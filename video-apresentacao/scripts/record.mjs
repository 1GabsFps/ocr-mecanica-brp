// Grava a apresentação Framer Motion em vídeo (.webm 1920x1080) usando Playwright.
// Uso: npm run record   (sobe o Vite automaticamente se não estiver rodando)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const URL = 'http://localhost:5199/?record';
const OUT_DIR = resolve('output');
const TMP_DIR = join(OUT_DIR, '.tmp');

async function isUp() {
  try { return (await fetch('http://localhost:5199')).ok; } catch { return false; }
}

let server;
if (!(await isUp())) {
  console.log('▶ Iniciando Vite...');
  server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', '5199', '--strictPort'], { stdio: 'ignore', shell: true });
  for (let k = 0; k < 60 && !(await isUp()); k++) await new Promise((r) => setTimeout(r, 500));
}

mkdirSync(TMP_DIR, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: { dir: TMP_DIR, size: { width: 1920, height: 1080 } },
});
const page = await context.newPage();
console.log('● Gravando...');
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__videoDone === true, null, { timeout: 5 * 60_000, polling: 250 });
await page.waitForTimeout(1500);
await context.close();
await browser.close();

const file = readdirSync(TMP_DIR).find((f) => f.endsWith('.webm'));
const target = join(OUT_DIR, 'mecanica-brp-apresentacao.webm');
rmSync(target, { force: true });
renameSync(join(TMP_DIR, file), target);
rmSync(TMP_DIR, { recursive: true, force: true });
console.log('✓ Vídeo salvo em', target);
server?.kill();
process.exit(0);
