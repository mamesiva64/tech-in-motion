/* DKIM (+SPF/DMARC) — scenes & lab
 * bh= と署名検証は WebCrypto（crypto.subtle）でページ上で実際に計算する。
 * デモ鍵はこのページ用に生成したもの（秘密鍵は非公開。公開鍵 p= と署名値 b= のみ掲載）。
 */
(function () {
  'use strict';

  /* ---------------------------------------------------------------
   * 実データ（openssl で生成・署名し、下の verify() で検証済みの値）
   * ------------------------------------------------------------- */
  const P1 = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3Tz3+7m+hmCxHOE29S/J5/Z/ZKPL9sfUqrLPPi2NUqodPqX8PYUkqNm+jEzO2daharO2YgF7wpvJ76YjuW+pHw2WiCYW34qloTa5aKAe1mCbLt6NtjxMCwQAPERRbzRI7RInDdH/T4S5mrtvuF5qAPNqI64hs+U5YkLPxOJHkSo4sbG7YEPaCC3kKKEeS5mp2Jo/0EYiaX3qBd';
  const P2 = 'N/aaRbKWqUcRvFPhTt+mYOEsue3mpzGaxPw5NKEOlofGE4QjwS1NyRF/PoW8QZdAmvuaeQT2Xep82lggE7MeL/IngDuayPE3Bc78V0zYSitrp508xYYWywd6aMrtMZjDzL9pPFswIDAQAB';
  const P = P1 + P2;
  const BH = 'bo8O1PQAIkYltLnLg/rfWUvvkQPYwAOFn0pcjkhn8qc=';
  const BH_HEX = '6e8f0ed4f400224625b4b9cb83fadf594bef9103d8c003859f4a5c8e4867f2a7';
  const HH_HEX = '83475cd6cded0e456de3fdd9db1f03f9523e1a2ed8b9e4c786ac78ec20605fc6';
  const B = 'OjpufJm2i1jt9alLUwptwuCKOo7z1Eh69uNF+zzeQ3d5yK/qsS/PlSbuXxiWLKx1/etiP8aKKCInPzkFLUpZUnlVS3jwNngwTGGNtT5xOzU352OoYzz1U3sdTn3GZ4rF6JB8y0SwXax5+H2+d+qW30+XLXA/Wk0THLr8Q9ncqasjoEd4AtgRGCpW98WRixA+OtqnXwEYnfZSRYEkQ7cdXHOP0RFRM2joKimeitdcHQMg4+4oi/7Lk9KdCyqwvEnwZAQMC2lfvxq23IxK1gX57WoBzfjxaEMXA1q2ajv7ybrZRe2BWLf6H33KXLZKJar7HAq4h8NS55AaEikIkCiZvQ==';
  const BL = 'o6O1YuEz9GWh/eRaTbfodWDRMM6Ea3v6KNfZrDaqIoOFjzZXDICwa3++ed+FnYvIwISuqN4Ji6cMtbNjKOC4SMj6CTBwwTQoS3ASyjji6tt6+QA13mMNlUXE3n3wI01L8jy7CwVagU7AUUSNX01LRlk9GIsN+bYLyuSQgoAYGZH2K7bRiF/TvQo+n+n0ANUNOceVTrlKe2sCe7bl9BRfg5RhJtQPl7vi6kNZVdwYlEgzRO9H3gQRKo0Rkl/bYPMHM7VjASiWvbYkeCWFgfMeA+IcqvV5U0SlikLQfNfxsysXZZHdrdTViLdBz7Eb6d1GWBubQRhjBOLQ912rm34fFQ==';
  const B64C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  const fold = (s, n) => s.match(new RegExp('.{1,' + n + '}', 'g'));
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const code = (title, lang, lines) => ({ title, lang, src: Array.isArray(lines) ? lines.join('\n') : lines });
  const L = (el, ...ns) => ns.map((n) => '[data-el="' + el + '"] .ln:nth-child(' + n + ')').join(', ');

  const HEAD = [
    'From: Alice <alice@example.com>',
    'To: Bob <bob@example.net>',
    'Subject: Invoice 2026-09',
    'Date: Mon, 28 Sep 2026 10:15:00 +0900',
    'Message-ID: <20260928011500.4F2A1C0B7E@mail.example.com>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
  ];
  const BODY = 'Hi Bob,\r\n\r\nTotal:  12,800 JPY   \r\nDue:    2026-10-31\r\nhttps://billing.example.com/inv/0928\r\n\r\nAlice\r\n\r\n\r\n';
  const FOOTER = '_______________________________________________\r\nTeam mailing list -- team@lists.example.net\r\nTo unsubscribe send an email to team-leave@lists.example.net\r\n';
  const APPEND = 'UPDATE: our bank account has changed.\r\nhttps://pay.attacker.example/0928\r\n';
  const RECEIVED = 'Received: from mail.example.com (mail.example.com [203.0.113.25])\r\n\t(using TLSv1.3 with cipher TLS_AES_256_GCM_SHA384 (256/256 bits))\r\n\tby mx.example.net (Postfix) with ESMTPS id 9C1D2E3F4A\r\n\tfor <bob@example.net>; Mon, 28 Sep 2026 10:15:04 +0900 (JST)';

  function sigHeader(o) {
    o = o || {};
    return [
      'DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;',
      '\td=example.com; s=' + (o.s || 'sel1') + '; t=1790558103;' + (o.l ? ' l=' + o.l + ';' : ''),
      '\tbh=' + BH + ';',
      '\th=From:To:Subject:Date:Message-ID:From;',
      '\tb=' + fold(o.b || B, 60).join('\r\n\t '),
    ].join('\r\n');
  }
  function message(o) {
    o = o || {};
    const head = HEAD.map((h) => (o.subject && h.indexOf('Subject:') === 0 ? 'Subject: ' + o.subject : h));
    return (o.received ? RECEIVED + '\r\n' : '') + sigHeader(o) + '\r\n' + head.join('\r\n') + '\r\n\r\n' + (o.body != null ? o.body : BODY);
  }
  const CASES = {
    orig: message(),
    recv: message({ received: true }),
    ml: message({ body: BODY + FOOTER }),
    amt: message({ body: BODY.replace('12,800', '98,000') }),
    subj: message({ subject: '[EXTERNAL] Invoice 2026-09' }),
    lbad: message({ l: 94, b: BL, body: BODY + APPEND }),
    nol: message({ body: BODY + APPEND }),
    nokey: message({ s: 'sel2' }),
  };
  const EXPECT = {
    orig: { bhCalc: BH, bhOk: true, sigOk: true, result: 'pass', bits: 2048, e: 65537, hhash: HH_HEX, bhHex: BH_HEX },
    recv: { bhCalc: BH, bhOk: true, sigOk: true, result: 'pass' },
    ml: { bhCalc: 'QtWpsMfIihwd8W5+6RYFsH2kGKHdZqhIuik4f25NRUQ=', bhOk: false, result: 'fail', why: 'body hash did not verify' },
    amt: { bhCalc: 'NsETopSEuV3JpwlH3bRH3zfpWWeYUog8cQ2gI3rMqKo=', bhOk: false, result: 'fail', why: 'body hash did not verify' },
    subj: { bhCalc: BH, bhOk: true, sigOk: false, result: 'fail', why: 'signature did not verify' },
    lbad: { bhCalc: BH, bhOk: true, sigOk: true, result: 'pass' },
    nol: { bhCalc: 'IPT+VIcnnHCUT11dXrSW579HxuAwyH8Q1JEq10+OxJo=', bhOk: false, result: 'fail', why: 'body hash did not verify' },
    nokey: { result: 'permerror', why: 'no key for signature' },
  };

  /* ---------------------------------------------------------------
   * DKIM 検証エンジン（RFC 6376 §3.4 正規化 / §3.7 ハッシュ / §6.1 検証）
   * ------------------------------------------------------------- */
  const te = new TextEncoder();
  const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(String(s).replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  const hex = (buf) => Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, '0')).join('');
  const DNS = { 'sel1._domainkey.example.com': 'v=DKIM1; h=sha256; k=rsa; p=' + P };

  function splitMsg(raw) {
    const t = String(raw).replace(/\r?\n/g, '\n');
    const i = t.indexOf('\n\n');
    const head = i < 0 ? t : t.slice(0, i);
    const body = i < 0 ? '' : t.slice(i + 2);
    const fields = [];
    head.split('\n').forEach((l) => {
      if (/^[ \t]/.test(l) && fields.length) fields[fields.length - 1].raw += '\r\n' + l;
      else if (l.trim()) { const k = l.indexOf(':'); fields.push({ name: (k < 0 ? l : l.slice(0, k)).trim().toLowerCase(), raw: l }); }
    });
    return { fields, body: body.replace(/\n/g, '\r\n') };
  }
  function bodyRelaxed(body) {
    const lines = body.replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/, '').replace(/[ \t]+/g, ' '));
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines.length ? lines.join('\r\n') + '\r\n' : '';
  }
  function bodySimple(body) { return body.replace(/\r\n/g, '\n').replace(/\n+$/, '').replace(/\n/g, '\r\n') + '\r\n'; }
  function stripB(v) { return v.replace(/(^|;)(\s*b\s*=)[^;]*/, '$1$2'); }
  function headerRelaxed(raw, isSig) {
    const k = raw.indexOf(':');
    let v = raw.slice(k + 1);
    if (isSig) v = stripB(v);
    return raw.slice(0, k).trim().toLowerCase() + ':' + v.replace(/\r\n/g, '').replace(/[ \t]+/g, ' ').trim();
  }
  function headerSimple(raw, isSig) { const k = raw.indexOf(':'); return raw.slice(0, k + 1) + (isSig ? stripB(raw.slice(k + 1)) : raw.slice(k + 1)); }
  function tagList(v) {
    const o = {};
    v.replace(/\r\n/g, '').split(';').forEach((p) => {
      const i = p.indexOf('=');
      if (i < 0) return;
      const k = p.slice(0, i).trim();
      if (k) o[k] = p.slice(i + 1).replace(/[ \t]+/g, ' ').trim();
    });
    return o;
  }
  async function verify(raw) {
    const { fields, body } = splitMsg(raw);
    const sigF = fields.find((f) => f.name === 'dkim-signature');
    if (!sigF) return { result: 'none', why: 'DKIM-Signature がありません' };
    const t = tagList(sigF.raw.slice(sigF.raw.indexOf(':') + 1));
    const r = { tags: t };
    const cm = String(t.c || 'simple/simple').split('/');
    const ch = cm[0] === 'relaxed' ? 'relaxed' : 'simple';
    const cb = cm[1] === 'relaxed' ? 'relaxed' : 'simple';
    // body
    r.cbody = cb === 'relaxed' ? bodyRelaxed(body) : bodySimple(body);
    let bytes = te.encode(r.cbody);
    if (t.l != null && t.l !== '') bytes = bytes.slice(0, parseInt(t.l, 10));
    r.hashedLen = bytes.length;
    r.bodyLen = te.encode(r.cbody).length;
    const bd = await crypto.subtle.digest('SHA-256', bytes);
    r.bhHex = hex(bd);
    r.bhCalc = b64(bd);
    r.bhSig = String(t.bh || '').replace(/\s+/g, '');
    r.bhOk = r.bhCalc === r.bhSig;
    // header data (h= の順に、同名ヘッダは下から順に使う。存在しなければ何も足さない)
    const used = {};
    let data = '';
    String(t.h || '').split(':').map((x) => x.trim()).filter(Boolean).forEach((hn) => {
      const lc = hn.toLowerCase();
      const cand = fields.filter((f) => f.name === lc && f !== sigF);
      const n = used[lc] || 0;
      if (n < cand.length) { const f = cand[cand.length - 1 - n]; data += (ch === 'relaxed' ? headerRelaxed(f.raw) : headerSimple(f.raw)) + '\r\n'; used[lc] = n + 1; }
    });
    data += ch === 'relaxed' ? headerRelaxed(sigF.raw, true) : headerSimple(sigF.raw, true);
    r.hdata = data;
    r.hlen = te.encode(data).length;
    r.hhash = hex(await crypto.subtle.digest('SHA-256', te.encode(data)));
    // key (§6.1.2)
    r.qname = t.s + '._domainkey.' + t.d;
    const rec = DNS[r.qname];
    if (!rec) { r.result = 'permerror'; r.why = 'no key for signature'; return r; }
    const kt = tagList(rec);
    if (!kt.p) { r.result = 'permerror'; r.why = 'key revoked'; return r; }
    // body hash (§6.1.3)
    if (!r.bhOk) { r.result = 'fail'; r.why = 'body hash did not verify'; return r; }
    const alg = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
    const key = await crypto.subtle.importKey('spki', unb64(kt.p), alg, true, ['verify']);
    const jwk = await crypto.subtle.exportKey('jwk', key);
    r.bits = unb64(jwk.n.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((jwk.n.length + 3) % 4)).length * 8;
    r.e = parseInt(hex(unb64(jwk.e.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((jwk.e.length + 3) % 4))), 16);
    try { r.sigOk = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64(t.b), te.encode(data)); } catch (e) { r.sigOk = false; }
    r.result = r.sigOk ? 'pass' : 'fail';
    if (!r.sigOk) r.why = 'signature did not verify';
    return r;
  }

  const RES = {};
  const ready = (async () => {
    if (!(window.crypto && crypto.subtle)) return false;
    for (const k of Object.keys(CASES)) RES[k] = await verify(CASES[k]);
    Object.keys(EXPECT).forEach((k) => {
      const a = RES[k], x = EXPECT[k];
      Object.keys(x).forEach((f) => { if (a && a[f] !== x[f]) console.warn('[dkim] mismatch', k, f, a[f], x[f]); });
    });
    return true;
  })().catch((e) => { console.warn('[dkim] WebCrypto unavailable', e); return false; });
  const R = async (k) => { await ready; return RES[k] || EXPECT[k]; };
  const short = (s, a, b) => (s ? s.slice(0, a) + '…' + (b ? s.slice(-b) : '') : '');

  /* ---------------------------------------------------------------
   * 表示用の断片
   * ------------------------------------------------------------- */
  const SEL1TXT = [
    'sel1._domainkey\tIN\tTXT\t( "v=DKIM1; h=sha256; k=rsa; "',
    '\t  "p=' + P1 + '"',
    '\t  "' + P2 + '" )  ; ----- DKIM key sel1 for example.com',
  ].join('\n');
  const PEM = ['-----BEGIN PUBLIC KEY-----'].concat(fold(P, 64), ['-----END PUBLIC KEY-----']).join('\n');
  const SIGHDR = sigHeader().replace(/\r\n/g, '\n');
  const MSG_TXT = HEAD.join('\n') + '\n\n' + BODY.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  const HDATA = [
    'from:Alice <alice@example.com>\\r\\n',
    'to:Bob <bob@example.net>\\r\\n',
    'subject:Invoice 2026-09\\r\\n',
    'date:Mon, 28 Sep 2026 10:15:00 +0900\\r\\n',
    'message-id:<20260928011500.4F2A1C0B7E@mail.example.com>\\r\\n',
    'dkim-signature:v=1; a=rsa-sha256; c=relaxed/relaxed; d=example.com; s=sel1; t=1790558103; bh=' + BH + '; h=From:To:Subject:Date:Message-ID:From; ⟪b=⟫',
  ];
  const ZONE2 = '<div class="file-h">db.example.com<small>serial 2026092802</small></div><pre data-lang="dns">' + esc([
    '@     IN SOA ns1 hostmaster ( … )',
    'mail  IN A   203.0.113.25',
    'sel1._domainkey IN TXT (',
    '  "v=DKIM1; h=sha256; k=rsa; "',
    '  "p=MIIBIjANBgkqhkiG9w0BAQEFAAOC…"',
    '  "N/aaRbKWqUcRvFP…pPFswIDAQAB" )',
  ].join('\n')) + '</pre>';

  /* ===============================================================
   * SCENE 1 — 鍵の生成と DNS 公開
   * ============================================================= */
  TIM.scene('#sc-keys', {
    intro: '秘密鍵は送信側 MTA の中に、公開鍵は DNS の TXT レコードに置きます。<code>opendkim-genkey</code> で鍵ペアを作り、DNS に公開し、OpenDKIM と Postfix をつないで、<code>opendkim-testkey</code> で確認するまでを順に見ます。',
    steps: [
      {
        title: '登場人物と、鍵の置き場所',
        text: '送信側ホスト <code>mail.example.com</code> では Postfix（MTA）と OpenDKIM（署名する milter）が動きます。公開鍵を配るのは <code>example.com</code> ゾーンの権威 DNS、検証するのは受信側の <code>mx.example.net</code> です。受信側は秘密鍵を一切持ちません。',
        code: code('関係するファイル', 'tree', [
          'mail.example.com（送信側）',
          '├── /etc/opendkim.conf            # Mode / Socket / KeyTable …',
          '├── /etc/opendkim/',
          '│   ├── KeyTable                  # 鍵名 → d=:s=:秘密鍵パス',
          '│   ├── SigningTable              # From アドレス → 鍵名',
          '│   ├── TrustedHosts              # 署名対象の接続元',
          '│   └── keys/example.com/',
          '│       ├── sel1.private          # 秘密鍵（600 opendkim）',
          '│       └── sel1.txt              # DNS に貼る TXT',
          '└── /etc/postfix/main.cf          # smtpd_milters',
          'ns1.example.com（権威 DNS）',
          '└── /etc/bind/db.example.com      # sel1._domainkey IN TXT',
        ]),
        run: async (s) => {
          s.pulse('postfix opendkim');
          await s.caption('秘密鍵 → 送信側 MTA ／ 公開鍵 → DNS の TXT ／ 検証 → 受信側 MTA');
        },
      },
      {
        title: 'opendkim-genkey で鍵ペアを作る',
        text: '<code>-b 2048</code> で 2048bit RSA、<code>-d</code> がドメイン、<code>-s</code> がセレクタ、<code>-D</code> が出力先です。内部で <code>openssl genrsa</code> を呼び、<code>sel1.private</code>（秘密鍵）と <code>sel1.txt</code>（DNS に貼る TXT）の 2 ファイルを作ります。',
        code: code('root@mail', 'bash', [
          '$ mkdir -p /etc/opendkim/keys/example.com',
          '$ opendkim-genkey -b 2048 -d example.com -s sel1 -D /etc/opendkim/keys/example.com',
          '$ chown -R opendkim:opendkim /etc/opendkim/keys',
          '$ ls -l /etc/opendkim/keys/example.com',
          'total 8',
          '-rw------- 1 opendkim opendkim 1732 Sep 28 10:02 sel1.private',
          '-rw-r--r-- 1 opendkim opendkim  501 Sep 28 10:02 sel1.txt',
        ]),
        run: async (s) => {
          s.caption('');
          s.state('opendkim', 'active');
          await s.term('t', [
            '$ opendkim-genkey -b 2048 -d example.com -s sel1 -D /etc/opendkim/keys/example.com',
            '$ ls -l /etc/opendkim/keys/example.com',
            '-rw------- 1 opendkim opendkim 1732 Sep 28 10:02 sel1.private',
            '-rw-r--r-- 1 opendkim opendkim  501 Sep 28 10:02 sel1.txt',
          ].join('\n'));
        },
      },
      {
        title: 'sel1.private：秘密鍵は送信側ホストの中だけ',
        text: 'PKCS#8 形式（<code>BEGIN PRIVATE KEY</code>）の RSA 秘密鍵です（OpenSSL 1.1 系で作ると PKCS#1 の <code>BEGIN RSA PRIVATE KEY</code>）。所有者 <code>opendkim</code>・パーミッション <code>600</code> で置き、このホストの外には出しません。',
        code: code('root@mail', 'bash', [
          '$ head -2 /etc/opendkim/keys/example.com/sel1.private',
          '-----BEGIN PRIVATE KEY-----',
          'MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDd…',
          '$ openssl pkey -in /etc/opendkim/keys/example.com/sel1.private -noout -text | head -2',
          'Private-Key: (2048 bit, 2 primes)',
          'modulus:',
        ]),
        run: async (s) => {
          s.state('opendkim', 'active');
          await s.show('fpriv', { fx: 'right' });
          await s.stamp('fpriv', 'PRIVATE', { cls: 'st-warn' });
        },
      },
      {
        title: 'sel1.txt：公開鍵を TXT レコードの形で',
        text: '<code>p=</code> は公開鍵（SubjectPublicKeyInfo の DER）を base64 にしたもので、<code>openssl rsa -pubout</code> が出す PEM の中身と同じです。2048bit 鍵の <code>p=</code> は 392 文字あり、TXT の 1 文字列の上限 255 を超えるため、<code>opendkim-genkey</code> は 250 文字ごとに <code>"…" "…"</code> と分けて出力します。',
        code: [
          code('/etc/opendkim/keys/example.com/sel1.txt', 'dns', SEL1TXT),
          code('同じ公開鍵を openssl で', 'bash', '$ openssl rsa -in sel1.private -pubout\nwriting RSA key\n' + PEM),
        ],
        run: async (s) => {
          await s.swap('fpriv', 'ftxt');
          s.hl([2, 3], 0);
        },
      },
      {
        title: '権威 DNS のゾーンに登録して公開',
        text: '<code>sel1.txt</code> の内容を <code>example.com</code> ゾーンに追加し、SOA のシリアルを上げて再読み込みします。名前は <code>&lt;セレクタ&gt;._domainkey.&lt;ドメイン&gt;</code> です。マネージド DNS なら管理画面で TXT として登録します。',
        code: [
          code('/etc/bind/db.example.com（追記）', 'dns', [
            '@       IN SOA ns1.example.com. hostmaster.example.com. (',
            '                ⟪2026092802⟫ 7200 3600 1209600 300 )',
            'sel1._domainkey IN TXT ( "v=DKIM1; h=sha256; k=rsa; "',
            '          "p=' + P1 + '"',
            '          "' + P2 + '" )',
          ]),
          code('root@ns1', 'bash', [
            '$ named-checkzone example.com /etc/bind/db.example.com',
            'zone example.com/IN: loaded serial 2026092802',
            'OK',
            '$ rndc reload example.com',
            'zone reload queued',
          ]),
        ],
        run: async (s) => {
          s.show('ftxt');
          await s.fly('ftxt:r', 'fzone:l', { label: 'TXT sel1._domainkey', arc: -40 });
          await s.set('fzone', ZONE2);
          s.cls(L('fzone', 3, 4, 5, 6), 'ok');
          s.state('dns', 'ok');
        },
      },
      {
        title: 'dig で公開された TXT を確認',
        text: '<code>dig +short</code> は TXT の各文字列を引用符付き・空白区切りで表示します。受信側はこれらを<strong>間に何も挟まずに連結</strong>して 1 つの値として扱います（RFC 6376 §3.6.2.2）。引用符や空白が値の中に混ざっていたら、登録の仕方が間違っています。',
        code: code('root@mail', 'bash', [
          '$ dig +short TXT sel1._domainkey.example.com',
          '"v=DKIM1; h=sha256; k=rsa; " "p=' + P1 + '" "' + P2 + '"',
          '$ dig +noall +answer TXT sel1._domainkey.example.com',
          'sel1._domainkey.example.com. 3600 IN TXT "v=DKIM1; h=sha256; k=rsa; " "p=MIIBIjAN…" "N/aaRb…IDAQAB"',
        ]),
        run: async (s) => {
          s.hide('ftxt');
          s.state('dns', 'ok');
          await s.term('t', '$ dig +short TXT sel1._domainkey.example.com');
          await s.fly('t:r', 'dns:l', { label: 'TXT?', arc: -30, dur: 800 });
          await s.fly('dns:l', 't:r', { label: 'TXT', cls: 'c-green', arc: -30, dur: 800 });
          await s.term('t', '"v=DKIM1; h=sha256; k=rsa; " "p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3Tz3+7m+hm…" "N/aaRbKWqUcRvFPhTt+mYOEsue3mpz…MZjDzL9pPFswIDAQAB"');
        },
      },
      {
        title: 'OpenDKIM の設定：/etc/opendkim.conf',
        text: '<code>Mode sv</code> で署名（s）と検証（v）の両方を行い、<code>Socket</code> で Postfix からの milter 接続を待ち受けます。<code>Canonicalization relaxed/relaxed</code> が署名の <code>c=</code> に、<code>OversignHeaders From</code> が <code>h=</code> 末尾の「余分な <code>From</code>」になります。',
        code: code('/etc/opendkim.conf', 'ini', [
          'Syslog              yes',
          'UMask               007',
          'UserID              opendkim',
          '⟪Mode                sv⟫',
          '⟪Socket              inet:8891@localhost⟫',
          'Canonicalization    relaxed/relaxed',
          'OversignHeaders     From',
          'KeyTable            refile:/etc/opendkim/KeyTable',
          'SigningTable        refile:/etc/opendkim/SigningTable',
          'ExternalIgnoreList  /etc/opendkim/TrustedHosts',
          'InternalHosts       /etc/opendkim/TrustedHosts',
          'PidFile             /run/opendkim/opendkim.pid',
        ]),
        run: async (s) => {
          await s.show('fconf', { fx: 'right' });
          s.state('opendkim', 'active');
        },
      },
      {
        title: 'KeyTable と SigningTable：どの From にどの鍵を使うか',
        text: '署名時、OpenDKIM は <code>From:</code> のアドレスを <code>SigningTable</code> で引いて鍵名を得て、<code>KeyTable</code> でその鍵名を「<code>d=</code> ドメイン : <code>s=</code> セレクタ : 秘密鍵ファイル」に変換します。<code>TrustedHosts</code>（<code>InternalHosts</code>）に含まれる接続元からのメールだけが署名の対象です。',
        code: [
          code('/etc/opendkim/KeyTable', 'text', 'sel1._domainkey.example.com ⟪example.com⟫:⟪sel1⟫:/etc/opendkim/keys/example.com/sel1.private'),
          code('/etc/opendkim/SigningTable（refile: = ワイルドカード）', 'text', '*@example.com    sel1._domainkey.example.com'),
          code('/etc/opendkim/TrustedHosts', 'text', '127.0.0.1\n::1\nlocalhost\n203.0.113.0/24'),
        ],
        run: async (s) => {
          await s.swap('fconf', 'ftab');
          s.cls(L('ftab', 2, 4), 'hl');
        },
      },
      {
        title: 'Postfix から milter で OpenDKIM を呼ぶ',
        text: '<code>smtpd_milters</code> は SMTP で受けたメール、<code>non_smtpd_milters</code> は <code>sendmail</code> コマンド等でローカル投入されたメールに適用されます。<code>milter_default_action</code> の既定は <code>tempfail</code> で、OpenDKIM が止まると受信も一時エラーになります。',
        code: [
          code('/etc/postfix/main.cf（追記）', 'ini', [
            'milter_default_action = accept',
            'milter_protocol = 6',
            'smtpd_milters = inet:localhost:8891',
            'non_smtpd_milters = $smtpd_milters',
          ]),
          code('root@mail', 'bash', [
            '$ systemctl restart opendkim postfix',
            '$ postconf -n | grep milter',
            'milter_default_action = accept',
            'milter_protocol = 6',
            'non_smtpd_milters = $smtpd_milters',
            'smtpd_milters = inet:localhost:8891',
          ]),
        ],
        run: async (s) => {
          await s.swap('ftab', 'fmain');
          await s.line('postfix:r', 'opendkim:l', { cls: 'flow', label: 'milter :8891', both: true });
          await s.term('t', '$ systemctl restart opendkim postfix');
          s.state('postfix', 'active');
          s.state('opendkim', 'active');
        },
      },
      {
        title: 'opendkim-testkey で DNS 上の鍵を確認',
        text: '<code>opendkim-testkey</code> は DNS から鍵を取得して解析し、KeyTable（または <code>-k</code>）の秘密鍵と対になっているかを確かめます。<code>key OK</code> が出れば公開は完了です。<code>key not secure</code> は鍵の応答が DNSSEC で検証されていないことを示す表示で、DKIM の署名・検証には支障ありません。',
        code: code('root@mail', 'bash', [
          '$ opendkim-testkey -d example.com -s sel1 -vvv',
          'opendkim-testkey: using default configfile /etc/opendkim.conf',
          "opendkim-testkey: checking key 'sel1._domainkey.example.com'",
          'opendkim-testkey: key not secure',
          'opendkim-testkey: ⟪key OK⟫',
        ]),
        run: async (s) => {
          await s.term('t', [
            '$ opendkim-testkey -d example.com -s sel1 -vvv',
            'opendkim-testkey: using default configfile /etc/opendkim.conf',
            "opendkim-testkey: checking key 'sel1._domainkey.example.com'",
            'opendkim-testkey: key not secure',
            'opendkim-testkey: key OK',
          ].join('\n'));
          s.state('opendkim', 'ok');
          await s.stamp('opendkim', 'KEY OK', { cls: 'st-ok' });
        },
      },
      {
        title: '受信側は DNS から公開鍵だけを取る',
        text: '受信側 <code>mx.example.net</code> は、届いたメールの <code>d=example.com</code> と <code>s=sel1</code> から <code>sel1._domainkey.example.com</code> を組み立てて TXT を引きます。送信側と受信側の間で鍵を事前にやり取りする必要はなく、DNS が公開鍵の配布路になります。',
        code: code('mx.example.net', 'bash', [
          '$ dig +short TXT sel1._domainkey.example.com | head -c 60; echo',
          '"v=DKIM1; h=sha256; k=rsa; " "p=MIIBIjANBgkqhkiG9w0BAQEFAAO',
        ]),
        run: async (s) => {
          s.hide('fmain');
          await s.show('mxq', { fx: 'pop' });
          await s.fly('mxq:r', 'fzone:b', { label: 'TXT?', arc: 40, dur: 900 });
          await s.fly('fzone:b', 'mx:r', { label: 'p=MIIB…', cls: 'c-green', arc: -40, dur: 900 });
          await s.show('mxa', { fx: 'pop' });
          s.state('mx', 'ok');
          await s.caption('秘密鍵 <code>sel1.private</code> は送信側から出ない ／ 公開鍵 <code>p=</code> は DNS で誰でも取得できる', { cls: 'ok' });
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 2 — 署名
   * ============================================================= */
  const fillTag = async (s, el, v, o) => {
    s.cls(el, 'new', 'dim');
    if (o && o.scramble) await s.scramble(el, v, { dur: o.dur || 1000, chars: o.chars || B64C });
    else await s.text(el, v);
  };
  TIM.scene('#sc-sign', {
    intro: 'Alice の MUA から Postfix に届いたメールに、OpenDKIM が署名を付けるまでです。右上のカードで <code>DKIM-Signature</code> のタグが 1 つずつ埋まっていきます。<code>bh=</code> と署名対象ハッシュはページ上の WebCrypto で計算した実際の値です。',
    steps: [
      {
        title: 'メッセージが送信側 MTA に届く',
        text: 'Alice のメールソフトが SMTP AUTH 付きで <code>submission</code>（587/tcp）に送信し、Postfix はキュー ID <code>4F2A1C0B7E</code> を振って受け取ります。この時点ではまだ署名はありません。本文 3〜4 行目には連続した空白と行末の空白、最後には空行が 2 つあります。',
        code: code('受け取ったメッセージ（DATA の中身）', 'mail', MSG_TXT),
        run: async (s) => {
          await s.fly('mua:r', 'postfix:l', { label: 'SMTP :587' });
          await s.show('msg');
          s.state('postfix', 'active');
        },
      },
      {
        title: 'milter で OpenDKIM へ。From から鍵を選ぶ',
        text: 'Postfix は接続情報・ヘッダ・本文を milter プロトコルで OpenDKIM に渡します。接続元 <code>203.0.113.77</code> は <code>InternalHosts</code> に含まれるので「署名」モードになり、<code>From: alice@example.com</code> を <code>SigningTable</code> で引いて鍵 <code>sel1._domainkey.example.com</code> → <code>KeyTable</code> で <code>d=example.com</code>・<code>s=sel1</code>・秘密鍵ファイルが決まります。',
        code: [
          code('/etc/opendkim/SigningTable', 'text', '⟪*@example.com⟫    sel1._domainkey.example.com'),
          code('/etc/opendkim/KeyTable', 'text', 'sel1._domainkey.example.com ⟪example.com⟫:⟪sel1⟫:/etc/opendkim/keys/example.com/sel1.private'),
        ],
        run: async (s) => {
          s.show('msg');
          s.cls(L('msg', 1), 'hl');
          await s.fly('postfix:r', 'opendkim:l', { label: 'milter' });
          s.state('opendkim', 'active');
          await s.show('sig', { fx: 'right' });
          await fillTag(s, 'tv', '1');
          await fillTag(s, 'ta', 'rsa-sha256');
          await fillTag(s, 'td', 'example.com');
          await fillTag(s, 'ts', 'sel1');
        },
      },
      {
        title: '本文を c=relaxed で正規化する',
        text: 'relaxed の本文正規化は「行末の空白を削除」「行内の連続空白を 1 つの SP に」「末尾の空行を削除」「改行は CRLF」です。<code>Total:␣␣12,800␣JPY␣␣␣</code> は <code>Total:␣12,800␣JPY</code> に、末尾の空行 2 つは消え、正規化後の本文は 94 バイトになります。',
        code: [
          code('正規化の差分（␣ = 空白）', 'diff', [
            ' Hi Bob,',
            ' ',
            '-Total:␣␣12,800␣JPY␣␣␣',
            '+Total:␣12,800␣JPY',
            '-Due:␣␣␣␣2026-10-31',
            '+Due:␣2026-10-31',
            ' https://billing.example.com/inv/0928',
            ' ',
            ' Alice',
            '-（空行）',
            '-（空行）',
          ]),
          code('正規化後の本文 94 バイト（xxd）', 'text', [
            '00000000: 4869 2042 6f62 2c0d 0a0d 0a54 6f74 616c  Hi Bob,....Total',
            '00000010: 3a20 3132 2c38 3030 204a 5059 0d0a 4475  : 12,800 JPY..Du',
            '00000020: 653a 2032 3032 362d 3130 2d33 310d 0a68  e: 2026-10-31..h',
            '00000030: 7474 7073 3a2f 2f62 696c 6c69 6e67 2e65  ttps://billing.e',
            '00000040: 7861 6d70 6c65 2e63 6f6d 2f69 6e76 2f30  xample.com/inv/0',
            '00000050: 3932 380d 0a0d 0a41 6c69 6365 0d0a       928....Alice..',
          ]),
        ],
        run: async (s) => {
          s.cls(L('msg', 1), '', 'hl');
          s.cls(L('msg', 11, 12), 'warn');
          await s.show('canon', { fx: 'up' });
          await s.scan('canon');
          await fillTag(s, 'tc', 'relaxed/relaxed');
        },
      },
      {
        title: 'bh=：正規化した本文の SHA-256 を base64 に',
        text: '94 バイトの SHA-256（32 バイト）を base64 にした 44 文字が <code>bh=</code> です。下の値はこのページがいま WebCrypto で計算したもので、<code>openssl</code> で同じバイト列を作れば同じ値になります。',
        code: code('同じ計算を openssl で', 'bash', [
          "$ printf 'Hi Bob,\\r\\n\\r\\nTotal: 12,800 JPY\\r\\nDue: 2026-10-31\\r\\nhttps://billing.example.com/inv/0928\\r\\n\\r\\nAlice\\r\\n' > body.c",
          '$ openssl dgst -sha256 body.c',
          'SHA2-256(body.c)= ' + BH_HEX,
          '$ openssl dgst -sha256 -binary body.c | base64',
          '⟪' + BH + '⟫',
        ]),
        run: async (s) => {
          const r = await R('orig');
          await s.show('cbh', { fx: 'pop' });
          await s.scramble('cbhv', short(r.bhHex, 24, 8), { dur: 900 });
          await fillTag(s, 'tbh', r.bhCalc, { scramble: true, dur: 1300 });
          s.pulse('tbh');
        },
      },
      {
        title: 't=：署名時刻',
        text: '<code>t=</code> は署名した時刻の UNIX 秒です（推奨タグ）。有効期限 <code>x=</code> は OpenDKIM で <code>SignatureTTL</code> を設定したときだけ付きます。<code>i=</code>（署名者の識別子）や <code>l=</code>（本文長）も任意タグで、この例では付けていません。',
        code: code('t= を読む', 'bash', [
          '$ date -u -d @1790558103',
          'Mon Sep 28 01:15:03 UTC 2026',
          '$ TZ=Asia/Tokyo date -d @1790558103 -R',
          'Mon, 28 Sep 2026 10:15:03 +0900',
        ]),
        run: async (s) => {
          await fillTag(s, 'tt', '1790558103');
        },
      },
      {
        title: 'h=：署名するヘッダを選ぶ',
        text: '<code>h=</code> に並べた順に、そのヘッダが署名対象になります。<code>Received</code> のように経路上で増えるヘッダは入れません。末尾の 2 つ目の <code>From</code> は <strong>オーバーサイン</strong>で、実在しない 2 つ目の <code>From</code> を「空」として署名に含め、後から <code>From:</code> を足されると検証が失敗するようにしています。',
        code: code('h= の意味', 'mail', [
          'h=⟪From⟫:⟪To⟫:⟪Subject⟫:⟪Date⟫:⟪Message-ID⟫:⟪From⟫',
          ';  1〜5 : メッセージの From / To / Subject / Date / Message-ID',
          ';  6    : 2 つ目の From は存在しない → 何も連結しない（RFC 6376 §5.4.2）',
          ';         後から From が追加されると、ここに値が入って検証失敗',
        ]),
        run: async (s) => {
          s.cls(L('msg', 11, 12), '', 'warn');
          s.cls(L('msg', 1, 2, 3, 4, 5), 'hl');
          s.cls(L('msg', 6, 7), 'dim');
          await fillTag(s, 'th', 'From:To:Subject:Date:Message-ID:From');
        },
      },
      {
        title: '署名対象データを組み立てる',
        text: '<code>h=</code> の順にヘッダを relaxed 正規化（名前を小文字、折り返しを解除、連続空白を 1 つ、コロン前後の空白を削除）して CRLF でつなぎ、最後に<strong><code>b=</code> を空にした DKIM-Signature 自身</strong>を末尾の CRLF なしで付けます。<code>bh=</code> がここに含まれるので、本文も間接的に署名されます。',
        code: code('署名対象データ（359 バイト）', 'text', HDATA),
        run: async (s) => {
          await s.swap('canon', 'hdata');
          await s.scan('hdata');
        },
      },
      {
        title: 'b=：秘密鍵で署名する',
        text: '署名対象データの SHA-256 を、<code>sel1.private</code> で RSASSA-PKCS1-v1_5 署名します（<code>a=rsa-sha256</code>）。結果の 256 バイトを base64 にした 344 文字が <code>b=</code> です。RSA PKCS#1 v1.5 署名は決定的なので、同じ鍵・同じデータなら毎回同じ値になります。',
        code: code('同じ計算を openssl で', 'bash', [
          '$ openssl dgst -sha256 hdr.c',
          'SHA2-256(hdr.c)= ' + HH_HEX,
          '$ openssl dgst -sha256 -sign sel1.private -binary hdr.c | base64 -w0',
          B,
        ]),
        run: async (s) => {
          const r = await R('orig');
          await s.show('chh', { fx: 'pop' });
          await s.scramble('chhv', short(r.hhash, 24, 8), { dur: 900 });
          await fillTag(s, 'tb', short(B, 44, 5), { scramble: true, dur: 1400 });
          s.state('sig', 'ok');
          await s.stamp('sig', 'SIGNED', { cls: 'st-ok' });
        },
      },
      {
        title: 'DKIM-Signature ヘッダをメッセージの先頭に付ける',
        text: 'OpenDKIM は完成したヘッダを milter 経由で Postfix に返し、Postfix がメッセージの先頭に挿入します。<code>b=</code> は長いので折り返されます（改行 + タブ）。本文には一切手を加えません。',
        code: code('追加されたヘッダ', 'mail', SIGHDR),
        run: async (s) => {
          s.hide('hdata');
          await s.fly('opendkim:b', 'msg:tr', { label: 'DKIM-Signature', arc: 30 });
          await s.swap('msg', 'msg2');
          s.cls(L('msg2', 1, 2, 3, 4, 5), 'ok');
          s.state('opendkim', 'ok');
        },
      },
      {
        title: '署名済みメッセージを受信側へ送る',
        text: 'Postfix は MX を引いて <code>mx.example.net</code>（198.51.100.10:25）へ SMTP で配送します。OpenDKIM のログには <code>DKIM-Signature field added</code> が残ります。',
        code: code('journalctl -u postfix -u opendkim', 'text', [
          'Sep 28 10:15:03 mail postfix/submission/smtpd[2201]: 4F2A1C0B7E: client=unknown[203.0.113.77], sasl_method=PLAIN, sasl_username=alice',
          'Sep 28 10:15:03 mail opendkim[812]: 4F2A1C0B7E: ⟪DKIM-Signature field added (s=sel1, d=example.com)⟫',
          'Sep 28 10:15:04 mail postfix/smtp[2210]: 4F2A1C0B7E: to=<bob@example.net>, relay=mx.example.net[198.51.100.10]:25, delay=1.1, delays=0.1/0/0.6/0.4, dsn=2.0.0, status=sent (250 2.0.0 Ok: queued as 9C1D2E3F4A)',
        ]),
        run: async (s) => {
          await s.show('log');
          await s.term('log', [
            'opendkim[812]: 4F2A1C0B7E: DKIM-Signature field added (s=sel1, d=example.com)',
            'postfix/smtp[2210]: 4F2A1C0B7E: to=<bob@example.net>, relay=mx.example.net[198.51.100.10]:25, status=sent (250 2.0.0 Ok: queued as 9C1D2E3F4A)',
          ].join('\n'), { lineDelay: 300 });
          await s.fly('postfix:r', 'out:l', { label: 'SMTP :25', arc: -50, dur: 1200 });
          s.state('out', 'active');
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 3 — 検証
   * ============================================================= */
  const SMTP_T = [
    '220 mx.example.net ESMTP Postfix',
    'EHLO mail.example.com',
    '250-mx.example.net … 250-STARTTLS',
    'STARTTLS → TLSv1.3',
    'MAIL FROM:<alice@example.com>',
    '250 2.1.0 Ok',
    'RCPT TO:<bob@example.net>',
    '250 2.1.5 Ok',
    'DATA',
    '354 End data with <CR><LF>.<CR><LF>',
    '(DKIM-Signature: … 本文 …)',
    '.',
    '250 2.0.0 Ok: queued as 9C1D2E3F4A',
  ];
  TIM.scene('#sc-verify', {
    intro: '受信側 <code>mx.example.net</code> で、OpenDKIM（verify モード）が DNS から公開鍵を取り、本文ハッシュと署名を検証して <code>Authentication-Results</code> を付けるまでです。再計算と RSA 検証はページ上の WebCrypto で実行しています。',
    steps: [
      {
        title: 'SMTP で受信側 MTA に届く',
        text: '送信側 Postfix が <code>mx.example.net</code> の 25 番に接続し、STARTTLS の後にエンベロープ（<code>MAIL FROM</code> / <code>RCPT TO</code>）と、<code>DATA</code> でメッセージ本体を送ります。DKIM が見るのは <code>DATA</code> の中身（ヘッダ + 本文）だけです。',
        code: code('SMTP セッション（抜粋）', 'text', [
          '220 mx.example.net ESMTP Postfix',
          'EHLO mail.example.com',
          '250-mx.example.net',
          '250-PIPELINING',
          '250-SIZE 10240000',
          '250-STARTTLS',
          '250-8BITMIME',
          '250 SMTPUTF8',
          'STARTTLS',
          '220 2.0.0 Ready to start TLS',
          '(TLSv1.3 ハンドシェイク後、EHLO をやり直す)',
          'MAIL FROM:<alice@example.com>',
          '250 2.1.0 Ok',
          'RCPT TO:<bob@example.net>',
          '250 2.1.5 Ok',
          'DATA',
          '354 End data with <CR><LF>.<CR><LF>',
          'DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; …',
          'From: Alice <alice@example.com>',
          '…',
          '.',
          '250 2.0.0 Ok: queued as 9C1D2E3F4A',
        ]),
        run: async (s) => {
          const tp = s.term('smtp', SMTP_T.join('\n'), { lineDelay: 110 });
          await s.fly('snd:r', 'mx:l', { label: 'SMTP :25 (TLS)', dur: 1200 });
          await tp;
          s.state('mx', 'active');
        },
      },
      {
        title: 'Received ヘッダが先頭に付く（署名には無関係）',
        text: '受信側 Postfix は、どこから受け取ったかを記録する <code>Received:</code> をメッセージの先頭に追加します。<code>Received</code> は <code>h=</code> に含まれていないので、経路上で何行増えても DKIM の検証結果は変わりません。',
        code: code('受信側が追加したヘッダ', 'mail', RECEIVED.replace(/\r\n/g, '\n')),
        run: async (s) => {
          await s.show('msg');
          s.cls(L('msg', 1, 2, 3, 4), 'dim');
          await s.show('rcv', { fx: 'pop' });
        },
      },
      {
        title: 'milter で OpenDKIM に渡し、DKIM-Signature をパースする',
        text: '接続元 <code>203.0.113.25</code> は受信側にとって外部なので、OpenDKIM は「検証」モードで動きます。まず <code>DKIM-Signature</code> をタグに分解し、<code>d=</code> と <code>s=</code> から公開鍵の DNS 名 <code>sel1._domainkey.example.com</code> を組み立てます。',
        code: code('DKIM-Signature', 'mail', [
          'DKIM-Signature: v=1; ⟪a=rsa-sha256⟫; ⟪c=relaxed/relaxed⟫;',
          '  ⟪d=example.com⟫; ⟪s=sel1⟫; t=1790558103;',
          '  bh=' + BH + ';',
          '  h=From:To:Subject:Date:Message-ID:From;',
          '  b=' + short(B, 56),
          '; 公開鍵の DNS 名 = <s>._domainkey.<d> = sel1._domainkey.example.com',
        ]),
        run: async (s) => {
          s.hide('rcv');
          await s.fly('mx:r', 'ver:l', { label: 'milter' });
          s.state('ver', 'active');
          s.cls(L('msg', 5, 6, 7, 8, 9), 'hl');
          await s.show('tags', { fx: 'right' });
        },
      },
      {
        title: 'DNS に公開鍵を問い合わせる',
        text: 'リゾルバ経由で <code>sel1._domainkey.example.com</code> の TXT を引きます。応答は 3 つの文字列に分かれていますが、連結すると <code>v=DKIM1; h=sha256; k=rsa; p=MIIB…</code> になります。<code>h=sha256</code> は署名の <code>a=rsa-sha256</code> と矛盾しないので続行します。',
        code: code('受信側で同じ問い合わせ', 'bash', [
          '$ dig +noall +answer TXT sel1._domainkey.example.com',
          'sel1._domainkey.example.com. 3600 IN TXT "v=DKIM1; h=sha256; k=rsa; " "p=' + P1 + '" "' + P2 + '"',
        ]),
        run: async (s) => {
          await s.fly('ver:r', 'dns:l', { label: 'TXT? sel1._domainkey', dur: 1000 });
          s.state('dns', 'active');
          await s.fly('dns:b', 'txt:tr', { label: 'TXT', cls: 'c-green', arc: 30, dur: 1000 });
          await s.show('txt', { fx: 'up' });
        },
      },
      {
        title: 'p= から RSA 公開鍵を復元する',
        text: '<code>p=</code> を base64 デコードすると DER の SubjectPublicKeyInfo になり、そこから RSA の法 n（2048bit）と公開指数 e を取り出します。ページ上では <code>crypto.subtle.importKey("spki", …)</code> で実際に読み込んでいます。',
        code: code('openssl で中身を見る', 'bash', [
          '$ openssl pkey -pubin -in sel1.pub.pem -noout -text',
          '⟪Public-Key: (2048 bit)⟫',
          'Modulus:',
          '    00:dd:3c:f7:fb:b9:be:86:60:b1:1c:e1:36:f5:2f:',
          '    c9:e7:f6:7f:64:a3:cb:f6:c7:d4:aa:b2:cf:3e:2d:',
          '    …',
          '    c5:b3',
          '⟪Exponent: 65537 (0x10001)⟫',
        ]),
        run: async (s) => {
          s.state('dns', 'ok');
          const r = await R('orig');
          await s.scan('txt');
          await s.show('key', { fx: 'pop' });
          await s.scramble('keyv', (r.bits || 2048) + ' bit · e=' + (r.e || 65537), { dur: 700, chars: '0123456789' });
        },
      },
      {
        title: '本文ハッシュを再計算して bh= と比べる',
        text: '受信側も同じ規則（<code>c=</code> の後半 <code>relaxed</code>）で本文を正規化し、SHA-256 → base64 を計算します。ヘッダに書かれた <code>bh=</code> と一致すれば「本文は署名時から変わっていない」ことが分かります。',
        code: code('受信側での再計算', 'bash', [
          '# 受信した本文を relaxed 正規化 → 94 バイト',
          '$ openssl dgst -sha256 -binary body.c | base64',
          '⟪' + BH + '⟫   # = bh= の値',
        ]),
        run: async (s) => {
          const r = await R('recv');
          await s.show('chk', { fx: 'up' });
          s.cls('bhc', 'new', 'dim');
          await s.scramble('bhc', r.bhCalc, { dur: 1200, chars: B64C });
          s.text('bhc', r.bhCalc + (r.bhOk ? ' ✓' : ' ✗'), { flash: false });
          s.cls('bhc', r.bhOk ? 'ok' : 'bad', 'new');
        },
      },
      {
        title: '署名対象データを受信側で組み立て直す',
        text: '<code>h=</code> の順にヘッダを取り出し、relaxed 正規化して連結します。最後に受け取った <code>DKIM-Signature</code> から <code>b=</code> の値だけを取り除いたものを付けます。送信側が署名したのと 1 バイトも違わないデータが再現されるはずです。',
        code: code('受信側で再構成した署名対象データ（359 バイト）', 'text', HDATA),
        run: async (s) => {
          s.cls(L('msg', 5, 6, 7, 8, 9), '', 'hl');
          s.cls(L('msg', 10), 'hl');
          await s.swap('smtp', 'hdata');
          await s.scan('hdata');
        },
      },
      {
        title: 'RSA 署名を公開鍵で検証する',
        text: '<code>b=</code> を base64 デコードした 256 バイトを公開鍵で検証します（RSASSA-PKCS1-v1_5 / SHA-256）。ページ上の <code>crypto.subtle.verify()</code> の戻り値がそのまま下に出ます。<code>true</code> なら、<code>d=example.com</code> の秘密鍵を持つ者が、このヘッダと本文に署名したことになります。',
        code: code('同じ検証を openssl で', 'bash', [
          '# sel1.pub.pem = DNS の p= を PEM にしたもの / hdr.c = 上の署名対象データ',
          '$ echo "' + short(B, 24) + '" | base64 -d > sig.bin   # b= の値',
          '$ openssl dgst -sha256 -verify sel1.pub.pem -signature sig.bin hdr.c',
          '⟪Verified OK⟫',
        ]),
        run: async (s) => {
          const r = await R('recv');
          await s.scan('chk');
          s.cls('sigc', 'new', 'dim');
          await s.text('sigc', 'crypto.subtle.verify() → ' + (r.sigOk ? 'true' : 'false'));
          s.cls('sigc', r.sigOk ? 'ok' : 'bad', 'new');
          s.state('ver', r.sigOk ? 'ok' : 'bad');
          await s.stamp('ver', r.sigOk ? 'dkim=pass' : 'dkim=fail', { cls: r.sigOk ? 'st-ok' : 'st-bad', pos: 'br' });
        },
      },
      {
        title: 'Authentication-Results を付けて配送する',
        text: '検証結果は <code>Authentication-Results</code> ヘッダ（RFC 8601）として先頭に付き、以降のフィルタやメールソフトはこれを見ます。<code>header.b=</code> は <code>b=</code> の先頭 8 文字で、署名が複数あるときにどの署名の結果かを区別します（RFC 6008）。',
        code: [
          code('追加されたヘッダ', 'mail', [
            'Authentication-Results: mx.example.net;',
            '\tdkim=⟪pass⟫ header.d=example.com header.s=sel1 header.b=' + B.slice(0, 8),
          ]),
          code('mx の journalctl', 'text', [
            'Sep 28 10:15:04 mx postfix/smtpd[3310]: 9C1D2E3F4A: client=mail.example.com[203.0.113.25]',
            'Sep 28 10:15:04 mx opendkim[640]: 9C1D2E3F4A: ⟪DKIM verification successful⟫',
            'Sep 28 10:15:04 mx postfix/local[3316]: 9C1D2E3F4A: to=<bob@example.net>, relay=local, status=sent (delivered to maildir)',
          ]),
        ],
        run: async (s) => {
          await s.swap('hdata', 'ar');
          s.cls(L('ar', 2, 3), 'ok');
          await s.fly('ver:b', 'ar:tr', { label: 'dkim=pass', cls: 'c-green', arc: -30 });
          s.state('mx', 'ok');
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 4 — 改ざん・失敗
   * ============================================================= */
  function tmsg(o) {
    o = o || {};
    const lines = [
      'DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;',
      '\td=example.com; s=' + (o.s || 'sel1') + '; t=1790558103;' + (o.l ? ' l=94;' : ''),
      '\tbh=' + BH + ';',
      '\th=From:To:Subject:Date:Message-ID:From; b=' + (o.l ? BL : B).slice(0, 8) + '…',
      'From: Alice <alice@example.com>',
      'Subject: ' + (o.subject || 'Invoice 2026-09'),
      '',
      'Hi Bob,',
      '',
      'Total:  ' + (o.amount || '12,800') + ' JPY   ',
      'Due:    2026-10-31',
      'https://billing.example.com/inv/0928',
      '',
      'Alice',
    ].concat(o.extra || []);
    return '<div class="file-h">' + esc(o.title || '検証対象のメッセージ') + '</div><pre data-lang="mail">' + esc(lines.join('\n')) + '</pre>';
  }
  const ML_EXTRA = ['', '', '_______________________________________________', 'Team mailing list -- team@lists.example.net', 'To unsubscribe send an email to team-leave@lists.exa…'];
  const ATK_EXTRA = ['', '', 'UPDATE: our bank account has changed.', 'https://pay.attacker.example/0928'];
  const ACTORS = 'ml atk gw';
  const tab = (s, k, actor) => {
    for (let i = 0; i <= 5; i++) s.cls('k' + i, 'c-gray', 'on c-green c-amber c-red');
    s.cls('k' + k, 'on c-' + ['green', 'amber', 'red', 'amber', 'red', 'amber'][k], 'c-gray');
    s.caption('');
    const off = ACTORS.split(' ').filter((a) => a !== actor).join(' ');
    s.$(off).forEach((e) => e.classList.add('hide'));
    if (actor) return s.show(actor, { fx: 'pop' });
    return Promise.resolve();
  };
  async function showResult(s, r, o) {
    o = o || {};
    s.cls('bhc sigc', 'new', 'dim ok bad warn');
    await s.scramble('bhc', r.bhCalc || '—', { dur: 900, chars: B64C });
    s.text('bhc', (r.bhCalc || '—') + (r.bhOk ? ' ✓' : ' ✗'), { flash: false });
    s.cls('bhc', r.bhOk ? 'ok' : 'bad', 'new');
    const sigTxt = r.sigOk == null ? '（検証しない：その前で失敗）' : 'crypto.subtle.verify() → ' + r.sigOk;
    await s.text('sigc', sigTxt);
    s.cls('sigc', r.sigOk == null ? 'dim' : r.sigOk ? (o.warn ? 'warn' : 'ok') : 'bad', 'new');
    const ar = 'dkim=' + r.result + (r.why ? ' (' + r.why + ')' : '') + '\n\theader.d=example.com header.s=' + (o.s || 'sel1') + ' header.b=' + (o.b || B).slice(0, 8);
    await s.set('ar', '<div class="file-h">Authentication-Results（mx.example.net）</div><pre data-lang="mail">' + esc(ar) + '</pre>');
    s.cls(L('ar', 1), r.result === 'pass' ? (o.warn ? 'warn' : 'ok') : 'bad');
    s.state('ver', r.result === 'pass' ? (o.warn ? 'warn' : 'ok') : 'bad');
    if (r.result !== 'pass') s.shake('ver');
  }
  TIM.scene('#sc-tamper', {
    intro: '同じ署名付きメールに、経路上でよく起きる変更と攻撃を加え、受信側の再計算がどこで食い違うかを見ます。<code>bh</code> の再計算値・<code>verify()</code> の結果・<code>Authentication-Results</code> は、各ステップで実際に書き換えたメッセージをページ上で検証した結果です。',
    steps: [
      {
        title: '基準：何も変わっていなければ pass',
        text: '送信側で署名された状態のまま届けば、本文ハッシュは <code>bh=</code> と一致し、署名も検証できます。以降、このメールの一部だけを変えていきます。',
        code: code('Authentication-Results', 'mail', 'Authentication-Results: mx.example.net;\n\tdkim=pass header.d=example.com header.s=sel1 header.b=' + B.slice(0, 8)),
        run: async (s) => {
          tab(s, 0);
          s.set('msg', tmsg(), { flash: false });
          const r = await R('orig');
          await s.fly('snd:r', 'ver:l', { label: '署名済みメール', dur: 1200 });
          await showResult(s, r);
        },
      },
      {
        title: 'A：メーリングリストが本文にフッタを追加',
        text: 'Mailman などのメーリングリストは、配信時に本文末尾へ購読解除の案内を追加します。悪意はありませんが、署名された本文は変わってしまいます。<code>DKIM-Signature</code> はそのまま残っています。',
        code: code('ML が追加した本文末尾', 'text', FOOTER.replace(/\r\n/g, '\n').trim()),
        run: async (s) => {
          await tab(s, 1, 'ml');
          await s.fly('snd:r', 'ml:l', { label: 'To: team@lists…' });
          await s.set('msg', tmsg({ extra: ML_EXTRA, title: 'lists.example.net が再配信したメッセージ' }));
          s.cls(L('msg', 17, 18, 19), 'bad');
          await s.fly('ml:r', 'ver:l', { label: 'フッタ付き', cls: 'c-amber' });
        },
      },
      {
        title: 'A：本文ハッシュが一致しない → body hash did not verify',
        text: '受信側が正規化した本文にはフッタが含まれるので、SHA-256 はまったく別の値になります。<code>bh=</code> が一致しない時点で検証は終わり、RSA 署名の検証までは進みません（RFC 6376 §6.1.3 の <code>PERMFAIL (body hash did not verify)</code>）。',
        code: [
          code('受信側の再計算', 'text', ['bh 署名値 : ' + BH, 'bh 再計算 : ⟪' + EXPECT.ml.bhCalc + '⟫']),
          code('Authentication-Results', 'mail', 'Authentication-Results: mx.example.net;\n\tdkim=⟪fail (body hash did not verify)⟫\n\theader.d=example.com header.s=sel1 header.b=' + B.slice(0, 8)),
        ],
        run: async (s) => {
          const r = await R('ml');
          await s.scan('msg');
          await showResult(s, r);
        },
      },
      {
        title: 'B：攻撃者が本文の金額を書き換える',
        text: '経路上で本文の <code>12,800</code> を <code>98,000</code> に変えても結果は同じで、1 文字の変更でも SHA-256 は全く別の値になります。攻撃者は秘密鍵を持たないので、新しい本文に合う <code>bh=</code> と <code>b=</code> を作り直せません。',
        code: code('受信側の再計算', 'text', ['bh 署名値 : ' + BH, 'bh 再計算 : ⟪' + EXPECT.amt.bhCalc + '⟫', '→ dkim=fail (body hash did not verify)']),
        run: async (s) => {
          await tab(s, 2, 'atk');
          await s.set('msg', tmsg({ amount: '98,000', title: '改変されたメッセージ' }));
          s.cls(L('msg', 10), 'bad');
          await s.fly('atk:r', 'ver:l', { label: '98,000 JPY', cls: 'c-red' });
          const r = await R('amt');
          await showResult(s, r);
        },
      },
      {
        title: 'C：件名に [EXTERNAL] が付く → signature did not verify',
        text: '受信側のセキュリティゲートウェイが件名に <code>[EXTERNAL]</code> を付けたケースです。本文は変わらないので <code>bh</code> は一致しますが、<code>Subject</code> は <code>h=</code> に含まれるので署名対象データが変わり、RSA 検証が <code>false</code> になります。',
        code: [
          code('署名対象データの差分', 'diff', ['-subject:Invoice 2026-09', '+subject:[EXTERNAL] Invoice 2026-09']),
          code('openssl で同じ検証', 'bash', [
            '$ openssl dgst -sha256 -verify sel1.pub.pem -signature sig.bin hdr_subj.c',
            'Verification failure',
          ]),
        ],
        run: async (s) => {
          await tab(s, 3, 'gw');
          await s.set('msg', tmsg({ subject: '[EXTERNAL] Invoice 2026-09', title: 'ゲートウェイが件名を変えたメッセージ' }));
          s.cls(L('msg', 6), 'bad');
          await s.fly('gw:r', 'ver:l', { label: 'Subject 変更', cls: 'c-amber' });
          const r = await R('subj');
          await showResult(s, r);
        },
      },
      {
        title: 'D：l= 付き署名は、末尾への追記を検出できない',
        text: '送信側が <code>l=94</code>（本文の先頭 94 バイトだけ署名）を付けていた場合、攻撃者が末尾に文章とリンクを追記しても、先頭 94 バイトのハッシュは変わりません。署名も有効なまま <code>dkim=pass</code> になり、追記部分が「署名済み」に見えてしまいます。',
        code: [
          code('l= 付きの署名', 'mail', ['DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;', '  d=example.com; s=sel1; t=1790558103; ⟪l=94⟫;', '  bh=' + BH + ';', '  h=From:To:Subject:Date:Message-ID:From;', '  b=' + short(BL, 40)]),
          code('受信側の計算', 'text', ['正規化後の本文 : 172 バイト', 'ハッシュ対象   : 先頭 ⟪94⟫ バイトのみ（残り 78 バイトは未検査）', 'bh 再計算      : ' + BH + ' ✓', 'verify()       : true → dkim=pass']),
        ],
        run: async (s) => {
          await tab(s, 4, 'atk');
          await s.set('msg', tmsg({ l: true, extra: ATK_EXTRA, title: 'l=94 の署名 + 攻撃者の追記' }));
          s.cls(L('msg', 2), 'warn');
          s.cls(L('msg', 17, 18), 'bad');
          await s.fly('atk:r', 'ver:l', { label: '末尾に追記', cls: 'c-red' });
          const r = await R('lbad');
          await showResult(s, r, { warn: true, b: BL });
          await s.stamp('msg', 'l=94 より後ろは未署名', { cls: 'st-bad' });
        },
      },
      {
        title: 'D：l= がなければ、同じ追記は fail になる',
        text: '同じ追記を、<code>l=</code> なしで署名されたメールに行うと、本文全体がハッシュ対象なので <code>body hash did not verify</code> で検出されます。OpenDKIM は <code>BodyLengthDB</code> を設定しない限り <code>l=</code> を付けません。受信側でも <code>l=</code> 付き署名を信用しない設定が推奨されます。',
        code: code('受信側の計算（l= なし）', 'text', ['ハッシュ対象 : 本文全体 172 バイト', 'bh 再計算    : ⟪IPT+VIcnnHCUT11dXrSW579HxuAwyH8Q1JEq10+OxJo=⟫ ✗', '→ dkim=fail (body hash did not verify)']),
        run: async (s) => {
          s.caption('');
          await s.set('msg', tmsg({ extra: ATK_EXTRA, title: 'l= なしの署名 + 同じ追記' }));
          s.cls(L('msg', 17, 18), 'bad');
          const r = await R('nol');
          await showResult(s, r);
        },
      },
      {
        title: 'E：DNS に鍵がない → 鍵の取得で失敗',
        text: '<code>s=sel2</code> で署名されているのに、DNS に <code>sel2._domainkey.example.com</code> がない（公開し忘れ・ローテーションで削除済み）と、本文や署名を調べる前に失敗します。RFC 6376 §6.1.2 では <code>PERMFAIL (no key for signature)</code> で、Authentication-Results の結果名は実装によって <code>permerror</code> や <code>neutral</code> などになります。',
        code: code('受信側で確認', 'bash', [
          '$ dig +noall +comments TXT sel2._domainkey.example.com | grep status',
          ';; ->>HEADER<<- opcode: QUERY, status: ⟪NXDOMAIN⟫, id: 28164',
        ]),
        run: async (s) => {
          await tab(s, 5, null);
          await s.set('msg', tmsg({ s: 'sel2', title: 's=sel2 で署名されたメッセージ' }));
          s.cls(L('msg', 2), 'warn');
          await s.show('dig');
          await s.term('dig', '$ dig TXT sel2._domainkey.example.com | grep status\n;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 28164', { lang: 'dns' });
          const r = await R('nokey');
          await showResult(s, Object.assign({}, r, { bhCalc: null, bhOk: null, sigOk: null }), { s: 'sel2' });
          s.text('bhc', '（鍵がないので検証しない）', { flash: false });
          s.cls('bhc', 'dim', 'ok bad new');
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 5 — SPF / DKIM / DMARC
   * ============================================================= */
  const ENV = {
    orig: [';; SMTP エンベロープ（RFC 5321）', 'MAIL FROM:<alice@example.com>', 'RCPT TO:<bob@example.net>', ';; ヘッダ（RFC 5322）', 'DKIM-Signature: v=1; a=rsa-sha256; d=example.com; s=sel1; …', 'From: Alice <alice@example.com>'],
    atk: [';; SMTP エンベロープ（RFC 5321）', 'MAIL FROM:<info@attacker.example>', 'RCPT TO:<bob@example.net>', ';; ヘッダ（RFC 5322）', '（DKIM-Signature なし）', 'From: Alice <alice@example.com>'],
    fwd: [';; SMTP エンベロープ（RFC 5321）', 'MAIL FROM:<alice@example.com>', 'RCPT TO:<bob@example.net>', ';; ヘッダ（RFC 5322）', 'DKIM-Signature: v=1; a=rsa-sha256; d=example.com; s=sel1; …', 'From: Alice <alice@example.com>'],
  };
  const envHTML = (k, title) => '<div class="file-h">' + esc(title) + '</div><pre data-lang="mail">' + esc(ENV[k].join('\n')) + '</pre>';
  const kvHTML = (rows) => rows.map((r) => '<dt>' + r[0] + '</dt><dd' + (r[2] ? ' class="' + r[2] + '"' : '') + '>' + r[1] + '</dd>').join('');
  const SPF_ROWS = [['見る', 'MAIL FROM のドメイン + 接続元 IP'], ['引く', 'TXT example.com', 'acc'], ['記録', 'v=spf1 ip4:203.0.113.0/24 include:_spf.example.net -all']];
  const DKIM_ROWS = [['見る', 'DKIM-Signature の d= / s='], ['引く', 'TXT sel1._domainkey.example.com', 'acc'], ['記録', 'v=DKIM1; h=sha256; k=rsa; p=MIIBIjAN…']];
  const DMARC_ROWS = [['見る', 'ヘッダ From のドメイン'], ['引く', 'TXT _dmarc.example.com', 'acc'], ['記録', 'v=DMARC1; p=reject; rua=mailto:dmarc-reports@example.com; adkim=s; aspf=r']];
  const AR = {
    orig: 'Authentication-Results: mx.example.net; spf=pass smtp.mailfrom=alice@example.com;\n\tdkim=pass header.d=example.com header.s=sel1 header.b=' + B.slice(0, 8) + '; dmarc=pass header.from=example.com',
    fwd: 'Authentication-Results: mx.example.net; spf=fail smtp.mailfrom=alice@example.com;\n\tdkim=pass header.d=example.com header.s=sel1 header.b=' + B.slice(0, 8) + '; dmarc=pass header.from=example.com',
  };
  const arHTML = (txt) => '<div class="file-h">mx.example.net が付ける結果ヘッダ</div><pre data-lang="mail">' + esc(txt) + '</pre>';
  TIM.scene('#sc-dmarc', {
    intro: '1 通のメールに対して、受信側 <code>mx.example.net</code> は SPF・DKIM・DMARC の 3 つを検査します。それぞれが「どの識別子を」「どの DNS レコードで」「何と比べるか」を並べ、なりすましと転送のケースで結果がどう変わるかを見ます。',
    steps: [
      {
        title: '3 つの識別子：MAIL FROM・From・d=',
        text: 'SMTP のエンベロープ <code>MAIL FROM</code>（バウンスの宛先。受信者には通常見えない）、ヘッダの <code>From:</code>（メールソフトに表示される）、DKIM の <code>d=</code>（署名したドメイン）は別々の値で、それぞれ別の仕組みが検査します。',
        code: code('受信側が受け取るもの', 'mail', ENV.orig.concat(['To: Bob <bob@example.net>', 'Subject: Invoice 2026-09'])),
        run: async (s) => {
          await s.fly('snd:r', 'env:l', { label: 'SMTP', dur: 800 });
          s.cls(L('env', 2), 'hl');
          await s.wait(300);
          s.cls(L('env', 5), 'hl');
          await s.wait(300);
          s.cls(L('env', 6), 'warn');
          await s.fly('env:r', 'mx:l', { dur: 800 });
          s.state('mx', 'active');
        },
      },
      {
        title: 'SPF：MAIL FROM のドメインが、この IP からの送信を許しているか',
        text: '受信側は <code>MAIL FROM</code> のドメイン <code>example.com</code> の TXT から <code>v=spf1</code> で始まるレコードを取り、接続元 IP <code>203.0.113.25</code> と照合します。<code>ip4:203.0.113.0/24</code> に一致するので <code>pass</code>。どれにも一致しなければ末尾の <code>-all</code> で <code>fail</code> です。<code>include:</code> などの DNS 参照は合計 10 回までです。',
        code: [
          code('SPF レコード', 'bash', ['$ dig +short TXT example.com', '"v=spf1 ⟪ip4:203.0.113.0/24⟫ include:_spf.example.net -all"']),
          code('受信側が付ける Received-SPF', 'mail', 'Received-SPF: pass (mx.example.net: domain of alice@example.com designates 203.0.113.25 as permitted sender) client-ip=203.0.113.25; envelope-from="alice@example.com"; helo=mail.example.com;'),
        ],
        run: async (s) => {
          await s.show('spf', { fx: 'up' });
          s.cls(L('env', 2), 'ok', 'hl');
          await s.scan('spf');
          await s.set('spfkv', kvHTML(SPF_ROWS.concat([['判定', '203.0.113.25 ∈ 203.0.113.0/24', 'ok']])));
          await s.show('rspf', { fx: 'pop' });
          s.cls('rspf', 'c-green');
          await s.text('rspf', 'spf=pass smtp.mailfrom=example.com');
        },
      },
      {
        title: 'DKIM：d= のドメインの鍵で署名が検証できるか',
        text: '前のシーンで見た検証です。<code>sel1._domainkey.example.com</code> の公開鍵で <code>b=</code> が検証でき、本文ハッシュも一致したので <code>pass</code>。DKIM の結果として記録されるドメインは <code>header.d=example.com</code> です。',
        code: code('DKIM の結果', 'mail', 'dkim=pass header.d=⟪example.com⟫ header.s=sel1 header.b=' + B.slice(0, 8)),
        run: async (s) => {
          await s.show('dkim', { fx: 'up' });
          s.cls(L('env', 5), 'ok', 'hl');
          await s.scan('dkim');
          await s.set('dkimkv', kvHTML(DKIM_ROWS.concat([['判定', 'bh 一致・b= 検証 OK', 'ok']])));
          await s.show('rdkim', { fx: 'pop' });
          s.cls('rdkim', 'c-green');
          await s.text('rdkim', 'dkim=pass header.d=example.com');
        },
      },
      {
        title: 'DMARC：From のドメインのポリシーを取る',
        text: 'DMARC は <strong>ヘッダ From</strong> のドメインから <code>_dmarc.example.com</code> の TXT を引きます。<code>p=reject</code>（失敗したら受信拒否）、<code>adkim=s</code>（DKIM は完全一致）、<code>aspf=r</code>（SPF は組織ドメイン一致で可）、<code>rua=</code>（集計レポートの送り先）を宣言しています。',
        code: code('DMARC レコード', 'bash', ['$ dig +short TXT _dmarc.example.com', '"v=DMARC1; ⟪p=reject⟫; rua=mailto:dmarc-reports@example.com; ⟪adkim=s⟫; ⟪aspf=r⟫"']),
        run: async (s) => {
          await s.show('dmarc', { fx: 'up' });
          await s.scan('dmarc');
        },
      },
      {
        title: 'DMARC：アラインメントを判定して pass',
        text: 'From のドメイン <code>example.com</code> と、pass した DKIM の <code>d=example.com</code> は完全一致（<code>adkim=s</code> を満たす）。SPF のドメイン <code>example.com</code> も一致。DMARC は<strong>どちらか一方</strong>がアラインして pass していれば <code>pass</code> です。3 つの結果は 1 つの <code>Authentication-Results</code> にまとめて書かれます。',
        code: code('Authentication-Results', 'mail', AR.orig),
        run: async (s) => {
          await s.set('dmarckv', kvHTML(DMARC_ROWS.concat([['整合', 'd=example.com = From（s）✓<br>MAIL FROM example.com ≈ From（r）✓', 'ok']])));
          s.cls(L('env', 6), 'ok', 'warn');
          await s.show('rdmarc', { fx: 'pop' });
          s.cls('rdmarc', 'c-green');
          await s.text('rdmarc', 'dmarc=pass header.from=example.com');
          await s.show('ar', { fx: 'up' });
          s.state('mx', 'ok');
        },
      },
      {
        title: 'なりすまし：From だけ example.com を名乗る',
        text: '攻撃者は自分のドメイン <code>attacker.example</code> を <code>MAIL FROM</code> に使い、自分の IP を SPF に登録しておけば SPF は <code>pass</code> にできます。しかしヘッダ From は <code>alice@example.com</code> を名乗っており、<code>example.com</code> の秘密鍵がないので DKIM 署名は付けられません。',
        code: code('攻撃者が送るもの', 'mail', ENV.atk.concat(['Subject: Invoice 2026-09 (updated bank account)'])),
        run: async (s) => {
          s.state('mx', 'active');
          s.hide('ar rdmarc');
          await s.show('atk', { fx: 'pop' });
          await s.set('env', envHTML('atk', 'attacker.example (198.51.100.66) → mx.example.net'));
          s.cls(L('env', 2), 'warn'); s.cls(L('env', 5), 'bad'); s.cls(L('env', 6), 'bad');
          await s.fly('atk:r', 'env:l', { label: 'SMTP', cls: 'c-red' });
          s.set('spfkv', kvHTML([['見る', 'MAIL FROM のドメイン + 接続元 IP'], ['引く', 'TXT attacker.example', 'acc'], ['記録', '（攻撃者が自由に設定できる）'], ['判定', '198.51.100.66 は許可済み', 'ok']]));
          s.set('dkimkv', kvHTML([['見る', 'DKIM-Signature の d= / s='], ['判定', '署名なし', 'bad']]));
          s.set('dmarckv', kvHTML(DMARC_ROWS));
          s.text('rspf', 'spf=pass smtp.mailfrom=attacker.example'); s.cls('rspf', 'c-amber', 'c-green');
          await s.text('rdkim', 'dkim=none'); s.cls('rdkim', 'c-red', 'c-green');
        },
      },
      {
        title: 'DMARC fail → p=reject で受信拒否',
        text: 'SPF は pass でもドメイン <code>attacker.example</code> は From の <code>example.com</code> とアラインせず、DKIM はそもそも無い。したがって DMARC は <code>fail</code> で、<code>example.com</code> のポリシー <code>p=reject</code> に従い、受信側は <code>DATA</code> の最後で SMTP エラーを返します（OpenDMARC の例）。',
        code: [
          code('攻撃者の SMTP セッション', 'text', ['DATA', '354 End data with <CR><LF>.<CR><LF>', '…', '.', '⟪550 5.7.1 rejected by DMARC policy for example.com⟫']),
          code('mx の journalctl', 'text', 'Sep 28 11:02:41 mx postfix/cleanup[3402]: 7D1E2F3A4B: milter-reject: END-OF-MESSAGE from unknown[198.51.100.66]: 5.7.1 rejected by DMARC policy for example.com; from=<info@attacker.example> to=<bob@example.net> proto=ESMTP helo=<attacker.example>'),
        ],
        run: async (s) => {
          await s.set('dmarckv', kvHTML(DMARC_ROWS.concat([['整合', 'attacker.example ≠ example.com ✗<br>DKIM なし ✗', 'bad']])));
          await s.show('rdmarc', { fx: 'pop' });
          s.cls('rdmarc', 'c-red', 'c-green');
          await s.text('rdmarc', 'dmarc=fail → p=reject');
          s.state('dmarc', 'bad');
          await s.fly('mx:b', 'atk:r', { label: '550 5.7.1', cls: 'c-red', arc: 60, dur: 1200 });
          s.state('atk', 'bad');
          s.shake('atk');
        },
      },
      {
        title: '転送：SPF は壊れるが、DKIM で DMARC は pass',
        text: 'Bob の旧アドレスから転送サーバ <code>fwd.example.net</code>（198.51.100.20）が同じメールをそのまま再送すると、接続元 IP が <code>example.com</code> の SPF に含まれないので <code>spf=fail</code> です。一方、ヘッダと本文は変わっていないので DKIM は <code>pass</code> のまま。DKIM がアラインしているので DMARC は <code>pass</code> になります。',
        code: code('転送後の Authentication-Results', 'mail', AR.fwd.replace('spf=fail', '⟪spf=fail⟫').replace('dmarc=pass', '⟪dmarc=pass⟫')),
        run: async (s) => {
          s.state('mx', 'active');
          s.state('atk dmarc', null);
          s.hide('atk');
          await s.show('fwd', { fx: 'pop' });
          await s.set('env', envHTML('fwd', 'fwd.example.net (198.51.100.20) → mx.example.net'));
          s.cls(L('env', 2), 'bad'); s.cls(L('env', 5), 'ok'); s.cls(L('env', 6), 'ok');
          await s.fly('fwd:r', 'env:l', { label: '転送', cls: 'c-amber' });
          s.set('spfkv', kvHTML(SPF_ROWS.concat([['判定', '198.51.100.20 ∉ 203.0.113.0/24 → -all', 'bad']])));
          s.set('dkimkv', kvHTML(DKIM_ROWS.concat([['判定', 'bh 一致・b= 検証 OK', 'ok']])));
          s.set('dmarckv', kvHTML(DMARC_ROWS.concat([['整合', 'd=example.com = From（s）✓<br>SPF は fail のため不採用', 'ok']])));
          s.text('rspf', 'spf=fail smtp.mailfrom=example.com'); s.cls('rspf', 'c-red', 'c-green c-amber');
          s.text('rdkim', 'dkim=pass header.d=example.com'); s.cls('rdkim', 'c-green', 'c-red');
          s.text('rdmarc', 'dmarc=pass（DKIM でアライン）'); s.cls('rdmarc', 'c-green', 'c-red');
          s.set('ar', arHTML(AR.fwd));
          await s.show('ar', { fx: 'up' });
          s.cls(L('ar', 1), 'bad');
          s.cls(L('ar', 2), 'ok');
          s.state('mx', 'ok');
        },
      },
      {
        title: 'rua：受信側からドメイン所有者への集計レポート',
        text: '<code>rua=mailto:dmarc-reports@example.com</code> を宣言すると、受信事業者は「どの IP から自ドメインを名乗るメールが何通来て、SPF/DKIM/DMARC がどうだったか」を XML で定期的に送ってきます。正規の送信経路の漏れや、なりすましの発生元をここで把握します。',
        code: code('集計レポート（XML・抜粋）', 'text', [
          '<feedback>',
          '  <report_metadata><org_name>mx.example.net</org_name> …</report_metadata>',
          '  <policy_published><domain>example.com</domain><adkim>s</adkim><aspf>r</aspf><p>reject</p></policy_published>',
          '  <record>',
          '    <row><source_ip>198.51.100.66</source_ip><count>12</count>',
          '      <policy_evaluated><disposition>reject</disposition><dkim>fail</dkim><spf>fail</spf></policy_evaluated></row>',
          '    <identifiers><header_from>example.com</header_from></identifiers>',
          '    <auth_results><spf><domain>attacker.example</domain><result>pass</result></spf></auth_results>',
          '  </record>',
          '</feedback>',
        ]),
        run: async (s) => {
          await s.fly('mx:b', 'snd:r', { label: 'rua: report.xml.gz → dmarc-reports@example.com', cls: 'c-amber', arc: 40, dur: 1600 });
          s.pulse('snd');
        },
      },
    ],
  });

  /* ===============================================================
   * LAB — ブラウザで検証
   * ============================================================= */
  const ta = document.getElementById('lab-msg');
  const out = document.getElementById('lab-out');
  if (ta && out) {
    const ORIG = message().replace(/\r\n/g, '\n').replace(/\n+$/, '\n');
    const reset = () => { ta.value = ORIG; out.innerHTML = ''; };
    const row = (k, v, cls) => '<div class="row ' + (cls || '') + '"><span>' + esc(k) + '</span><code>' + esc(v) + '</code></div>';
    const run = async () => {
      if (!(window.crypto && crypto.subtle)) { out.innerHTML = row('エラー', 'このブラウザでは WebCrypto (crypto.subtle) が使えません', 'bad'); return; }
      const r = await verify(ta.value);
      if (r.result === 'none') { out.innerHTML = row('結果', r.why, 'bad'); return; }
      out.innerHTML =
        row('鍵の DNS 名', r.qname + (DNS[r.qname] ? '  → TXT あり' : '  → NXDOMAIN（鍵なし）'), DNS[r.qname] ? '' : 'bad') +
        row('正規化後の本文', r.bodyLen + ' バイト' + (r.hashedLen !== r.bodyLen ? '（l= により先頭 ' + r.hashedLen + ' バイトのみ）' : '')) +
        row('bh 署名値', r.bhSig) +
        row('bh 再計算', r.bhCalc + (r.bhOk ? '  一致' : '  不一致'), r.bhOk ? 'ok' : 'bad') +
        row('署名対象データ', r.hlen + ' バイト · SHA-256 ' + r.hhash) +
        row('verify()', r.sigOk == null ? '（実行せず）' : String(r.sigOk), r.sigOk == null ? '' : r.sigOk ? 'ok' : 'bad') +
        row('Authentication-Results', 'dkim=' + r.result + (r.why ? ' (' + r.why + ')' : '') + ' header.d=' + (r.tags.d || '') + ' header.s=' + (r.tags.s || '') + ' header.b=' + String(r.tags.b || '').replace(/\s+/g, '').slice(0, 8), r.result === 'pass' ? 'ok' : 'bad');
    };
    reset();
    document.getElementById('lab-run').addEventListener('click', run);
    document.getElementById('lab-reset').addEventListener('click', reset);
    document.getElementById('lab-body').addEventListener('click', () => { ta.value = ta.value.replace(/\n*$/, '\n\n') + FOOTER.replace(/\r\n/g, '\n'); run(); });
    document.getElementById('lab-subj').addEventListener('click', () => { ta.value = ta.value.replace(/^Subject: (\[EXTERNAL\] )?/m, 'Subject: [EXTERNAL] '); run(); });
    document.getElementById('lab-recv').addEventListener('click', () => { ta.value = RECEIVED.replace(/\r\n/g, '\n') + '\n' + ta.value; run(); });
    document.getElementById('lab-ws').addEventListener('click', () => { ta.value = ta.value.replace('Hi Bob,', 'Hi    Bob,   '); run(); });
  }
})();
