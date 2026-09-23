// Validates and normalises the body of POST / PUT /api/capsules.
// Only the fields listed here are accepted. Anything else in the body -
// including user_id, id or created_at - is ignored, so the browser can
// never choose which user owns a record.

export const CATEGORIES = ['Coding', 'Debugging', 'Writing', 'Research', 'Study', 'Design', 'Other'];
export const USEFULNESS = ['Very Useful', 'Good', 'Needs Improvement', 'Not Useful'];

const MAX_LENGTH = {
  project_name: 100,
  prompt_title: 120,
  prompt_version: 20,
  prompt_text: 5000,
  response_summary: 3000,
  screenshot_url: 500,
  notes: 2000,
};

const LABELS = {
  project_name: 'Project name',
  prompt_title: 'Prompt title',
  prompt_version: 'Prompt version',
  prompt_text: 'Prompt text',
  response_summary: 'Response summary',
  screenshot_url: 'Screenshot URL',
  notes: 'Notes',
};

function text(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function toFlag(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'yes' ? 1 : 0;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateCapsule(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['Request body must be a JSON object.'], data: null };
  }

  const errors = [];
  const data = {};

  for (const field of Object.keys(MAX_LENGTH)) {
    data[field] = text(body[field]);
    if (data[field].length > MAX_LENGTH[field]) {
      errors.push(`${LABELS[field]} must be ${MAX_LENGTH[field]} characters or fewer.`);
    }
  }

  for (const field of ['project_name', 'prompt_title', 'prompt_text']) {
    if (!data[field]) errors.push(`${LABELS[field]} is required.`);
  }

  data.category = text(body.category);
  if (data.category && !CATEGORIES.includes(data.category)) {
    errors.push(`Category must be one of: ${CATEGORIES.join(', ')}.`);
  }

  data.usefulness = text(body.usefulness);
  if (data.usefulness && !USEFULNESS.includes(data.usefulness)) {
    errors.push(`Usefulness must be one of: ${USEFULNESS.join(', ')}.`);
  }

  // Only allow http(s) links so a stored value can never become a
  // "javascript:" link when it is rendered in the dashboard.
  if (data.screenshot_url && !isHttpUrl(data.screenshot_url)) {
    errors.push('Screenshot URL must start with http:// or https://.');
  }

  data.reviewed = toFlag(body.reviewed);
  data.improved = toFlag(body.improved);

  // Store empty optional fields as NULL rather than ''.
  for (const field of ['prompt_version', 'response_summary', 'screenshot_url', 'notes', 'category', 'usefulness']) {
    if (data[field] === '') data[field] = null;
  }

  return { errors, data };
}
