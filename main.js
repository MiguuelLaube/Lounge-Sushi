(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loaded = () => document.body.classList.add('is-loaded');
  requestAnimationFrame(loaded); setTimeout(loaded, 60);

  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  /* ---------------- entradas ao rolar ---------------- */
  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%',
      once: true,
      interval: 0.08,
      onEnter: (els) => els.forEach((el, i) => setTimeout(() => el.classList.add('in'), i * 90)),
    });
  } else {
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('in'));
  }

  /* ---------------- o hot cai do céu e o hashi pega ---------------- */
  if (hasGsap) {
    const sticks = document.getElementById('bandSticks');
    const hot = document.getElementById('fallingHot');
    const shadow = document.querySelector('.catch-shadow');

    gsap.set(sticks, { '--open': 1 });
    const catchTl = gsap.timeline({
      scrollTrigger: { trigger: '.band', start: 'top 95%', end: 'top 18%', scrub: 0.6 },
    });
    catchTl
      // queda: vem girando lá de cima, o hashi esperando aberto
      .fromTo(hot,
        { y: () => -window.innerHeight * 0.95, rotation: -340, scale: 0.75, opacity: 0 },
        { y: 0, rotation: 0, scale: 1, opacity: 1, ease: 'power2.in', duration: 1 })
      .fromTo(shadow, { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 0.9, ease: 'power2.in', duration: 1 }, 0)
      // o hashi fecha e prende o hot
      .to(sticks, { '--open': 0, duration: 0.22, ease: 'back.out(3)' })
      .to(hot, { scaleX: 1.08, scaleY: 0.9, duration: 0.08, yoyo: true, repeat: 1 }, '<')
      // e levanta um pouquinho, como quem vai comer
      .to(hot, { y: -16, rotation: -4, duration: 0.45, ease: 'power1.out' })
      .to(shadow, { scale: 0.8, opacity: 0.55, duration: 0.45 }, '<');

    // caligrafia com parallax (desligado com "reduzir movimento")
    if (!reduce) {
      gsap.to('.kanji-hero', { yPercent: -25, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.fromTo('.kanji-band', { yPercent: -12 }, { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.band', start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.utils.toArray('.birds').forEach((b, i) => {
        gsap.fromTo(b, { x: i % 2 ? 60 : -60, opacity: 0 }, { x: 0, opacity: 1, ease: 'power2.out', scrollTrigger: { trigger: b, start: 'top 95%', end: 'top 60%', scrub: 0.5 } });
      });
    }
  }


  /* ---------------- cardápio no desktop: duas colunas equilibradas ---------------- */
  const colsBox = document.querySelector('.menu-cols');
  const catOrder = [...colsBox.querySelectorAll('.menu-cat')];
  function balanceMenu() {
    colsBox.classList.add('balanced');
    colsBox.innerHTML = '';
    const a = document.createElement('div'), b = document.createElement('div');
    a.className = b.className = 'menu-col';
    colsBox.append(a, b);
    // mede cada categoria na largura da coluna e testa todas as divisões
    // possíveis (são só 14) para achar a que deixa as colunas mais iguais
    catOrder.forEach((cat) => a.appendChild(cat));
    const h = catOrder.map((cat) => cat.offsetHeight + parseFloat(getComputedStyle(cat).marginBottom));
    const total = h.reduce((x, y) => x + y, 0);
    let best = 1, bestDiff = Infinity;
    for (let mask = 1; mask < 1 << h.length; mask += 2) { // a 1ª categoria fica sempre na esquerda
      let sum = 0;
      for (let i = 0; i < h.length; i++) if (mask & (1 << i)) sum += h[i];
      const diff = Math.abs(total - 2 * sum);
      if (diff < bestDiff) { bestDiff = diff; best = mask; }
    }
    catOrder.forEach((cat, i) => ((best & (1 << i)) ? a : b).appendChild(cat));
    if (hasGsap) ScrollTrigger.refresh();
  }
  balanceMenu();
  document.fonts && document.fonts.ready.then(balanceMenu);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(balanceMenu, 250); });

  /* ---------------- cardápio-livro no celular ---------------- */
  const mq = matchMedia('(max-width: 900px)');
  const menu = document.querySelector('.menu');
  const wrap = document.getElementById('bookWrap');
  const book = document.getElementById('book');
  const btnPrev = document.getElementById('bookPrev');
  const btnNext = document.getElementById('bookNext');
  const count = document.getElementById('bookCount');
  const KANJI = { 'Combinados': '盛', 'Hots': '揚', 'Joy e Dragon': '龍', 'Temaki': '巻', 'Niguiri': '握', 'Hossomaki': '細', 'Sashimi': '刺', 'Entradas': '前', 'Pastéis Harumaki': '包', 'Yakissoba': '麺', 'Culinária chinesa': '中', 'Tepan': '鉄', 'Sobremesa': '甘', 'Monte seu poke': '丼' };

  let pages = [], names = [], idx = 0, built = false, busy = false, current = null;
  // um gesto novo conclui na hora a virada que ainda estiver acontecendo
  const settle = () => { if (current) current.progress(1); };

  const logoHTML = document.querySelector('.logo-word').outerHTML;

  function face(inner, extraClass = '') {
    const p = document.createElement('div');
    p.className = 'bk-page ' + extraClass;
    p.innerHTML = `<div class="bk-face bk-front">${inner}</div><div class="bk-face bk-back"></div>`;
    return p;
  }

  // Monta o livro: cada categoria ocupa quantas páginas precisar, sem rolagem
  // dentro da página (assim o arrasto vertical sempre rola o site).
  function build() {
    const total = catOrder.length;
    book.innerHTML = '';
    pages = []; names = [];
    const add = (p, name) => { book.appendChild(p); pages.push(p); names.push(name); return p; };

    add(face(`<div class="bk-cover-in">${logoHTML}<p>Sushi Bar · Cardápio</p><div class="bk-sun"><span>品書</span></div><p>${total} categorias · preços em reais</p><span class="swipe">‹ deslize para abrir</span></div>`, 'bk-cover'), 'Capa');

    catOrder.forEach((cat) => {
      const name = cat.querySelector('h3').textContent.trim();
      const note = cat.querySelector('.menu-note');
      const items = [...cat.querySelectorAll('.menu-list > li')];
      let i = 0, part = 0;
      while (i < items.length) {
        const p = add(face(`<div class="bk-in"><span class="bk-kanji" aria-hidden="true">${KANJI[name] || '品'}</span><h3>${name}${part ? ' <small>continuação</small>' : ''}</h3>${part === 0 && note ? note.outerHTML : ''}<ul class="menu-list"></ul></div><div class="bk-foot"><span>Lounge Sushi Bar</span><span class="bk-num"></span></div>`), name);
        const inner = p.querySelector('.bk-in'), ul = p.querySelector('ul');
        let placed = 0;
        while (i < items.length) {
          ul.appendChild(items[i].cloneNode(true));
          if (inner.scrollHeight > inner.clientHeight + 1 && placed > 0) { ul.lastChild.remove(); break; }
          i++; placed++;
        }
        part++;
      }
    });

    add(face(`<div class="bk-cover-in"><div class="bk-sun"><span>寿司</span></div><p>Escolheu?</p><a class="btn-line btn-line-red" href="https://wa.me/5582991163767">Pedir pelo WhatsApp</a><p>(82) 99116-3767</p></div>`, 'bk-cover bk-last'), 'Contracapa');

    const inner = pages.length - 2;
    pages.forEach((p, n) => {
      p.style.zIndex = pages.length - n;
      p.classList.add('flat');
      const num = p.querySelector('.bk-num');
      if (num) num.textContent = `${n} / ${inner}`;
    });
    idx = 0;
    built = true;
    refresh();
  }

  // Parada, a página fica "plana" (sem 3D) para o texto ficar nítido;
  // só vira camada 3D enquanto está sendo virada.
  function setTurn(p, deg) {
    const t = Math.sin(Math.min(Math.abs(deg), 180) * Math.PI / 180);
    if (Math.abs(deg) < 0.01) {
      if (hasGsap) gsap.set(p, { clearProps: 'transform' }); else p.style.transform = '';
      p.classList.add('flat');
      p.style.setProperty('--turn', 0);
      return;
    }
    p.classList.remove('flat');
    if (hasGsap) gsap.set(p, { rotationY: deg, skewY: t * -2.5, z: 1 });
    else p.style.transform = `rotateY(${deg}deg)`;
    p.style.setProperty('--turn', t.toFixed(3));
  }

  function animateTurn(p, to, done) {
    busy = true;
    p.style.visibility = 'visible';
    const from = hasGsap && !p.classList.contains('flat') ? gsap.getProperty(p, 'rotationY') : 0;
    if (!hasGsap) { setTurn(p, to); finish(); return; }
    const o = { d: from };
    current = gsap.to(o, {
      d: to, duration: 0.6 * Math.max(0.4, Math.abs(to - from) / 180), ease: 'power2.inOut',
      onUpdate: () => setTurn(p, o.d),
      onComplete: finish,
    });
    function finish() {
      if (to <= -179) p.style.visibility = 'hidden';
      busy = false; current = null;
      done && done();
      refresh();
    }
  }

  function next() { settle(); if (idx >= pages.length - 1) return; const p = pages[idx]; animateTurn(p, -180, () => { idx++; refresh(); }); }
  function prev() { settle(); if (idx <= 0) return; const p = pages[idx - 1]; p.style.visibility = 'visible'; animateTurn(p, 0, () => { idx--; refresh(); }); }

  function refresh() {
    btnPrev.disabled = idx === 0;
    btnNext.disabled = idx === pages.length - 1;
    const n = names[idx];
    count.textContent = idx === 0 || idx === pages.length - 1 ? n : `${n} · ${idx}/${pages.length - 2}`;
  }

  // arrastar com o dedo: a página acompanha e vira de verdade
  let sx = 0, sy = 0, dragging = false, decided = false, target = null, dir = 0, W = 1;
  book.addEventListener('pointerdown', (e) => {
    settle();
    sx = e.clientX; sy = e.clientY; dragging = true; decided = false; target = null; W = book.clientWidth;
  });
  book.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!decided) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      decided = true;
      if (Math.abs(dy) > Math.abs(dx)) { dragging = false; return; } // rolagem vertical
      dir = dx < 0 ? 1 : -1;
      if (dir === 1 && idx < pages.length - 1) target = pages[idx];
      else if (dir === -1 && idx > 0) { target = pages[idx - 1]; target.style.visibility = 'visible'; }
      else { dragging = false; return; }
      book.setPointerCapture(e.pointerId);
    }
    if (!target) return;
    e.preventDefault();
    const deg = dir === 1 ? Math.max(-180, Math.min(0, dx / W * 180)) : Math.max(-180, Math.min(0, -180 + dx / W * 180));
    setTurn(target, deg);
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    if (!target) return;
    const dx = e.clientX - sx;
    if (dir === 1) {
      if (dx < -W * 0.22) animateTurn(target, -180, () => { idx++; refresh(); });
      else animateTurn(target, 0);
    } else {
      if (dx > W * 0.22) animateTurn(target, 0, () => { idx--; refresh(); });
      else animateTurn(target, -180);
    }
    target = null;
  };
  book.addEventListener('pointerup', end);
  book.addEventListener('pointercancel', end);
  btnNext.addEventListener('click', next);
  btnPrev.addEventListener('click', prev);
  wrap.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); });

  function applyMode() {
    if (mq.matches) {
      wrap.hidden = false;
      if (!built) build();
      menu.classList.add('has-book');
    } else {
      wrap.hidden = true;
      menu.classList.remove('has-book');
    }
    if (hasGsap) ScrollTrigger.refresh();
  }
  mq.addEventListener('change', applyMode);
  let lastW = innerWidth, bt;
  addEventListener('resize', () => {
    if (innerWidth === lastW) return; // ignora a barra do navegador do celular aparecendo/sumindo
    lastW = innerWidth; clearTimeout(bt);
    bt = setTimeout(() => { if (mq.matches) build(); else built = false; }, 300);
  });
  document.fonts && document.fonts.ready.then(() => { if (mq.matches) build(); });
  applyMode();

  // links do topo para categorias abrem a página certa do livro no celular
  document.querySelectorAll('a[href^="#m-"]').forEach((a) => a.addEventListener('click', (e) => {
    if (!mq.matches) return;
    e.preventDefault();
    const name = document.querySelector(a.hash + ' h3')?.textContent.trim();
    const target = names.indexOf(name);
    if (target < 0) return;
    pages.forEach((p, i) => { if (i < target) { setTurn(p, -180); p.style.visibility = 'hidden'; } else { setTurn(p, 0); p.style.visibility = 'visible'; } });
    idx = target; refresh();
    wrap.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }));

  window.addEventListener('load', () => hasGsap && ScrollTrigger.refresh());
})();
