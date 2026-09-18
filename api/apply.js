import mysql from 'mysql2/promise';

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

// chữ trên form -> mã lưu trong DB
const GOALS = {
    'Phát triển tư duy': 'tu_duy',
    'Phát triển kỹ năng chuyên môn': 'ky_nang',
    'Giao lưu và kết nối': 'ket_noi',
    'Tìm cơ hội thực tập': 'thuc_tap',
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const b = req.body || {};
    const s = v => String(v ?? '').trim();

    const name = s(b.ho_ten);
    const phone = s(b.so_dien_thoai).replace(/[\s.\-]/g, '');
    const school = s(b.truong_nganh);
    const year = Number(b.nam_hoc);
    const goals = (Array.isArray(b.mong_muon) ? b.mong_muon : [b.mong_muon])
        .map(g => GOALS[s(g)]).filter(Boolean);
    const action = s(b.hanh_dong);

    if (!name || !/^0\d{9}$/.test(phone) || !school ||
        ![1, 2, 3, 4].includes(year) || goals.length === 0 || !action) {
        return res.status(400).json({ ok: false });
    }

    try {
        await db().execute(
            `INSERT INTO applications
         (full_name, phone, school_major, study_year, goals, proactive_action)
       VALUES (?,?,?,?,?,?)`,
            [name.slice(0, 120), phone, school.slice(0, 255), year,
            JSON.stringify(goals), action.slice(0, 5000)]
        );
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false });
    }
}