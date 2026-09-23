# AI Capsule — Cloud-Deployed AI Prompt Manager

CSE3CWA / CSE5006 Assessment 3 · Nushal Dharmarathna (22158121)

AI Capsule is a private prompt library. A user signs in with GitHub, and the Express backend issues its own JWT in a `Secure`, `HttpOnly` cookie named `token`. The user can then create, read, update and delete their own prompt records ("capsules"). React, Express and SQLite run as **one Render web service at one public HTTPS URL**.

| | |
|---|---|
| **Deployed URL** | https://ai-capsule-nushal.onrender.com |
| **Cloud platform** | Render: Web Service (Node runtime, Free instance) |
| **Frontend** | React 19 + Vite + React Router |
| **Backend** | Node.js + Express 5 |
| **Auth** | GitHub OAuth (Authorization Code flow) → application JWT (`jsonwebtoken`, HS256) |
| **Database** | SQLite through Node's built-in `node:sqlite` module |

> On the free plan, the service sleeps after about 15 minutes without traffic. The first request after that can take up to a minute while it wakes up.

---

## 1. Project structure

```
ai-capsule/
├── package.json          # root: server dependencies + build/start/test scripts
├── .node-version         # Node 24 on Render
├── .env.example          # variable NAMES only (copy to .env locally)
├── server/
│   ├── index.js          # entry point: opens DB, starts Express
│   ├── app.js            # Express app: security headers, routes, serves React build
│   ├── config.js         # reads environment variables, fails fast if JWT_SECRET missing
│   ├── auth.js           # GitHub OAuth routes, JWT sign/verify, requireAuth middleware
│   ├── capsules.js       # GET/POST/PUT/DELETE /api/capsules (all use requireAuth)
│   ├── validation.js     # validates request bodies (ignores any user_id sent by the browser)
│   ├── db.js             # opens SQLite and runs schema.sql
│   └── schema.sql        # CREATE TABLE capsules ...
├── tests/
│   └── api.test.js       # 14 automated tests (node:test + supertest)
└── client/               # React app (Vite)
    ├── vite.config.js
    └── src/
        ├── api.js        # every fetch() call to Express lives here
        ├── App.jsx       # routes: /, /login, /dashboard
        ├── pages/        # Landing, Login, Dashboard, NotFound
        └── components/   # ProtectedRoute, CapsuleForm, CapsuleCard, Modal, ...
```

---

## 2. Install and run locally

Requirements: Node.js **22.13 or newer** (Node 24 LTS recommended). `node:sqlite` is built into Node, so no native build tools are needed.

```bash
# 1. install server dependencies
npm install

# 2. install client dependencies and build React into client/dist
npm run build

# 3. create your local environment file, then fill in the values
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env

# 4. start the app (Express serves the API and the React build)
npm start                     # -> http://localhost:3000

# 5. run the automated API tests
npm test
```

For local GitHub login, create a **separate** GitHub OAuth App with the callback URL `http://localhost:3000/api/auth/github/callback`. A GitHub OAuth App only accepts one callback URL, so local and Render each need their own app. Chrome, Edge and Firefox accept `Secure` cookies on `http://localhost`.

Optional hot-reload mode: run `npm run dev` (Express with `--watch`) and `npm run dev:client` (Vite on port 5173, which proxies `/api` to port 3000) in two terminals.

| Script | What it does |
|---|---|
| `npm start` | Starts Express on `PORT` (Render sets this automatically) |
| `npm run build` | `npm install` + `vite build` inside `client/` → `client/dist` |
| `npm test` | Runs `tests/api.test.js` with Node's built-in test runner |
| `npm run dev` / `npm run dev:client` | Local development with auto-restart / Vite dev server |

---

## 3. Deployment on Render

1. Push this repository to GitHub. `.gitignore` excludes `.env`, `node_modules`, `client/dist` and `*.db`.
2. In Render, go to **New → Web Service**, connect the repo and use these settings:

   | Setting | Value |
   |---|---|
   | Runtime | Node |
   | Build Command | `npm install && npm run build` |
   | Start Command | `npm start` |
   | Instance Type | Free |
   | Health Check Path | `/api/health` |

