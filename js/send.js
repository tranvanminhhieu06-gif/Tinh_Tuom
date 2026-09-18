(() => {
    const form = document.getElementById('apply-form');
    if (!form) return;
    let sending = false;

    form.addEventListener('submit', () => {
        if (sending) return;
        const fd = new FormData(form);
        const t = k => String(fd.get(k) || '').trim();
        const phone = t('so_dien_thoai').replace(/[\s.\-]/g, '');

        // chỉ gửi khi đã điền đủ (API cũng kiểm tra lại)
        const valid = t('ho_ten') && /^0\d{9}$/.test(phone) && t('truong_nganh') &&
            t('nam_hoc') && fd.getAll('mong_muon').length > 0 && t('hanh_dong');
        if (!valid) return;

        sending = true;
        fetch('/api/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({
                ho_ten: t('ho_ten'),
                so_dien_thoai: phone,
                truong_nganh: t('truong_nganh'),
                nam_hoc: t('nam_hoc'),
                mong_muon: fd.getAll('mong_muon'),
                hanh_dong: t('hanh_dong'),
            }),
        })
            .then(r => r.json())
            .then(j => { if (!j.ok) console.error('Lưu hồ sơ thất bại', j); })
            .catch(err => console.error('Lưu hồ sơ thất bại', err))
            .finally(() => { sending = false; });
    }, true);   // true = chạy TRƯỚC code có sẵn, trước khi form bị reset
})();