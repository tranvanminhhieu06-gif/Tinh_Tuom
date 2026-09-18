// Rê chuột lên phần tử và đọc màu: node qa/hover.mjs "<selector>" [out.png]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [SEL, OUT] = process.argv.slice(2);
const port = 9800 + Math.floor(Math.random() * 90);
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t; for (let k = 0; k < 40; k++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.length) break; } catch {} await sleep(250); }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const p = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m.result); p.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; p.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await send('Page.navigate', { url: 'http://localhost:5173/index.html' });
await sleep(2500);
const read = `(() => { const s = getComputedStyle(document.querySelector(${JSON.stringify(SEL)})); return [s.backgroundColor, s.color, s.borderColor].join(' | '); })()`;
await js(`document.querySelector(${JSON.stringify(SEL)}).scrollIntoView({ block: 'center' })`);
await sleep(400);
console.log('before', await js(read));
const r = await js(`(() => { const r = document.querySelector(${JSON.stringify(SEL)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r[0], y: r[1] });
await sleep(500);
console.log('hover ', await js(read));
if (OUT) { const s = await send('Page.captureScreenshot', { format: 'png', clip: { x: r[0] - 160, y: r[1] - 50, width: 320, height: 100, scale: 1 } }); writeFileSync(OUT, Buffer.from(s.data, 'base64')); }
ws.close(); proc.kill();