3. Create a GitHub OAuth App (GitHub → Settings → Developer settings → OAuth Apps):
   - Homepage URL: `https://ai-capsule-nushal.onrender.com`
   - Authorization callback URL: `https://ai-capsule-nushal.onrender.com/api/auth/github/callback`
4. Add the environment variables in Render → **Environment** (listed in section 6). Saving them redeploys the service.

Because React is served by the same Express app, the browser only talks to one origin. That means there is no CORS configuration, and the `token` cookie can stay `SameSite=Lax`.

---

## 4. Routes and how React talks to Express

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Landing page explaining AI Capsule |
| `/login` | Public | "Continue with GitHub" button that starts OAuth |
| `/dashboard` | Protected | The user's capsules and the CRUD UI |
| `GET /api/health` | Public | Returns `{ "status": "ok" }` |
| `GET /api/capsules` | JWT | Read the logged-in user's records |
| `POST /api/capsules` | JWT | Create a record owned by the logged-in user |
| `PUT /api/capsules/:id` | JWT | Update one of the user's own records |
| `DELETE /api/capsules/:id` | JWT | Delete one of the user's own records |
| `GET /api/auth/github/start` | Public | Redirects to GitHub's authorize page (with `state`) |
| `GET /api/auth/github/callback` | Public | GitHub redirects here; issues the app JWT |
| `GET /api/auth/me` | JWT | Returns the logged-in user (used by the React route guard) |
| `POST /api/auth/logout` | Public | Clears the `token` cookie |

**React → Express communication.** Every API call is in `client/src/api.js`, which uses `fetch()` with relative URLs such as `/api/capsules` and `credentials: 'same-origin'`. The frontend and API share an origin, so the browser attaches the HttpOnly `token` cookie automatically. React never reads, stores or sends the JWT itself: there is no `localStorage` and no `Authorization` header. JSON bodies are sent for POST and PUT. If any call returns 401, the dashboard redirects to `/login`.

**Protecting `/dashboard`.** The dashboard is protected in three places:

1. Express redirects `GET /dashboard` to `/login` unless the JWT cookie verifies (`server/app.js`).
2. The React `ProtectedRoute` calls `GET /api/auth/me` and redirects on 401.
3. The data itself comes only from the JWT-protected API.

---

## 5. OAuth and JWT: how the token is issued, stored and verified

OAuth provider: **GitHub OAuth App** (Authorization Code flow), following the Week 5 lab.

1. `/login` → the user clicks **Continue with GitHub** → `GET /api/auth/github/start`.
2. Express generates a random `state` (`crypto.randomBytes`) and stores it in a short-lived HttpOnly cookie. It then redirects to `https://github.com/login/oauth/authorize` with `client_id`, `redirect_uri`, `scope=read:user` and `state`.
3. GitHub redirects back to `/api/auth/github/callback?code=…&state=…`. Express rejects the request if `state` does not match the cookie, which protects against CSRF.
4. Express exchanges the `code` for a GitHub access token **server-to-server**, so `GITHUB_CLIENT_SECRET` never reaches the browser. It then calls `GET https://api.github.com/user`.
5. **Issued:** Express signs its **own application JWT** with `jsonwebtoken`: `jwt.sign({ sub: <GitHub user id>, login, name, avatar_url }, JWT_SECRET, { algorithm: 'HS256', expiresIn: 2h, issuer: 'ai-capsule' })`. The GitHub access token is only used to read the profile and is then discarded. It is **not** the JWT.
6. **Stored:** the JWT is set as a cookie named **`token`** with `HttpOnly` (JavaScript cannot read it), `Secure` (HTTPS only), `SameSite=Lax` (not sent on cross-site POST/PUT/DELETE) and `Max-Age` of 2 hours. The browser is then redirected to `/dashboard`.
7. **Verified:** `requireAuth` in `server/auth.js` reads `req.cookies.token` and calls `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], issuer: 'ai-capsule' })`. A missing, malformed, forged (wrong secret), wrong-algorithm or expired token gets **401 Unauthorized**, and no capsule data is returned. On success it sets `req.user = { id: payload.sub, ... }`.

All four capsule routes use the middleware explicitly (`server/capsules.js`):

```js
router.get('/',       requireAuth, ...);
router.post('/',      requireAuth, ...);
router.put('/:id',    requireAuth, ...);
router.delete('/:id', requireAuth, ...);
```

