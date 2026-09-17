// Chụp giữa chừng hiệu ứng chữ để kiểm tra dấu không bị cắt: node qa/mid.mjs <w> <h> <mobile> <out.png> <ms>
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [W, H, M, OUT, MS] = process.argv.slice(2);
const port = 9900 + Math.floor(Math.random() * 90);
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t; for (let k = 0; k < 40; k++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.length) break; } catch {} await sleep(250); }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const p = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m.result); p.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; p.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 2, mobile: M === '1' });
await send('Page.navigate', { url: 'http://localhost:5173/index.html' });
await sleep(1500);
const ev = await send('Runtime.evaluate', { expression: `(() => { const ws = document.querySelectorAll('.hero-title .wi'); ws.forEach((w, i) => { w.style.animation = 'none'; w.style.transform = 'translateY(' + [0, 18, 40, 65][i % 4] + '%)'; }); return ws.length; })()`, returnByValue: true });
console.log('words', ev.result && ev.result.value);
await sleep(200);
const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 60, width: +W * 0.55, height: +H * 0.6, scale: 1 } });
writeFileSync(OUT, Buffer.from(r.data, 'base64'));
ws.close(); proc.kill();
