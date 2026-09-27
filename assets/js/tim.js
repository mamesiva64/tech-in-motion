/*! Tech in Motion — tim.js
 *  Motion engine (step scenes) + site chrome + code highlighter. No dependencies.
 *  See AGENT.md §7 for the API.
 */
(function () {
  'use strict';

  const TIM = (window.TIM = window.TIM || {});
  const d = document;
  const ROOT = d.body.dataset.root || './';
  const REPO = 'https://github.com/mamesiva64/tech-in-motion';
  const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };
  const SPEEDS = [0.75, 1, 1.5, 2];
  let SPEED = parseFloat(store.get('tim.speed')) || 1;
  if (!SPEEDS.includes(SPEED)) SPEED = 1;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const EASE = {
    out: 'cubic-bezier(.2,.8,.2,1)',
    inOut: 'cubic-bezier(.65,0,.35,1)',
    back: 'cubic-bezier(.34,1.56,.64,1)',
  };

  function h(tag, cls, html) {
    const e = d.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function dedent(s) {
    s = String(s).replace(/\t/g, '  ').replace(/^[ \t]*\n/, '').replace(/\s+$/, '');
    const lines = s.split('\n');
    let ind = Infinity;
    for (const l of lines) if (l.trim()) ind = Math.min(ind, l.match(/^ */)[0].length);
    return ind && ind !== Infinity ? lines.map((l) => l.slice(ind)).join('\n') : s;
  }

  /* =====================================================================
   *  Syntax highlighter (tiny, regex based; tokens never span lines)
   * ===================================================================*/
  const STR = /"(?:[^"\\\n]|\\.)*"|'[^'\n]*'/;
  const NUM = /\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/;
  const LANGS = {
    bash: [
      ['com', /(?<=^|\s)#[^\n]*/],
      ['prompt', /^\$ /],
      ['cmd', /(?<=^\$ |^\$ sudo |\| |&& |; |^sudo )[A-Za-z_][\w.-]*/],
      ['str', STR],
      ['var', /\$\{[^}\n]+\}|\$[A-Za-z_]\w*|\$\(/],
      ['flag', /(?<=\s)--?[A-Za-z][\w-]*/],
      ['op', /\|\||&&|\||>>?|\\$/],
    ],
    http: [
      ['kw', /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)(?= )/],
      ['kw2', /^HTTP\/[\d.]+ \d{3}[^\n]*/],
      ['ver', /HTTP\/[\d.]+/],
      ['key', /^[A-Za-z][\w-]*(?=:)/],
      ['key', /"(?:[^"\\\n]|\\.)*"(?=\s*:)/],
      ['str', STR],
      ['num', NUM],
    ],
    json: [
      ['com', /\/\/[^\n]*/],
      ['key', /"(?:[^"\\\n]|\\.)*"(?=\s*:)/],
      ['str', STR],
      ['kw', /\b(?:true|false|null)\b/],
      ['num', NUM],
    ],
    yaml: [
      ['com', /(?<=^|\s)#[^\n]*/],
      ['key', /^[ \t]*(?:- )?[\w.\/"-]+(?=:(?:[ \t]|$))/],
      ['str', STR],
      ['var', /\$\{[^}\n]+\}/],
      ['kw', /\b(?:true|false|null|yes|no)\b/],
      ['num', NUM],
      ['op', /^[ \t]*- /],
    ],
    dockerfile: [
      ['com', /^[ \t]*#[^\n]*/],
      ['kw', /^[ \t]*(?:FROM|RUN|CMD|LABEL|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL|MAINTAINER)\b/],
      ['kw2', /\bAS\b/],
      ['flag', /--[\w-]+(?:=[^\s]+)?/],
      ['str', STR],
      ['var', /\$\{[^}\n]+\}|\$[A-Za-z_]\w*/],
    ],
    dns: [
      ['com', /;[^\n]*/],
      ['str', STR],
      ['kw', /\b(?:IN|A|AAAA|CNAME|MX|NS|SOA|TXT|PTR|SRV|CAA|DS|DNSKEY|RRSIG|NSEC|HTTPS|SVCB|ANY)\b/],
      ['attr', /(?<=^|[;\s"])[a-z]{1,6}(?==)/],
      ['num', /\b\d+\b/],
    ],
    ini: [
      ['kw', /^[ \t]*\[[^\]\n]+\]/],
      ['com', /^[ \t]*[#;][^\n]*/],
      ['key', /^[ \t]*[\w.-]+(?=\s*=)/],
      ['str', STR],
      ['num', NUM],
    ],
    pem: [
      ['kw', /-----(?:BEGIN|END) [A-Z0-9 ]+-----/],
      ['com', /^[\w-]+:.*$/],
    ],
    cert: [
      ['kw', /-----(?:BEGIN|END) [A-Z0-9 ]+-----/],
      ['num', /(?:[0-9a-fA-F]{2}:){3,}[0-9a-fA-F]{0,2}/],
      ['key', /^[ \t]*[A-Za-z][\w .\/()-]*:(?=\s|$)/],
      ['kw2', /\bcritical\b/],
      ['attr', /\b(?:C|ST|L|O|OU|CN|DC|emailAddress)(?= ?=)/],
      ['str', STR],
    ],
    mail: [
      ['key', /^[A-Za-z][\w-]*(?=:)/],
      ['attr', /(?<=^|[;\s])[a-z]{1,6}(?==)/],
      ['str', STR],
      ['com', /^[ \t]*;[^\n]*/],
    ],
    js: [
      ['com', /\/\/[^\n]*/],
      ['str', /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`[^`\n]*`/],
      ['kw', /\b(?:const|let|var|function|return|await|async|if|else|new|import|from|export|default|throw|try|catch|class|of|in|for|while|typeof|null|undefined|true|false)\b/],
      ['key', /\b[A-Za-z_$][\w$]*(?=\s*:(?!:))/],
      ['num', NUM],
    ],
    py: [
      ['com', /#[^\n]*/],
      ['str', /[rbf]?"(?:[^"\\\n]|\\.)*"|[rbf]?'(?:[^'\\\n]|\\.)*'/],
      ['kw', /\b(?:def|return|import|from|as|if|elif|else|for|in|while|with|try|except|raise|class|None|True|False|and|or|not|lambda|print)\b/],
      ['num', NUM],
    ],
    go: [
      ['com', /\/\/[^\n]*/],
      ['str', /"(?:[^"\\\n]|\\.)*"|`[^`\n]*`/],
      ['kw', /\b(?:package|import|func|return|if|else|for|range|var|const|type|struct|interface|map|chan|go|defer|nil|true|false|err)\b/],
      ['num', NUM],
    ],
    tree: [
      ['com', /#[^\n]*/],
      ['dim', /[├└│─┬┐┘]+/],
      ['key', /[^\s├└│─]+\/(?=\s|$)/],
    ],
    diff: [
      ['add', /^\+[^\n]*/],
      ['del', /^-[^\n]*/],
      ['kw', /^@@[^\n]*/],
    ],
    text: [],
  };
  LANGS.sh = LANGS.bash;
  LANGS.shell = LANGS.bash;
  LANGS.yml = LANGS.yaml;
  LANGS.email = LANGS.mail;

  const compiled = {};
  function compile(lang) {
    if (compiled[lang]) return compiled[lang];
    const rules = LANGS[lang] || [];
    return (compiled[lang] = {
      classes: rules.map((r) => r[0]),
      re: rules.length ? new RegExp(rules.map((r) => '(' + r[1].source + ')').join('|'), 'gm') : null,
    });
  }
  function tokenize(text, lang) {
    const c = compile(lang);
    if (!c.re) return esc(text);
    let out = '', last = 0, m;
    c.re.lastIndex = 0;
    while ((m = c.re.exec(text))) {
      if (m[0] === '') { c.re.lastIndex++; continue; }
      let gi = 1;
      while (m[gi] === undefined) gi++;
      out += esc(text.slice(last, m.index)) + '<span class="t-' + c.classes[gi - 1] + '">' + esc(m[0]) + '</span>';
      last = m.index + m[0].length;
    }
    return out + esc(text.slice(last));
  }
  /** highlight: supports ⟪marked⟫ segments (must not span lines) */
  function highlight(src, lang) {
    return String(src)
      .split(/(⟪[^⟫]*⟫)/)
      .map((p) => (p[0] === '⟪' && p[p.length - 1] === '⟫' ? '<mark>' + tokenize(p.slice(1, -1), lang) + '</mark>' : tokenize(p, lang)))
      .join('');
  }
  function codeLines(src, lang, hl) {
    const set = new Set(hl || []);
    return highlight(src, lang)
      .split('\n')
      .map((l, i) => '<span class="ln' + (set.has(i + 1) ? ' hl' : '') + '">' + (l || ' ') + '</span>')
      .join('');
  }
  const LANG_LABEL = { bash: 'shell', http: 'HTTP', json: 'JSON', yaml: 'YAML', dockerfile: 'Dockerfile', dns: 'DNS', ini: 'config', pem: 'PEM', cert: 'openssl', mail: 'mail', js: 'JavaScript', py: 'Python', go: 'Go', tree: 'files', diff: 'diff', text: 'text' };

  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {
      const ta = h('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; d.body.appendChild(ta); ta.select();
      try { d.execCommand('copy'); } catch (e2) { /* ignore */ }
      ta.remove(); return true;
    }
  }

  function codeBlock(c) {
    if (typeof c === 'string') c = { lang: 'bash', src: c };
    const lang = c.lang || 'text';
    const raw = dedent(c.src || '');
    const cb = h('div', 'cb');
    const head = h('div', 'cb-h', '<span class="cb-t">' + esc(c.title || LANG_LABEL[lang] || lang) + '</span><button class="cb-copy" type="button" aria-label="コピー">copy</button>');
    const pre = h('pre', '', '<code>' + codeLines(raw, lang, c.hl) + '</code>');
    pre.dataset.lang = lang;
    head.querySelector('button').addEventListener('click', (ev) => {
      copyText(raw.replace(/[⟪⟫]/g, ''));
      ev.target.textContent = 'copied'; setTimeout(() => (ev.target.textContent = 'copy'), 1200);
    });
    cb.append(head, pre);
    return cb;
  }

  function renderPre(pre) {
    if (pre.dataset.done) return;
    const lang = pre.dataset.lang || 'text';
    const raw = dedent(pre.textContent);
    const hl = pre.dataset.hl ? pre.dataset.hl.split(/[\s,]+/).map(Number) : null;
    pre.dataset.done = '1';
    pre.innerHTML = '<code>' + codeLines(raw, lang, hl) + '</code>';
    if (pre.closest('.stage, .cb, .scene') || pre.hasAttribute('data-bare')) return;
    const cb = h('div', 'cb');
    const head = h('div', 'cb-h', '<span class="cb-t">' + esc(pre.dataset.title || LANG_LABEL[lang] || lang) + '</span><button class="cb-copy" type="button" aria-label="コピー">copy</button>');
    pre.parentNode.insertBefore(cb, pre);
    cb.append(head, pre);
    head.querySelector('button').addEventListener('click', (ev) => {
      copyText(raw.replace(/[⟪⟫]/g, ''));
      ev.target.textContent = 'copied'; setTimeout(() => (ev.target.textContent = 'copy'), 1200);
    });
  }

  /* =====================================================================
   *  Icons (24x24 stroke)
   * ===================================================================*/
  const ICONS = {
    laptop: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6"/>',
    browser: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M6.5 6.5h.01M9 6.5h.01"/>',
    db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3M14 9l2 2"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2"/>',
    unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.6-1.8"/>',
    cert: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M7 8h10M7 11h5"/><circle cx="16" cy="16" r="3"/><path d="m14.6 18.6-.6 3.4 2-1 2 1-.6-3.4"/>',
    file: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 16.5h5"/>',
    folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/>',
    box: '<path d="M12 3 3 7.5v9L12 21l9-4.5v-9z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/>',
    shieldok: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M17.5 14.3c2.3.7 4 2.8 4 5.7"/>',
    cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.6a4.2 4.2 0 0 1-.6 8.4z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    network: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v4M12 11.5 6.5 17M12 11.5l5.5 5.5"/>',
    git: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="8" r="2.5"/><path d="M6 8.5v7M18 10.5c0 3.5-3.5 4.5-9.8 6.3"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    attacker: '<path d="M4 10c0-4.4 3.6-7 8-7s8 2.6 8 7v2H4z"/><path d="M4 12h16l-1.5 3h-13z"/><path d="M8 18.5c1 1.6 2.4 2.5 4 2.5s3-.9 4-2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    hash: '<path d="M5 9h15M4 15h15M10 3 8 21M16 3l-2 18"/>',
    sign: '<path d="M3 20c2.5 0 3.5-2.5 5.5-2.5S10 20 12 20s3-1.5 5-1.5 2.5 1 4 1"/><path d="m14 4 3 3-7.5 7.5H6.5v-3z"/>',
    code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    warn: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
    arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
    router: '<rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 16.5h.01M11 16.5h.01M8 9.5a5.5 5.5 0 0 1 8 0M5.5 7a9 9 0 0 1 13 0"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
    play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/>',
    prev: '<path d="M6 5v14"/><path d="M18 5v14L8.5 12z" fill="currentColor" stroke="none"/>',
    next: '<path d="M18 5v14"/><path d="M6 5v14l9.5-7z" fill="currentColor" stroke="none"/>',
    replay: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  };
  function icon(n) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[n] || ICONS.box) + '</svg>';
  }

  function prep(root) {
    if (!root || !root.querySelectorAll) return;
    const one = (sel, fn) => { if (root.matches && root.matches(sel)) fn(root); root.querySelectorAll(sel).forEach(fn); };
    one('i[data-icon]:not(.ic)', (i) => { i.classList.add('ic'); i.innerHTML = icon(i.dataset.icon); });
    one('pre[data-lang]:not([data-done])', renderPre);
  }

  /* =====================================================================
   *  Scene engine
   * ===================================================================*/
  const FX = {
    up: [{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }],
    down: [{ opacity: 0, translate: '0 -14px' }, { opacity: 1, translate: '0 0' }],
    left: [{ opacity: 0, translate: '-24px 0' }, { opacity: 1, translate: '0 0' }],
    right: [{ opacity: 0, translate: '24px 0' }, { opacity: 1, translate: '0 0' }],
    zoom: [{ opacity: 0, scale: '0.86' }, { opacity: 1, scale: '1' }],
    pop: [{ opacity: 0, scale: '0.3' }, { opacity: 1, scale: '1' }],
    fade: [{ opacity: 0 }, { opacity: 1 }],
    blur: [{ opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)' }],
  };
  const ANCHOR = /^(.*?):(c|t|b|l|r|tl|tr|bl|br)$/;
  const NAMES = /^[\w-]+(\s+[\w-]+)*$/;
  const SVGNS = 'http://www.w3.org/2000/svg';

  class Ctx {
    constructor(sc, tok, instant, ff) { this.sc = sc; this.tok = tok; this.instant = instant; this.ff = ff; }
    get alive() { return this.tok === this.sc.token; }
    get world() { return this.sc.world; }
    get fx() { return this.sc.fx; }
    get W() { return this.sc.W; }
    get H() { return this.sc.H; }
    ms(v) { return v / SPEED; }

    $(sel) {
      if (!this.alive || sel == null) return [];
      if (sel instanceof Element) return [sel];
      if (Array.isArray(sel)) return sel.flatMap((x) => this.$(x));
      sel = String(sel).trim();
      const m = sel.match(ANCHOR);
      if (m && NAMES.test(m[1])) sel = m[1];
      if (NAMES.test(sel)) return sel.split(/\s+/).flatMap((n) => Array.from(this.world.querySelectorAll('[data-el="' + n + '"]')));
      return Array.from(this.world.querySelectorAll(sel));
    }
    el(sel) {
      const e = this.$(sel)[0];
      if (!e && this.alive) console.warn('[TIM] element not found:', sel);
      return e || h('div');
    }

    _a(el, frames, o = {}) {
      if (this.instant || !this.alive || !el || !el.animate) return Promise.resolve();
      const a = el.animate(frames, {
        duration: this.ms(o.dur != null ? o.dur : 500),
        delay: this.ms(o.delay || 0),
        easing: o.ease || EASE.out,
        fill: o.fill || 'backwards',
      });
      this.sc.anims.add(a);
      return a.finished.then(() => { this.sc.anims.delete(a); }, () => {});
    }

    box(target) {
      const e = target instanceof Element ? target : this.$(target)[0];
      if (!e) return { x: 0, y: 0, w: 0, h: 0 };
      if (e instanceof HTMLElement) {
        let x = 0, y = 0, n = e;
        while (n && n !== this.world) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
        if (n === this.world) return { x, y, w: e.offsetWidth, h: e.offsetHeight };
      }
      const r = e.getBoundingClientRect(), wr = this.world.getBoundingClientRect();
      const k = wr.width / this.sc.W || 1;
      return { x: (r.left - wr.left) / k, y: (r.top - wr.top) / k, w: r.width / k, h: r.height / k };
    }
    pt(spec) {
      if (spec && typeof spec === 'object' && !(spec instanceof Element) && 'x' in spec) return { x: spec.x, y: spec.y };
      let side = 'c', sel = spec;
      if (typeof spec === 'string') { const m = spec.match(ANCHOR); if (m) { sel = m[1]; side = m[2]; } }
      const b = this.box(sel);
      return {
        x: side.includes('l') ? b.x : side.includes('r') ? b.x + b.w : b.x + b.w / 2,
        y: side.includes('t') ? b.y : side.includes('b') ? b.y + b.h : b.y + b.h / 2,
      };
    }

    wait(ms) { return this.instant || !this.alive ? Promise.resolve() : sleep(this.ms(ms)); }

    show(sel, o = {}) {
      const els = this.$(sel);
      return Promise.all(els.map((el, k) => {
        el.classList.remove('hide');
        const delay = (o.delay || 0) + k * (o.stagger != null ? o.stagger : 90);
        if (o.fx === 'draw' && el.getTotalLength) {
          const L = el.getTotalLength();
          return this._a(el, [{ strokeDasharray: L + ' ' + L, strokeDashoffset: L }, { strokeDasharray: L + ' ' + L, strokeDashoffset: 0 }], { dur: o.dur || 800, delay, ease: EASE.inOut });
        }
        return this._a(el, FX[o.fx] || FX.up, { dur: o.dur != null ? o.dur : 520, delay, ease: o.fx === 'pop' ? EASE.back : EASE.out });
      }));
    }
    hide(sel, o = {}) {
      const els = this.$(sel);
      return Promise.all(els.map((el, k) => {
        if (this.instant) { el.classList.add('hide'); return null; }
        return this._a(el, [{ opacity: 1 }, { opacity: 0 }], { dur: o.dur != null ? o.dur : 300, delay: (o.delay || 0) + k * (o.stagger || 0), fill: 'forwards', ease: 'ease-in' })
          .then(() => {
            if (!this.alive) return;
            el.classList.add('hide');
            el.getAnimations().forEach((a) => a.cancel());
          });
      }));
    }
    swap(a, b, o = {}) { return Promise.all([this.hide(a, o), this.show(b, Object.assign({ delay: 120 }, o))]); }

    set(sel, html, o = {}) {
      return Promise.all(this.$(sel).map((el) => {
        el.innerHTML = html; prep(el);
        return o.flash === false ? null : this._a(el, [{ filter: 'brightness(2.2)', opacity: 0.4 }, { filter: 'brightness(1)', opacity: 1 }], { dur: 520 });
      }));
    }
    text(sel, str, o = {}) {
      return Promise.all(this.$(sel).map((el) => {
        el.textContent = str;
        return o.flash === false ? null : this._a(el, [{ filter: 'brightness(2.2)', opacity: 0.4 }, { filter: 'brightness(1)', opacity: 1 }], { dur: 520 });
      }));
    }
    append(sel, html, o = {}) {
      const tgt = this.$(sel)[0];
      if (!tgt) return Promise.resolve();
      const t = d.createElement('template');
      t.innerHTML = String(html).trim();
      const kids = Array.from(t.content.children);
      kids.forEach((k) => { prep(k); tgt.appendChild(k); });
      if (o.scroll !== false) tgt.scrollTop = tgt.scrollHeight;
      return Promise.all(kids.map((k, i) => this._a(k, FX[o.fx] || FX.up, { dur: 380, delay: i * 70 })));
    }

    _ticker(dur, fn) {
      if (this.instant || !this.alive) { fn(1); return Promise.resolve(); }
      const T = this.ms(dur);
      return new Promise((res) => {
        const t0 = performance.now();
        const tick = () => {
          if (!this.alive) return res();
          const p = Math.min(1, (performance.now() - t0) / T);
          fn(p);
          if (p >= 1) return res();
          // rAF is paused in background tabs; fall back to timers so audits/automation don't stall
          if (d.hidden) setTimeout(tick, 16); else requestAnimationFrame(tick);
        };
        tick();
      });
    }
    type(sel, str, o = {}) {
      const el = this.$(sel)[0];
      if (!el) return Promise.resolve();
      str = String(str);
      const base = o.append ? el.textContent : '';
      const dur = o.dur || (str.length / (o.cps || 45)) * 1000;
      el.classList.add('typing');
      return this._ticker(dur, (p) => { el.textContent = base + str.slice(0, Math.round(p * str.length)); })
        .then(() => el.classList.remove('typing'));
    }
    scramble(sel, final, o = {}) {
      const el = this.$(sel)[0];
      if (!el) return Promise.resolve();
      final = String(final);
      const chars = o.chars || '0123456789abcdef';
      return this._ticker(o.dur || 1200, (p) => {
        const fixed = Math.floor(p * final.length);
        let s = final.slice(0, fixed);
        for (let i = fixed; i < final.length; i++) {
          const ch = final[i];
          s += ch === ' ' || ch === '\n' || ch === '.' ? ch : chars[(Math.random() * chars.length) | 0];
        }
        el.textContent = p >= 1 ? final : s;
      });
    }
    count(sel, from, to, o = {}) {
      const el = this.$(sel)[0];
      if (!el) return Promise.resolve();
      const fmt = o.fmt || ((v) => Math.round(v).toLocaleString());
      return this._ticker(o.dur || 900, (p) => { el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - p, 3))); });
    }
    async term(sel, text, o = {}) {
      const t = this.$(sel)[0];
      if (!t) return;
      const b = t.querySelector('.term-b') || t;
      if (o.clear) b.innerHTML = '';
      const lines = (o.raw ? String(text) : dedent(text)).split('\n');
      for (const line of lines) {
        if (!this.alive) return;
        const row = h('div', 'tl');
        b.appendChild(row);
        if (line.startsWith('$ ')) {
          if (!this.instant) {
            row.innerHTML = '<span class="t-prompt">$ </span><span class="tc typing"></span>';
            const tc = row.lastChild, cmd = line.slice(2).replace(/[⟪⟫]/g, '');
            await this._ticker(Math.min(1800, cmd.length * 28), (p) => { tc.textContent = cmd.slice(0, Math.round(p * cmd.length)); b.scrollTop = b.scrollHeight; });
            if (!this.alive) return;
          }
          row.innerHTML = highlight(line, 'bash');
          await this.wait(o.pause != null ? o.pause : 260);
        } else {
          row.className = 'tl out' + (o.cls ? ' ' + o.cls : '');
          row.innerHTML = highlight(line, o.lang || 'text') || '&nbsp;';
          this._a(row, [{ opacity: 0 }, { opacity: 1 }], { dur: 160 });
          await this.wait(o.lineDelay != null ? o.lineDelay : 45);
        }
        b.scrollTop = b.scrollHeight;
      }
    }

    fly(from, to, o = {}) {
      if (!this.alive) return Promise.resolve();
      const a = this.pt(from), b = this.pt(to);
      const hasLabel = o.label != null && o.label !== '';
      const p = h('div', 'packet ' + (hasLabel ? '' : 'dot ') + (o.cls || ''), hasLabel ? o.label : '');
      if (o.id) p.dataset.el = o.id;
      p.style.left = a.x + 'px';
      p.style.top = a.y + 'px';
      this.fx.appendChild(p);
      const land = () => {
        if (o.keep) { p.style.left = b.x + 'px'; p.style.top = b.y + 'px'; } else p.remove();
      };
      if (this.instant) { land(); return Promise.resolve(); }
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const arc = o.arc || 0, nx = -dy / len, ny = dx / len;
      const cx = dx / 2 + nx * arc, cy = dy / 2 + ny * arc;
      const N = 20, frames = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, u = 1 - t;
        const x = 2 * u * t * cx + t * t * dx, y = 2 * u * t * cy + t * t * dy;
        frames.push({ offset: t, translate: x.toFixed(1) + 'px ' + y.toFixed(1) + 'px', opacity: i === 0 ? 0 : i === N && !o.keep ? 0 : 1, scale: i === 0 ? '0.6' : i === N && !o.keep ? '0.7' : '1' });
      }
      const an = p.animate(frames, { duration: this.ms(o.dur || 1000), delay: this.ms(o.delay || 0), easing: o.ease || 'cubic-bezier(.45,0,.25,1)', fill: 'both' });
      this.sc.anims.add(an);
      return an.finished.then(() => {
        this.sc.anims.delete(an);
        if (!this.alive) return;
        land();
        an.cancel();
        if (o.hit !== false && typeof to !== 'object') this.pulse(to, { dur: 500, scale: 1.06 });
      }, () => {});
    }

    line(from, to, o = {}) {
      if (!this.alive) return Promise.resolve();
      const a = this.pt(from), b = this.pt(to);
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      let dp, mid;
      if (o.elbow === 'h' || o.elbow === 'v') {
        if (o.elbow === 'h') { const mx = a.x + dx / 2; dp = `M${a.x} ${a.y}H${mx}V${b.y}H${b.x}`; mid = { x: mx, y: a.y + dy / 2 }; }
        else { const my = a.y + dy / 2; dp = `M${a.x} ${a.y}V${my}H${b.x}V${b.y}`; mid = { x: a.x + dx / 2, y: my }; }
      } else if (o.curve) {
        const cx = a.x + dx / 2 + (-dy / len) * o.curve, cy = a.y + dy / 2 + (dx / len) * o.curve;
        dp = `M${a.x} ${a.y}Q${cx} ${cy} ${b.x} ${b.y}`;
        mid = { x: 0.25 * a.x + 0.5 * cx + 0.25 * b.x, y: 0.25 * a.y + 0.5 * cy + 0.25 * b.y };
      } else {
        dp = `M${a.x} ${a.y}L${b.x} ${b.y}`;
        mid = { x: a.x + dx / 2, y: a.y + dy / 2 };
      }
      const g = d.createElementNS(SVGNS, 'g');
      if (o.id) g.setAttribute('data-el', o.id);
      const p = d.createElementNS(SVGNS, 'path');
      p.setAttribute('d', dp);
      p.setAttribute('class', 'wire ' + (o.cls || ''));
      g.appendChild(p);
      this.sc.wires.appendChild(g);
      const mk = 'url(#tim-arr-' + this.sc.no + ')';
      const addMarkers = () => {
        if (o.arrow !== false) p.setAttribute('marker-end', mk);
        if (o.both) p.setAttribute('marker-start', 'url(#tim-arrs-' + this.sc.no + ')');
      };
      let lab = null;
      if (o.label) {
        lab = h('div', 'wlabel ' + (o.cls || ''), o.label);
        if (o.id) lab.dataset.el = o.id;
        lab.style.left = mid.x + (o.lx || 0) + 'px';
        lab.style.top = mid.y + (o.ly || 0) + 'px';
        this.fx.appendChild(lab);
      }
      if (this.instant) { addMarkers(); return Promise.resolve(); }
      const L = p.getTotalLength();
      const an = p.animate([{ strokeDasharray: L + ' ' + L, strokeDashoffset: L }, { strokeDasharray: L + ' ' + L, strokeDashoffset: 0 }], { duration: this.ms(o.dur || 600), delay: this.ms(o.delay || 0), easing: EASE.inOut, fill: 'backwards' });
      this.sc.anims.add(an);
      if (lab) this._a(lab, FX.zoom, { dur: 300, delay: (o.delay || 0) + (o.dur || 600) * 0.6 });
      return an.finished.then(() => { this.sc.anims.delete(an); if (this.alive) addMarkers(); }, () => {});
    }

    move(sel, o = {}) {
      return Promise.all(this.$(sel).map((el) => {
        const op = el.offsetParent && el.offsetParent !== this.world ? this.box(el.offsetParent) : { x: 0, y: 0 };
        const fromL = el.offsetLeft, fromT = el.offsetTop;
        let x = o.x != null ? o.x - op.x : fromL + (o.dx || 0);
        let y = o.y != null ? o.y - op.y : fromT + (o.dy || 0);
        if (o.to) {
          const b = this.box(o.to);
          x = b.x + b.w / 2 - el.offsetWidth / 2 - op.x;
          y = b.y + b.h / 2 - el.offsetHeight / 2 - op.y;
        }
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        return this._a(el, [{ left: fromL + 'px', top: fromT + 'px' }, { left: x + 'px', top: y + 'px' }], { dur: o.dur || 700, delay: o.delay || 0, ease: EASE.inOut });
      }));
    }

    state(sel, st) {
      const els = this.$(sel);
      els.forEach((e) => { if (st) e.setAttribute('data-state', st); else e.removeAttribute('data-state'); });
      if (st && st !== 'dim' && !this.instant) return this.pulse(els, { cls: 'r-' + st });
      return Promise.resolve();
    }
    cls(sel, add, rm) {
      this.$(sel).forEach((e) => {
        if (rm) e.classList.remove(...rm.split(/\s+/).filter(Boolean));
        if (add) e.classList.add(...add.split(/\s+/).filter(Boolean));
      });
      return Promise.resolve();
    }
    pulse(sel, o = {}) {
      if (this.instant || !this.alive) return Promise.resolve();
      return Promise.all(this.$(sel).map((e) => {
        const b = this.box(e);
        if (!b.w) return null;
        const r = h('div', 'ring ' + (o.cls || ''));
        Object.assign(r.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' });
        this.fx.appendChild(r);
        const an = r.animate([{ opacity: 0.95, scale: '1' }, { opacity: 0, scale: String(o.scale || 1.12) }], { duration: this.ms(o.dur || 700), easing: 'ease-out' });
        this.sc.anims.add(an);
        return an.finished.then(() => r.remove(), () => r.remove());
      }));
    }
    shake(sel) {
      return Promise.all(this.$(sel).map((e) => this._a(e, [
        { translate: '0 0' }, { translate: '-8px 0' }, { translate: '7px 0' }, { translate: '-5px 0' }, { translate: '3px 0' }, { translate: '0 0' },
      ], { dur: 460, ease: 'linear' })));
    }
    scan(sel, o = {}) {
      if (this.instant || !this.alive) return Promise.resolve();
      return Promise.all(this.$(sel).map((e) => {
        const b = this.box(e);
        const s = h('div', 'scan ' + (o.cls || ''), '<i></i>');
        Object.assign(s.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' });
        this.fx.appendChild(s);
        const an = s.firstChild.animate([{ top: '0%' }, { top: '100%' }], { duration: this.ms(o.dur || 900), easing: 'ease-in-out', iterations: o.times || 1 });
        this.sc.anims.add(an);
        return an.finished.then(() => s.remove(), () => s.remove());
      }));
    }
    stamp(sel, text, o = {}) {
      return Promise.all(this.$(sel).map((e) => {
        const st = h('div', 'stamp ' + (o.cls || 'st-ok') + (o.pos ? ' at-' + o.pos : ''), text);
        e.appendChild(st);
        return this._a(st, [{ opacity: 0, scale: '2.4', rotate: '-20deg' }, { opacity: 1, scale: '1', rotate: '0deg' }], { dur: 440, delay: o.delay || 0, ease: EASE.back });
      }));
    }
    unstamp(sel) {
      this.$(sel).forEach((e) => e.querySelectorAll(':scope > .stamp').forEach((st) => st.remove()));
      return Promise.resolve();
    }
    caption(html, o = {}) {
      if (!this.alive) return Promise.resolve();
      let c = this.fx.querySelector('.caption');
      if (!html) { if (c) c.remove(); return Promise.resolve(); }
      if (!c) { c = h('div', 'caption'); this.fx.appendChild(c); }
      c.className = 'caption ' + (o.cls || '');
      c.innerHTML = html;
      c.style.left = o.x != null ? o.x + 'px' : '';
      c.style.top = o.y != null ? o.y + 'px' : '';
      c.style.bottom = o.y != null ? 'auto' : '';
      return this._a(c, [{ opacity: 0, translate: '-50% 10px' }, { opacity: 1, translate: '-50% 0' }], { dur: 420 });
    }
    camera(o = {}) {
      if (!this.alive) return Promise.resolve();
      const s = o.scale || 1;
      let x = o.x != null ? o.x : this.W / 2, y = o.y != null ? o.y : this.H / 2;
      if (o.to) { const b = this.box(o.to); x = b.x + b.w / 2; y = b.y + b.h / 2; }
      let tx = this.W / 2 - x * s, ty = this.H / 2 - y * s;
      if (s >= 1) { tx = clamp(tx, this.W - this.W * s, 0); ty = clamp(ty, this.H - this.H * s, 0); }
      const tf = s === 1 && !o.x && !o.y && !o.to ? 'none' : `translate(${tx}px, ${ty}px) scale(${s})`;
      const from = getComputedStyle(this.world).transform;
      this.world.style.transform = tf === 'none' ? '' : tf;
      if (this.instant) return Promise.resolve();
      return this._a(this.world, [{ transform: from }, { transform: tf }], { dur: o.dur || 900, ease: EASE.inOut });
    }
    spawn(html, o = {}) {
      const t = d.createElement('template');
      t.innerHTML = String(html).trim();
      const e = t.content.firstElementChild;
      if (!e || !this.alive) return h('div');
      prep(e);
      const parent = o.into ? this.$(o.into)[0] : null;
      if (parent) parent.appendChild(e); else this.world.insertBefore(e, this.fx);
      if (o.x != null) e.style.left = o.x + 'px';
      if (o.y != null) e.style.top = o.y + 'px';
      if (o.w != null) e.style.width = o.w + 'px';
      if (o.id) e.dataset.el = o.id;
      if (o.hidden) e.classList.add('hide'); else this.show(e, o);
      return e;
    }
    hl(lines, bi = 0) {
      if (this.ff || !this.alive) return Promise.resolve();
      const cb = this.sc.pc.querySelectorAll('.cb')[bi];
      if (!cb) return Promise.resolve();
      const set = new Set([].concat(lines));
      let first = null;
      cb.querySelectorAll('.ln').forEach((l, i) => {
        const on = set.has(i + 1);
        l.classList.toggle('hl', on);
        if (on && !first) first = l;
      });
      if (first) {
        const pre = first.closest('pre');
        if (pre) pre.scrollTop = Math.max(0, first.offsetTop - pre.clientHeight / 3);
      }
      return Promise.resolve();
    }
  }

  let sceneSeq = 0;
  class Scene {
    constructor(root, def) {
      this.root = root;
      this.def = def || {};
      this.steps = this.def.steps || [];
      this.no = ++sceneSeq;
      this.i = -1;
      this.token = 0;
      this.playing = false;
      this.stepDone = false;
      this.ended = false;
      this.started = false;
      this.anims = new Set();

      const stage = root.querySelector('.stage');
      if (!stage) throw new Error('[TIM] .stage not found in scene');
      this.W = +stage.dataset.w || 960;
      this.H = +stage.dataset.h || 460;
      prep(stage);
      this.template = stage.innerHTML;
      stage.innerHTML = '';
      this.world = h('div', 'world');
      stage.appendChild(this.world);
      this.stage = stage;

      root.classList.add('scene', 'scene-on');
      root.tabIndex = 0;
      const title = this.def.title || root.dataset.title || '';
      this.title = title;

      // head
      const head = h('div', 'scene-head', '<b>SCENE ' + pad(this.no) + '</b><span class="sh-t">' + esc(title) + '</span><span class="sh-n">' + this.steps.length + ' steps</span>');
      root.insertBefore(head, root.firstChild);

      // viewport
      this.vp = h('div', 'stage-vp');
      this.sizer = h('div', 'stage-sizer');
      stage.parentNode.insertBefore(this.vp, stage);
      this.vp.appendChild(this.sizer);
      this.sizer.appendChild(stage);
      this.cover = h('button', 'stage-cover', '<span class="cv-play">' + icon('play') + '</span><span class="cv-t">' + esc(title || 'PLAY') + '</span><span class="cv-n">' + this.steps.length + ' STEPS · クリックで再生</span>');
      this.cover.type = 'button';
      this.cover.addEventListener('click', () => { this.started = true; this.play(); });
      this.vp.appendChild(this.cover);

      // control bar
      this.bar = h('div', 'scene-bar');
      this.bar.innerHTML =
        '<button class="sb-btn" data-a="prev" title="前のステップ (←)">' + icon('prev') + '</button>' +
        '<button class="sb-btn sb-play" data-a="play" title="再生/一時停止 (Space)">' + icon('play') + '</button>' +
        '<button class="sb-btn" data-a="next" title="次のステップ (→)">' + icon('next') + '</button>' +
        '<div class="sb-steps">' + this.steps.map((st, k) => '<button class="sb-dot" data-k="' + k + '" title="' + pad(k + 1) + ' ' + esc(String(st.title || '').replace(/<[^>]+>/g, '')) + '"><i></i></button>').join('') + '</div>' +
        '<span class="sb-count">00 / ' + pad(this.steps.length) + '</span>' +
        '<button class="sb-btn sb-speed" data-a="speed" title="再生速度">' + SPEED + '×</button>' +
        '<button class="sb-btn" data-a="restart" title="最初から">' + icon('replay') + '</button>' +
        '<button class="sb-btn" data-a="full" title="全画面">' + icon('full') + '</button>' +
        '<div class="sb-timer"><i></i></div>';
      this.vp.after(this.bar);
      this.timerBar = this.bar.querySelector('.sb-timer i');
      this.bar.addEventListener('click', (ev) => {
        const b = ev.target.closest('button');
        if (!b) return;
        this.started = true;
        if (b.dataset.k != null) return this.go(+b.dataset.k);
        const a = b.dataset.a;
        if (a === 'prev') this.prev();
        else if (a === 'next') this.next();
        else if (a === 'play') this.toggle();
        else if (a === 'restart') { this.go(0); }
        else if (a === 'speed') {
          SPEED = SPEEDS[(SPEEDS.indexOf(SPEED) + 1) % SPEEDS.length];
          store.set('tim.speed', String(SPEED));
          TIM.scenes.forEach((s) => s.bar.querySelector('.sb-speed').textContent = SPEED + '×');
        } else if (a === 'full') this.fullscreen();
      });

      // panel
      this.panel = h('div', 'scene-panel',
        '<div class="sp-narr"><div class="sp-k"></div><h3 class="sp-t"></h3><div class="sp-x"></div></div><div class="sp-code"></div>');
      this.bar.after(this.panel);
      this.pk = this.panel.querySelector('.sp-k');
      this.pt = this.panel.querySelector('.sp-t');
      this.px = this.panel.querySelector('.sp-x');
      this.pc = this.panel.querySelector('.sp-code');

      this.reset();
      this.renderIntro();
      this.fit();
      if (window.ResizeObserver) new ResizeObserver(() => this.fit()).observe(this.vp);
      else window.addEventListener('resize', () => this.fit());
      d.addEventListener('fullscreenchange', () => { this.root.classList.toggle('is-full', d.fullscreenElement === this.root); this.fit(); });

      root.addEventListener('keydown', (ev) => {
        if (ev.target.closest('input, textarea, select')) return;
        if (ev.key === 'ArrowRight') { ev.preventDefault(); this.started = true; this.next(); }
        else if (ev.key === 'ArrowLeft') { ev.preventDefault(); this.started = true; this.prev(); }
        else if (ev.key === ' ' || ev.key === 'k') { ev.preventDefault(); this.started = true; this.toggle(); }
        else if (ev.key === 'Home') { ev.preventDefault(); this.go(0); }
        else if (ev.key === 'f') { this.fullscreen(); }
      });
      this.vp.addEventListener('click', (ev) => { if (!ev.target.closest('.stage-cover')) root.focus({ preventScroll: true }); });

      if (!REDUCED && this.def.autoplay !== false && window.IntersectionObserver) {
        const io = new IntersectionObserver((es) => {
          es.forEach((e) => {
            if (e.isIntersecting && e.intersectionRatio >= 0.5) {
              if (!this.started) { this.started = true; this.play(); }
              else if (this.autoPaused) { this.autoPaused = false; this.play(); }
            } else if (!e.isIntersecting && this.playing) {
              this.autoPaused = true; this.pause();
            }
          });
        }, { threshold: [0, 0.5] });
        io.observe(this.vp);
      }
      TIM.scenes.push(this);
    }

    reset() {
      this.anims.forEach((a) => { try { a.cancel(); } catch (e) { /* ignore */ } });
      this.anims.clear();
      this.world.getAnimations().forEach((a) => a.cancel());
      this.world.style.transform = '';
      const n = this.no;
      this.world.innerHTML =
        '<svg class="wires" width="' + this.W + '" height="' + this.H + '"><defs>' +
        '<marker id="tim-arr-' + n + '" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 1 10 5 0 9z"/></marker>' +
        '<marker id="tim-arrs-' + n + '" viewBox="0 0 10 10" refX="1.5" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M10 1 0 5 10 9z"/></marker>' +
        '</defs></svg>' + this.template + '<div class="fx"></div>';
      this.wires = this.world.firstElementChild;
      this.fx = this.world.lastElementChild;
    }

    fit() {
      const fs = d.fullscreenElement === this.root;
      const aw = this.vp.clientWidth || this.W;
      let s = aw / this.W;
      if (fs) s = Math.min(s, (window.innerHeight * 0.66) / this.H);
      s = clamp(s, 0.25, fs ? 4 : this.def.maxScale || 1.2);
      this.scale = s;
      this.stage.style.width = this.W + 'px';
      this.stage.style.height = this.H + 'px';
      this.stage.style.transform = 'scale(' + s + ')';
      this.sizer.style.width = Math.round(this.W * s) + 'px';
      this.sizer.style.height = Math.round(this.H * s) + 'px';
    }

    fullscreen() {
      if (d.fullscreenElement) d.exitFullscreen && d.exitFullscreen();
      else if (this.root.requestFullscreen) this.root.requestFullscreen().catch(() => {});
    }

    renderIntro() {
      this.pk.textContent = 'OVERVIEW · ' + this.steps.length + ' STEPS';
      this.pt.innerHTML = esc(this.title);
      this.px.innerHTML = this.def.intro || '';
      prep(this.px);
      const ol = h('ol', 'sp-index');
      this.steps.forEach((st, k) => {
        const li = h('li', '', '<button type="button"><span>' + pad(k + 1) + '</span>' + (st.title || '') + '</button>');
        li.firstChild.addEventListener('click', () => { this.started = true; this.go(k); });
        ol.appendChild(li);
      });
      this.pc.innerHTML = '';
      this.pc.appendChild(ol);
      this.panel.classList.remove('no-code');
    }

    renderStep(n) {
      const st = this.steps[n] || {};
      this.pk.textContent = 'STEP ' + pad(n + 1) + ' / ' + pad(this.steps.length);
      this.pt.innerHTML = st.title || '';
      this.px.innerHTML = st.text || '';
      prep(this.px);
      this.pc.innerHTML = '';
      const codes = st.code ? [].concat(st.code) : [];
      codes.forEach((c) => this.pc.appendChild(codeBlock(c)));
      this.panel.classList.toggle('no-code', !codes.length);
      if (!REDUCED) {
        const nar = this.panel.querySelector('.sp-narr');
        nar.animate([{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], { duration: 380, easing: EASE.out });
        if (codes.length) this.pc.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: 80, easing: EASE.out, fill: 'backwards' });
      }
    }

    async go(n, opt = {}) {
      if (!this.steps.length) return;
      n = clamp(n, 0, this.steps.length - 1);
      const tok = ++this.token;
      this.clearTimer();
      this.cover.classList.add('off');
      this.ended = false;
      this.reset();
      const ff = new Ctx(this, tok, true, true);
      for (let k = 0; k < n; k++) {
        await this.runStep(k, ff);
        if (tok !== this.token) return;
      }
      this.i = n;
      this.stepDone = false;
      this.renderStep(n);
      this.sync();
      await this.runStep(n, new Ctx(this, tok, !!opt.instant || REDUCED, false));
      if (tok !== this.token) return;
      this.stepDone = true;
      if (this.playing) this.schedule();
      this.sync();
    }
    async runStep(k, ctx) {
      const st = this.steps[k];
      if (!st || typeof st.run !== 'function') return;
      try { await st.run(ctx); } catch (e) { console.error('[TIM] scene ' + this.no + ' step ' + (k + 1) + ':', e); }
    }
    autoHold(st) {
      const txt = String(st.title || '') + String(st.text || '').replace(/<[^>]+>/g, '');
      const codeLen = [].concat(st.code || []).reduce((n, c) => n + String(typeof c === 'string' ? c : c.src || '').split('\n').length, 0);
      return clamp(1800 + txt.length * 55 + codeLen * 80, 3000, 12000);
    }
    schedule() {
      this.clearTimer();
      if (this.i >= this.steps.length - 1) { this.playing = false; this.ended = true; this.sync(); return; }
      const st = this.steps[this.i] || {};
      const dwell = (st.hold != null ? st.hold : this.autoHold(st)) / SPEED;
      this.timerAnim = this.timerBar.animate([{ width: '0%' }, { width: '100%' }], { duration: dwell, easing: 'linear', fill: 'forwards' });
      this.timer = setTimeout(() => { if (this.playing) this.go(this.i + 1); }, dwell);
    }
    clearTimer() {
      clearTimeout(this.timer);
      if (this.timerAnim) { this.timerAnim.cancel(); this.timerAnim = null; }
    }
    play() {
      this.started = true;
      this.playing = true;
      this.cover.classList.add('off');
      if (this.ended || this.i < 0) this.go(0);
      else if (this.stepDone) this.schedule();
      this.sync();
    }
    pause() { this.playing = false; this.clearTimer(); this.sync(); }
    toggle() { if (this.playing) this.pause(); else this.play(); }
    next() { if (this.i < this.steps.length - 1) this.go(this.i + 1); }
    prev() { this.go(Math.max(0, this.i - 1)); }

    sync() {
      const pb = this.bar.querySelector('.sb-play');
      const mode = this.playing ? 'pause' : this.ended ? 'replay' : 'play';
      if (pb.dataset.mode !== mode) { pb.dataset.mode = mode; pb.innerHTML = icon(mode); }
      this.bar.querySelectorAll('.sb-dot').forEach((dt, k) => {
        dt.classList.toggle('on', k === this.i);
        dt.classList.toggle('done', k < this.i);
      });
      this.bar.querySelector('.sb-count').textContent = pad(Math.max(0, this.i + 1)) + ' / ' + pad(this.steps.length);
      this.root.dataset.step = this.i;
      this.root.classList.toggle('is-playing', this.playing);
    }
  }

  /* =====================================================================
   *  Site chrome: header / topic menu / TOC / footer / reveal
   * ===================================================================*/
  const LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="lg-tim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset=".5" stop-color="#a78bfa"/><stop offset="1" stop-color="#f472b6"/></linearGradient></defs><rect x="2" y="2" width="28" height="28" rx="8" fill="none" stroke="url(#lg-tim)" stroke-width="2"/><path d="M8 20l5-8 4 5 3-4 4 7" fill="none" stroke="url(#lg-tim)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="20" r="2" fill="#f472b6"/></svg>';

  function topicUrl(id) { return ROOT + 'topics/' + id + '/'; }

  function chrome() {
    const topics = window.TIM_TOPICS || [];
    const cats = window.TIM_CATS || {};
    const id = d.body.dataset.topic;
    const t = topics.find((x) => x.id === id);
    const cat = t && cats[t.cat];
    if (cat) d.documentElement.style.setProperty('--accent', cat.color);

    let hdr = d.querySelector('header.site-h');
    if (!hdr) { hdr = h('header', 'site-h'); d.body.insertBefore(hdr, d.body.firstChild); }
    const menu = Object.keys(cats).map((ck) => {
      const list = topics.filter((x) => x.cat === ck);
      if (!list.length) return '';
      return '<div class="tm-cat" style="--accent:' + cats[ck].color + '"><div class="tm-ch">' + esc(cats[ck].ja) + '<small>' + esc(cats[ck].name) + '</small></div>' +
        list.map((x) => x.status === 'ready'
          ? '<a class="tm-a' + (x.id === id ? ' on' : '') + '" href="' + topicUrl(x.id) + '">' + esc(x.title) + '</a>'
          : '<span class="tm-a soon">' + esc(x.title) + '<em>soon</em></span>').join('') + '</div>';
    }).join('');
    hdr.innerHTML =
      '<a class="brand" href="' + ROOT + '">' + LOGO + '<span class="brand-t">TECH<b>IN</b>MOTION</span></a>' +
      (t ? '<span class="crumb"><span class="crumb-c">' + esc(cat ? cat.ja : '') + '</span><span class="crumb-s">/</span><span class="crumb-t">' + esc(t.title) + '</span></span>' : '<span class="crumb"></span>') +
      '<button class="tm-btn" type="button" aria-expanded="false"><span>TOPICS</span><i></i></button>' +
      '<nav class="tm" aria-label="トピック一覧"><div class="tm-in">' + menu + '</div></nav>';
    const btn = hdr.querySelector('.tm-btn');
    btn.addEventListener('click', () => {
      const open = hdr.classList.toggle('menu-open');
      btn.setAttribute('aria-expanded', String(open));
    });
    d.addEventListener('click', (ev) => { if (!ev.target.closest('header.site-h')) { hdr.classList.remove('menu-open'); btn.setAttribute('aria-expanded', 'false'); } });
    d.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') hdr.classList.remove('menu-open'); });
    let lastY = 0;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      hdr.classList.toggle('scrolled', y > 8);
      lastY = y;
    }, { passive: true });

    // TOC
    const toc = d.querySelector('.toc');
    const heads = Array.from(d.querySelectorAll('main .chapter > h2'));
    heads.forEach((hd, i) => {
      const sec = hd.parentElement;
      if (!sec.id) sec.id = 'sec-' + (i + 1);
      hd.dataset.no = pad(i + 1);
    });
    if (toc && heads.length) {
      toc.innerHTML = '<div class="toc-h">CONTENTS</div><ol>' + heads.map((hd) => '<li><a href="#' + hd.parentElement.id + '"><span>' + hd.dataset.no + '</span>' + esc(hd.textContent) + '</a></li>').join('') + '</ol>';
      const links = Array.from(toc.querySelectorAll('a'));
      if (window.IntersectionObserver) {
        const io = new IntersectionObserver((es) => {
          es.forEach((e) => {
            if (e.isIntersecting) {
              links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
            }
          });
        }, { rootMargin: '-20% 0px -70% 0px' });
        heads.forEach((hd) => io.observe(hd.parentElement));
      }
    }

    // footer
    let ftr = d.querySelector('footer.site-f');
    if (!ftr) { ftr = h('footer', 'site-f'); d.body.appendChild(ftr); }
    let rel = '';
    if (t) {
      const ready = topics.filter((x) => x.status === 'ready');
      const idx = ready.findIndex((x) => x.id === id);
      const prev = idx > 0 ? ready[idx - 1] : null, next = idx >= 0 && idx < ready.length - 1 ? ready[idx + 1] : null;
      const related = (t.related || []).map((r) => topics.find((x) => x.id === r)).filter(Boolean);
      rel =
        (related.length ? '<div class="rel"><div class="rel-h">RELATED</div><div class="rel-g">' + related.map((x) => {
          const c = cats[x.cat] || {};
          const inner = '<span class="rel-c">' + esc(c.ja || '') + '</span><b>' + esc(x.title) + '</b><small>' + esc(x.sub || '') + '</small>';
          return x.status === 'ready' ? '<a class="rel-a" style="--accent:' + c.color + '" href="' + topicUrl(x.id) + '">' + inner + '</a>' : '<span class="rel-a soon" style="--accent:' + c.color + '">' + inner + '<em>soon</em></span>';
        }).join('') + '</div></div>' : '') +
        '<div class="pn">' +
        (prev ? '<a class="pn-a" href="' + topicUrl(prev.id) + '"><small>← PREV</small><b>' + esc(prev.title) + '</b></a>' : '<span></span>') +
        (next ? '<a class="pn-a nx" href="' + topicUrl(next.id) + '"><small>NEXT →</small><b>' + esc(next.title) + '</b></a>' : '<span></span>') +
        '</div>';
    }
    ftr.innerHTML = '<div class="f-in">' + rel +
      '<div class="f-b"><a class="brand sm" href="' + ROOT + '">' + LOGO + '<span class="brand-t">TECH<b>IN</b>MOTION</span></a>' +
      '<span>見えないプロトコルを、動かして見る。</span><a href="' + REPO + '" target="_blank" rel="noopener">GitHub</a></div></div>';
  }

  function reveal() {
    const els = d.querySelectorAll('.reveal');
    if (!els.length) return;
    if (!window.IntersectionObserver || REDUCED) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach((e) => io.observe(e));
  }

  /* =====================================================================
   *  Small crypto/encoding utils for labs
   * ===================================================================*/
  const te = new TextEncoder(), td = new TextDecoder();
  const b64u = {
    enc(input) {
      const bytes = typeof input === 'string' ? te.encode(input) : new Uint8Array(input);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    dec(str) {
      str = String(str).replace(/-/g, '+').replace(/_/g, '/');
      while (str.length % 4) str += '=';
      const bin = atob(str);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    },
    decText(str) { return td.decode(b64u.dec(str)); },
  };
  const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  async function sha256(data) { return crypto.subtle.digest('SHA-256', typeof data === 'string' ? te.encode(data) : data); }
  async function hmac(hash, key, data) {
    const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? te.encode(key) : key, { name: 'HMAC', hash }, false, ['sign']);
    return crypto.subtle.sign('HMAC', k, typeof data === 'string' ? te.encode(data) : data);
  }

  /* =====================================================================
   *  Public API
   * ===================================================================*/
  TIM.scenes = TIM.scenes || [];
  TIM.scene = function (target, def) {
    const root = typeof target === 'string' ? d.querySelector(target) : target;
    if (!root) { console.error('[TIM] scene root not found:', target); return null; }
    try { return new Scene(root, def); } catch (e) { console.error(e); return null; }
  };
  /**
   * TIM.audit(): 全シーンの全ステップを瞬時再生し、
   *  - ステージ外へのはみ出し
   *  - 要素内のテキストあふれ（scrollWidth/Height > client）
   *  - ステップ実行時の例外
   * を列挙する。開発時にコンソールで `await TIM.audit()` を実行する。
   */
  TIM.audit = async function () {
    const out = [];
    const origErr = console.error;
    for (const sc of TIM.scenes) {
      sc.pause();
      for (let k = 0; k < sc.steps.length; k++) {
        console.error = (...a) => { out.push('scene ' + sc.no + ' step ' + (k + 1) + ': ERROR ' + a.map(String).join(' ')); origErr.apply(console, a); };
        await sc.go(k, { instant: true });
        console.error = origErr;
        const box = (e) => { let x = 0, y = 0, n = e; while (n && n !== sc.world) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return { x, y, w: e.offsetWidth, h: e.offsetHeight }; };
        const name = (e) => e.dataset.el || e.className || e.tagName;
        sc.world.querySelectorAll('.stamp').forEach((s) => { s.style.display = 'none'; });
        sc.world.querySelectorAll(':scope > :not(.hide):not(svg):not(.fx)').forEach((e) => {
          const b = box(e);
          if (b.x < -1 || b.y < -1 || b.x + b.w > sc.W + 1 || b.y + b.h > sc.H + 1) out.push('scene ' + sc.no + ' step ' + (k + 1) + ': [' + name(e) + '] outside stage (' + b.x + ',' + b.y + ' ' + b.w + 'x' + b.h + ' / ' + sc.W + 'x' + sc.H + ')');
        });
        sc.world.querySelectorAll('.node, .file, .file pre, .chip, .kv, .seg > span, .label, .txt, .big, .bytes').forEach((e) => {
          if (e.closest('.hide') || e.closest('.term')) return;
          if (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2) out.push('scene ' + sc.no + ' step ' + (k + 1) + ': [' + name(e) + '] content overflows (' + e.scrollWidth + 'x' + e.scrollHeight + ' > ' + e.clientWidth + 'x' + e.clientHeight + ')');
        });
        // overlap between visible top-level parts (zones are containers by design) and wire labels
        const items = [];
        sc.world.querySelectorAll(':scope > :not(.hide):not(svg):not(.fx):not(.zone):not([data-overlap-ok])').forEach((e) => items.push([e, box(e)]));
        sc.fx.querySelectorAll('.wlabel:not(.hide):not([data-overlap-ok])').forEach((e) => items.push([e, { x: e.offsetLeft - e.offsetWidth / 2, y: e.offsetTop - e.offsetHeight / 2, w: e.offsetWidth, h: e.offsetHeight }]));
        for (let a = 0; a < items.length; a++) {
          for (let b = a + 1; b < items.length; b++) {
            const A = items[a][1], B = items[b][1];
            const ix = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
            const iy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
            if (ix > 4 && iy > 4) out.push('scene ' + sc.no + ' step ' + (k + 1) + ': overlap [' + name(items[a][0]) + '] x [' + name(items[b][0]) + '] (' + Math.round(ix) + 'x' + Math.round(iy) + 'px)');
          }
        }
      }
      await sc.go(0, { instant: true });
      sc.pause();
    }
    const uniq = Array.from(new Set(out));
    return uniq.length ? uniq : 'OK: ' + TIM.scenes.length + ' scenes, ' + TIM.scenes.reduce((n, s) => n + s.steps.length, 0) + ' steps, no issues';
  };

  TIM.highlight = highlight;
  TIM.codeLines = codeLines;
  TIM.codeBlock = codeBlock;
  TIM.icon = icon;
  TIM.esc = esc;
  TIM.dedent = dedent;
  TIM.prep = prep;
  TIM.b64u = b64u;
  TIM.hex = hex;
  TIM.sha256 = sha256;
  TIM.hmac = hmac;
  TIM.te = te;
  TIM.td = td;
  TIM.root = ROOT;
  TIM.reduced = REDUCED;
  TIM.topicUrl = topicUrl;

  chrome();
  prep(d.body);
  reveal();
})();
