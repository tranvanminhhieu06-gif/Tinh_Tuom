(function () {
  'use strict';

  var FB_URL = 'https://www.facebook.com/groups/tinhoatuchu';
  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var ARROW = [[0.5, 0.02], [0.93, 0.47], [0.645, 0.47], [0.645, 0.98], [0.355, 0.98], [0.355, 0.47], [0.07, 0.47]];

  var doc = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqMobile = window.matchMedia('(max-width: 899px)');
  var isReduced = function () { return mqReduce.matches; };
  var lenis = null;

  /* ------------------------------------------------------------
     Tiện ích
     ------------------------------------------------------------ */
  function headerH() { return $('.site-header').offsetHeight; }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /* ------------------------------------------------------------
     Cuộn tới neo (#dang-ky, #top)
     ------------------------------------------------------------ */
  function scrollToTarget(target, focusEl) {
    var done = function () { if (focusEl) focusEl.focus({ preventScroll: true }); };
    if (lenis) {
      lenis.scrollTo(target.id === 'top' ? 0 : target, { offset: target.id === 'top' ? 0 : -headerH() + 1, duration: 1.4, onComplete: done });
    } else {
      var y = target.id === 'top' ? 0 : target.getBoundingClientRect().top + window.pageYOffset - headerH() + 1;
      window.scrollTo({ top: y, behavior: isReduced() ? 'auto' : 'smooth' });
      setTimeout(done, isReduced() ? 0 : 700);
    }
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    var target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    var focusEl = id === 'dang-ky' ? $('#register-title') : (id === 'top' ? null : target);
    scrollToTarget(target, focusEl);
    if (history.replaceState) history.replaceState(null, '', '#' + id);
  });

  /* ------------------------------------------------------------
     Thanh tiến độ cuộn + thanh CTA dính đáy (mobile)
     ------------------------------------------------------------ */
  var progress = $('.progress');
  var progressBar = $('.progress span');
  var sticky = $('#sticky-cta');
  var stickyLink = $('#sticky-cta a');
  var heroCtaVisible = true;
  var formVisible = false;
  var ticking = false;

  function updateProgress() {
    ticking = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, window.pageYOffset / max)) : 0;
    progressBar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(updateProgress); }
  }, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  function updateSticky() {
    var show = mqMobile.matches && !heroCtaVisible && !formVisible;
    sticky.classList.toggle('is-visible', show);
    stickyLink.tabIndex = show ? 0 : -1;
    sticky.setAttribute('aria-hidden', show ? 'false' : 'true');
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { heroCtaVisible = en.isIntersecting; });
      updateSticky();
    }, { rootMargin: '-64px 0px 0px 0px' }).observe($('#hero-cta'));

    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { formVisible = en.isIntersecting; });
      progress.classList.toggle('is-red', formVisible);
      updateSticky();
    }, { rootMargin: '0px 0px -35% 0px' }).observe($('#dang-ky'));
  }
  mqMobile.addEventListener('change', updateSticky);
  updateSticky();

  /* ------------------------------------------------------------
     Dải logo đối tác: dừng khi chạm (mobile)
     ------------------------------------------------------------ */
  var partners = $('.partners');
  partners.addEventListener('touchstart', function () { partners.classList.add('is-paused'); }, { passive: true });
  partners.addEventListener('touchend', function () { setTimeout(function () { partners.classList.remove('is-paused'); }, 1200); }, { passive: true });
  partners.addEventListener('focusin', function () { partners.classList.add('is-paused'); });
  partners.addEventListener('focusout', function () { partners.classList.remove('is-paused'); });

  /* ------------------------------------------------------------
     FORM
     ------------------------------------------------------------ */
  var form = $('#register-form');
  var statusEl = $('#form-status');
  var submitBtn = $('#submit-btn');
  var ERR_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 16.5v.5"/></svg>';

  var rules = {
    hoTen: function () {
      var v = form.hoTen.value.trim();
      if (!v) return 'Vui lòng nhập họ và tên.';
      if (v.length < 2) return 'Họ và tên cần ít nhất 2 ký tự.';
      return '';
    },
    soDienThoai: function () {
      var raw = form.soDienThoai.value.trim();
      if (!raw) return 'Vui lòng nhập số điện thoại hoặc Zalo.';
      var v = raw.replace(/[\s.\-()]/g, '');
      if (!/^(0|\+?84)(3|5|7|8|9)\d{8}$/.test(v)) return 'Số điện thoại chưa đúng. Nhập 10 số, ví dụ 0912 345 678.';
      return '';
    },
    truongNganh: function () {
      var v = form.truongNganh.value.trim();
      if (!v) return 'Vui lòng nhập trường và chuyên ngành đang học.';
      if (v.length < 2) return 'Tên trường và chuyên ngành cần ít nhất 2 ký tự.';
      return '';
    },
    namHoc: function () {
      return form.namHoc.value ? '' : 'Vui lòng chọn năm học hiện tại.';
    },
    mongMuon: function () {
      return $$('input[name="mongMuon"]:checked', form).length ? '' : 'Vui lòng chọn ít nhất một mong muốn.';
    },
    hanhDong: function () {
      var v = form.hanhDong.value.trim();
      if (!v) return 'Vui lòng chia sẻ hành động chủ động của bạn.';
      if (v.length < 10) return 'Hãy viết cụ thể hơn một chút (ít nhất 10 ký tự).';
      return '';
    }
  };

  function setError(name, msg) {
    var wrap = $('[data-field="' + name + '"]', form);
    var err = $('#e-' + name);
    var controls = $$('[name="' + name + '"]', form);
    wrap.classList.toggle('is-invalid', !!msg);
    controls.forEach(function (c) {
      if (msg) c.setAttribute('aria-invalid', 'true'); else c.removeAttribute('aria-invalid');
    });
    if (msg) {
      err.innerHTML = ERR_ICON + '<span></span>';
      err.lastChild.textContent = msg;
      err.hidden = false;
    } else {
      err.hidden = true;
      err.textContent = '';
    }
  }
  function validate(name) {
    var msg = rules[name]();
    setError(name, msg);
    return !msg;
  }

  Object.keys(rules).forEach(function (name) {
    var controls = $$('[name="' + name + '"]', form);
    controls.forEach(function (c) {
      var evt = (c.type === 'checkbox' || c.tagName === 'SELECT') ? 'change' : 'blur';
      c.addEventListener(evt, function () { validate(name); });
      c.addEventListener('input', function () {
        if ($('[data-field="' + name + '"]', form).classList.contains('is-invalid')) validate(name);
      });
    });
  });

  function showStatus(msg, isError) {
    statusEl.classList.toggle('is-error', !!isError);
    if (!msg) { statusEl.textContent = ''; return; }
    statusEl.innerHTML = (isError ? ERR_ICON : '') + '<span></span>';
    statusEl.lastChild.textContent = msg;
  }

  function collect() {
    return {
      hoTen: form.hoTen.value.trim(),
      soDienThoai: form.soDienThoai.value.trim(),
      truongNganh: form.truongNganh.value.trim(),
      namHoc: form.namHoc.value,
      mongMuon: $$('input[name="mongMuon"]:checked', form).map(function (c) { return c.value; }),
      hanhDong: form.hanhDong.value.trim(),
      guiLuc: new Date().toISOString()
    };
  }

  var lastPointer = null;
  submitBtn.addEventListener('pointerdown', function (e) { lastPointer = { x: e.clientX, y: e.clientY }; });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var invalid = Object.keys(rules).filter(function (n) { return !validate(n); });
    if (invalid.length) {
      showStatus('Còn ' + invalid.length + ' mục cần kiểm tra lại. Xem hướng dẫn màu đỏ bên dưới từng mục.', true);
      var first = $('[data-field="' + invalid[0] + '"]', form);
      var ctl = $('input, select, textarea', first);
      first.scrollIntoView({ behavior: isReduced() ? 'auto' : 'smooth', block: 'center' });
      ctl.focus({ preventScroll: true });
      return;
    }
    showStatus('');
    var r = submitBtn.getBoundingClientRect();
    var origin = lastPointer || { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    lastPointer = null;

    if (!FORM_ENDPOINT) {
      form.reset();
      openModal(origin);
      return;
    }

    var label = $('.btn-label', submitBtn);
    submitBtn.disabled = true;
    label.textContent = 'Đang gửi…';
    fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collect())
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      form.reset();
      openModal(origin);
    }).catch(function () {
      showStatus('Chưa gửi được hồ sơ do lỗi kết nối. Dữ liệu bạn nhập vẫn được giữ nguyên, vui lòng bấm Gửi Hồ Sơ lần nữa.', true);
    }).then(function () {
      submitBtn.disabled = false;
      label.textContent = 'Gửi Hồ Sơ';
    });
  });

  /* ------------------------------------------------------------
     POPUP
     ------------------------------------------------------------ */
  var modal = $('#modal');
  var dialog = $('.modal-dialog', modal);
  var reveal = $('.modal-reveal', modal);
  var lastFocus = null;
  var closing = false;

  function focusables() {
    return $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', dialog)
      .filter(function (el) { return el.offsetParent !== null; });
  }

  function openModal(origin) {
    lastFocus = document.activeElement;
    var x = origin.x, y = origin.y;
    var rad = Math.ceil(Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))) + 2;
    reveal.style.width = reveal.style.height = rad * 2 + 'px';
    reveal.style.left = (x - rad) + 'px';
    reveal.style.top = (y - rad) + 'px';
    modal.hidden = false;
    doc.classList.add('modal-open');
    if (lenis) lenis.stop();
    document.addEventListener('keydown', onModalKey);

    if (window.gsap && !isReduced()) {
      gsap.killTweensOf([reveal, dialog]);
      gsap.fromTo(reveal, { scale: 0 }, { scale: 1, duration: 0.7, ease: 'power3.inOut' });
      gsap.fromTo(dialog, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.45, delay: 0.35, ease: 'power2.out' });
      gsap.fromTo($$('.split-modal .wi', dialog), { yPercent: 110 }, { yPercent: 0, duration: 0.7, stagger: 0.025, delay: 0.45, ease: 'power3.out' });
      gsap.fromTo($('.btn', dialog), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, delay: 0.7, ease: 'power2.out' });
    } else {
      reveal.style.transform = 'none';
    }
    dialog.focus({ preventScroll: true });
  }

  function closeModal() {
    if (modal.hidden || closing) return;
    closing = true;
    document.removeEventListener('keydown', onModalKey);
    var finish = function () {
      modal.hidden = true;
      closing = false;
      doc.classList.remove('modal-open');
      if (lenis) lenis.start();
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    };
    if (window.gsap && !isReduced()) {
      gsap.killTweensOf([reveal, dialog]);
      gsap.to(dialog, { opacity: 0, y: 16, duration: 0.25, ease: 'power2.in' });
      gsap.to(reveal, { opacity: 0, duration: 0.35, delay: 0.1, onComplete: function () { gsap.set(reveal, { opacity: 1 }); finish(); } });
    } else {
      finish();
    }
  }

  function onModalKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
    if (e.key !== 'Tab') return;
    var f = focusables();
    if (!f.length) { e.preventDefault(); return; }
    var first = f[0], last = f[f.length - 1];
    var active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialog)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    else if (!dialog.contains(active)) { e.preventDefault(); first.focus(); }
  }

  $$('[data-close]', modal).forEach(function (el) { el.addEventListener('click', closeModal); });
  $('#join-btn').addEventListener('click', function () { setTimeout(closeModal, 150); });

  /* ------------------------------------------------------------
     HIỆU ỨNG (cần GSAP)
     ------------------------------------------------------------ */
  window.addEventListener('DOMContentLoaded', function () {
    if (!window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);

    var mm = gsap.matchMedia();
    mm.add({
      desktop: '(min-width: 900px)',
      mobile: '(max-width: 899px)',
      fine: '(hover: hover) and (pointer: fine)',
      reduce: '(prefers-reduced-motion: reduce)'
    }, function (ctx) {
      var c = ctx.conditions;
      if (c.reduce) return;
      var cleanups = [];
      var richDesktop = c.desktop && c.fine;

      if (richDesktop && window.Lenis) cleanups.push(initLenis());
      initHeroScroll();
      if (c.desktop) cleanups.push(initPillarsPinned()); else initPillarsMobile();
      initPortrait();
      cleanups.push(initTimeline());
      if (richDesktop) {
        cleanups.push(initSpotlight());
        cleanups.push(initCursor());
        cleanups.push(initMagnetic());
      }
      if (c.desktop) cleanups.push(initParticles());

      ScrollTrigger.refresh();
      return function () { cleanups.forEach(function (fn) { if (typeof fn === 'function') fn(); }); };
    });

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  });

  /* 1. Lenis */
  function initLenis() {
    lenis = new Lenis({ lerp: 0.08, smoothWheel: true, syncTouch: false });
    lenis.on('scroll', ScrollTrigger.update);
    var raf = function (t) { lenis.raf(t * 1000); };
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return function () {
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      lenis = null;
    };
  }

  /* 2. Hero – chữ rời đi theo tiến độ cuộn, "NHƯNG" rời sau cùng */
  function initHeroScroll() {
    var words = $$('.hero-title .w, .hero-title-2 .w');
    var accent = words.filter(function (w) { return w.closest('.accent'); });
    var rest = words.filter(function (w) { return !w.closest('.accent'); });
    var tl = gsap.timeline({
      scrollTrigger: { trigger: '.hero', start: 0, end: 'bottom top+=10%', scrub: 0.6 }
    });
    tl.to(rest, { yPercent: -70, opacity: 0, ease: 'none', stagger: { each: 0.04 } }, 0)
      .to(accent, { yPercent: -70, opacity: 0, ease: 'none', duration: 0.6 }, '>-0.1')
      .to('.hero-sub, .hero-access, .partners, .hero-cta', { opacity: 0, y: -30, ease: 'none', stagger: 0.1 }, 0.2);
  }

  /* 5. Ba trụ cột – ghim, mỗi trụ một màn (desktop) */
  function initPillarsPinned() {
    var sec = $('.pillars');
    sec.classList.add('is-pinned');
    var items = $$('.pillar', sec);
    gsap.set(items, { opacity: 0, yPercent: 14 });
    gsap.set(items[0], { opacity: 1, yPercent: 0 });
    var tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: { trigger: sec, start: 'top top', end: '+=150%', pin: '.pillars-pin', scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true }
    });
    items.forEach(function (it, i) {
      var words = $$('.pillar-desc .wi', it);
      var num = $('.pillar-num', it);
      if (i > 0) {
        tl.to(items[i - 1], { opacity: 0, yPercent: -14, duration: 0.5 })
          .fromTo(it, { opacity: 0, yPercent: 14 }, { opacity: 1, yPercent: 0, duration: 0.5 }, '<0.15')
          .fromTo(num, { xPercent: -8 }, { xPercent: 0, duration: 0.6 }, '<');
      }
      tl.fromTo(words, { opacity: 0.15 }, { opacity: 1, duration: 0.6, stagger: 0.04, ease: 'none' }, i === 0 ? 0 : '>-0.2');
      tl.to({}, { duration: 0.35 });
    });
    return function () {
      sec.classList.remove('is-pinned');
      gsap.set(items, { clearProps: 'opacity,transform' });
    };
  }

  /* Ba trụ cột – mobile: thẻ trồi lên */
  function initPillarsMobile() {
    $$('.pillar').forEach(function (it) {
      gsap.from(it, { y: 48, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: it, start: 'top 88%', once: true } });
    });
  }

  /* 7. Chân dung – hai cột trượt vào từ hai phía */
  function initPortrait() {
    var st = { trigger: '.ptable', start: 'top 78%', once: true };
    gsap.from('.ptable .th-yes, .ptable .col-yes', { x: -64, opacity: 0, duration: 1, stagger: 0.12, ease: 'power3.out', scrollTrigger: st });
    gsap.from('.ptable .th-no, .ptable .col-no', { x: 64, opacity: 0, duration: 1, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: '.ptable', start: 'top 78%', once: true } });
  }

  /* 8. Lộ trình – đường tự vẽ, mốc bật khi chạm */
  function initTimeline() {
    var wrap = $('.timeline-wrap');
    var fill = $('.timeline-fill');
    var steps = $$('.step');
    doc.classList.add('tl-anim');
    var marks = function () {
      var h = fill.offsetHeight || 1;
      return steps.map(function (s) { return s.offsetTop / h; });
    };
    var m = marks();
    var tween = gsap.fromTo(fill, { scaleY: 0 }, {
      scaleY: 1, ease: 'none',
      scrollTrigger: {
        trigger: wrap, start: 'top 62%', end: 'bottom 62%', scrub: 0.5,
        onRefresh: function () { m = marks(); },
        onUpdate: function (self) {
          var p = self.progress;
          steps.forEach(function (s, i) { s.classList.toggle('is-active', p >= m[i] - 0.001 && p > 0); });
        }
      }
    });
    return function () {
      doc.classList.remove('tl-anim');
      steps.forEach(function (s) { s.classList.remove('is-active'); });
      if (tween) tween.kill();
    };
  }

  /* 4. Spotlight xanh theo con trỏ */
  function initSpotlight() {
    var sec = $('.portrait');
    var tx = 0, ty = 0, x = 0, y = 0, raf = 0, inside = false;
    var loop = function () {
      x += (tx - x) * 0.12; y += (ty - y) * 0.12;
      sec.style.setProperty('--mx', x.toFixed(1) + 'px');
      sec.style.setProperty('--my', y.toFixed(1) + 'px');
      raf = (Math.abs(tx - x) + Math.abs(ty - y) > 0.3) ? requestAnimationFrame(loop) : 0;
    };
    var move = function (e) {
      var r = sec.getBoundingClientRect();
      tx = e.clientX - r.left; ty = e.clientY - r.top;
      if (!inside) { inside = true; x = tx; y = ty; sec.classList.add('spot-on'); }
      if (!raf) raf = requestAnimationFrame(loop);
    };
    var leave = function () { inside = false; sec.classList.remove('spot-on'); };
    sec.addEventListener('pointermove', move);
    sec.addEventListener('pointerleave', leave);
    return function () {
      sec.removeEventListener('pointermove', move);
      sec.removeEventListener('pointerleave', leave);
      cancelAnimationFrame(raf);
      sec.classList.remove('spot-on');
    };
  }

  /* 6a. Con trỏ tùy biến */
  function initCursor() {
    var cur = $('.cursor');
    var dot = $('.cursor-dot', cur);
    var ring = $('.cursor-ring', cur);
    var mx = -100, my = -100, rx = -100, ry = -100, scale = 1, ts = 1;
    doc.classList.add('has-cursor');
    cur.classList.add('is-idle');
    var tick = function () {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18; scale += (ts - scale) * 0.2;
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0) scale(' + scale.toFixed(3) + ')';
    };
    gsap.ticker.add(tick);
    var move = function (e) {
      mx = e.clientX; my = e.clientY;
      cur.classList.remove('is-idle');
      var t = e.target;
      var field = t.closest && t.closest('input:not([type="checkbox"]), select, textarea');
      var link = t.closest && t.closest('a, button, label.check, [data-close]');
      var red = t.closest && t.closest('.btn-primary');
      cur.classList.toggle('is-hidden', !!field);
      cur.classList.toggle('is-link', !!link && !field);
      cur.classList.toggle('is-red', !!red);
      ts = link && !field ? (red ? 1.9 : 1.6) : 1;
    };
    var out = function (e) { if (!e.relatedTarget) cur.classList.add('is-idle'); };
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerout', out);
    return function () {
      gsap.ticker.remove(tick);
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerout', out);
      doc.classList.remove('has-cursor');
    };
  }

  /* 6b. Nút nam châm */
  function initMagnetic() {
    var RADIUS = 90;
    var btns = $$('.magnetic');
    var state = btns.map(function (b) {
      return {
        el: b,
        label: $('.btn-label', b),
        xb: gsap.quickTo(b, 'x', { duration: 0.6, ease: 'power3.out' }),
        yb: gsap.quickTo(b, 'y', { duration: 0.6, ease: 'power3.out' }),
        xl: gsap.quickTo($('.btn-label', b), 'x', { duration: 0.6, ease: 'power3.out' }),
        yl: gsap.quickTo($('.btn-label', b), 'y', { duration: 0.6, ease: 'power3.out' }),
        on: false
      };
    });
    var move = function (e) {
      state.forEach(function (s) {
        var r = s.el.getBoundingClientRect();
        var cx = r.left + r.width / 2 - (gsap.getProperty(s.el, 'x') || 0);
        var cy = r.top + r.height / 2 - (gsap.getProperty(s.el, 'y') || 0);
        var dx = e.clientX - cx, dy = e.clientY - cy;
        var edgeX = Math.max(0, Math.abs(dx) - r.width / 2);
        var edgeY = Math.max(0, Math.abs(dy) - r.height / 2);
        var d = Math.hypot(edgeX, edgeY);
        if (d < RADIUS) {
          var k = 1 - d / RADIUS;
          s.on = true;
          s.xb(dx * 0.18 * k); s.yb(dy * 0.28 * k);
          s.xl(dx * 0.12 * k); s.yl(dy * 0.18 * k);
        } else if (s.on) {
          s.on = false;
          gsap.to(s.el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' });
          gsap.to(s.label, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' });
        }
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return function () {
      window.removeEventListener('pointermove', move);
      state.forEach(function (s) { gsap.set([s.el, s.label], { clearProps: 'transform' }); });
    };
  }

  /* 3. Trường hạt WebGL (desktop) */
  function initParticles() {
    var alive = true;
    var teardown = null;
    (window.THREE ? Promise.resolve() : loadScript(THREE_URL)).catch(function () {}).then(function () {
      if (!alive || !window.THREE) return;
      try { teardown = startParticles(); } catch (err) { teardown = null; }
    });
    return function () { alive = false; if (teardown) teardown(); };
  }

  function sampleArrow(count) {
    var S = 220;
    var cv = document.createElement('canvas');
    cv.width = cv.height = S;
    var g = cv.getContext('2d');
    g.fillStyle = '#000';
    g.beginPath();
    ARROW.forEach(function (p, i) { g[i ? 'lineTo' : 'moveTo'](p[0] * S, p[1] * S); });
    g.closePath();
    g.fill();
    var data = g.getImageData(0, 0, S, S).data;
    var pool = [];
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) if (data[(y * S + x) * 4 + 3] > 127) pool.push(x, y);
    var out = new Float32Array(count * 2);
    var n = pool.length / 2;
    for (var i = 0; i < count; i++) {
      var j = (Math.random() * n) | 0;
      out[i * 2] = (pool[j * 2] + Math.random()) / S;
      out[i * 2 + 1] = (pool[j * 2 + 1] + Math.random()) / S;
    }
    return out;
  }

  function startParticles() {
    var THREE = window.THREE;
    var wrap = $('.hero-visual');
    var canvas = $('#particles');
    var hero = $('.hero');
    var N = 3200;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0xffffff, 0);
    var scene = new THREE.Scene();
    var cam = new THREE.OrthographicCamera(0, 1, 0, 1, -10, 10);

    var tex = (function () {
      var c = document.createElement('canvas');
      c.width = c.height = 32;
      var g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(16, 16, 15, 0, Math.PI * 2); g.fill();
      var t = new THREE.CanvasTexture(c);
      return t;
    })();

    var norm = sampleArrow(N);
    var home = new Float32Array(N * 2);
    var vel = new Float32Array(N * 2);
    var scat = new Float32Array(N * 2);
    var heat = new Float32Array(N);
    var pos = new Float32Array(N * 3);
    var col = new Float32Array(N * 3);
    var W = 1, H = 1;

    for (var i = 0; i < N; i++) {
      var a = Math.random() * Math.PI * 2;
      var m = 120 + Math.random() * 380;
      scat[i * 2] = Math.cos(a) * m;
      scat[i * 2 + 1] = Math.sin(a) * m - 120;
    }

    function layout() {
      W = Math.max(1, wrap.clientWidth);
      H = Math.max(1, wrap.clientHeight);
      renderer.setSize(W, H, false);
      cam.right = W; cam.bottom = H; cam.updateProjectionMatrix();
      var size = Math.min(W, H) * 0.86;
      var ox = (W - size) / 2, oy = (H - size) / 2;
      for (var i = 0; i < N; i++) {
        home[i * 2] = ox + norm[i * 2] * size;
        home[i * 2 + 1] = oy + norm[i * 2 + 1] * size;
      }
      mat.size = 2.3 * dpr;
    }

    var geo = new THREE.BufferGeometry();
    var posAttr = new THREE.BufferAttribute(pos, 3);
    var colAttr = new THREE.BufferAttribute(col, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('color', colAttr);
    var mat = new THREE.PointsMaterial({
      size: 2.3 * dpr, sizeAttenuation: false, vertexColors: true,
      map: tex, transparent: true, opacity: 0.72, depthWrite: false, alphaTest: 0.05
    });
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    layout();

    // Vị trí ban đầu: tản mát, rồi tụ về hình mũi tên
    for (var k = 0; k < N; k++) {
      pos[k * 3] = W / 2 + (Math.random() - 0.5) * W * 1.4;
      pos[k * 3 + 1] = H / 2 + (Math.random() - 0.5) * H * 1.4;
    }

    var mouse = { x: -9999, y: -9999 };
    var scroll = { p: 0 };
    var R = 95, R2 = R * R, HOT = R * 0.7, HOT2 = HOT * HOT;
    var RED = [1, 0.2314, 0.1882];

    var onMove = function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    var onLeave = function () { mouse.x = mouse.y = -9999; };
    hero.addEventListener('pointermove', onMove, { passive: true });
    hero.addEventListener('pointerleave', onLeave);

    var st = ScrollTrigger.create({
      trigger: hero, start: 0, end: 'bottom top', scrub: true,
      onUpdate: function (self) { scroll.p = self.progress; }
    });

    var visible = true;
    var io = new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0 });
    io.observe(wrap);
    var ro = new ResizeObserver(function () { layout(); });
    ro.observe(wrap);

    var first = true;
    var tick = function () {
      if (!visible || document.hidden) return;
      var sp = scroll.p;
      var sEase = sp * sp * (3 - 2 * sp);
      var mx = mouse.x, my = mouse.y;
      for (var i = 0; i < N; i++) {
        var i2 = i * 2, i3 = i * 3;
        var px = pos[i3], py = pos[i3 + 1];
        var hx = home[i2] + scat[i2] * sEase;
        var hy = home[i2 + 1] + scat[i2 + 1] * sEase;
        var vx = vel[i2] + (hx - px) * 0.035;
        var vy = vel[i2 + 1] + (hy - py) * 0.035;
        var dx = px - mx, dy = py - my;
        var d2 = dx * dx + dy * dy;
        var target = 0;
        if (d2 < R2) {
          var d = Math.sqrt(d2) || 1;
          var f = (1 - d / R) * 3.2;
          vx += (dx / d) * f; vy += (dy / d) * f;
          if (d2 < HOT2) target = 1;
        }
        vx *= 0.86; vy *= 0.86;
        vel[i2] = vx; vel[i2 + 1] = vy;
        pos[i3] = px + vx; pos[i3 + 1] = py + vy;
        var h = heat[i] += (target - heat[i]) * (target ? 0.25 : 0.04);
        col[i3] = RED[0] * h; col[i3 + 1] = RED[1] * h; col[i3 + 2] = RED[2] * h;
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      renderer.render(scene, cam);
      if (first) { first = false; wrap.classList.add('webgl-on'); }
    };
    gsap.ticker.add(tick);

    return function () {
      gsap.ticker.remove(tick);
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
      st.kill(); io.disconnect(); ro.disconnect();
      wrap.classList.remove('webgl-on');
      geo.dispose(); mat.dispose(); tex.dispose(); renderer.dispose();
    };
  }
})();
