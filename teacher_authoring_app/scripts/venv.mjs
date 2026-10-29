// Runs a tool from graph_validator/.venv on any OS (bin/ on Linux/macOS, Scripts\ on Windows).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const venv = resolve(import.meta.dirname, '../../graph_validator/.venv');
const bin = join(venv, process.platform === 'win32' ? 'Scripts' : 'bin');
const [tool, ...args] = process.argv.slice(2);
const exe = join(bin, process.platform === 'win32' ? `${tool}.exe` : tool);
if (!existsSync(exe)) {
  console.error(`${exe} não encontrado. Crie o ambiente: cd graph_validator && python -m venv .venv && pip install -e ".[dev]"`);
  process.exit(1);
}
spawn(exe, args, { stdio: 'inherit' }).on('exit', (code) => process.exit(code ?? 1));
