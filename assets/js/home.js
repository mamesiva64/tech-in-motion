/*! Tech in Motion — home.js : hero network, title, typer, ticker, sitemap constellation, cards, journey scene */
(function () {
  'use strict';
  const d = document;
  const CATS = window.TIM_CATS || {};
  const TOPICS = window.TIM_TOPICS || [];
  const REDUCED = TIM.reduced;
  const esc = TIM.esc;
  const url = (t) => 'topics/' + t.id + '/';
  const CAT_ICON = { container: 'box', web: 'globe', pki: 'cert', auth: 'key', mail: 'mail', net: 'network', dev: 'git' };
  const onVisible = (el, fn, opt) => {
    if (!window.IntersectionObserver) { fn(true); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => fn(e.isIntersecting, io)), opt || { threshold: 0.15 });
    io.observe(el);
  };

  /* ------------------------------------------------------------------
   * 1) Title: scramble-in per character
   * ----------------------------------------------------------------*/
  (function title() {
    const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*+=<>/\\{}[]';
    const grad = ['#22d3ee', '#60a5fa', '#a78bfa', '#c084fc', '#f472b6', '#fb7185'];
    let idx = 0;
    d.querySelectorAll('.h-title .w').forEach((w) => {
      const word = w.dataset.w;
      [...word].forEach((c, i) => {
        const s = d.createElement('span');
        s.className = 'ch';
        s.textContent = c;
        s.dataset.c = c;
        if (w.classList.contains('w3')) s.style.color = grad[i % grad.length];
        s.style.setProperty('--i', idx++);
        w.appendChild(s);
      });
    });
    const chars = [...d.querySelectorAll('.h-title .ch')];
    if (REDUCED) return;
    chars.forEach((s, i) => {
      s.style.opacity = '0';
      const start = 250 + i * 70;
      setTimeout(() => {
        s.style.opacity = '1';
        s.classList.add('glitch');
        s.animate([{ transform: 'translateY(-0.35em) scale(1.3)', filter: 'blur(10px)', opacity: 0 }, { transform: 'none', filter: 'blur(0)', opacity: 1 }], { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' });
        let n = 0;
        const iv = setInterval(() => {
          s.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0];
          if (++n > 7) { clearInterval(iv); s.textContent = s.dataset.c; s.classList.remove('glitch'); }
        }, 45);
      }, start);
    });
    // occasional glitch
    setInterval(() => {
      const s = chars[(Math.random() * chars.length) | 0];
      if (!s) return;
      s.classList.add('glitch');
      let n = 0;
      const iv = setInterval(() => {
        s.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        if (++n > 4) { clearInterval(iv); s.textContent = s.dataset.c; s.classList.remove('glitch'); }
      }, 50);
    }, 2600);
  })();

  /* ------------------------------------------------------------------
   * 2) Hero canvas: drifting node network with packets
   * ----------------------------------------------------------------*/
  (function network() {
    const cv = d.getElementById('net');
    if (!cv || !cv.getContext) return;
    const ctx = cv.getContext('2d');
    const colors = Object.values(CATS).map((c) => c.color);
    let W = 0, H = 0, DPR = 1, nodes = [], pkts = [], running = false, total = 0;
    const mouse = { x: -9999, y: -9999 };
    const LINK = 150;
    const hudPk = d.getElementById('hud-pk'), hudRtt = d.getElementById('hud-rtt'), hudLayer = d.getElementById('hud-layer');
    const layers = ['L2 · Ethernet', 'L3 · IPv4', 'L4 · TCP', 'L5 · TLS 1.3', 'L7 · HTTP/2', 'L7 · DNS', 'L7 · SMTP'];

    function resize() {
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * DPR; cv.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const n = Math.max(30, Math.min(130, Math.round((W * H) / 12000)));
      nodes = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28,
        r: Math.random() * 1.5 + 0.7,
        c: colors[(Math.random() * colors.length) | 0],
        hub: Math.random() < 0.08,
      }));
      pkts = [];
    }
    function neighbors(i) {
      const a = nodes[i], out = [];
      for (let j = 0; j < nodes.length; j++) {
        if (j === i) continue;
        const b = nodes[j], dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy < LINK * LINK) out.push(j);
      }
      return out;
    }
    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20;
        const mx = n.x - mouse.x, my = n.y - mouse.y, md = mx * mx + my * my;
        if (md < 160 * 160) { n.x += mx * 0.006; n.y += my * 0.006; }
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const al = (1 - Math.sqrt(d2) / LINK) * 0.28;
            ctx.strokeStyle = 'rgba(110,140,210,' + al.toFixed(3) + ')';
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      if (pkts.length < 26 && Math.random() < 0.22) {
        const i = (Math.random() * nodes.length) | 0, nb = neighbors(i);
        if (nb.length) {
          const j = nb[(Math.random() * nb.length) | 0];
          pkts.push({ a: i, b: j, t: 0, v: 0.008 + Math.random() * 0.014, c: colors[(Math.random() * colors.length) | 0], hops: 2 + ((Math.random() * 4) | 0) });
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let k = pkts.length - 1; k >= 0; k--) {
        const p = pkts[k], a = nodes[p.a], b = nodes[p.b];
        p.t += p.v;
        const x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t;
        const tx = a.x + (b.x - a.x) * Math.max(0, p.t - 0.35), ty = a.y + (b.y - a.y) * Math.max(0, p.t - 0.35);
        const g = ctx.createLinearGradient(tx, ty, x, y);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, p.c);
        ctx.strokeStyle = g; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = p.c; ctx.globalAlpha = 0.25;
        ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 6.283); ctx.fill();
        if (p.t >= 1) {
          total++;
          const nb = p.hops > 0 ? neighbors(p.b).filter((q) => q !== p.a) : [];
          if (nb.length) { p.a = p.b; p.b = nb[(Math.random() * nb.length) | 0]; p.t = 0; p.hops--; }
          else pkts.splice(k, 1);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const n of nodes) {
        ctx.fillStyle = n.hub ? n.c : 'rgba(170,190,240,0.55)';
        ctx.beginPath(); ctx.arc(n.x, n.y, n.hub ? n.r + 1.2 : n.r, 0, 6.283); ctx.fill();
        if (n.hub) { ctx.strokeStyle = n.c; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 6, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
      }
      requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener('resize', () => { resize(); if (REDUCED) staticDraw(); });
    cv.parentElement.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    cv.parentElement.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
    function staticDraw() { running = true; frame(); running = false; }
    if (REDUCED) { staticDraw(); return; }
    onVisible(cv.parentElement, (vis) => {
      if (vis && !running && !d.hidden) { running = true; requestAnimationFrame(frame); }
      else if (!vis) running = false;
    }, { threshold: 0 });
    d.addEventListener('visibilitychange', () => { if (d.hidden) running = false; else if (!running) { running = true; requestAnimationFrame(frame); } });
    setInterval(() => {
      if (hudPk) hudPk.textContent = total.toLocaleString();
      if (hudRtt) hudRtt.textContent = (8 + Math.random() * 24).toFixed(1) + ' ms';
    }, 400);
    setInterval(() => { if (hudLayer) hudLayer.textContent = layers[(Math.random() * layers.length) | 0]; }, 2200);
  })();

  /* ------------------------------------------------------------------
   * 3) Typer: cycles real commands from the registry
   * ----------------------------------------------------------------*/
  (function typer() {
    const el = d.getElementById('typer'), tag = d.getElementById('typer-topic');
    if (!el) return;
    const list = [];
    TOPICS.forEach((t) => (t.cmds || []).forEach((c) => { if (!c.includes('…')) list.push({ c, t }); }));
    if (!list.length) return;
    for (let i = list.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [list[i], list[j]] = [list[j], list[i]]; }
    let k = 0;
    const show = (it) => {
      const cat = CATS[it.t.cat] || {};
      tag.textContent = it.t.title;
      tag.style.setProperty('--accent', cat.color || '#22d3ee');
      tag.href = it.t.status === 'ready' ? url(it.t) : '#topics';
    };
    if (REDUCED) { el.textContent = list[0].c; show(list[0]); tag.classList.add('on'); return; }
    async function loop() {
      await new Promise((r) => setTimeout(r, 2000));
      for (;;) {
        const it = list[k++ % list.length];
        tag.classList.remove('on');
        for (let i = 0; i <= it.c.length; i++) { el.textContent = it.c.slice(0, i); await new Promise((r) => setTimeout(r, 26 + Math.random() * 40)); }
        show(it); tag.classList.add('on');
        await new Promise((r) => setTimeout(r, 2400));
        for (let i = it.c.length; i >= 0; i -= 3) { el.textContent = it.c.slice(0, i); await new Promise((r) => setTimeout(r, 12)); }
      }
    }
    loop();
  })();

  /* ------------------------------------------------------------------
   * 4) Ticker
   * ----------------------------------------------------------------*/
  (function ticker() {
    const all = [];
    TOPICS.forEach((t) => (t.cmds || []).forEach((c) => all.push({ c, t })));
    const row = (items) => {
      const html = items.map((it) => '<span class="tk" style="--accent:' + (CATS[it.t.cat] || {}).color + '"><i>' + esc(it.t.title) + '</i><b>$</b> ' + esc(it.c) + '</span>').join('');
      return html + html;
    };
    const half = Math.ceil(all.length / 2);
    const t1 = d.getElementById('tick1'), t2 = d.getElementById('tick2');
    if (t1) t1.innerHTML = row(all.slice(0, half));
    if (t2) t2.innerHTML = row(all.slice(half));
  })();

  /* ------------------------------------------------------------------
   * 5) Stats
   * ----------------------------------------------------------------*/
  (function stats() {
    const vals = {
      topics: TOPICS.length,
      cats: Object.keys(CATS).length,
      cmds: TOPICS.reduce((n, t) => n + (t.cmds || []).length, 0),
    };
    d.querySelectorAll('[data-count]').forEach((b) => {
      const to = vals[b.dataset.count] || 0;
      if (REDUCED) { b.textContent = to; return; }
      onVisible(b, (vis, io) => {
        if (!vis) return;
        io.disconnect();
        const t0 = performance.now();
        const tick = () => {
          const p = Math.min(1, (performance.now() - t0) / 1200);
          b.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(tick);
        };
        tick();
      });
    });
  })();

  /* ------------------------------------------------------------------
   * 6) Sitemap constellation (SVG)
   * ----------------------------------------------------------------*/
  (function map() {
    const svg = d.getElementById('map-svg'), card = d.getElementById('map-card'), wrap = d.getElementById('map-wrap');
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';
    const C = { x: 600, y: 380 };
    const catKeys = Object.keys(CATS);
    const catPos = {}, topPos = {};
    catKeys.forEach((k, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / catKeys.length;
      catPos[k] = { a, x: C.x + Math.cos(a) * 250, y: C.y + Math.sin(a) * 182 };
      const list = TOPICS.filter((t) => t.cat === k);
      const spread = list.length > 2 ? 0.27 : 0.3;
      list.forEach((t, j) => {
        const ta = a + (j - (list.length - 1) / 2) * spread;
        topPos[t.id] = { a: ta, x: C.x + Math.cos(ta) * 448, y: C.y + Math.sin(ta) * 300, t };
      });
    });
    const el = (tag, attrs, parent) => {
      const e = d.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(e);
      return e;
    };
    const defs = el('defs', {}, svg);
    defs.innerHTML = '<linearGradient id="mg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset=".5" stop-color="#a78bfa"/><stop offset="1" stop-color="#f472b6"/></linearGradient>';
    const gRel = el('g', {}, svg), gEdge = el('g', {}, svg), gPk = el('g', {}, svg), gNode = el('g', {}, svg);

    // orbits + hub
    el('circle', { class: 'm-orbit', cx: C.x, cy: C.y, r: 92 }, gEdge);
    el('circle', { class: 'm-orbit o2', cx: C.x, cy: C.y, r: 128 }, gEdge);
    const hub = el('g', { class: 'm-pop', style: '--d:0s' }, gNode);
    el('circle', { class: 'm-hub-c', cx: C.x, cy: C.y, r: 56 }, hub);
    el('text', { class: 'm-hub-t', x: C.x, y: C.y + 2 }, hub).textContent = 'TIM';
    el('text', { class: 'm-hub-s', x: C.x, y: C.y + 20 }, hub).textContent = 'SITEMAP';

    const edges = [];
    const qPath = (a, b, bend) => {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const cx = mx + (C.x - mx) * bend, cy = my + (C.y - my) * bend;
      return 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + 'Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
    };

    // hub → category edges, category nodes
    catKeys.forEach((k, i) => {
      const p = catPos[k], color = CATS[k].color;
      const hx = C.x + Math.cos(p.a) * 56, hy = C.y + Math.sin(p.a) * 56;
      const e = el('path', { class: 'm-edge hub', d: 'M' + hx + ' ' + hy + 'L' + p.x + ' ' + p.y, pathLength: 1, style: '--c:' + color + ';--d:' + (0.2 + i * 0.06) + 's' }, gEdge);
      e.dataset.cat = k;
      edges.push({ path: e, color, kind: 'hub' });
      const g = el('g', { class: 'm-cat m-pop', style: '--c:' + color + ';--d:' + (0.35 + i * 0.07) + 's' }, gNode);
      g.dataset.cat = k;
      el('circle', { class: 'm-cat-c', cx: p.x, cy: p.y, r: 25 }, g);
      const ic = el('svg', { class: 'm-cat-i', x: p.x - 11, y: p.y - 11, width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      ic.innerHTML = TIM.icon(CAT_ICON[k] || 'box').replace(/^<svg[^>]*>|<\/svg>$/g, '');
      const below = Math.sin(p.a) > -0.3;
      const ty = below ? p.y + 44 : p.y - 44;
      el('text', { class: 'm-cat-t', x: p.x, y: ty }, g).textContent = CATS[k].ja;
      el('text', { class: 'm-cat-e', x: p.x, y: ty + 13 }, g).textContent = CATS[k].name;
    });

    // category → topic edges + topic nodes
    let ti = 0;
    const topicEls = {};
    TOPICS.forEach((t) => {
      const p = topPos[t.id], cp = catPos[t.cat], color = (CATS[t.cat] || {}).color || '#22d3ee';
      if (!p || !cp) return;
      const e = el('path', { class: 'm-edge', d: qPath(cp, p, -0.12), pathLength: 1, style: '--c:' + color + ';--d:' + (0.7 + ti * 0.05) + 's' }, gEdge);
      e.dataset.topic = t.id;
      edges.push({ path: e, color, kind: 'topic', id: t.id });
      const ready = t.status === 'ready';
      const a = el('a', { class: 'm-top m-pop' + (ready ? '' : ' soon'), style: '--c:' + color + ';--d:' + (0.9 + ti * 0.06) + 's;--pd:' + (ti * 0.19).toFixed(2) + 's', tabindex: 0 }, gNode);
      if (ready) a.setAttribute('href', url(t));
      a.setAttribute('aria-label', t.title + '：' + t.sub);
      a.dataset.id = t.id;
      el('circle', { class: 'm-top-r', cx: p.x, cy: p.y, r: 12 }, a);
      el('circle', { cx: p.x, cy: p.y, r: 26, fill: 'transparent' }, a);
      el('circle', { class: 'm-top-c', cx: p.x, cy: p.y, r: 7.5 }, a);
      const cos = Math.cos(p.a), sin = Math.sin(p.a);
      let anchor = 'middle', lx = p.x, ly = p.y;
      if (cos > 0.25) { anchor = 'start'; lx = p.x + 16; ly = p.y + 5; }
      else if (cos < -0.25) { anchor = 'end'; lx = p.x - 16; ly = p.y + 5; }
      else { ly = sin < 0 ? p.y - 20 : p.y + 28; }
      el('text', { class: 'm-top-t', x: lx, y: ly, 'text-anchor': anchor }, a).textContent = t.title;
      el('text', { class: 'm-top-s', x: lx, y: ly + 14, 'text-anchor': anchor }, a).textContent = ready ? (t.tags || []).slice(0, 2).join(' · ') : 'COMING SOON';
      topicEls[t.id] = a;
      ti++;
    });

    // related links (deduped)
    const seen = new Set();
    TOPICS.forEach((t) => (t.related || []).forEach((r) => {
      const key = [t.id, r].sort().join('|');
      if (seen.has(key) || !topPos[r] || !topPos[t.id]) return;
      seen.add(key);
      const e = el('path', { class: 'm-rel m-fade', d: qPath(topPos[t.id], topPos[r], 0.55), style: '--d:' + (1.8 + seen.size * 0.03) + 's' }, gRel);
      e.dataset.a = t.id; e.dataset.b = r;
      edges.push({ path: e, color: '#ffffff', kind: 'rel', a: t.id, b: r });
    }));

    // card
    const defaultCard = () => {
      wrap.style.setProperty('--accent', '#22d3ee');
      const ready = TOPICS.filter((t) => t.status === 'ready').length;
      card.innerHTML = '<div class="mc-k">SITEMAP · ' + TOPICS.length + ' TOPICS</div><div class="mc-t">ノードにカーソルを</div><p class="mc-s">カテゴリ（中円）→ トピック（外周）。破線は関連トピック。公開済み ' + ready + ' / ' + TOPICS.length + '。</p><div class="mc-c"><b>$</b> open https://mamesiva64.github.io/tech-in-motion/</div>';
    };
    const showCard = (t) => {
      const cat = CATS[t.cat] || {};
      wrap.style.setProperty('--accent', cat.color);
      card.innerHTML = '<div class="mc-k">' + esc(cat.ja) + ' · ' + esc(cat.name) + '</div><div class="mc-t">' + esc(t.title) + '</div><p class="mc-s">' + esc(t.sub) + '</p>' +
        (t.cmds || []).slice(0, 2).map((c) => '<div class="mc-c"><b>$</b> ' + esc(c) + '</div>').join('<div style="height:6px"></div>') +
        '<div class="mc-tags">' + (t.tags || []).map((x) => '<span>' + esc(x) + '</span>').join('') + '</div>' +
        '<div class="mc-hint">' + (t.status === 'ready' ? 'CLICK TO OPEN →' : 'COMING SOON') + '</div>';
    };
    defaultCard();
    const focus = (id) => {
      const t = TOPICS.find((x) => x.id === id);
      if (!t) return;
      svg.classList.add('focus');
      svg.querySelectorAll('.hot, .me').forEach((x) => x.classList.remove('hot', 'me'));
      const rel = new Set([id, ...(t.related || [])]);
      TOPICS.forEach((x) => { if ((x.related || []).includes(id)) rel.add(x.id); });
      rel.forEach((r) => topicEls[r] && topicEls[r].classList.add('hot'));
      topicEls[id].classList.add('me');
      svg.querySelectorAll('.m-cat').forEach((c) => { if (c.dataset.cat === t.cat) c.classList.add('hot'); });
      svg.querySelectorAll('.m-edge').forEach((e) => { if (e.dataset.topic === id || e.dataset.cat === t.cat) e.classList.add('hot'); });
      svg.querySelectorAll('.m-rel').forEach((e) => { if (e.dataset.a === id || e.dataset.b === id) e.classList.add('hot'); });
      showCard(t);
    };
    const blur = () => { svg.classList.remove('focus'); svg.querySelectorAll('.hot, .me').forEach((x) => x.classList.remove('hot', 'me')); defaultCard(); };
    Object.entries(topicEls).forEach(([id, a]) => {
      a.addEventListener('pointerenter', () => focus(id));
      a.addEventListener('focus', () => focus(id));
      a.addEventListener('pointerleave', blur);
      a.addEventListener('blur', blur);
      a.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && a.getAttribute('href')) location.href = a.getAttribute('href'); });
    });

    // packets travelling along edges
    const pk = [];
    const lens = edges.map((e) => e.path.getTotalLength());
    let running = false;
    const spawn = () => {
      const i = (Math.random() * edges.length) | 0;
      const e = edges[i];
      const c = el('circle', { class: 'm-pk', r: e.kind === 'rel' ? 1.8 : 2.4, style: '--c:' + e.color }, gPk);
      pk.push({ c, i, t: 0, v: 0.004 + Math.random() * 0.006, rev: e.kind !== 'hub' && Math.random() < 0.4 });
    };
    const tick = () => {
      if (!running) return;
      if (pk.length < 22 && Math.random() < 0.12) spawn();
      for (let k = pk.length - 1; k >= 0; k--) {
        const p = pk[k];
        p.t += p.v;
        if (p.t >= 1) { p.c.remove(); pk.splice(k, 1); continue; }
        const e = edges[p.i], L = lens[p.i];
        const pt = e.path.getPointAtLength((p.rev ? 1 - p.t : p.t) * L);
        p.c.setAttribute('cx', pt.x.toFixed(1));
        p.c.setAttribute('cy', pt.y.toFixed(1));
        p.c.setAttribute('opacity', Math.min(1, Math.sin(p.t * Math.PI) * 1.6).toFixed(2));
      }
      requestAnimationFrame(tick);
    };
    onVisible(wrap, (vis) => {
      if (vis) {
        svg.classList.add('in');
        if (!running && !REDUCED) { running = true; requestAnimationFrame(tick); }
      } else running = false;
    }, { threshold: 0.12 });
  })();

  /* ------------------------------------------------------------------
   * 7) Topic cards + filters
   * ----------------------------------------------------------------*/
  (function cards() {
    const grid = d.getElementById('grid'), flt = d.getElementById('filters');
    if (!grid) return;
    grid.innerHTML = TOPICS.map((t, i) => {
      const cat = CATS[t.cat] || {};
      const ready = t.status === 'ready';
      const tag = ready ? 'a' : 'div';
      return '<' + tag + ' class="tc reveal' + (ready ? '' : ' soon') + '" data-cat="' + t.cat + '" style="--accent:' + cat.color + ';--rd:' + ((i % 3) * 0.08).toFixed(2) + 's"' + (ready ? ' href="' + url(t) + '"' : '') + '>' +
        '<span class="tc-scan"></span>' +
        '<div class="tc-top"><span class="tc-ic">' + TIM.icon(CAT_ICON[t.cat] || 'box') + '</span><span class="tc-cat">' + esc(cat.ja || '') + '</span><span class="tc-no">' + String(i + 1).padStart(2, '0') + '</span></div>' +
        '<h3>' + esc(t.title) + '</h3><p>' + esc(t.sub) + '</p>' +
        '<div class="tc-cmd"><b>$</b>' + esc((t.cmds || [''])[0]) + '</div>' +
        '<div class="tc-tags">' + (t.tags || []).slice(0, 5).map((x) => '<span>' + esc(x) + '</span>').join('') + '</div>' +
        '<div class="tc-go"><span>' + esc(cat.name || '') + '</span><em>' + (ready ? 'OPEN →' : 'SOON') + '</em></div>' +
        '</' + tag + '>';
    }).join('');
    grid.querySelectorAll('.tc').forEach((c) => {
      c.addEventListener('pointermove', (e) => {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', e.clientX - r.left + 'px');
        c.style.setProperty('--my', e.clientY - r.top + 'px');
      });
    });
    if (window.IntersectionObserver && !REDUCED) {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
      grid.querySelectorAll('.reveal').forEach((c) => io.observe(c));
    } else grid.querySelectorAll('.reveal').forEach((c) => c.classList.add('in'));

    const keys = ['all', ...Object.keys(CATS)];
    flt.innerHTML = keys.map((k) => {
      const n = k === 'all' ? TOPICS.length : TOPICS.filter((t) => t.cat === k).length;
      const c = k === 'all' ? '#dde5f6' : CATS[k].color;
      return '<button class="flt' + (k === 'all' ? ' on' : '') + '" data-k="' + k + '" style="--accent:' + c + '" role="tab"><i></i>' + (k === 'all' ? 'ALL' : esc(CATS[k].ja)) + '<small>' + n + '</small></button>';
    }).join('');
    flt.addEventListener('click', (ev) => {
      const b = ev.target.closest('.flt');
      if (!b) return;
      flt.querySelectorAll('.flt').forEach((x) => x.classList.toggle('on', x === b));
      const k = b.dataset.k;
      grid.querySelectorAll('.tc').forEach((c, i) => {
        const show = k === 'all' || c.dataset.cat === k;
        c.classList.toggle('gone', !show);
        if (show && !REDUCED) c.animate([{ opacity: 0, transform: 'translateY(12px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: (i % 6) * 40, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      });
    });
  })();

  /* ------------------------------------------------------------------
   * 8) Journey scene — one curl across every topic
   * ----------------------------------------------------------------*/
  (function journey() {
    const link = (id, label) => {
      const t = TOPICS.find((x) => x.id === id);
      const c = t ? (CATS[t.cat] || {}).color : '#22d3ee';
      return '<a class="jl" style="--jc:' + c + '" href="topics/' + id + '/">' + esc(label || (t ? t.title : id)) + ' →</a>';
    };
    TIM.scene('#sc-journey', {
      intro: 'ターミナルで <code>curl</code> を 1 回実行したときに、どのホストのどのプロセスが、どのファイルを読み、どんなメッセージをやりとりするかを順番に追います。各ステップのリンクから詳しいページへ。',
      steps: [
        {
          title: 'コマンドを実行する',
          text: '<code>-v</code> を付けると、curl は名前解決・接続・TLS・HTTP の各段階をログに出します。以降のステップはこのログの 1 行 1 行に対応しています。',
          code: { title: 'zsh', lang: 'bash', src: `
            $ curl -v https://api.example.com/v1/users/42 \\
                -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjIwMjYtMDkifQ…"` },
          run: async (s) => {
            s.state('client', 'active');
            await s.term('term', '$ curl -v https://api.example.com/v1/users/42 -H "Authorization: Bearer eyJhbGci…"');
          },
        },
        {
          title: '名前解決：api.example.com → 203.0.113.10',
          text: 'libcurl が <code>getaddrinfo()</code> を呼び、OS のスタブリゾルバが <code>/etc/resolv.conf</code> の <code>nameserver</code> に UDP 53 番で問い合わせます。<br>' + link('dns', 'DNS 名前解決'),
          code: { title: '$ dig +noall +answer api.example.com A', lang: 'dns', src: `
            ;; /etc/resolv.conf → nameserver 192.0.2.53
            api.example.com.   300   IN   A   ⟪203.0.113.10⟫` },
          run: async (s) => {
            await s.fly('client:tr', 'dns:l', { label: 'A? api.example.com', cls: 'c-blue', arc: -30 });
            s.state('dns', 'active');
            await s.fly('dns:l', 'client:tr', { label: '203.0.113.10 TTL 300', cls: 'c-blue', arc: 30 });
            s.state('dns', null);
            await s.show('ipchip', { fx: 'pop' });
            await s.term('term', '* Host api.example.com:443 was resolved.\n* IPv4: 203.0.113.10');
          },
        },
        {
          title: 'TCP 3-way handshake（:443）',
          text: 'カーネルが <code>SYN</code> → <code>SYN-ACK</code> → <code>ACK</code> を交換してコネクションを確立します。ここまではまだ平文で、中身は空です。',
          code: { title: 'curl -v', lang: 'text', src: `
            *   Trying 203.0.113.10:443...
            * Connected to api.example.com (203.0.113.10) port 443` },
          run: async (s) => {
            await s.fly('client:r', 'nginx:l', { label: 'SYN', cls: 'c-gray', dur: 700 });
            await s.fly('nginx:l', 'client:r', { label: 'SYN-ACK', cls: 'c-gray', dur: 700 });
            await s.fly('client:r', 'nginx:l', { label: 'ACK', cls: 'c-gray', dur: 700 });
            s.line('client:r', 'nginx:l', { cls: 'dash', arrow: false, id: 'tcp' });
            await s.term('term', '* Connected to api.example.com (203.0.113.10) port 443');
          },
        },
        {
          title: 'TLS 1.3：証明書を受け取り、チェーンを検証する',
          text: 'ClientHello に SNI <code>api.example.com</code> を載せて送信。nginx は <code>ssl_certificate</code> の fullchain.pem を返し、CertificateVerify で秘密鍵を持っていることを証明します。curl はトラストストアのルート CA までチェーンを検証し、SAN とホスト名を照合します。<br>' + link('https-tls', 'TLS 1.3') + link('x509', 'X.509') + link('ca-pki', 'CA'),
          code: { title: 'curl -v', lang: 'text', src: `
            * TLSv1.3 (OUT), TLS handshake, Client hello (1):
            * TLSv1.3 (IN), TLS handshake, Server hello (2):
            * TLSv1.3 (IN), TLS handshake, Certificate (11):
            * TLSv1.3 (IN), TLS handshake, CERT verify (15):
            * SSL connection using ⟪TLSv1.3 / TLS_AES_256_GCM_SHA384⟫ / X25519
            *  subject: CN=api.example.com
            *  subjectAltName: host "api.example.com" matched cert's "api.example.com"
            *  SSL certificate verify ok.` },
          run: async (s) => {
            await s.fly('client:r', 'nginx:l', { label: 'ClientHello · SNI', cls: 'c-violet', arc: -34 });
            s.state('nginx', 'active');
            await s.show('cert', { fx: 'zoom' });
            await s.show('key', { fx: 'pop' });
            await s.fly('nginx:l', 'client:r', { label: 'Certificate + CertVerify', cls: 'c-violet', arc: 40 });
            await s.scan('client');
            await s.show('chain', { fx: 'pop' });
            s.state('nginx', null);
            s.hide('tcp');
            s.line('client:r', 'nginx:l', { cls: 'flow c-violet', label: '🔒', id: 'tls', arrow: false });
            await s.term('term', '* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384\n*  SSL certificate verify ok.');
          },
        },
        {
          title: 'HTTP リクエスト（暗号化されたレコードの中身）',
          text: 'ここで初めて HTTP が流れます。ネットワーク上では TLS の application_data レコードとしか見えず、パスもヘッダも暗号化されています。<br>' + link('http', 'HTTP') + link('webapi', 'Web API'),
          code: { title: 'HTTP/2 request (decrypted view)', lang: 'http', src: `
            GET /v1/users/42 HTTP/2
            Host: api.example.com
            User-Agent: curl/8.9.1
            Accept: */*
            ⟪Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjIwMjYtMDkifQ…⟫` },
          run: async (s) => {
            await s.fly('client:r', 'nginx:l', { label: '🔒 GET /v1/users/42', cls: 'c-lime', arc: -30 });
            s.state('nginx', 'active');
            await s.term('term', '> GET /v1/users/42 HTTP/2\n> Host: api.example.com');
          },
        },
        {
          title: 'リバースプロキシ → コンテナ',
          text: 'nginx は TLS を終端し、<code>proxy_pass http://api:8080;</code> で平文 HTTP としてコンテナへ転送します。<code>api</code> という名前は Docker の組み込み DNS（<code>127.0.0.11</code>）がコンテナの IP に解決します。<br>' + link('docker-compose', 'Docker Compose') + link('docker', 'Docker'),
          code: { title: '/etc/nginx/conf.d/api.conf', lang: 'text', src: `
            server {
              listen 443 ssl;
              server_name api.example.com;
              ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
              ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;
              location /v1/ {
                ⟪proxy_pass http://api:8080;⟫
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
              }
            }` },
          run: async (s) => {
            s.state('nginx', null);
            s.line('nginx:r', 'api:l', { cls: 'acc c-cyan', label: ':8080' });
            await s.fly('nginx:r', 'api:l', { label: 'GET /v1/users/42', cls: 'c-cyan' });
            s.state('api', 'active');
          },
        },
        {
          title: 'API が JWT の署名を検証する',
          text: 'api は <code>Authorization</code> ヘッダから JWT を取り出し、ヘッダの <code>kid</code> に対応する公開鍵を認可サーバーの <code>jwks.json</code>（キャッシュ）から選び、<code>header.payload</code> に対する RS256 署名を検証。続けて <code>exp</code>・<code>aud</code>・<code>iss</code> を確認します。<br>' + link('jwt', 'JWT') + link('oauth-oidc', 'OAuth 2.0 / OIDC'),
          code: [
            { title: 'JWT header / payload (base64url decoded)', lang: 'json', src: `
              { "alg": "RS256", "typ": "JWT", "kid": "⟪2026-09⟫" }
              { "iss": "https://auth.example.com", "sub": "42",
                "aud": "api.example.com", "exp": 1790000000, "scope": "users:read" }` },
          ],
          run: async (s) => {
            await s.show('jwt', { fx: 'zoom' });
            s.line('auth:b', 'api:t', { cls: 'dash c-pink', label: 'JWKS (cached)', arrow: true });
            await s.fly('auth:b', 'api:t', { label: 'kid=2026-09 · n,e', cls: 'c-pink', dur: 800 });
            await s.scan('jwt');
            await s.stamp('jwt', 'SIG OK', { cls: 'st-ok' });
            s.state('jwt', 'ok');
          },
        },
        {
          title: '200 OK が同じ経路を戻る',
          text: 'api が DB から取得した行を JSON にして返し、nginx が再び TLS で暗号化して curl へ。curl は復号して標準出力に JSON を書き出します。',
          code: { title: 'curl -v', lang: 'http', src: `
            HTTP/2 200
            content-type: application/json
            content-length: 58

            {"id":42,"name":"alice","email":"alice@example.com"}` },
          run: async (s) => {
            await s.show('json', { fx: 'up' });
            await s.fly('api:l', 'nginx:r', { label: '200 OK', cls: 'c-lime' });
            await s.fly('nginx:l', 'client:r', { label: '🔒 200 · JSON', cls: 'c-lime', arc: 30 });
            s.state('api', 'ok');
            s.state('client', 'ok');
            await s.term('term', '< HTTP/2 200\n< content-type: application/json\n{"id":42,"name":"alice",…}');
          },
        },
      ],
    });
  })();
})();
