/**
 * OpenCERN CLI Auth Worker
 *
 * Implements the device-code authentication flow for the CLI:
 *   POST /auth/cli/init     → Generate auth code, store in KV (5min TTL)
 *   GET  /auth/cli/poll     → Poll for authorization status
 *   POST /auth/cli/revoke   → Revoke/delete token
 *
 * KV Namespace: CLI_AUTH_CODES
 * Binding: CLI_AUTH_CODES (in wrangler.toml)
 */

export interface Env {
  CLI_AUTH_CODES: KVNamespace;
  JWT_SECRET: string;           // Secret for signing CLI JWTs
  CLERK_SECRET_KEY?: string;    // Optional Clerk integration
}

interface CodeEntry {
  code: string;
  status: 'pending' | 'authorized' | 'expired';
  token?: string;
  username?: string;
  createdAt: string;
}

const CODE_TTL_SECONDS = 300; // 5 minutes

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars
  const segments = [4, 4];
  return segments.map(len =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  ).join('-');
}

async function signToken(username: string, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    iss: 'opencern-cli',
  };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const data = `${encode(header)}.${encode(payload)}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${data}.${sigB64}`;
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // POST /auth/cli/init — Start device code flow
    if (method === 'POST' && url.pathname === '/auth/cli/init') {
      const code = generateCode();
      const entry: CodeEntry = {
        code,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await env.CLI_AUTH_CODES.put(code, JSON.stringify(entry), {
        expirationTtl: CODE_TTL_SECONDS,
      });

      const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();

      return json({
        code,
        expiresAt,
        pollUrl: `/auth/cli/poll?code=${code}`,
        authUrl: `https://app.opencern.io/auth/cli?code=${code}`,
      });
    }

    // GET /auth/cli/poll?code=XXXX — Check authorization status
    if (method === 'GET' && url.pathname === '/auth/cli/poll') {
      const code = url.searchParams.get('code');
      if (!code) return json({ error: 'Missing code' }, 400);

      const raw = await env.CLI_AUTH_CODES.get(code);
      if (!raw) return json({ status: 'expired' });

      const entry: CodeEntry = JSON.parse(raw);
      return json({ status: entry.status, token: entry.token, username: entry.username });
    }

    // POST /auth/cli/authorize — Called by web UI when user clicks "Authorize"
    // (Protected: requires Clerk session cookie or valid Clerk JWT)
    if (method === 'POST' && url.pathname === '/auth/cli/authorize') {
      let body: { code: string; username: string };
      try {
        body = await request.json() as { code: string; username: string };
      } catch {
        return json({ error: 'Invalid request body' }, 400);
      }

      const { code, username } = body;
      if (!code || !username) return json({ error: 'Missing code or username' }, 400);

      const raw = await env.CLI_AUTH_CODES.get(code);
      if (!raw) return json({ error: 'Code expired or not found' }, 404);

      const entry: CodeEntry = JSON.parse(raw);
      if (entry.status !== 'pending') return json({ error: 'Code already used' }, 409);

      // Issue CLI JWT
      const token = await signToken(username, env.JWT_SECRET);

      // Update KV entry with token
      entry.status = 'authorized';
      entry.token = token;
      entry.username = username;

      await env.CLI_AUTH_CODES.put(code, JSON.stringify(entry), {
        expirationTtl: 60, // Token can only be polled for 60s after authorization
      });

      return json({ ok: true });
    }

    // POST /auth/cli/revoke — Invalidate token (called on logout)
    if (method === 'POST' && url.pathname === '/auth/cli/revoke') {
      const code = url.searchParams.get('code');
      if (code) {
        await env.CLI_AUTH_CODES.delete(code);
      }
      return json({ ok: true });
    }

    // GET /auth/cli?code=XXXX — Serve inline HTML auth page
    if (method === 'GET' && url.pathname === '/auth/cli') {
      const code = url.searchParams.get('code');
      if (!code) {
        return new Response('Missing code parameter', { status: 400, headers: corsHeaders() });
      }

      const raw = await env.CLI_AUTH_CODES.get(code);
      if (!raw) {
        return new Response(renderAuthPage(code, 'expired'), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders() },
        });
      }

      const entry: CodeEntry = JSON.parse(raw);
      return new Response(renderAuthPage(code, entry.status), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders() },
      });
    }

    return json({ error: 'Not found' }, 404);
  },
};

