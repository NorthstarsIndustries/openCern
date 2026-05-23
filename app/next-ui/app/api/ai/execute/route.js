import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { auth } from '@clerk/nextjs/server';

const execFileAsync = promisify(execFile);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Loopback / "localhost" addresses we accept. Anything else is rejected
// unless OPENCERN_AI_EXECUTE_ALLOW_REMOTE is explicitly set to "true".
const LOOPBACK = new Set([
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
  'localhost',
]);

function clientAddress(request) {
  // Next.js routes don't expose a connection IP directly. We accept the
  // standard proxy headers and the request URL host as fallbacks.
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  try {
    return new URL(request.url).hostname;
  } catch {
    return '';
  }
}

function denyResponse(reason, status = 403) {
  return Response.json({ error: reason }, { status });
}

export async function POST(request) {
  // ── Hard kill switch: disabled by default in production. ─────────────
  // The endpoint executes arbitrary Python/bash on the host process. It
  // exists to back a local AI assistant; it must not be exposed publicly.
  // Operators who genuinely need it in production must opt in explicitly.
  const isProduction = process.env.NODE_ENV === 'production';
  const explicitlyAllowed =
    process.env.OPENCERN_AI_EXECUTE_ENABLED === 'true';
  if (isProduction && !explicitlyAllowed) {
    return new Response('Not Found', { status: 404 });
  }

  // ── Loopback-only by default. ────────────────────────────────────────
  const allowRemote =
    process.env.OPENCERN_AI_EXECUTE_ALLOW_REMOTE === 'true';
  if (!allowRemote) {
    const addr = clientAddress(request);
    if (!LOOPBACK.has(addr)) {
      return denyResponse('Execute endpoint is restricted to loopback');
    }
  }

  // ── Auth gate. ───────────────────────────────────────────────────────
  // Even on loopback we require a signed-in Clerk session, so a stray
  // local process can't drive code execution by accident.
  let userId = null;
  try {
    const session = await auth();
    userId = session?.userId ?? null;
  } catch {
    userId = null;
  }
  if (!userId) {
    return denyResponse('Authentication required', 401);
  }

  try {
    const { toolName, toolInput } = await request.json();
    if (!toolName || !toolInput) {
      return Response.json(
        { error: 'Missing toolName or toolInput' },
        { status: 400 },
      );
    }

    let output = '';
    let hasError = false;
    const images = [];
    const workDir = path.join(os.tmpdir(), `opencern-run-${Date.now()}`);
    fs.mkdirSync(workDir, { recursive: true });

    try {
      if (toolName === 'execute_python') {
        const code = toolInput.code;
        if (!code) {
          return Response.json(
            { error: 'Missing python code' },
            { status: 400 },
          );
        }
        // Pass workDir via env so we don't interpolate it into Python source.
        const preamble = [
          'import warnings, os',
          "warnings.filterwarnings('ignore')",
          "_OPENCERN_OUT = os.environ['OPENCERN_OUT_DIR']",
        ].join('\n');
        const epilogue = [
          'try:',
          '    import matplotlib.pyplot as plt',
          '    if plt.get_fignums():',
          "        plt.savefig(os.path.join(_OPENCERN_OUT, 'output.png'), bbox_inches='tight', dpi=150)",
          "        print('\\n[OPENCERN_IMAGE_GENERATED: output.png]')",
          'except Exception:',
          '    pass',
        ].join('\n');
        const scriptPath = path.join(workDir, 'script.py');
        fs.writeFileSync(
          scriptPath,
          `${preamble}\n${code}\n${epilogue}\n`,
        );
        const { stdout, stderr } = await execFileAsync('python3', [scriptPath], {
          cwd: workDir,
          timeout: 60000,
          maxBuffer: 1024 * 1024,
          env: { ...process.env, OPENCERN_OUT_DIR: workDir },
        });
        output = stdout + (stderr ? `\n--- STDERR ---\n${stderr}` : '');
        const imgPath = path.join(workDir, 'output.png');
        if (fs.existsSync(imgPath)) {
          const base64Image = fs.readFileSync(imgPath, 'base64');
          images.push(`data:image/png;base64,${base64Image}`);
        }
      } else if (toolName === 'execute_bash') {
        // Bash requires shell semantics, which is the actual risk. We run
        // through `bash -lc <cmd>` but only after the auth + loopback gates
        // above, so the attacker model here is "authenticated local user."
        // The blocklist is best-effort defense in depth, not the primary
        // boundary.
        const command = toolInput.command;
        if (!command) {
          return Response.json(
            { error: 'Missing bash command' },
            { status: 400 },
          );
        }
        const blocked = [
          'rm -rf /',
          'mkfs',
          'dd if=',
          ':(){',
          'shutdown',
          'reboot',
        ];
        if (blocked.some((b) => command.includes(b))) {
          return Response.json(
            { error: 'Command blocked by security policy.' },
            { status: 403 },
          );
        }
        const { stdout, stderr } = await execFileAsync('bash', ['-lc', command], {
          cwd: process.cwd(),
          timeout: 60000,
          maxBuffer: 1024 * 1024,
        });
        output = stdout + (stderr ? `\n--- STDERR ---\n${stderr}` : '');
      } else if (toolName === 'opencern_cli') {
        const args = String(toolInput.args || '');
        output =
          `Command received: opencern ${args}\n\n` +
          'The local OpenCERN CLI integration is under active development. ' +
          'Dataset downloading is not yet available in the chat agent. ' +
          'Please use the Electron UI to download data.';
      } else {
        return Response.json(
          { error: `Unknown tool: ${toolName}` },
          { status: 400 },
        );
      }
    } catch (err) {
      hasError = true;
      const e = err || {};
      output =
        (e.stdout?.toString?.() || '') +
        (e.stderr ? `\n--- STDERR ---\n${e.stderr}` : '') +
        `\nError: ${e.message || String(err)}`;
    } finally {
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {}
    }

    if (output.length > 5000) {
      output =
        output.substring(0, 5000) + '\n...[Output truncated due to length]';
    }

    return Response.json({
      success: !hasError,
      output:
        output.trim() || '(Command executed successfully with no output)',
      images,
    });
  } catch (err) {
    // Don't leak the raw error message to the caller.
    console.error('ai/execute internal error', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
