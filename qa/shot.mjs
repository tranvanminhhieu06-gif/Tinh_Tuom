// QA qua Chrome DevTools Protocol (không cần puppeteer).
// node qa/shot.mjs <width> <height> <mobile 0|1> <prefix> [reduce 0|1]
// Cần server: python -m http.server 5173 (thư mục gốc dự án)
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
  '--hide-scrollbars', '--no-first-run', '--enable-unsafe-swiftshader', '--window-size=1600,1200', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const logs = [];
const requests = [];
const result = {};
function send(method, params = {}) {
  return new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
}
async function js(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('JS: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result && r.result.value;
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${PREFIX}-${name}.png`, Buffer.from(r.data, 'base64'));
}
async function key(k, code, vk, shift = false) {
  const mods = shift ? 8 : 0;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, modifiers: mods });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, modifiers: mods });
}
async function scrollTo(expr, wait = 1800) {
  const t = await js(`Math.round(${expr})`);
  await js(`(async () => { const t = ${t}; const l = window.__lenisForQA; let cur = scrollY; const n = 14; const step = (t - cur) / n;
    for (let i = 0; i < n; i++) { cur += step; window.scrollTo(0, cur); await new Promise(r => setTimeout(r, 50)); } window.scrollTo(0, t); })()`);
  await sleep(wait);
}
const top = (sel, off = 0) => `(document.querySelector('${sel}').getBoundingClientRect().top + scrollY + (${off}))`;

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
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) logs.push(m.params.type + ' ' + m.params.args.map((a) => a.value || a.description).join(' '));
    if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) logs.push('LOG ' + m.params.entry.text);
    if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url.slice(0, 90));
  });
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: REDUCE === '1' ? 'reduce' : 'no-preference' }] });
  await send('Page.navigate', { url: URL });
  await sleep(4000);
  await shot('01-hero');

  // ---- màn hình đầu ----
  result.firstScreen = await js(`(() => {
    const vis = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; };
    return { audience: vis('.audience'), title: vis('.hero-title'), sub: vis('.hero-sub'), cta: vis('.hero-cta .btn'),
      ctaBottom: Math.round(document.querySelector('.hero-cta .btn').getBoundingClientRect().bottom),
      img: [...document.querySelectorAll('.hero-img')].map(i => i.complete && i.naturalWidth > 0) };
  })()`);
  result.fonts = await js(`(async () => { await document.fonts.ready; const fams = new Set();
    for (const el of document.querySelectorAll('h1,h2,h3,p,button,a,label')) fams.add(getComputedStyle(el).fontFamily.split(',')[0]);
    return { families: [...fams], loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.weight + f.style) }; })()`);
  result.uppercase = await js(`[...document.querySelectorAll('body *')].filter(e => getComputedStyle(e).textTransform === 'uppercase' && e.textContent.trim()).map(e => e.className).filter((v, i, a) => a.indexOf(v) === i)`);
  result.lineHeightMin = await js(`(() => { let min = 9, who = ''; for (const e of document.querySelectorAll('h1,h2,h3,p,span,a,button,label,li,legend')) { if (!e.textContent.trim()) continue; const cs = getComputedStyle(e); const lh = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize); if (lh < min) { min = lh; who = e.tagName + '.' + e.className; } } return { min: +min.toFixed(3), who }; })()`);

  // ---- nền trắng: lấy mẫu nhiều điểm ----
  const bgCheck = `(() => {
    const bad = [];
    const bgAt = (x, y) => { let el = document.elementFromPoint(x, y);
      while (el) { if (el.closest && (el.closest('.hero-arc') || el.closest('.p-dark'))) return 'skip';
        const c = getComputedStyle(el).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; el = el.parentElement; }
      return getComputedStyle(document.documentElement).backgroundColor; };
    for (let y = 5; y < innerHeight; y += Math.round(innerHeight / 9)) for (let x = 3; x < innerWidth; x += Math.round(innerWidth / 9)) {
      const c = bgAt(x, y); if (c !== 'skip' && !/^rgba?\\(255, 255, 255(, 0\\.9\\d*)?(, 1)?\\)$/.test(c)) {
        const el = document.elementFromPoint(x, y); bad.push(c + ' @' + x + ',' + y + ' ' + (el && el.className)); } }
    return bad; })()`;
  result.bg = { hero: await js(bgCheck) };

  // ---- hạt WebGL khi cuộn khỏi hero (desktop) ----
  if (!mobile) {
    await scrollTo(`document.querySelector('.hero').offsetHeight * 0.3`, 1600);
    await shot('01b-hero-particles');
    result.particles = await js(`({ canvas: getComputedStyle(document.querySelector('.hero-particles')).display, peopleOpacity: getComputedStyle(document.querySelector('.hero-people')).opacity })`);
    await scrollTo('0', 1500);
    result.particlesBack = await js(`getComputedStyle(document.querySelector('.hero-people')).opacity`);
  }

  // ---- 3 trụ cột ----
  const pin = await js(`(() => { const s = document.querySelector('.pin-spacer'); if (!s) return null; const r = s.getBoundingClientRect(); return { top: r.top + scrollY, h: s.offsetHeight }; })()`);
  if (pin) {
    const stops = [['02-pillar1', pin.top + 5], ['03-pillar2', pin.top + (pin.h - height) * 0.52], ['04-pillar3', pin.top + (pin.h - height) * 0.95]];
    for (const [n, y] of stops) { await scrollTo(String(y), 1800); await shot(n); result.bg[n] = await js(bgCheck); }
  } else {
    await scrollTo(top('#gia-tri', -60)); await shot('02-pillars');
    await scrollTo(top('.pillar:last-child', -200)); await shot('03-pillars-b');
  }
  result.pinned = !!pin;

  // ---- câu chuyển tiếp ----
  await scrollTo(top('.bridge', `-innerHeight * 0.1`), 1500);
  await shot('04b-bridge');

  // ---- chân dung ----
  await scrollTo(top('#chan-dung', -70), 1500);
  await sleep(900);
  await scrollTo(top('.compare-row:nth-of-type(2)', mobile ? 200 : -40), 1200);
  await shot('05-portrait');
  result.portrait = await js(`({ blocks: document.querySelectorAll('.opt').length, buttons: document.querySelectorAll('.compare button').length, resultShown: !document.querySelector('.result--fit').hidden })`);
  result.bg.portrait = await js(bgCheck);

  // ---- lộ trình ----
  await scrollTo(top('#lo-trinh', mobile ? 60 : -40), 1500);
  await shot('06-journey');
  await scrollTo(top('.step:last-child', `-innerHeight * 0.55`), 1500);
  await shot('06b-journey-end');
  result.journey = await js(`[...document.querySelectorAll('.step')].map(s => s.classList.contains('is-on'))`);

  // ---- form: lỗi ----
  await scrollTo(top('#dang-ky', -70), 1600);
  await js(`document.querySelector('#f-name').focus()`);
  await key('Tab', 'Tab', 9);
  result.tabFromName = await js(`document.activeElement.id`);
  await js(`document.querySelector('#f-phone').value = '123'; document.querySelector('#f-phone').dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#f-phone').blur()`);
  await js(`document.querySelector('[data-next]').click()`);
  await sleep(700);
  await shot('07-form-error');
  result.formErrors = await js(`[...document.querySelectorAll('.error:not([hidden])')].map(e => e.textContent.trim())`);
  result.bg.form = await js(bgCheck);

  // ---- lưu nháp ----
  await js(`(() => { const n = document.querySelector('#f-name'); n.value = 'Nguyễn Văn Thử'; n.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(600);
  await send('Page.reload', {});
  await sleep(3500);
  result.draftRestored = await js(`document.querySelector('#f-name').value`);

  // ---- form hợp lệ → popup ----
  await scrollTo(top('#dang-ky', -70), 1200);
  await js(`(() => { const f = document.getElementById('apply-form');
    f.elements.so_dien_thoai.value = '0912 345 678'; f.elements.so_dien_thoai.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-next]').click(); })()`);
  await sleep(500);
  result.step2 = await js(`document.querySelector('.fstep.is-active').dataset.step`);
  await js(`(() => { const f = document.getElementById('apply-form');
    f.elements.truong_nganh.value = 'ĐH Thử nghiệm - CNTT'; f.elements.nam_hoc.value = '2'; f.querySelectorAll('input[name=mong_muon]')[1].checked = true;
    document.querySelector('[data-next]').click(); })()`);
  await sleep(500);
  await js(`(() => { const f = document.getElementById('apply-form'); f.elements.hanh_dong.value = 'Tự học và làm một dự án nhỏ.'; f.elements.hanh_dong.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(400);
  await shot('08-form-step3');
  await js(`document.querySelector('[data-submit]').click()`);
  await sleep(2200);
  await shot('09-popup');
  result.bg.popup = await js(bgCheck);
  const trap = [];
  for (let i = 0; i < 5; i++) { await key('Tab', 'Tab', 9); trap.push(await js(`!!document.activeElement.closest('#success-modal') + ':' + (document.activeElement.className || document.activeElement.tagName)`)); }
  result.modal = { trap, draftCleared: await js(`localStorage.getItem('nge-draft-v1')`) };
  await key('Escape', 'Escape', 27);
  await sleep(1000);
  result.afterEsc = await js(`({ hidden: document.getElementById('success-modal').hidden, focus: document.activeElement.id })`);
  // mở lại và đóng bằng bấm ra ngoài
  await js(`window.__openModal(innerWidth / 2, innerHeight / 2)`);
  await sleep(900);
  await js(`document.getElementById('success-modal').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
  await sleep(900);
  result.afterBackdrop = await js(`document.getElementById('success-modal').hidden`);

  // ---- chân trang + tràn ngang ----
  await scrollTo('document.documentElement.scrollHeight', 1500);
  await shot('10-footer');
  result.bg.footer = await js(bgCheck);
  result.overflow = await js(`(() => { const W = document.documentElement.clientWidth; return { W, sw: document.documentElement.scrollWidth,
    bad: [...document.querySelectorAll('main *, footer *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > W + 1 && !e.closest('.marquee') && !e.closest('.hero-visual'); }).map(e => e.tagName + '.' + e.className).slice(0, 5) }; })()`);
  result.sticky = await js(`document.querySelector('.sticky-cta').classList.contains('is-on')`);
  result.targets = await js(`[...document.querySelectorAll('a, button, input:not([type=checkbox]), select, textarea, label.check')].filter(e => e.offsetParent && !e.closest('.sr-only')).map(e => { const r = e.getBoundingClientRect(); return [e.className || e.tagName, Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => h < 44 || w < 44).slice(0, 8)`);
  result.googleFonts = requests.filter((u) => u.includes('fonts.g'));
  result.requests = [...new Set(requests.filter((u) => !u.startsWith('data:')))];
  result.logs = logs;
  console.log(JSON.stringify(result, null, 1));
} catch (e) {
  console.error('FAIL', e, JSON.stringify(result), logs);
} finally {
  try { ws && ws.close(); } catch {}
  proc.kill();
}