function renderAuthPage(code: string, status: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OpenCERN CLI Authorization</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,monospace;
    background:#0a0a0f;color:#e0e0e0;min-height:100vh;
    display:flex;align-items:center;justify-content:center}
  .card{background:#12121a;border:1px solid #1e1e2e;border-radius:12px;
    padding:40px;max-width:420px;width:100%;text-align:center}
  .logo{font-size:14px;font-family:monospace;color:#4a9eff;margin-bottom:24px;
    line-height:1.2;white-space:pre}
  h1{font-size:20px;font-weight:600;margin-bottom:8px;color:#fff}
  .subtitle{color:#888;font-size:14px;margin-bottom:32px}
  .code-display{background:#1a1a2e;border:1px solid #2a2a3e;border-radius:8px;
    padding:16px;margin-bottom:24px}
  .code-label{font-size:12px;color:#888;text-transform:uppercase;
    letter-spacing:1px;margin-bottom:8px}
  .code-value{font-size:28px;font-weight:700;font-family:monospace;
    color:#4a9eff;letter-spacing:4px}
  .input-group{margin-bottom:16px;text-align:left}
  .input-group label{display:block;font-size:12px;color:#888;
    text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
  .input-group input{width:100%;padding:10px 14px;background:#1a1a2e;
    border:1px solid #2a2a3e;border-radius:6px;color:#fff;font-size:14px;
    outline:none;transition:border-color 0.2s}
  .input-group input:focus{border-color:#4a9eff}
  .btn{width:100%;padding:12px;background:#4a9eff;color:#fff;border:none;
    border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;
    transition:background 0.2s;margin-top:8px}
  .btn:hover{background:#3a8eef}
  .btn:disabled{background:#333;color:#666;cursor:not-allowed}
  .status{margin-top:16px;padding:12px;border-radius:6px;font-size:14px}
  .status.success{background:#0a2e1a;border:1px solid #1a4e2a;color:#4ade80}
  .status.error{background:#2e0a0a;border:1px solid #4e1a1a;color:#f87171}
  .status.expired{background:#2e1a0a;border:1px solid #4e2a1a;color:#fbbf24}
  .footer{margin-top:24px;font-size:12px;color:#555}
  .hidden{display:none}
</style>
</head>
<body>
<div class="card">
  <div class="logo"> ___                    ____ _____ ____  _   _
/ _ \\ _ __   ___ _ __  / ___| ____|  _ \\| \\ | |
| | | | '_ \\ / _ \\ '_ \\| |   |  _| | |_) |  \\| |
| |_| | |_) |  __/ | | | |___| |___|  _ <| |\\  |
 \\___/| .__/ \\___|_| |_|\\____|_____|_| \\_\\_| \\_|
      |_|</div>
  <h1>CLI Authorization</h1>
  <p class="subtitle">Authorize the OpenCERN CLI to access your account</p>

  <div class="code-display">
    <div class="code-label">Device Code</div>
    <div class="code-value">${code}</div>
  </div>

  <div id="form-section" class="${status === 'authorized' || status === 'expired' ? 'hidden' : ''}">
    <div class="input-group">
      <label for="username">Username</label>
      <input type="text" id="username" placeholder="Enter your username" autocomplete="username">
    </div>
    <button class="btn" id="auth-btn" onclick="authorize()">Authorize CLI</button>
  </div>

  <div id="status-msg" class="${status === 'authorized' ? 'status success' : status === 'expired' ? 'status expired' : 'hidden'}">
    ${status === 'authorized' ? 'CLI authorized. You can close this page.' : ''}
    ${status === 'expired' ? 'This code has expired. Please run /login again in the CLI.' : ''}
  </div>

  <div class="footer">This page authorizes a one-time CLI session token.</div>
</div>

<script>
async function authorize() {
  const username = document.getElementById('username').value.trim();
  if (!username) { document.getElementById('username').focus(); return; }

  const btn = document.getElementById('auth-btn');
  btn.disabled = true;
  btn.textContent = 'Authorizing...';

  try {
    const res = await fetch('/auth/cli/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '${code}', username })
    });
    const data = await res.json();

    const statusEl = document.getElementById('status-msg');
    if (res.ok && data.ok) {
      statusEl.className = 'status success';
      statusEl.textContent = 'CLI authorized successfully! You can close this page and return to the terminal.';
      document.getElementById('form-section').classList.add('hidden');
    } else {
      statusEl.className = 'status error';
      statusEl.textContent = data.error || 'Authorization failed. Please try again.';
      btn.disabled = false;
      btn.textContent = 'Authorize CLI';
    }
    statusEl.classList.remove('hidden');
  } catch (e) {
    const statusEl = document.getElementById('status-msg');
    statusEl.className = 'status error';
    statusEl.textContent = 'Network error. Please check your connection.';
    statusEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Authorize CLI';
  }
}

document.getElementById('username').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') authorize();
});
</script>
</body>
</html>`;
}
