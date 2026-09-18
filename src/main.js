(() => {
  'use strict';

  // Địa chỉ nhận hồ sơ. null = chỉ mở popup, KHÔNG gửi dữ liệu đi đâu.
  // Khi có URL: POST JSON { ho_ten, so_dien_thoai, truong_nganh, nam_hoc, mong_muon[], hanh_dong, gui_luc }.
  const FORM_ENDPOINT = null;

  const DRAFT_KEY = 'nge-draft-v1';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const mqDesktop = matchMedia('(min-width: 900px)');
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
  const root = document.documentElement;
  const header = $('.site-header');
  let lenis = null;

  /* ---------- tiện ích ---------- */
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } },
    clear() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* bỏ qua */ } },
  };

  function scrollToTarget(target) {
    if (!target) return;
    if (lenis) lenis.scrollTo(target, { offset: -(header.offsetHeight + 16), duration: 1.1 });
    else target.scrollIntoView({ behavior: mqReduce.matches ? 'auto' : 'smooth', block: 'start' });
  }

  /* ---------- đầu trang + thanh tiến độ cuộn ---------- */
  const progress = $('.scroll-progress');
  const progressBar = $('.scroll-progress span');
  const formSection = $('#dang-ky');
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      progressBar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      header.classList.toggle('is-stuck', y > 8);
      progress.classList.toggle('is-form', formSection.getBoundingClientRect().top < innerHeight * 0.6);
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- liên kết cuộn trong trang ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    if (id === 'dau-trang') { lenis ? lenis.scrollTo(0) : scrollTo({ top: 0, behavior: mqReduce.matches ? 'auto' : 'smooth' }); return; }
    scrollToTarget(target);
    const focusEl = id === 'dang-ky' ? $('#register-title') : (target.querySelector('h2') || target);
    if (focusEl) {
      if (!focusEl.hasAttribute('tabindex')) focusEl.setAttribute('tabindex', '-1');
      setTimeout(() => focusEl.focus({ preventScroll: true }), lenis ? 0 : 50);
    }
  });

  /* ---------- CTA dính đáy (mobile) ---------- */
  const sticky = $('.sticky-cta');
  const heroCta = $('#hero-cta');
  if ('IntersectionObserver' in window) {
    let heroGone = false;
    let formIn = false;
    const setSticky = () => {
      const on = heroGone && !formIn && !root.classList.contains('modal-open');
      sticky.classList.toggle('is-on', on);
      sticky.toggleAttribute('inert', !on);
      sticky.setAttribute('aria-hidden', on ? 'false' : 'true');
    };
    new IntersectionObserver(([en]) => {
      heroGone = !en.isIntersecting && en.boundingClientRect.bottom < 0;
      setSticky();
    }).observe(heroCta);
    new IntersectionObserver(([en]) => { formIn = en.isIntersecting; setSticky(); }, { rootMargin: '0px 0px -10% 0px' }).observe(formSection);
    window.__setSticky = setSticky;
  }

  /* ---------- dải logo chạy ngang (mobile) ---------- */
  (function marquee() {
    const wrap = $('.marquee');
    const list = $('.partner-list', wrap);
    let track = null;
    function build() {
      const want = !mqDesktop.matches && !mqReduce.matches;
      if (want && !track) {
        track = document.createElement('div');
        track.className = 'marquee-track';
        list.replaceWith(track);
        track.appendChild(list);
        const clone = list.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        clone.removeAttribute('aria-label');
        $$('img', clone).forEach((img) => { img.alt = ''; });
        track.appendChild(clone);
        wrap.classList.add('is-running');
      } else if (!want && track) {
        track.replaceWith(list);
        track = null;
        wrap.classList.remove('is-running');
      }
    }
    wrap.addEventListener('touchstart', () => wrap.classList.add('is-paused'), { passive: true });
    wrap.addEventListener('touchend', () => wrap.classList.remove('is-paused'), { passive: true });
    wrap.addEventListener('focusin', () => wrap.classList.add('is-paused'));
    wrap.addEventListener('focusout', () => wrap.classList.remove('is-paused'));
    build();
    mqDesktop.addEventListener('change', build);
    mqReduce.addEventListener('change', build);
  })();

  /* ---------- 04 · form 3 phần ---------- */
  const form = $('#apply-form');
  const steps = $$('.fstep', form);
  const btnPrev = $('[data-prev]', form);
  const btnNext = $('[data-next]', form);
  const btnSubmit = $('[data-submit]', form);
  const curText = $('[data-cur]', form);
  const bar = $('.progress-bar span', form);
  const statusEl = $('.form-status', form);
  let cur = 0;

  const PHONE_RE = /^0\d{9}$/;
  const normPhone = (v) => {
    let d = v.replace(/[\s.\-()]/g, '');
    if (d.startsWith('+84')) d = '0' + d.slice(3);
    else if (d.startsWith('84') && d.length === 11) d = '0' + d.slice(2);
    return d;
  };
  const rules = {
    ho_ten: (el) => el.value.trim().length >= 2,
    so_dien_thoai: (el) => PHONE_RE.test(normPhone(el.value)),
    truong_nganh: (el) => el.value.trim().length >= 2,
    nam_hoc: (el) => el.value !== '',
    hanh_dong: (el) => el.value.trim().length >= 2,
  };

  function setFieldState(fieldEl, ok, errEl, control) {
    fieldEl.classList.toggle('is-invalid', !ok);
    fieldEl.classList.toggle('is-valid', ok);
    errEl.hidden = ok;
    if (control) control.setAttribute('aria-invalid', ok ? 'false' : 'true');
  }
  function validateControl(el) {
    const rule = rules[el.name];
    if (!rule) return true;
    const ok = rule(el);
    const field = el.closest('.field');
    setFieldState(field, ok, $('.error', field), el);
    return ok;
  }
  function validateWishes() {
    const box = $('.checks', form);
    const ok = $$('input[type=checkbox]', box).some((c) => c.checked);
    box.classList.toggle('is-invalid', !ok);
    $('#e-wish').hidden = ok;
    return ok;
  }
  function validateStep(i) {
    let firstBad = null;
    $$('input:not([type=checkbox]), select, textarea', steps[i]).forEach((el) => {
      if (!validateControl(el) && !firstBad) firstBad = el;
    });
    if ($('.checks', steps[i]) && !validateWishes() && !firstBad) firstBad = $('.checks input', steps[i]);
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  function stepIsValid(i) {
    const controlsOk = $$('input:not([type=checkbox]), select, textarea', steps[i]).every((el) => !rules[el.name] || rules[el.name](el));
    const box = $('.checks', steps[i]);
    return controlsOk && (!box || $$('input', box).some((c) => c.checked));
  }

  $$('input:not([type=checkbox]), select, textarea', form).forEach((el) => {
    el.addEventListener('input', () => {
      el.dataset.dirty = '1';
      if (el.closest('.field').classList.contains('is-invalid')) validateControl(el);
    });
    el.addEventListener('blur', () => {
      if (el.dataset.dirty || el.closest('.field').classList.contains('is-invalid')) validateControl(el);
    });
    el.addEventListener('change', () => { if (el.tagName === 'SELECT') validateControl(el); });
  });
  $$('.checks input', form).forEach((c) => c.addEventListener('change', () => {
    if ($('.checks', form).classList.contains('is-invalid')) validateWishes();
  }));

  function showStep(i, dir) {
    steps.forEach((s, k) => {
      s.classList.toggle('is-active', k === i);
      s.classList.remove('from-left', 'from-right');
    });
    if (dir) steps[i].classList.add(dir > 0 ? 'from-right' : 'from-left');
    cur = i;
    curText.textContent = String(i + 1);
    bar.style.transform = `scaleX(${(i + 1) / steps.length})`;
    btnPrev.hidden = i === 0;
    btnNext.hidden = i === steps.length - 1;
    btnSubmit.hidden = i !== steps.length - 1;
    if (dir) {
      steps[i].focus({ preventScroll: true });
      const top = form.getBoundingClientRect().top;
      if (top < header.offsetHeight) scrollToTarget(form);
    }
  }
  btnNext.addEventListener('click', () => { if (validateStep(cur)) showStep(cur + 1, 1); });
  btnPrev.addEventListener('click', () => showStep(cur - 1, -1));
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && cur < steps.length - 1) {
      e.preventDefault();
      btnNext.click();
    }
  });

  // lưu nháp
  function collect() {
    const fd = new FormData(form);
    return {
      ho_ten: (fd.get('ho_ten') || '').trim(),
      so_dien_thoai: normPhone(fd.get('so_dien_thoai') || ''),
      truong_nganh: (fd.get('truong_nganh') || '').trim(),
      nam_hoc: fd.get('nam_hoc') || '',
      mong_muon: fd.getAll('mong_muon'),
      hanh_dong: (fd.get('hanh_dong') || '').trim(),
    };
  }
  let saveTimer = 0;
  form.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const fd = new FormData(form);
      store.set({
        ho_ten: fd.get('ho_ten'), so_dien_thoai: fd.get('so_dien_thoai'), truong_nganh: fd.get('truong_nganh'),
        nam_hoc: fd.get('nam_hoc') || '', mong_muon: fd.getAll('mong_muon'), hanh_dong: fd.get('hanh_dong'),
      });
    }, 300);
  });
  (function restore() {
    const d = store.get();
    if (!d) return;
    ['ho_ten', 'so_dien_thoai', 'truong_nganh', 'hanh_dong'].forEach((k) => { if (d[k]) form.elements[k].value = d[k]; });
    if (d.nam_hoc) form.elements.nam_hoc.value = d.nam_hoc;
    if (Array.isArray(d.mong_muon)) $$('.checks input', form).forEach((c) => { c.checked = d.mong_muon.includes(c.value); });
  })();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (cur !== steps.length - 1) { btnNext.click(); return; }
    // kiểm tra lại cả 3 phần (nháp có thể đã bị sửa dở)
    for (let i = 0; i < steps.length; i++) {
      if (!stepIsValid(i)) {
        if (i !== cur) showStep(i, -1);
        validateStep(i);
        return;
      }
    }
    statusEl.hidden = true;
    const payload = { ...collect(), gui_luc: new Date().toISOString() };
    if (FORM_ENDPOINT) {
      btnSubmit.disabled = true;
      $('.btn-label', btnSubmit).textContent = 'Đang gửi…';
      try {
        const res = await fetch(FORM_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(String(res.status));
      } catch (err) {
        statusEl.textContent = 'Chưa gửi được hồ sơ. Vui lòng kiểm tra kết nối và thử lại.';
        statusEl.hidden = false;
        return;
      } finally {
        btnSubmit.disabled = false;
        $('.btn-label', btnSubmit).textContent = 'Gửi hồ sơ';
      }
    }
    const rect = btnSubmit.getBoundingClientRect();
    store.clear();
    form.reset();
    $$('.field, .checks', form).forEach((f) => f.classList.remove('is-valid', 'is-invalid'));
    $$('[data-dirty]', form).forEach((el) => delete el.dataset.dirty);
    showStep(0);
    openModal(rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  showStep(0);

  /* ---------- popup thành công ---------- */
  const modal = $('#success-modal');
  const modalLogo = $('[data-logo-copy]', modal);
  if (modalLogo) modalLogo.src = $('.site-footer .logo-v').src;
  const modalTitle = $('#modal-title');
  let titleWords = null;
  const outside = [header, $('main'), $('.site-footer'), sticky, $('.skip-link')];
  const focusables = () => $$('a[href], button:not([disabled])', modal).filter((el) => el.offsetParent !== null);

  function openModal(x, y) {
    modal.hidden = false;
    root.classList.add('modal-open');
    outside.forEach((el) => el && el.setAttribute('inert', ''));
    if (lenis) lenis.stop();
    if (window.__setSticky) window.__setSticky();
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    if (!mqReduce.matches && modal.animate) {
      modal.animate([
        { clipPath: `circle(0px at ${x}px ${y}px)` },
        { clipPath: `circle(${R}px at ${x}px ${y}px)` },
      ], { duration: 650, easing: 'cubic-bezier(.65,0,.35,1)' });
      if (!titleWords) titleWords = window.__splitWords(modalTitle);
      titleWords.forEach((w, i) => w.animate(
        [{ transform: 'translateY(115%)' }, { transform: 'none' }],
        { duration: 600, delay: 300 + i * 45, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' },
      ));
      $$('.modal-top, .mini-steps, [data-rise]', modal).forEach((el, i) => el.animate(
        [{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 500, delay: 380 + i * 90, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' },
      ));
    }
    modal.dataset.x = x;
    modal.dataset.y = y;
    modalTitle.focus({ preventScroll: true });
  }
  function closeModal() {
    if (modal.hidden) return;
    const finish = () => {
      modal.hidden = true;
      root.classList.remove('modal-open');
      outside.forEach((el) => el && el.removeAttribute('inert'));
      if (lenis) lenis.start();
      if (window.__setSticky) window.__setSticky();
      $('#register-title').focus({ preventScroll: true });
    };
    if (!mqReduce.matches && modal.animate) {
      const x = +modal.dataset.x || innerWidth / 2;
      const y = +modal.dataset.y || innerHeight / 2;
      const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      modal.animate([
        { clipPath: `circle(${R}px at ${x}px ${y}px)` },
        { clipPath: `circle(0px at ${x}px ${y}px)` },
      ], { duration: 420, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' }).finished.then((a) => { finish(); a.cancel(); });
    } else finish();
  }
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
    if (e.key === 'Tab') {
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === modalTitle)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  window.__openModal = openModal; // dùng cho QA

  /* =====================================================================
     HIỆU ỨNG (nạp sau khi trang đã hiện; lỗi mạng thì trang vẫn đầy đủ)
     ===================================================================== */
  const CDN = {
    gsap: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js',
    st: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollTrigger.min.js',
    lenis: 'https://cdn.jsdelivr.net/npm/lenis@1.3.11/dist/lenis.min.js',
    ogl: 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm',
  };
  const loadScript = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  const whenIdle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 200));
  const isRich = () => mqDesktop.matches && mqFine.matches && !mqReduce.matches;

  function boot() {
    if (mqReduce.matches) return;
    const needLenis = isRich();
    Promise.all([loadScript(CDN.gsap), needLenis ? loadScript(CDN.lenis).catch(() => null) : null])
      .then(() => loadScript(CDN.st))
      .then(initEffects)
      .catch(() => { /* không có thư viện: giữ trang tĩnh */ });
    if (isRich()) initPointer();
  }
  if (document.readyState === 'complete') whenIdle(boot);
  else addEventListener('load', () => whenIdle(boot), { once: true });

  function initEffects() {
    const { gsap, ScrollTrigger } = window;
    if (!gsap || !ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    root.classList.add('fx');

    // 1. cuộn mượt (desktop có chuột)
    if (isRich() && window.Lenis) {
      lenis = new window.Lenis({ lerp: 0.08, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }

    const mm = gsap.matchMedia();
    const EASE = 'power3.out';

    // 2. hero: chữ rời đi theo từ khi cuộn khỏi hero, "NHƯNG" đi sau cùng
    const heroWords = $$('#hero-title .w');
    if (heroWords.length) {
      const red = heroWords.filter((w) => w.closest('.kw-red'));
      const rest = heroWords.filter((w) => !w.closest('.kw-red'));
      gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 10%', scrub: 0.6 } })
        .to({}, { duration: 0.35 })
        .to(rest, { yPercent: -40, autoAlpha: 0, stagger: 0.02, ease: 'none', duration: 0.4 })
        .to(red, { yPercent: -60, autoAlpha: 0, ease: 'none', duration: 0.25 });
      gsap.fromTo('.hero-sub, .hero-cta, .audience', { autoAlpha: 1, y: 0 }, {
        autoAlpha: 0, y: -24, ease: 'none', immediateRender: false,
        scrollTrigger: { trigger: '.hero', start: '30% top', end: '75% top', scrub: 0.6 },
      });
    }

    // 3. hạt WebGL (desktop có chuột)
    if (isRich()) whenIdle(() => initParticles(gsap, ScrollTrigger));

    // tiêu đề section trồi theo từ
    $$('.section-head .h2').forEach((h) => {
      const words = window.__splitWords(h);
      gsap.from(words, { yPercent: 115, duration: 0.8, ease: EASE, stagger: 0.05, scrollTrigger: { trigger: h, start: 'top 85%', once: true } });
    });

    // 4. ba trụ cột
    const pillarsSec = $('.pillars');
    const pillars = $$('.pillar', pillarsSec);
    const pillarWords = pillars.map((p) => window.__splitWords($('[data-split-words]', p)));
    mm.add('(min-width: 900px) and (min-height: 640px)', () => {
      pillarsSec.classList.add('is-pinned');
      const dots = document.createElement('div');
      dots.className = 'pillar-dots';
      dots.setAttribute('aria-hidden', 'true');
      dots.innerHTML = '<span class="on"></span><span></span><span></span>';
      $('.pillar-stage', pillarsSec).after(dots);
      const dotEls = $$('span', dots);
      gsap.set(pillars.slice(1), { autoAlpha: 0, y: 80 });
      gsap.set(pillarWords[1].concat(pillarWords[2]), { yPercent: 115 });
      gsap.from(pillarWords[0], { yPercent: 115, stagger: 0.025, duration: 0.7, ease: EASE, scrollTrigger: { trigger: pillarsSec, start: 'top 60%', once: true } });
      gsap.from($('.pillar-num', pillars[0]), { y: 60, autoAlpha: 0, duration: 0.9, ease: EASE, scrollTrigger: { trigger: pillarsSec, start: 'top 60%', once: true } });
      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: {
          trigger: pillarsSec, start: 'top top', end: '+=150%', pin: true, scrub: 0.8, anticipatePin: 1,
          onUpdate(self) { const k = self.progress < 0.36 ? 0 : self.progress < 0.72 ? 1 : 2; dotEls.forEach((d, i) => d.classList.toggle('on', i === k)); },
        },
      });
      tl.to({}, { duration: 0.15 })
        .to(pillars[0], { autoAlpha: 0, y: -80, duration: 0.3 })
        .to(pillars[1], { autoAlpha: 1, y: 0, duration: 0.3 }, '<0.12')
        .to(pillarWords[1], { yPercent: 0, stagger: 0.01, duration: 0.25, ease: 'power2.out' }, '<0.08')
        .to({}, { duration: 0.2 })
        .to(pillars[1], { autoAlpha: 0, y: -80, duration: 0.3 })
        .to(pillars[2], { autoAlpha: 1, y: 0, duration: 0.3 }, '<0.12')
        .to(pillarWords[2], { yPercent: 0, stagger: 0.008, duration: 0.25, ease: 'power2.out' }, '<0.08')
        .to({}, { duration: 0.15 });
      return () => { pillarsSec.classList.remove('is-pinned'); dots.remove(); };
    });
    mm.add('(max-width: 899px), (max-height: 639px)', () => {
      pillars.forEach((p, i) => {
        gsap.from(p, { y: 48, autoAlpha: 0, duration: 0.8, ease: EASE, scrollTrigger: { trigger: p, start: 'top 88%', once: true } });
        gsap.from(pillarWords[i], { yPercent: 115, stagger: 0.02, duration: 0.6, ease: EASE, delay: 0.15, scrollTrigger: { trigger: p, start: 'top 88%', once: true } });
      });
    });

    // 5. câu chuyển tiếp: lộ theo tiến độ cuộn
    const bridge = $('.bridge-text');
    const bw = window.__splitWords(bridge).map((w) => w.parentNode);
    gsap.fromTo(bw, { opacity: 0.12 }, {
      opacity: 1, ease: 'none', stagger: 0.12,
      scrollTrigger: { trigger: '.bridge', start: 'top 70%', end: 'center 45%', scrub: true },
    });
    gsap.fromTo($('.kw-red', bridge), { scale: 0.96 }, { scale: 1, transformOrigin: '50% 60%', ease: 'none', scrollTrigger: { trigger: '.bridge', start: 'top 60%', end: 'center 45%', scrub: true } });

    // 6. chân dung: hai cột trượt vào từ hai phía
    mm.add('(min-width: 900px)', () => {
      const st = { trigger: '.compare', start: 'top 80%', once: true };
      gsap.fromTo('.compare-head .col-fit, .opt-fit', { x: -80, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.9, stagger: 0.1, ease: EASE, clearProps: 'transform', scrollTrigger: st });
      gsap.fromTo('.compare-head .col-unfit, .opt-unfit', { x: 80, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.9, stagger: 0.1, ease: EASE, clearProps: 'transform', scrollTrigger: { ...st } });
    });
    mm.add('(max-width: 899px)', () => {
      $$('.compare-row').forEach((r) => {
        gsap.from($$('.opt', r), { y: 32, autoAlpha: 0, duration: 0.7, stagger: 0.1, ease: EASE, scrollTrigger: { trigger: r, start: 'top 88%', once: true } });
      });
    });

    // 7. lộ trình: đường xanh tự vẽ, mốc bật khi đường chạm tới
    const timeline = $('.timeline');
    const fill = $('.timeline-fill');
    const track = $('.timeline-track');
    const stepEls = $$('.step', timeline);
    stepEls.forEach((s, i) => s.classList.toggle('is-on', i === 0));
    let marks = [];
    const measure = () => {
      const tr = track.getBoundingClientRect();
      marks = stepEls.map((s) => {
        const d = $('.step-dot', s).getBoundingClientRect();
        return (d.top + d.height / 2 - tr.top) / tr.height;
      });
    };
    gsap.fromTo(fill, { scaleY: 0 }, {
      scaleY: 1, ease: 'none',
      scrollTrigger: {
        trigger: timeline, start: 'top 65%', end: 'bottom 65%', scrub: 0.5,
        onRefresh: measure,
        onUpdate(self) {
          stepEls.forEach((s, i) => {
            const on = i === 0 || self.progress >= marks[i] - 0.02;
            if (on !== s.classList.contains('is-on')) {
              s.classList.toggle('is-on', on);
              if (on) gsap.fromTo($('.step-dot', s), { scale: 0.7 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
            }
          });
        },
      },
    });
    stepEls.forEach((s) => {
      gsap.from($('.step-body', s), { y: 32, autoAlpha: 0, duration: 0.7, ease: EASE, scrollTrigger: { trigger: s, start: 'top 85%', once: true } });
    });

    // 10. form: khung form trồi nhẹ
    gsap.from('.apply-form', { y: 40, autoAlpha: 0, duration: 0.8, ease: EASE, scrollTrigger: { trigger: '.register-grid', start: 'top 85%', once: true } });
    gsap.from('.form-aside', { x: -40, autoAlpha: 0, duration: 0.8, ease: EASE, delay: 0.15, scrollTrigger: { trigger: '.register-grid', start: 'top 85%', once: true } });

    // phông chữ nạp xong → đo lại
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  /* ---------- 9. con trỏ + nam châm + thị sai chuột ---------- */
  function initPointer() {
    const dot = document.createElement('div');
    const ring = document.createElement('div');
    dot.className = 'cursor-dot';
    ring.className = 'cursor-ring';
    dot.setAttribute('aria-hidden', 'true');
    ring.setAttribute('aria-hidden', 'true');
    document.body.append(dot, ring);
    let mx = -100; let my = -100; let rx = -100; let ry = -100; let shown = false;
    const magnets = $$('.magnetic').map((el) => ({ el, label: $('.btn-label', el), x: 0, y: 0, lx: 0, ly: 0 }));
    const heroEl = $('.hero');
    const par = { tx: 0, ty: 0, x: 0, y: 0 };
    const tags = $$('.float-tag');
    const arc = $('.hero-arc');
    const people = $$('.person');

    addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      if (!shown) { shown = true; rx = mx; ry = my; root.classList.add('has-cursor'); }
      const hr = heroEl.getBoundingClientRect();
      if (my >= hr.top && my <= hr.bottom) {
        par.tx = (mx / innerWidth) * 2 - 1;
        par.ty = ((my - hr.top) / hr.height) * 2 - 1;
      }
    }, { passive: true });
    document.addEventListener('mouseleave', () => { root.classList.remove('has-cursor'); shown = false; });
    document.addEventListener('pointerover', (e) => {
      const t = e.target;
      const onRed = t.closest('.btn-primary, .btn-outline');
      const onLink = t.closest('a, button, label.check, select');
      dot.classList.toggle('is-red', !!onRed);
      ring.classList.toggle('is-red', !!onRed);
      dot.classList.toggle('is-link', !!onLink && !onRed);
      ring.classList.toggle('is-link', !!onLink);
    });

    (function loop() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
      ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;

      magnets.forEach((m) => {
        const r = m.el.getBoundingClientRect();
        const cx = r.left + r.width / 2 - m.x;
        const cy = r.top + r.height / 2 - m.y;
        const dx = mx - cx; const dy = my - cy;
        const reach = 90 + Math.max(r.width, r.height) / 2;
        const inRange = Math.hypot(dx, dy) < reach && m.el.offsetParent !== null;
        const txx = inRange ? dx * 0.22 : 0; const tyy = inRange ? dy * 0.3 : 0;
        m.x += (txx - m.x) * 0.15; m.y += (tyy - m.y) * 0.15;
        m.lx += ((inRange ? dx * 0.36 : 0) - m.lx) * 0.15; m.ly += ((inRange ? dy * 0.42 : 0) - m.ly) * 0.15;
        m.el.style.transform = Math.abs(m.x) + Math.abs(m.y) > 0.05 ? `translate3d(${m.x.toFixed(2)}px,${m.y.toFixed(2)}px,0)` : '';
        if (m.label) m.label.style.transform = Math.abs(m.lx) + Math.abs(m.ly) > 0.05 ? `translate3d(${(m.lx - m.x).toFixed(2)}px,${(m.ly - m.y).toFixed(2)}px,0)` : '';
      });

      par.x += (par.tx - par.x) * 0.06;
      par.y += (par.ty - par.y) * 0.06;
      if (window.scrollY < heroEl.offsetHeight + 200) {
        const px = (par.x * 8).toFixed(2) + 'px'; const py = (par.y * 8).toFixed(2) + 'px';
        tags.forEach((t, i) => { const k = i === 1 ? -1 : 1; t.style.setProperty('--px', `calc(${px} * ${k})`); t.style.setProperty('--py', py); });
        arc.style.setProperty('--px', (par.x * -8).toFixed(2) + 'px');
        arc.style.setProperty('--py', (par.y * -6).toFixed(2) + 'px');
        people.forEach((p) => { p.style.setProperty('--ppx', (par.x * 3).toFixed(2) + 'px'); p.style.setProperty('--ppy', (par.y * 2).toFixed(2) + 'px'); });
      }
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- 3. hạt WebGL lấy mẫu từ ảnh sinh viên ---------- */
  async function initParticles(gsap, ScrollTrigger) {
    let OGL;
    try { OGL = await import(CDN.ogl); } catch (e) { return; }
    const { Renderer, Program, Geometry, Mesh } = OGL;
    const heroEl = $('.hero');
    const canvas = $('.hero-particles');
    const peopleWrap = $('.hero-people');
    const arcEl = $('.hero-arc');
    const imgs = [$('.hero-img--nu'), $('.hero-img--nam')]; // nữ vẽ trước, nam đè lên
    await Promise.all(imgs.map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = r; }))));

    let renderer;
    try {
      renderer = new Renderer({ canvas, dpr: Math.min(devicePixelRatio || 1, 2), alpha: true, antialias: false, premultipliedAlpha: false });
    } catch (e) { return; }
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    canvas.style.display = 'block';
    canvas.style.opacity = '1';

    const IMG_TOTAL = 7000; // hạt lấy mẫu từ 2 ảnh sinh viên
    const ARC_TOTAL = 2200; // hạt đỏ của vòm tròn phía sau
    const TOTAL = IMG_TOTAL + ARC_TOTAL;
    // đọc điểm ảnh một lần (ảnh cùng nguồn data: nên không bị chặn CORS)
    const samples = imgs.map((im) => {
      const sw = 180;
      const sh = Math.round(sw * im.naturalHeight / im.naturalWidth);
      const c = document.createElement('canvas');
      c.width = sw; c.height = sh;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(im, 0, 0, sw, sh);
      const data = ctx.getImageData(0, 0, sw, sh).data;
      const pts = [];
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const k = (y * sw + x) * 4;
          if (data[k + 3] >= 128) pts.push(x, y, data[k], data[k + 1], data[k + 2]);
        }
      }
      return { sw, sh, pts };
    });
    const counts = samples.map((s) => s.pts.length / 5);
    const sum = counts[0] + counts[1];

    const program = new Program(gl, {
      transparent: true, depthTest: false, depthWrite: false,
      vertex: `
        attribute vec2 position; attribute vec3 color; attribute vec3 rnd; attribute float flag;
        uniform vec2 uRes; uniform float uProgress; uniform vec2 uMouse; uniform float uAmp; uniform float uTime; uniform float uDpr; uniform vec2 uOffset;
        varying vec3 vColor; varying float vAlpha;
        void main(){
          vec2 p = position + uOffset;
          float t = clamp((uProgress - rnd.z * 0.3) / 0.7, 0.0, 1.0);
          t = t * t * (3.0 - 2.0 * t);
          float a = rnd.x * 6.28318;
          vec2 dir = normalize(vec2(cos(a), sin(a)) + vec2(0.85, -0.55));
          p += dir * t * (180.0 + rnd.y * 560.0);
          p.x += sin(uTime * 0.7 + rnd.x * 30.0) * 8.0 * t;
          vec2 d = p - uMouse;
          float dist = length(d);
          float fall = exp(-dist * dist / 9800.0) * uAmp * flag;
          float wave = sin(dist * 0.09 - uTime * 7.0);
          p += (d / max(dist, 1.0)) * fall * (7.0 + 5.0 * wave);
          vec2 clip = (p / uRes) * 2.0 - 1.0;
          gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
          gl_PointSize = (2.0 + rnd.y * 1.4) * uDpr;
          vColor = color;
          float scrollA = smoothstep(0.0, 0.1, uProgress) * (1.0 - smoothstep(0.8, 1.0, uProgress));
          vAlpha = max(scrollA, clamp(fall * (0.55 + 0.45 * wave), 0.0, 1.0));
        }`,
      fragment: `
        precision mediump float;
        varying vec3 vColor; varying float vAlpha;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          if (dot(c, c) > 0.25) discard;
          gl_FragColor = vec4(vColor, vAlpha);
        }`,
      uniforms: {
        uRes: { value: [1, 1] }, uProgress: { value: 0 }, uMouse: { value: [-9999, -9999] }, uAmp: { value: 0 },
        uTime: { value: 0 }, uDpr: { value: renderer.dpr }, uOffset: { value: [0, 0] },
      },
    });

    let mesh = null;
    function build() {
      const hr = heroEl.getBoundingClientRect();
      renderer.setSize(hr.width, hr.height);
      program.uniforms.uRes.value = [hr.width, hr.height];
      const pos = new Float32Array(TOTAL * 2);
      const col = new Float32Array(TOTAL * 3);
      const rnd = new Float32Array(TOTAL * 3);
      const flag = new Float32Array(TOTAL);
      let n = 0;
      // vòm đỏ vẽ trước (nằm sau), rải đều trong hình tròn; không gợn theo chuột
      const ar = arcEl.getBoundingClientRect();
      const acx = ar.left - hr.left + ar.width / 2;
      const acy = ar.top - hr.top + ar.height / 2;
      const aR = ar.width / 2;
      for (; n < ARC_TOTAL; n++) {
        const rr = aR * Math.sqrt(Math.random());
        const th = Math.random() * Math.PI * 2;
        pos[n * 2] = acx + rr * Math.cos(th);
        pos[n * 2 + 1] = acy + rr * Math.sin(th);
        col[n * 3] = 1; col[n * 3 + 1] = 59 / 255; col[n * 3 + 2] = 48 / 255;
        rnd[n * 3] = Math.random(); rnd[n * 3 + 1] = Math.random(); rnd[n * 3 + 2] = Math.random();
        flag[n] = 0;
      }
      imgs.forEach((im, s) => {
        const r = im.getBoundingClientRect();
        const { sw, sh, pts } = samples[s];
        const want = s === 0 ? Math.round(IMG_TOTAL * counts[0] / sum) : TOTAL - n;
        const avail = pts.length / 5;
        for (let i = 0; i < want && n < TOTAL; i++, n++) {
          const k = Math.floor(Math.random() * avail) * 5;
          const px = pts[k] + Math.random();
          const py = pts[k + 1] + Math.random();
          pos[n * 2] = r.left - hr.left + (px / sw) * r.width;
          pos[n * 2 + 1] = r.top - hr.top + (py / sh) * r.height;
          col[n * 3] = pts[k + 2] / 255; col[n * 3 + 1] = pts[k + 3] / 255; col[n * 3 + 2] = pts[k + 4] / 255;
          rnd[n * 3] = Math.random(); rnd[n * 3 + 1] = Math.random(); rnd[n * 3 + 2] = Math.random();
          // chỉ vùng áo/balo (dưới ~34% chiều cao ảnh) được gợn theo chuột; khuôn mặt đứng yên
          flag[n] = py / sh > 0.34 ? 1 : 0;
        }
      });
      const geometry = new Geometry(gl, {
        position: { size: 2, data: pos }, color: { size: 3, data: col }, rnd: { size: 3, data: rnd }, flag: { size: 1, data: flag },
      });
      if (mesh) mesh.geometry.remove();
      mesh = new Mesh(gl, { mode: gl.POINTS, geometry, program });
    }
    build();

    // trạng thái
    let target = 0; let prog = 0; let amp = 0; let visible = true; let dirty = true;
    const mouse = { x: -9999, y: -9999 };
    ScrollTrigger.create({
      trigger: heroEl, start: 'top top', end: 'bottom top',
      onUpdate: (self) => { target = self.progress; dirty = true; },
    });
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(heroEl);
    const visual = $('.hero-visual');
    visual.addEventListener('mousemove', (e) => {
      const hr = heroEl.getBoundingClientRect();
      mouse.x = e.clientX - hr.left; mouse.y = e.clientY - hr.top;
      amp = Math.min(1, amp + 0.12);
      dirty = true;
    }, { passive: true });

    let rt = 0;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!mqDesktop.matches) { canvas.style.display = 'none'; peopleWrap.style.opacity = ''; arcEl.style.opacity = ''; return; } canvas.style.display = 'block'; build(); dirty = true; }, 200); });

    let lastT = performance.now();
    gsap.ticker.add(() => {
      if (!visible || !mqDesktop.matches) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      prog += (target - prog) * 0.12;
      amp *= 0.95;
      const moving = Math.abs(target - prog) > 0.0005 || amp > 0.003 || prog > 0.001;
      if (!moving && !dirty) return;
      dirty = false;
      const u = program.uniforms;
      u.uTime.value += dt;
      u.uProgress.value = prog;
      u.uAmp.value = amp > 0.003 ? amp : 0;
      u.uMouse.value = [mouse.x, mouse.y];
      const pp = $('.person--nam');
      const cs = getComputedStyle(pp);
      u.uOffset.value = [parseFloat(cs.getPropertyValue('--ppx')) || 0, parseFloat(cs.getPropertyValue('--ppy')) || 0];
      // ảnh thật mờ dần khi hạt tách ra; cuộn ngược thì hiện lại
      const imgA = 1 - Math.min(1, Math.max(0, (prog - 0.02) / 0.12));
      peopleWrap.style.opacity = imgA.toFixed(3);
      arcEl.style.opacity = imgA.toFixed(3);
      renderer.render({ scene: mesh });
    });
  }
})();
