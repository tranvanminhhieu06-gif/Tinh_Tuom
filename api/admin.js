import mysql from 'mysql2/promise';
import { timingSafeEqual } from 'node:crypto';

let pool;
const db = () => pool ??= mysql.createPool({
    host: process.env.TIDB_HOST,
    port: 4000,
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: 'tinhtuom',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    connectionLimit: 1,
});

const GOAL_LABEL = {
    tu_duy: 'Phát triển tư duy',
    ky_nang: 'Kỹ năng chuyên môn',
    ket_noi: 'Giao lưu và kết nối',
    thuc_tap: 'Tìm cơ hội thực tập',
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const same = (a, b) => {
    const x = Buffer.from(a), y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
};

function authorized(req) {
    const U = process.env.EXPORT_USER, P = process.env.EXPORT_PASS;
    if (!U || !P) return false;
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Basic' || !token) return false;
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    if (i < 0) return false;
    return same(decoded.slice(0, i), U) && same(decoded.slice(i + 1), P);
}

export default async function handler(req, res) {
    if (!authorized(req)) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Xem ho so", charset="UTF-8"');
        return res.status(401).send('Cần đăng nhập');
    }

    try {
        const [rows] = await db().query(`
      SELECT CAST(id AS CHAR) AS id, full_name, phone, school_major, study_year,
             goals, proactive_action,
             DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+07:00'), '%d/%m/%Y %H:%i') AS gio_nop
      FROM applications
      ORDER BY created_at DESC`);

        const trs = rows.map(r => {
            const g = Array.isArray(r.goals) ? r.goals : JSON.parse(r.goals || '[]');
            const goalsText = g.map(x => GOAL_LABEL[x] || x).join(', ');
            return `<tr>
        <td>${esc(r.gio_nop)}</td>
        <td>${esc(r.full_name)}</td>
        <td>${esc(r.phone)}</td>
        <td>${esc(r.school_major)}</td>
        <td>Năm ${esc(r.study_year)}</td>
        <td>${esc(goalsText)}</td>
        <td>${esc(r.proactive_action)}</td>
      </tr>`;
        }).join('');

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`<!doctype html>
<html lang="vi"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hồ sơ đăng ký - NextGen Elite</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #1a1a1a; }
  h1 { font-size: 20px; }
  .toolbar { display: flex; gap: 12px; align-items: center; margin: 16px 0; flex-wrap: wrap; }
  input[type=search] { padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; width: 260px; }
  .count { color: #666; font-size: 14px; }
  a.btn { background: #111; color: #fff; padding: 8px 14px; border-radius: 6px; text-decoration: none; font-size: 14px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { border: 1px solid #e2e2e2; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; position: sticky; top: 0; }
  tr:nth-child(even) { background: #fafafa; }
  .wrap { overflow-x: auto; max-height: 80vh; }
  td:nth-child(7) { max-width: 320px; white-space: pre-wrap; }
</style>
</head><body>
  <h1>Hồ sơ đăng ký NextGen Elite</h1>
  <div class="toolbar">
    <input type="search" id="q" placeholder="Tìm theo tên, SĐT, trường...">
    <span class="count" id="count"></span>
    <a class="btn" href="/api/export">Tải Excel</a>
  </div>
  <div class="wrap">
  <table id="tbl">
    <thead><tr>
      <th>Thời gian nộp</th><th>Họ và tên</th><th>SĐT / Zalo</th>
      <th>Trường & Chuyên ngành</th><th>Năm học</th><th>Mong muốn</th><th>Hành động chủ động</th>
    </tr></thead>
    <tbody>${trs}</tbody>
  </table>
  </div>
<script>
  const q = document.getElementById('q');
  const rows = [...document.querySelectorAll('#tbl tbody tr')];
  const count = document.getElementById('count');
  function update() {
    const v = q.value.trim().toLowerCase();
    let shown = 0;
    for (const r of rows) {
      const hit = !v || r.textContent.toLowerCase().includes(v);
      r.style.display = hit ? '' : 'none';
      if (hit) shown++;
    }
    count.textContent = shown + ' / ' + rows.length + ' hồ sơ';
  }
  q.addEventListener('input', update);
  update();
</script>
</body></html>`);
    } catch (e) {
        console.error(e);
        res.status(500).send('Lỗi khi tải dữ liệu');
    }
}