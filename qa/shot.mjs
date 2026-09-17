// Chụp ảnh QA qua Chrome DevTools Protocol (không cần puppeteer).
// node shot.mjs <width> <height> <mobile 0|1> <prefix> [reduce 0|1]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [W, H, MOBILE, PREFIX, REDUCE] = process.argv.slice(2);
const width = +W, height = +H, mobile = MOBILE === '1';
const URL = 'http://localhost:5173/index.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'cdp-'));
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--no-first-run', '--window-size=1600,1200', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const logs = [];
function send(method, params = {}) {
  return new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
}
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  return r.result && r.result.value;
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${PREFIX}-${name}.png`, Buffer.from(r.data, 'base64'));
}

try {
  let targets;
  for (let k = 0; k < 40; k++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {}
    await sleep(250);
  }
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(m.error) : p.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) logs.push(m.params.type + ' ' + m.params.args.map((a) => a.value || a.description).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push('LOG ' + m.params.entry.text);
  });
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: REDUCE === '1' ? 'reduce' : 'no-preference' }] });
  await send('Page.navigate', { url: URL });
  await sleep(3500);
  await shot('01-hero');

  const info = await evalJs(`(() => {
    const W = document.documentElement.clientWidth;
    return { W, sw: document.documentElement.scrollWidth };
  })()`);
  console.log('hero', JSON.stringify(info));

  // Trụ cột: nếu được ghim thì chụp 3 thời điểm
  const pin = await evalJs(`(() => { const s = document.querySelector('.pin-spacer'); if (!s) return null; const r = s.getBoundingClientRect(); return { top: r.top + scrollY, h: s.offsetHeight }; })()`);
  const stops = pin
    ? [['02-pillar1', pin.top + 10], ['03-pillar2', pin.top + (pin.h - height) * 0.5], ['04-pillar3', pin.top + (pin.h - height) * 0.92]]
    : [['02-pillars', `document.getElementById('gia-tri').offsetTop`]];
  const secs = [...stops,
    ['05-portrait', `document.getElementById('chan-dung').getBoundingClientRect().top + scrollY - 60`],
    ['06-journey', `document.getElementById('lo-trinh').getBoundingClientRect().top + scrollY + 200`],
    ['07-form', `document.getElementById('dang-ky').getBoundingClientRect().top + scrollY - 70`],
    ['08-form-bottom', `document.getElementById('submit-btn').getBoundingClientRect().top + scrollY - ${height} + 240`],
    ['09-footer', `document.documentElement.scrollHeight`]];
  for (const [name, y] of secs) {
    // cuộn từng bước để ScrollTrigger kích hoạt tuần tự
    const target = await evalJs(`Math.round(${y})`);
    await evalJs(`(async () => { const t = ${target}; let cur = scrollY; const step = (t - cur) / 12; for (let i = 0; i < 12; i++) { cur += step; window.scrollTo(0, cur); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, t); })()`);
    await sleep(2200);
    await shot(name);
  }
  const overflow = await evalJs(`(() => { const W = document.documentElement.clientWidth; return { W, sw: document.documentElement.scrollWidth, bad: [...document.querySelectorAll('main *, footer *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > W + 1 && !e.closest('.partners'); }).map(e => e.tagName + '.' + e.className).slice(0, 5) }; })()`);
  console.log('after-scroll', JSON.stringify(overflow));

  // Form: gửi rỗng -> lỗi
  await evalJs(`document.getElementById('submit-btn').click()`);
  await sleep(1200);
  await evalJs(`window.scrollTo(0, document.getElementById('dang-ky').getBoundingClientRect().top + scrollY - 70)`);
  await sleep(1200);
  await shot('10-form-errors');
  const errs = await evalJs(`[...document.querySelectorAll('.err:not([hidden])')].map(e => e.textContent)`);
  console.log('errors', JSON.stringify(errs));

  // Form hợp lệ -> popup
  await evalJs(`(() => { const f = document.getElementById('register-form');
    f.hoTen.value = 'Nguyễn Văn Thử'; f.soDienThoai.value = '0912 345 678'; f.truongNganh.value = 'ĐH Thử nghiệm - CNTT';
    f.namHoc.value = 'Năm 2'; f.querySelectorAll('input[name=mongMuon]')[1].checked = true; f.hanhDong.value = 'Tự học và làm một dự án nhỏ.';
    document.getElementById('submit-btn').click(); })()`);
  await sleep(2500);
  await shot('11-popup');
  const modal = await evalJs(`({ hidden: document.getElementById('modal').hidden, focus: document.activeElement.className, lock: document.documentElement.classList.contains('modal-open') })`);
  console.log('modal', JSON.stringify(modal));
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(1200);
  const closed = await evalJs(`({ hidden: document.getElementById('modal').hidden, focus: document.activeElement.id })`);
  console.log('after-esc', JSON.stringify(closed));
  console.log('logs', JSON.stringify(logs));
} catch (e) {
  console.error('FAIL', e);
} finally {
  try { ws && ws.close(); } catch {}
  proc.kill();
}
