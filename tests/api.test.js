// Automated API tests: run with `npm test`.
// Uses Node's built-in test runner + supertest against an in-memory SQLite DB.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Test-only configuration (set BEFORE importing the app).
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
process.env.GITHUB_CALLBACK_URL = 'http://localhost:3000/api/auth/github/callback';

const { openDatabase } = await import('../server/db.js');
const { createApp } = await import('../server/app.js');
const { signAppToken } = await import('../server/auth.js');

const app = createApp({ db: openDatabase(':memory:') });

const alice = { id: 1001, login: 'alice', name: 'Alice' };
const bob = { id: 2002, login: 'bob', name: 'Bob' };
const cookieFor = (user) => `token=${signAppToken(user)}`;

const sample = {
  project_name: 'SmartFarm Irrigation',
  prompt_title: 'Debug cloud deployment',
  prompt_version: 'v1',
  prompt_text: 'Why does my Node server fail on Render?',
  response_summary: 'Check the start command',
  category: 'Coding',
  usefulness: 'Good',
  reviewed: true,
  improved: false,
  screenshot_url: 'https://example.com/shot.png',
  notes: 'Tested and worked',
};

// ------------------------------------------------------------------ public
test('GET /api/health is public and returns { status: "ok" }', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

// ------------------------------------------------------- 401 protection
test('cURL Test 1: GET /api/capsules without a token -> 401', async () => {
  const res = await request(app).get('/api/capsules');
  assert.equal(res.status, 401);
  assert.equal(Array.isArray(res.body), false);
});

test('cURL Test 2: GET /api/capsules with token=fake-token-123 -> 401', async () => {
  const res = await request(app).get('/api/capsules').set('Cookie', 'token=fake-token-123');
  assert.equal(res.status, 401);
});

test('JWT signed with a different secret -> 401', async () => {
  const forged = jwt.sign({ sub: '1001' }, 'some-other-secret-that-is-long-enough-000', { issuer: 'ai-capsule' });
  const res = await request(app).get('/api/capsules').set('Cookie', `token=${forged}`);
  assert.equal(res.status, 401);
});

test('Expired JWT -> 401', async () => {
  const expired = jwt.sign({ sub: '1001', exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET, {
    issuer: 'ai-capsule',
  });
  const res = await request(app).get('/api/capsules').set('Cookie', `token=${expired}`);
  assert.equal(res.status, 401);
});

test('JWT in an Authorization header is NOT accepted (cookie only)', async () => {
  const res = await request(app).get('/api/capsules').set('Authorization', `Bearer ${signAppToken(alice)}`);
  assert.equal(res.status, 401);
});

test('POST, PUT and DELETE are also protected -> 401 without a token', async () => {
  assert.equal((await request(app).post('/api/capsules').send(sample)).status, 401);
  assert.equal((await request(app).put('/api/capsules/1').send(sample)).status, 401);
  assert.equal((await request(app).delete('/api/capsules/1')).status, 401);
  assert.equal((await request(app).put('/api/capsules/1').set('Cookie', 'token=fake').send(sample)).status, 401);
  assert.equal((await request(app).delete('/api/capsules/1').set('Cookie', 'token=fake')).status, 401);
});

// ---------------------------------------------------- CRUD + ownership
test('full CRUD cycle and per-user ownership', async () => {
  // CREATE (the user_id in the body must be ignored)
  const created = await request(app)
    .post('/api/capsules')
    .set('Cookie', cookieFor(alice))
    .send({ ...sample, user_id: '2002' });
  assert.equal(created.status, 201);
  assert.equal(created.body.user_id, '1001');
  assert.equal(created.body.prompt_title, sample.prompt_title);
  assert.equal(created.body.reviewed, true);
  assert.equal(created.body.improved, false);
  assert.ok(created.body.created_at);
  const id = created.body.id;

  // READ (owner sees it, another user does not)
  const aliceList = await request(app).get('/api/capsules').set('Cookie', cookieFor(alice));
  assert.equal(aliceList.status, 200);
  assert.equal(aliceList.body.length, 1);
  const bobList = await request(app).get('/api/capsules').set('Cookie', cookieFor(bob));
  assert.equal(bobList.status, 200);
  assert.equal(bobList.body.length, 0);

  // UPDATE by another user -> 404, record unchanged
  const bobUpdate = await request(app)
    .put(`/api/capsules/${id}`)
    .set('Cookie', cookieFor(bob))
    .send({ ...sample, prompt_title: 'hacked' });
  assert.equal(bobUpdate.status, 404);

  // UPDATE by owner
  const updated = await request(app)
    .put(`/api/capsules/${id}`)
    .set('Cookie', cookieFor(alice))
    .send({ ...sample, prompt_version: 'v2', improved: true });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.prompt_version, 'v2');
  assert.equal(updated.body.improved, true);
  assert.equal(updated.body.prompt_title, sample.prompt_title);
  assert.ok(updated.body.updated_at);

  // DELETE by another user -> 404, record still there
  const bobDelete = await request(app).delete(`/api/capsules/${id}`).set('Cookie', cookieFor(bob));
  assert.equal(bobDelete.status, 404);
  assert.equal((await request(app).get('/api/capsules').set('Cookie', cookieFor(alice))).body.length, 1);

  // DELETE by owner
  const deleted = await request(app).delete(`/api/capsules/${id}`).set('Cookie', cookieFor(alice));
  assert.equal(deleted.status, 200);
  assert.equal((await request(app).get('/api/capsules').set('Cookie', cookieFor(alice))).body.length, 0);
});

test('validation: required fields, enums and safe screenshot URLs', async () => {
  const missing = await request(app)
    .post('/api/capsules')
    .set('Cookie', cookieFor(alice))
    .send({ project_name: 'X' });
  assert.equal(missing.status, 400);
  assert.ok(missing.body.details.some((m) => m.includes('Prompt title')));
  assert.ok(missing.body.details.some((m) => m.includes('Prompt text')));

  const badUrl = await request(app)
    .post('/api/capsules')
    .set('Cookie', cookieFor(alice))
    .send({ ...sample, screenshot_url: 'javascript:alert(1)' });
  assert.equal(badUrl.status, 400);

  const badCategory = await request(app)
    .post('/api/capsules')
    .set('Cookie', cookieFor(alice))
    .send({ ...sample, category: 'Nope' });
  assert.equal(badCategory.status, 400);

  const badId = await request(app).put('/api/capsules/abc').set('Cookie', cookieFor(alice)).send(sample);
  assert.equal(badId.status, 400);
});

// ------------------------------------------------------------ OAuth flow
test('GET /api/auth/github/start redirects to GitHub with a state cookie', async () => {
  const res = await request(app).get('/api/auth/github/start');
  assert.equal(res.status, 302);
  const location = new URL(res.headers.location);
  assert.equal(location.origin + location.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(location.searchParams.get('client_id'), 'test-client-id');
  const stateCookie = res.headers['set-cookie'].find((c) => c.startsWith('oauth_state='));
  assert.ok(stateCookie.includes(location.searchParams.get('state')));
  assert.match(stateCookie, /HttpOnly/);
});

test('callback with a mismatched state is rejected', async () => {
  const res = await request(app)
    .get('/api/auth/github/callback?code=abc&state=attacker')
    .set('Cookie', 'oauth_state=real-state');
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, '/login?error=invalid_state');
  assert.ok(!(res.headers['set-cookie'] || []).some((c) => c.startsWith('token=ey')));
});

test('successful callback issues our own JWT in a Secure HttpOnly cookie named token', async (t) => {
  // Fake GitHub's two API responses.
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).includes('/login/oauth/access_token')) {
      return new Response(JSON.stringify({ access_token: 'gho_github_access_token' }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: 424242, login: 'octo', name: 'Octo Cat' }), { status: 200 });
  });

  const res = await request(app)
    .get('/api/auth/github/callback?code=good-code&state=s1')
    .set('Cookie', 'oauth_state=s1');
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, '/dashboard');

  const tokenCookie = res.headers['set-cookie'].find((c) => c.startsWith('token='));
  assert.ok(tokenCookie, 'token cookie set');
  assert.match(tokenCookie, /HttpOnly/);
  assert.match(tokenCookie, /Secure/);
  assert.match(tokenCookie, /SameSite=Lax/);

  const value = tokenCookie.split(';')[0].slice('token='.length);
  assert.notEqual(value, 'gho_github_access_token'); // not the GitHub token
  const payload = jwt.verify(value, process.env.JWT_SECRET);
  assert.equal(payload.sub, '424242');
  assert.equal(payload.login, 'octo');

  const me = await request(app).get('/api/auth/me').set('Cookie', `token=${value}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.id, '424242');
});

test('logout clears the token cookie', async () => {
  const res = await request(app).post('/api/auth/logout');
  assert.equal(res.status, 200);
  assert.ok(res.headers['set-cookie'].some((c) => c.startsWith('token=;')));
});

test('unknown /api route returns JSON 404', async () => {
  const res = await request(app).get('/api/nope');
  assert.equal(res.status, 404);
});