---

## 6. Environment variables (names only; values are never committed)

| Name | Used for |
|---|---|
| `JWT_SECRET` | Signs and verifies the application JWT. The server refuses to start if it is missing or shorter than 32 characters |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret (used only server-side) |
| `GITHUB_CALLBACK_URL` | `https://ai-capsule-nushal.onrender.com/api/auth/github/callback`. Must exactly match the OAuth App |
| `NODE_ENV` | `production` on Render |
| `PORT` | Set automatically by Render (defaults to 3000 locally) |
| `DB_PATH` | Optional path to the SQLite file (default `./data/capsules.db`) |

Locally these go in `.env`, which is git-ignored and loaded with Node's built-in `process.loadEnvFile()`. On Render they are set in **Environment**. `.env.example` contains names and placeholders only.

---

## 7. Database and storage

- **Creation:** on every start, `server/db.js` opens the SQLite file (it creates `data/` if needed) and runs `server/schema.sql`. That file contains `CREATE TABLE IF NOT EXISTS capsules (...)` plus an index on `user_id`. No manual setup step is needed.
- **Schema:** the table from the brief, plus `updated_at` (set on every PUT). `reviewed`/`improved` are stored as `0/1` and returned to React as booleans.
- **User ownership:** `capsules.user_id` stores the GitHub user ID taken from the **verified JWT** (`req.user.id`). The browser never sends it. `validation.js` only copies known fields, so a `user_id` in the request body is ignored. Every SQL statement filters by owner:
  - READ: `SELECT * FROM capsules WHERE user_id = ?`
  - UPDATE: `UPDATE capsules SET ... WHERE id = :id AND user_id = :user_id`
  - DELETE: `DELETE FROM capsules WHERE id = ? AND user_id = ?`

  If a user tries to update or delete someone else's record, 0 rows change and the API returns **404**. It returns 404 rather than 403 so other users' record IDs are not revealed. All queries use prepared statements with bound parameters, which prevents SQL injection.
- **Validation:** project name, prompt title and prompt text are required. Lengths are limited, category and usefulness must be one of the listed values, and the screenshot URL must be `http(s)://`, so a `javascript:` link cannot be stored.
- **Persistence on Render: EPHEMERAL.** The SQLite file is on the Free web service's local filesystem. That filesystem is reset whenever the service is **redeployed, restarted or spun down after inactivity**, so saved capsules can disappear. Persistent options: a Render Persistent Disk (paid) mounted with `DB_PATH=/var/data/capsules.db`, or a managed PostgreSQL database.

---

## 8. Required cURL tests (against the deployed URL)

On Windows PowerShell, type `curl.exe`, not `curl`. `curl` is an alias for `Invoke-WebRequest` there.

```powershell
# Test 1 - no authentication
curl.exe -i https://ai-capsule-nushal.onrender.com/api/capsules

# Test 2 - fake / invalid JWT
curl.exe -i -H "Cookie: token=fake-token-123" https://ai-capsule-nushal.onrender.com/api/capsules
```

**Results obtained** (run on 23 September 2026 against the deployed service; headers trimmed):

```
Test 1 - no authentication
HTTP/1.1 401 Unauthorized
Date: Wed, 23 Sep 2026 03:09:15 GMT
Content-Type: application/json; charset=utf-8
x-render-origin-server: Render
...
{"error":"Unauthorized","message":"Authentication required. Please log in."}

Test 2 - fake / invalid JWT (token=fake-token-123)
HTTP/1.1 401 Unauthorized
Date: Wed, 23 Sep 2026 03:10:41 GMT
Content-Type: application/json; charset=utf-8
x-render-origin-server: Render
...
{"error":"Unauthorized","message":"Invalid or expired token. Please log in again."}
```

Test 1 shows the API requires authentication. Test 2 shows the backend actually verifies the JWT signature rather than only checking that a cookie exists: a cookie named `token` is present, but its value is not a valid JWT, so the request is still rejected. Neither response contains any capsule data.

`GET /api/health` returns `{"status":"ok"}`.

---

## 9. Testing and verification

`npm test` runs 14 automated tests against an in-memory database:

