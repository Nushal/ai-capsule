// CRUD routes for prompt records, mounted at /api/capsules.
//
// Every route uses the requireAuth JWT middleware, and every SQL statement
// includes "user_id = ?" with the ID taken from the VERIFIED JWT (req.user.id).
// A user can therefore only ever read, change or delete their own records.
import express from 'express';
import { requireAuth } from './auth.js';
import { validateCapsule } from './validation.js';

// Convert a database row into the JSON sent to the browser.
function toCapsule(row) {
  return {
    ...row,
    id: Number(row.id),
    reviewed: row.reviewed === 1,
    improved: row.improved === 1,
  };
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function createCapsulesRouter(db) {
  const router = express.Router();

  const statements = {
    listForUser: db.prepare(
      'SELECT * FROM capsules WHERE user_id = ? ORDER BY created_at DESC, id DESC'
    ),
    getForUser: db.prepare('SELECT * FROM capsules WHERE id = ? AND user_id = ?'),
    insert: db.prepare(`
      INSERT INTO capsules
        (user_id, project_name, prompt_title, prompt_version, prompt_text, response_summary,
         category, usefulness, reviewed, improved, screenshot_url, notes)
      VALUES
        (:user_id, :project_name, :prompt_title, :prompt_version, :prompt_text, :response_summary,
         :category, :usefulness, :reviewed, :improved, :screenshot_url, :notes)
    `),
    update: db.prepare(`
      UPDATE capsules SET
        project_name = :project_name,
        prompt_title = :prompt_title,
        prompt_version = :prompt_version,
        prompt_text = :prompt_text,
        response_summary = :response_summary,
        category = :category,
        usefulness = :usefulness,
        reviewed = :reviewed,
        improved = :improved,
        screenshot_url = :screenshot_url,
        notes = :notes,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = :id AND user_id = :user_id
    `),
    remove: db.prepare('DELETE FROM capsules WHERE id = ? AND user_id = ?'),
  };

  // READ - only the logged-in user's records
  router.get('/', requireAuth, (req, res) => {
    const rows = statements.listForUser.all(req.user.id);
    res.json(rows.map(toCapsule));
  });

  // CREATE - owner is always the logged-in user
  router.post('/', requireAuth, (req, res) => {
    const { errors, data } = validateCapsule(req.body);
    if (errors.length) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    const result = statements.insert.run({ ...data, user_id: req.user.id });
    const created = statements.getForUser.get(Number(result.lastInsertRowid), req.user.id);
    return res.status(201).json(toCapsule(created));
  });

  // UPDATE - only if the record belongs to the logged-in user
  router.put('/:id', requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid capsule id' });

    const { errors, data } = validateCapsule(req.body);
    if (errors.length) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    const result = statements.update.run({ ...data, id, user_id: req.user.id });
    if (result.changes === 0) {
      // Either it does not exist or it belongs to someone else. We return 404
      // in both cases so other users' record IDs are not revealed.
      return res.status(404).json({ error: 'Capsule not found' });
    }
    return res.json(toCapsule(statements.getForUser.get(id, req.user.id)));
  });

  // DELETE - only if the record belongs to the logged-in user
  router.delete('/:id', requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid capsule id' });

    const result = statements.remove.run(id, req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Capsule not found' });
    }
    return res.json({ message: 'Capsule deleted', id });
  });

  return router;
}