- `/api/health` is public and returns exactly `{ "status": "ok" }`.
- GET, POST, PUT and DELETE on `/api/capsules` all return 401 with no cookie, with `token=fake-token-123`, with a JWT signed by a different secret, with an expired JWT, and with a JWT sent as a Bearer header instead of the cookie.
- The full CRUD cycle works. User B cannot see, update or delete user A's record (404), and a `user_id` in the request body is ignored.
- `/api/auth/github/start` redirects to GitHub with a `state` that matches an HttpOnly cookie. A callback with the wrong `state` is rejected.
- A successful callback (with GitHub's API mocked) sets a cookie named `token` with `HttpOnly`, `Secure` and `SameSite=Lax`. Its value is our JWT, not the GitHub token, and `sub` is the GitHub user ID.

Manual verification on the deployed site: GitHub login → dashboard; create, reload (READ from the server), edit, delete. `document.cookie` in the browser console does not show `token`, which confirms it is HttpOnly. Both cURL tests return 401. Logging in with a second GitHub account shows an empty list.

---

## 10. Limitations

- **Ephemeral storage:** on Render Free, the SQLite data is lost on redeploy, restart or spin-down (see section 7).
- **Cold starts:** the free instance sleeps when idle, so the first request can take up to about a minute.
- **No refresh token or server-side logout list:** the JWT is valid for 2 hours. Logging out deletes the cookie, but a copied token would still be valid until it expires.
- Screenshot evidence is a URL only; file upload is not implemented.

---

## 11. AI-assisted development statement

> ✏️ Read this through and adjust anything that doesn't match what you did — you need to be able to explain it.

- **AI tool used:** Claude (Anthropic).
- **What it helped with:** generating the project structure, the Express routes and JWT middleware, the React components and CSS, the automated tests, and drafting this README.
- **What I did myself:** created the GitHub repository and pushed the code; created the Render web service and chose its build command, start command, instance type and health check path; registered the GitHub OAuth App and set its homepage and callback URLs; generated and configured all environment variables in Render; deployed and debugged the live service; ran the two cURL tests against the deployed URL; signed in with my GitHub account and tested the full CRUD cycle on the deployed dashboard; and reviewed the code and README.
- **A problem found and corrected in AI-generated code/configuration:** after the first successful deploy, clicking "Continue with GitHub" returned "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and GITHUB_CALLBACK_URL." The deployment instructions had me create the Render service before the GitHub OAuth App, so only `NODE_ENV` and `JWT_SECRET` had been set. The application deliberately fails with that message instead of redirecting to GitHub with an empty `client_id`. I fixed it by registering the OAuth App with the callback URL `https://ai-capsule-nushal.onrender.com/api/auth/github/callback`, adding `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `GITHUB_CALLBACK_URL` in Render → Environment, and redeploying. The callback URL has to match the OAuth App exactly, or GitHub rejects the login with "redirect_uri is not associated with this application".
- **How OAuth login, JWT verification and protected API behaviour were verified:** the two cURL tests in section 8 both returned 401 against the deployed URL — the second proves the signature is actually verified, because a cookie named `token` is present but invalid. I then completed a real GitHub login on the deployed site and reached the protected dashboard, and confirmed in the browser console that `document.cookie` does not contain the token, because it is HttpOnly. `npm test` runs 14 automated tests covering the same behaviour, including a JWT signed with a different secret, an expired JWT, and a token sent as an `Authorization: Bearer` header instead of the cookie.
- **How CRUD behaviour and user data ownership were verified:** I created, edited and deleted capsules on the deployed dashboard and reloaded the page each time, so the list came back from `GET /api/capsules` rather than from browser state. Ownership is enforced server-side: `user_id` comes from the verified JWT and every SQL statement filters by it, so an update or delete of another user's record changes 0 rows and returns 404. The automated tests cover this with two different users.
- **An implementation/deployment decision I can explain:** serving the built React app from the same Express service on one Render URL, instead of deploying the frontend and backend separately. Because the browser only talks to one origin, there is no CORS configuration and the `token` cookie can stay `SameSite=Lax` rather than needing `SameSite=None` for cross-site requests, which also keeps it protected against cross-site request forgery. It also means one build command, one deploy and one URL to test. The trade-off is that the frontend and backend cannot be scaled or redeployed independently, which does not matter at this size.
