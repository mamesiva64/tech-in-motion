/* HTTPS / TLS 1.3 — scenes (see AGENT.md §7)
 * 端末出力・16 進値は 2026-09 の実測（curl 8.5.0 / OpenSSL 3.0.13 on Ubuntu 24.04、
 * openssl s_client 3.5.7 -trace）。IP アドレスのみ RFC 5737 の例示アドレスに置換。
 */
(function () {
  'use strict';

  const esc = TIM.esc;
  const LK = '<span class="pk-ic">' + TIM.icon('lock') + '</span>';
  const P = (x, y) => ({ x, y });

  /** .file の中身（ヘッダ + ハイライト済み pre）を作る */
  function card(title, src, lang, hl) {
    return '<div class="file-h">' + esc(title) + '</div>' +
      '<pre data-lang="' + (lang || 'text') + '"' + (hl ? ' data-hl="' + [].concat(hl).join(',') + '"' : '') + '>' +
      esc(TIM.dedent(src)) + '</pre>';
  }

  /* =====================================================================
   * SCENE 1 — 全体像
   * ===================================================================*/
  (function () {
    const L = 130, R = 830;
    const Y = { tcp: 124, ch: 158, sh: 192, sf: 244, cf: 278, rq: 332, rs: 356 };

    TIM.scene('#sc-overview', {
      intro: '<code>curl -v https://example.com/</code> 1 回で何が流れるかを、TCP → TLS 1.3 → HTTP/2 の順に追います。下の端末は実測の <code>curl -v</code> 出力で、各ステップで増えていく行が「いま回線上で起きたこと」に対応します。',
      steps: [
        {
          title: 'curl が名前解決して 443 番へ',
          text: '<code>curl -v</code> はまず <code>example.com</code> を名前解決し、<code>203.0.113.10:443</code> へ TCP 接続を試みます。この時点では TLS はまだ何も始まっていません。',
          code: { title: 'shell', lang: 'bash', src: `
            $ curl -v https://example.com/ -o /dev/null
            # -v            接続・TLS・HTTP の経過を表示（* 情報 / > 送信 / < 受信）
            # -o /dev/null  本文は捨てる` },
          run: async (s) => {
            s.state('cli', 'active');
            await s.term('t', `
              $ curl -v https://example.com/ -o /dev/null
              * Host example.com:443 was resolved.
              * IPv6: (none)
              * IPv4: 203.0.113.10
              *   Trying 203.0.113.10:443...`);
          },
        },
        {
          title: 'TCP 3-way handshake（1 RTT）',
          text: 'TLS の前に TCP の SYN → SYN/ACK → ACK で <strong>1 往復</strong>かかります。宛先ポートは HTTPS の既定 <code>443</code>。ここまではただの TCP です。',
          code: { title: 'tcpdump', lang: 'text', src: `
            $ sudo tcpdump -ni eth0 'host 203.0.113.10 and tcp port 443'
            IP 198.51.100.7.53412 > 203.0.113.10.443: Flags [S], seq 1780045123, win 64240, options [mss 1460,sackOK,…], length 0
            IP 203.0.113.10.443 > 198.51.100.7.53412: Flags [S.], seq 2203411962, ack 1780045124, win 65535, options [mss 1460,…], length 0
            IP 198.51.100.7.53412 > 203.0.113.10.443: Flags [.], ack 1, win 502, length 0` },
          run: async (s) => {
            s.state('cli', null);
            s.line(P(L, Y.tcp), P(R, Y.tcp), { label: 'SYN → SYN/ACK → ACK（TCP :443）', both: true });
            await s.fly(P(L, Y.tcp), P(R, Y.tcp), { label: 'SYN', dur: 700 });
            await s.fly(P(R, Y.tcp), P(L, Y.tcp), { label: 'SYN/ACK', dur: 700 });
            await s.fly(P(L, Y.tcp), P(R, Y.tcp), { label: 'ACK', dur: 600 });
            s.show('rtt1', { fx: 'pop' });
            await s.term('t', '* Connected to example.com (203.0.113.10) port 443');
          },
        },
        {
          title: 'ClientHello（平文）',
          text: '最初の TLS レコードは<strong>平文</strong>です。接続先ホスト名（SNI）、使える cipher suite、ECDHE の公開鍵（<code>key_share</code>）、HTTP のバージョン候補（ALPN）がすべて入っています。中身は次のシーンで 1 バイトずつ読みます。',
          code: { title: 'ClientHello の要点（実測）', lang: 'text', src: `
            ClientHello (1)                         ← 平文（record type 22）
              legacy_version       0x0303
              random               32 bytes
              cipher_suites        0x1302 0x1303 0x1301 …
              server_name          ⟪example.com⟫
              supported_versions   0x0304 (TLS 1.3), 0x0303 (TLS 1.2)
              key_share            x25519: 公開鍵 32 bytes
              ALPN                 h2, http/1.1` },
          run: async (s) => {
            s.line(P(L, Y.ch), P(R, Y.ch), { label: 'ClientHello · SNI=example.com · key_share x25519 · ALPN h2', cls: 'warn' });
            await s.fly(P(L, Y.ch), P(R, Y.ch), { label: 'ClientHello', cls: 'c-amber', dur: 1100 });
            s.show('plain', { fx: 'pop' });
            await s.term('t', `
              * ALPN: curl offers h2,http/1.1
              * TLSv1.3 (OUT), TLS handshake, Client hello (1):
              *  CAfile: /etc/ssl/certs/ca-certificates.crt
              *  CApath: /etc/ssl/certs`);
          },
        },
        {
          title: 'ServerHello（平文）で鍵が決まる',
          text: 'サーバーは cipher suite <code>0x1302</code> と自分の <code>key_share</code> を選んで返します。ServerHello も平文ですが、これが届いた瞬間に両者は同じ ECDHE 共有秘密を計算でき、<strong>handshake traffic keys</strong> が決まります。',
          code: { title: 'ServerHello の要点（実測）', lang: 'text', src: `
            ServerHello (2)                         ← 平文
              cipher_suite         ⟪0x1302 TLS_AES_256_GCM_SHA384⟫
              key_share            x25519: 公開鍵 32 bytes
              supported_versions   0x0304 → TLS 1.3 に決定

            両側: shared = X25519(自分の秘密鍵, 相手の公開鍵)
                  → HKDF → handshake traffic keys` },
          run: async (s) => {
            s.show('hk2', { fx: 'pop' });
            s.line(P(R, Y.sh), P(L, Y.sh), { label: 'ServerHello · TLS_AES_256_GCM_SHA384 · key_share x25519', cls: 'warn' });
            await s.fly(P(R, Y.sh), P(L, Y.sh), { label: 'ServerHello', cls: 'c-amber', dur: 1100 });
            await s.term('t', '* TLSv1.3 (IN), TLS handshake, Server hello (2):');
            await s.show('hk1', { fx: 'pop' });
          },
        },
        {
          title: 'サーバーの暗号化フライト',
          text: 'ここから暗号化です。サーバーは <code>{EncryptedExtensions}</code>（ALPN の結果）、<code>{Certificate}</code>（証明書チェーン）、<code>{CertificateVerify}</code>（秘密鍵での署名）、<code>{Finished}</code>（HMAC）を続けて送ります。回線上では外側の content type がすべて <code>23</code> に見えます。',
          code: { title: 'openssl s_client -msg（実測）', lang: 'text', src: `
            $ openssl s_client -connect example.com:443 -servername example.com -msg </dev/null
            <<< TLS 1.3, Handshake [length 007a], ServerHello
            <<< TLS 1.3, ChangeCipherSpec [length 0001]
            <<< TLS 1.3, InnerContent [length 0001]
            <<< TLS 1.3, Handshake [length 000a], ⟪EncryptedExtensions⟫
            <<< TLS 1.3, Handshake [length 0e66], ⟪Certificate⟫
            <<< TLS 1.3, Handshake [length 004f], ⟪CertificateVerify⟫
            <<< TLS 1.3, Handshake [length 0034], ⟪Finished⟫` },
          run: async (s) => {
            await s.show('bandA', { fx: 'fade' });
            s.line(P(R, Y.sf), P(L, Y.sf), { label: '{EncryptedExtensions} {Certificate} {CertificateVerify} {Finished}', cls: 'ok' });
            await s.fly(P(R, Y.sf), P(L, Y.sf), { label: LK + '{EE}{Cert}{CV}{Fin}', cls: 'c-green', dur: 1200 });
            s.show('enc1', { fx: 'pop' });
            await s.term('t', `
              * TLSv1.3 (IN), TLS handshake, Encrypted Extensions (8):
              * TLSv1.3 (IN), TLS handshake, Certificate (11):
              * TLSv1.3 (IN), TLS handshake, CERT verify (15):
              * TLSv1.3 (IN), TLS handshake, Finished (20):`);
          },
        },
        {
          title: 'クライアントが検証して {Finished}',
          text: 'curl（OpenSSL）は証明書チェーン・ホスト名・CertificateVerify・Finished を検証し、すべて通ったら互換用の ChangeCipherSpec と自分の <code>{Finished}</code> を送ります。ここで <code>SSL connection using …</code> が出て、<strong>application traffic keys</strong> に切り替わります。',
          code: { title: 'curl -v（実測）', lang: 'text', src: `
            * TLSv1.3 (OUT), TLS change cipher, Change cipher spec (1):
            * TLSv1.3 (OUT), TLS handshake, Finished (20):
            * SSL connection using ⟪TLSv1.3 / TLS_AES_256_GCM_SHA384 / X25519 / id-ecPublicKey⟫
            * ALPN: server accepted h2
            * Server certificate:
            *  subject: CN=example.com
            *  start date: Sep 26 22:49:11 2026 GMT
            *  expire date: Dec 25 22:56:35 2026 GMT
            *  subjectAltName: host "example.com" matched cert's "example.com"
            *  issuer: C=US; O=SSL Corporation; CN=Cloudflare TLS Issuing ECC CA 3
            *  SSL certificate verify ok.` },
          run: async (s) => {
            await s.scan('cli');
            await s.term('t', `
              * TLSv1.3 (OUT), TLS change cipher, Change cipher spec (1):
              * TLSv1.3 (OUT), TLS handshake, Finished (20):`);
            s.line(P(L, Y.cf), P(R, Y.cf), { label: '(CCS) {Finished}', cls: 'ok' });
            await s.fly(P(L, Y.cf), P(R, Y.cf), { label: LK + '{Finished}', cls: 'c-green', dur: 900 });
            s.show('ak1 ak2 rtt2', { fx: 'pop' });
            s.state('cli', 'ok');
            await s.term('t', `
              * SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384 / X25519 / id-ecPublicKey
              * ALPN: server accepted h2
              * Server certificate:
              *  subject: CN=example.com
              *  subjectAltName: host "example.com" matched cert's "example.com"
              *  SSL certificate verify ok.`);
          },
        },
        {
          title: 'HTTP/2 リクエスト（application data）',
          text: '最初の HTTP/2 リクエストは application traffic key で暗号化されたレコード <code>[…]</code> で送られます。TCP 接続開始から数えて 2 往復目の終わりには、もう <code>GET /</code> が出ています。',
          code: [
            { title: 'curl -v（実測）', lang: 'text', src: `
              * using HTTP/2
              * [HTTP/2] [1] OPENED stream for https://example.com/
              * [HTTP/2] [1] [:method: GET]
              * [HTTP/2] [1] [:scheme: https]
              * [HTTP/2] [1] [:authority: example.com]
              * [HTTP/2] [1] [:path: /]` },
            { title: 'HTTP request（curl の表示形式）', lang: 'http', src: `
              GET / HTTP/2
              Host: example.com
              User-Agent: curl/8.5.0
              Accept: */*` },
          ],
          run: async (s) => {
            await s.show('bandB', { fx: 'fade' });
            s.line(P(L, Y.rq), P(R, Y.rq), { label: '[HEADERS] GET /（HTTP/2）', cls: 'ok' });
            await s.fly(P(L, Y.rq), P(R, Y.rq), { label: LK + 'GET /', cls: 'c-green', dur: 900 });
            s.show('enc2', { fx: 'pop' });
            await s.term('t', `
              * using HTTP/2
              > GET / HTTP/2
              > Host: example.com
              > User-Agent: curl/8.5.0
              > Accept: */*`);
          },
        },
        {
          title: 'レスポンスと NewSessionTicket',
          text: 'サーバーはレスポンスと一緒に <code>NewSessionTicket</code> を 2 枚送ってきました（実測）。次回の接続を再開するためのチケットで、これも暗号化されています。<strong>TCP 1 RTT ＋ TLS 1 RTT</strong> の後に HTTP が流れる、というのが TLS 1.3 の基本形です。',
          code: { title: 'curl -v（実測）', lang: 'text', src: `
            * TLSv1.3 (IN), TLS handshake, ⟪Newsession Ticket (4)⟫:
            * TLSv1.3 (IN), TLS handshake, ⟪Newsession Ticket (4)⟫:
            < HTTP/2 200
            < content-type: text/html
            < last-modified: Sat, 26 Sep 2026 09:10:30 GMT
            < allow: GET, HEAD
            < accept-ranges: bytes` },
          run: async (s) => {
            s.line(P(R, Y.rs), P(L, Y.rs), { label: '[HEADERS 200] [DATA] + NewSessionTicket ×2', cls: 'ok' });
            await s.fly(P(R, Y.rs), P(L, Y.rs), { label: LK + '200 OK', cls: 'c-green', dur: 900 });
            s.show('rtt3', { fx: 'pop' });
            s.state('srv', 'ok');
            await s.term('t', `
              * TLSv1.3 (IN), TLS handshake, Newsession Ticket (4):
              * TLSv1.3 (IN), TLS handshake, Newsession Ticket (4):
              < HTTP/2 200
              < content-type: text/html`);
          },
        },
      ],
    });
  })();

  /* =====================================================================
   * SCENE 2 — ClientHello をバイト単位で
   * ===================================================================*/
  (function () {
    // openssl s_client 3.5.7 -groups X25519:secp256r1 -alpn h2,http/1.1 -trace の実測値から組み立てた 337 バイト
    const CH = [
      ['rec', '16 03 01 01 4c'],
      ['hs', '01 00 01 48'],
      ['ver', '03 03'],
      ['rnd', '96ff0b1cfabec9e81e35c77a50649753d8ee189f86fc86855a69b2d14bb51afc'],
      ['sid', '20 63339d3409cc7e2c43f1bf6ff9391717cf7c5f880fcf9901fab9c1cc5328630b'],
      ['cs', '003c 1302 1303 1301 c02c c030 009f cca9 cca8 ccaa c02b c02f 009e c024 c028 006b c023 c027 0067 c00a c014 0039 c009 c013 0033 009d 009c 003d 003c 0035 002f'],
      ['cm', '01 00'],
      ['extlen', '00 c3'],
      ['reneg', 'ff01 0001 00'],
      ['sni', '0000 0010 000e 00 000b 6578616d706c652e636f6d'],
      ['ecpf', '000b 0004 03 000102'],
      ['grp', '000a 0006 0004 001d 0017'],
      ['st', '0023 0000'],
      ['alpn', '0010 000e 000c 02 6832 08 687474702f312e31'],
      ['etm', '0016 0000'],
      ['ems', '0017 0000'],
      ['sig', '000d 0036 0034 0905 0906 0904 0403 0503 0603 0807 0808 081a 081b 081c 0809 080a 080b 0804 0805 0806 0401 0501 0601 0303 0301 0302 0402 0502 0602'],
      ['ver2', '002b 0005 04 0304 0303'],
      ['pskm', '002d 0002 01 01'],
      ['ks', '0033 0026 0024 001d 0020 73935f9d9720b1da7cac216699637ee1e6c73e3babf1184da1200758fee1ac1a'],
      ['cc', '001b 0003 02 0001'],
    ];
    const BYTES = [], OWNER = [];
    CH.forEach(([k, hx]) => {
      hx = hx.replace(/\s+/g, '');
      for (let i = 0; i < hx.length; i += 2) { BYTES.push(parseInt(hx.substr(i, 2), 16)); OWNER.push(k); }
    });
    if (BYTES.length !== 337) console.warn('[https-tls] ClientHello length mismatch:', BYTES.length);

    /** 16 進ダンプ 6 行（ハイライト対象の周辺）を返す */
    function hexView(keys) {
      const set = new Set([].concat(keys));
      const first = OWNER.findIndex((o) => set.has(o));
      let last = -1;
      OWNER.forEach((o, i) => { if (set.has(o)) last = i; });
      const LINES = 6, total = Math.ceil(BYTES.length / 16);
      let s0 = Math.floor(first / 16) - (last - first < 48 ? 1 : 0);
      s0 = Math.max(0, Math.min(s0, total - LINES));
      const out = [];
      for (let ln = s0; ln < Math.min(total, s0 + LINES); ln++) {
        let hx = '', asc = '';
        for (let j = 0; j < 16; j++) {
          const i = ln * 16 + j;
          const gap = j === 7 ? '  ' : ' ';
          if (i >= BYTES.length) { hx += '  ' + gap; continue; }
          const b = BYTES[i];
          let h2 = b.toString(16).padStart(2, '0');
          let ch = esc(b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.');
          if (set.has(OWNER[i])) { h2 = '<b>' + h2 + '</b>'; ch = '<b>' + ch + '</b>'; }
          hx += h2 + gap;
          asc += ch;
        }
        out.push('<span class="off">' + (ln * 16).toString(16).padStart(4, '0') + '</span>  ' + hx + '<span class="asc">' + asc + '</span>');
      }
      return out.join('\n');
    }

    function step(rows, keys, title, src, obs, obsCls) {
      return async (s) => {
        s.state('.fld', null);
        s.state(rows, 'active');
        s.set('det', card(title, src));
        s.set('hex', hexView(keys));
        await s.show('det hex', { fx: 'fade', dur: 300 });
        if (obs) {
          s.cls('obs', obsCls || 'c-violet', 'c-amber c-green c-violet');
          s.set('obs', obs);
          s.show('obs', { fx: 'pop' });
        } else {
          s.hide('obs');
        }
        await s.scan('det');
      };
    }

    TIM.scene('#sc-hello', {
      intro: 'ClientHello は 337 バイト（この実測では）の平文です。左の各フィールドを順に選び、右上にフィールドの意味、右下にレコード先頭からのオフセット付き 16 進ダンプを出します。黄色のバイトがいま見ている部分です。',
      steps: [
        {
          title: 'レコードヘッダとハンドシェイクヘッダ',
          text: '先頭 5 バイトが TLS レコードヘッダ、次の 4 バイトがハンドシェイクヘッダです。<code>16</code> = handshake、<code>01</code> = client_hello。レコードの版が <code>03 01</code>（TLS 1.0 表記）なのは互換のためで、交渉には使われません。',
          code: { title: 'openssl s_client -trace（実測）', lang: 'text', src: `
            Sent TLS Record
            Header:
              Version = ⟪TLS 1.0 (0x301)⟫
              Content Type = Handshake (22)
              Length = 332
                ClientHello, Length=328` },
          run: step('f-rec f-hs', ['rec', 'hs'], 'Record header (5 B) + Handshake header (4 B)', `
            16         ContentType            = handshake (22)
            03 01      legacy_record_version  = 0x0301（TLS 1.0 表記）
            01 4c      length                 = 332
            01         HandshakeType          = client_hello (1)
            00 01 48   length (24 bit)        = 328

            ※ 最初の ClientHello だけは 0x0301 でもよい（RFC 8446 §5.1）
            ※ 本当のバージョンは supported_versions 拡張で決まる`,
          '<i data-icon="search"></i>Wireshark: tls.handshake.type == 1'),
        },
        {
          title: 'legacy_version と random',
          text: '<code>legacy_version</code> は TLS 1.3 でも <code>0x0303</code>（TLS 1.2）固定です。続く <code>random</code> は毎回 CSPRNG で作る 32 バイト。鍵導出の入力（トランスクリプト）に入り、SSLKEYLOGFILE ではこの値が接続の識別子になります。',
          code: { title: 'openssl s_client -trace（実測）', lang: 'text', src: `
            client_version=0x303 (TLS 1.2)
            Random:
              gmt_unix_time=0x96FF0B1C
              random_bytes (len=28): FABEC9E81E35C77A50649753D8EE189F86FC86855A69B2D14BB51AFC
            # -trace は TLS 1.2 時代の構造で先頭 4 B を gmt_unix_time と表示するが、
            # TLS 1.3 では 32 B 全体がただの乱数` },
          run: step('f-ver f-rnd', ['ver', 'rnd'], 'legacy_version (2 B) + random (32 B)', `
            03 03      legacy_version = 0x0303（TLS 1.2 のふりをする）
            random（32 B、接続ごとに CSPRNG で生成）:
              96ff0b1cfabec9e81e35c77a50649753
              d8ee189f86fc86855a69b2d14bb51afc

            ・ハンドシェイクのトランスクリプトハッシュに含まれる
            ・SSLKEYLOGFILE の 2 列目（client_random）はこの値`,
          '<i data-icon="key"></i>SSLKEYLOGFILE の client_random = この 32 B', 'c-green'),
        },
        {
          title: 'legacy_session_id と cipher_suites',
          text: '<code>legacy_session_id</code> の 32 バイトに意味はありません（TLS 1.2 の再開に見せかけるミドルボックス互換モード）。<code>cipher_suites</code> は 30 個で、TLS 1.3 用は先頭の <code>13 02</code> / <code>13 03</code> / <code>13 01</code> の 3 つだけです。',
          code: { title: 'openssl s_client -trace（実測・抜粋）', lang: 'text', src: `
            session_id (len=32): 63339D3409CC7E2C43F1BF6FF9391717CF7C5F880FCF9901FAB9C1CC5328630B
            cipher_suites (len=60)
              ⟪{0x13, 0x02} TLS_AES_256_GCM_SHA384⟫
              ⟪{0x13, 0x03} TLS_CHACHA20_POLY1305_SHA256⟫
              ⟪{0x13, 0x01} TLS_AES_128_GCM_SHA256⟫
              {0xC0, 0x2C} TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
              {0xC0, 0x30} TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
              …（TLS 1.2 以下用、計 27 個）
            compression_methods (len=1)
              No Compression (0x00)` },
          run: step('f-sid f-cs f-cm', ['cs', 'cm'], 'legacy_session_id (1+32 B) + cipher_suites (2+60 B)', `
            20         legacy_session_id length = 32
            63339d3409cc7e2c43f1bf6ff9391717cf7c5f880fcf9901fab9c1cc5328630b
                       ↑ 値に意味はない（ミドルボックス互換用）
            00 3c      cipher_suites length = 60 → 30 個
            13 02      TLS_AES_256_GCM_SHA384
            13 03      TLS_CHACHA20_POLY1305_SHA256
            13 01      TLS_AES_128_GCM_SHA256
            c0 2c …    TLS 1.2 用 27 個（1.2 で交渉されたとき用）
            01 00      legacy_compression_methods = [null] 固定`),
        },
        {
          title: 'server_name（SNI）— 平文で見える',
          text: 'SNI（type <code>0</code>）には接続先ホスト名がそのまま ASCII で入っています。右下のダンプの ASCII 欄にも <code>example.com</code> が見えます。サーバーはこれで証明書を選びますが、<strong>経路上の誰でも読めます</strong>。',
          code: { title: 'openssl s_client -trace（実測）', lang: 'text', src: `
            extension_type=server_name(0), length=16
              0000 - 00 0e 00 00 0b 65 78 61-6d 70 6c 65 2e 63 6f   .....example.co
              000f - 6d                                             m` },
          run: step('e-sni', ['sni'], 'server_name (0) — SNI（RFC 6066 §3）', `
            00 00      extension_type = server_name (0)
            00 10      extension_data length = 16
            00 0e      server_name_list length = 14
            00         name_type = host_name (0)
            00 0b      HostName length = 11
            65 78 61 6d 70 6c 65 2e 63 6f 6d   = "example.com"

            nginx は server_name とこの値を照合して証明書を選ぶ
            暗号化の前に送るので、経路上から読める（隠すなら ECH）`,
          '<i data-icon="eye"></i>経路上から見える: example.com（隠すには ECH / RFC 9849）', 'c-amber'),
        },
        {
          title: 'supported_versions — 本当のバージョン交渉',
          text: 'TLS 1.3 の交渉は <code>supported_versions</code>（type <code>43</code>）で行います。<code>03 04</code> = TLS 1.3、<code>03 03</code> = TLS 1.2。サーバーは ServerHello の同じ拡張で <code>03 04</code> を返します。',
          code: { title: 'openssl s_client -trace（実測）', lang: 'text', src: `
            extension_type=supported_versions(43), length=5
              ⟪TLS 1.3 (772)⟫
              TLS 1.2 (771)` },
          run: step('e-ver', ['ver2'], 'supported_versions (43)', `
            00 2b      extension_type = supported_versions (43)
            00 05      length = 5
            04         versions length = 4 → 2 個
            03 04      TLS 1.3   ← サーバーはこの中から選ぶ
            03 03      TLS 1.2

            legacy_version が 0x0303 でも、この拡張があれば
            TLS 1.3 として交渉される`,
          '<i data-icon="search"></i>Wireshark: tls.handshake.extensions.supported_version == 0x0304'),
        },
        {
          title: 'supported_groups と key_share — ECDHE の公開鍵',
          text: '<code>supported_groups</code>（10）で使える楕円曲線を並べ、<code>key_share</code>（51）で<strong>公開鍵そのもの</strong>を先に送ってしまうのが TLS 1.3 の 1-RTT の秘密です。秘密鍵はクライアントのメモリの中だけにあります。',
          code: { title: 'openssl s_client -trace（実測）', lang: 'text', src: `
            extension_type=supported_groups(10), length=6
              ecdh_x25519 (29)
              secp256r1 (P-256) (23)
            extension_type=key_share(51), length=38
                NamedGroup: ecdh_x25519 (29)
                key_exchange:  (len=32): 73935F9D9720B1DA7CAC216699637EE1E6C73E3BABF1184DA1200758FEE1AC1A
            # -groups を付けない OpenSSL 3.5 既定では:
            #   NamedGroup: X25519MLKEM768 (4588)  key_exchange (len=1216)
            #   NamedGroup: ecdh_x25519 (29)       key_exchange (len=32)` },
          run: step('e-grp e-ks', ['ks'], 'supported_groups (10) + key_share (51)', `
            00 0a 00 06  supported_groups (10), length 6
            00 04        named_group_list length = 4
            00 1d        x25519 (29)        00 17  secp256r1 (23)

            00 33 00 26  key_share (51), length 38
            00 24        client_shares length = 36
            00 1d        group = x25519
            00 20        key_exchange length = 32
            73935f9d9720b1da7cac216699637ee1e6c73e3babf1184da1200758fee1ac1a`,
          '<i data-icon="key"></i>ブラウザ / OpenSSL 3.5 既定: X25519MLKEM768 (0x11ec) の key_share は 1216 B', 'c-green'),
        },
        {
          title: 'signature_algorithms — サーバーに使わせる署名方式',
          text: '<code>signature_algorithms</code>（13）は「CertificateVerify の署名にこれらを使ってよい」という一覧です。今回サーバーは <code>0x0403</code> ecdsa_secp256r1_sha256 を選びました。OpenSSL 3.5 は ML-DSA（<code>0x0904</code>〜<code>0x0906</code>）も提示しています。',
          code: { title: 'openssl s_client -trace（実測・抜粋）', lang: 'text', src: `
            extension_type=signature_algorithms(13), length=54
              mldsa65 (0x0905)
              mldsa87 (0x0906)
              mldsa44 (0x0904)
              ⟪ecdsa_secp256r1_sha256 (0x0403)⟫
              ecdsa_secp384r1_sha384 (0x0503)
              ecdsa_secp521r1_sha512 (0x0603)
              ed25519 (0x0807)
              …
              rsa_pss_rsae_sha256 (0x0804)
              …
              rsa_pkcs1_sha256 (0x0401)
              …（計 26 方式）` },
          run: step('e-sig', ['sig'], 'signature_algorithms (13)', `
            00 0d 00 36  signature_algorithms (13), length 54
            00 34        list length = 52 → 26 方式
            09 05 …      mldsa65 / mldsa87 / mldsa44（OpenSSL 3.5）
            04 03        ecdsa_secp256r1_sha256   ← 今回サーバーが使った
            05 03        ecdsa_secp384r1_sha384
            08 07        ed25519
            08 04        rsa_pss_rsae_sha256
            04 01        rsa_pkcs1_sha256（1.3 では証明書の署名用のみ）`,
          '<i data-icon="search"></i>Wireshark: tls.handshake.sig_hash_alg == 0x0403'),
        },
        {
          title: 'ALPN — HTTP/2 か HTTP/1.1 か',
          text: 'ALPN（type <code>16</code>, RFC 7301）で HTTP のバージョン候補を送ります。長さ付き文字列の並びで、<code>02 "h2"</code> と <code>08 "http/1.1"</code>。サーバーの選択は EncryptedExtensions で<strong>暗号化されて</strong>返ってきます。',
          code: { title: 'openssl s_client -trace（実測）', lang: 'text', src: `
            extension_type=application_layer_protocol_negotiation(16), length=14
              ⟪h2⟫
              http/1.1
            # curl -v の表示
            * ALPN: curl offers h2,http/1.1
            * ALPN: server accepted h2` },
          run: step('e-alpn', ['alpn'], 'application_layer_protocol_negotiation (16)', `
            00 10      extension_type = application_layer_protocol_negotiation (16)
            00 0e      length = 14
            00 0c      protocol_name_list length = 12
            02 68 32   "h2"
            08 68 74 74 70 2f 31 2e 31   "http/1.1"

            サーバーの選択（"h2"）は EncryptedExtensions で返る
            → 候補は見えるが、結果は暗号化される`,
          '<i data-icon="search"></i>Wireshark: tls.handshake.extensions_alpn_str == "h2"'),
        },
        {
          title: 'psk_key_exchange_modes と「今回は無い」拡張',
          text: '<code>psk_key_exchange_modes</code>（45）の <code>psk_dhe_ke</code> は「再開するときも ECDHE を併用する」という宣言です。初回接続なので <code>pre_shared_key</code>（41）と <code>early_data</code>（42）は付いていません。',
          code: { title: 'openssl s_client -trace（実測）', lang: 'text', src: `
            extension_type=psk_key_exchange_modes(45), length=2
              psk_dhe_ke (1)
            extension_type=key_share(51), length=38
              …
            extension_type=compress_certificate(27), length=3
              zlib (1)
            # 他: renegotiate(65281) ec_point_formats(11) session_ticket(35)
            #     encrypt_then_mac(22) extended_master_secret(23) は TLS 1.2 用` },
          run: step('e-psk e-oth', ['pskm', 'cc'], 'psk_key_exchange_modes (45) と、今回は付いていない拡張', `
            00 2d 00 02 01 01     psk_key_exchange_modes (45): psk_dhe_ke (1)
                                  → 再開時も ECDHE を併用（前方秘匿性を保つ）
            00 1b 00 03 02 00 01  compress_certificate (27): zlib

            今回は付いていない拡張:
              pre_shared_key (41)   再開時だけ。必ず最後の拡張
              early_data (42)       0-RTT を送るときだけ
              encrypted_client_hello (0xfe0d)   ECH を使うときだけ`,
          '<i data-icon="search"></i>Wireshark: tls.handshake.extension.type == 41'),
        },
      ],
    });
  })();

  /* =====================================================================
   * SCENE 3 — 鍵スケジュールと暗号化の境界
   * ===================================================================*/
  (function () {
    const showMsg = async (s, title, src) => {
      s.set('msg', card(title, src));
      await s.show('msg', { fx: 'fade', dur: 300 });
    };

    TIM.scene('#sc-keys', {
      intro: '上段が鍵スケジュール（HKDF）、下段が回線上のメッセージです。ServerHello を受け取ってから handshake keys ができるまでと、そこから先のメッセージが暗号化される境界を追います。数値は実測（cipher suite <code>0x1302</code> なのでハッシュは SHA-384、secret は 48 バイト）。',
      steps: [
        {
          title: 'ServerHello を受け取る（平文）',
          text: 'サーバーが選んだ cipher suite と、サーバーの X25519 公開鍵が届きます。<code>legacy_session_id</code> は ClientHello の値をそのまま返すだけです。ここまでは平文（レコード type <code>22</code>）。',
          code: { title: 'openssl s_client -trace（実測）', lang: 'text', src: `
            Received TLS Record
            Header:
              Version = TLS 1.2 (0x303)
              Content Type = Handshake (22)
              Length = 122
                ServerHello, Length=118
                  server_version=0x303 (TLS 1.2)
                  cipher_suite {0x13, 0x02} ⟪TLS_AES_256_GCM_SHA384⟫
                  extension_type=key_share(51), length=36
                      NamedGroup: ecdh_x25519 (29)
                      key_exchange:  (len=32): ⟪1B41816E43EACEDE654B64140A6800595C8EA868E14D8FE37814D191A32A5954⟫
                  extension_type=supported_versions(43), length=2
                      TLS 1.3 (772)` },
          run: async (s) => {
            await s.show('r-sh', { fx: 'right' });
            await s.fly('srv:l', 'cli:r', { label: 'ServerHello', cls: 'c-amber' });
            await showMsg(s, 'ServerHello (2) · 118 bytes · 平文', `
              legacy_version      03 03
              random              421a4d74042e2070db38798c9c19f323…1430c02a82bafd24
              legacy_session_id   63339d34…5328630b（ClientHello と同じ値）
              cipher_suite        13 02 → TLS_AES_256_GCM_SHA384
              key_share (51)      x25519: 1b41816e43eacede…a32a5954 (32 B)
              supported_versions  03 04 → TLS 1.3`);
          },
        },
        {
          title: 'ECDHE：両側で同じ共有秘密',
          text: 'クライアントは「自分の秘密鍵 × サーバーの公開鍵」、サーバーは「自分の秘密鍵 × クライアントの公開鍵」で X25519 を計算し、<strong>同じ 32 バイト</strong>を得ます。回線に流れたのは 2 つの公開鍵だけで、共有秘密そのものは一度も送られません。',
          code: { title: 'ECDHE (X25519, RFC 7748)', lang: 'text', src: `
            client: shared = X25519(client_priv, server_pub = 1b41816e…a32a5954)
            server: shared = X25519(server_priv, client_pub = 73935f9d…fee1ac1a)
                    → 同じ 32 B（回線には流れない）

            秘密鍵はこの接続だけの使い捨て（ephemeral）
            → 後でサーバーの privkey.pem が漏れても過去の通信は復号できない（前方秘匿性）` },
          run: async (s) => {
            await s.show('k1', { fx: 'zoom' });
            s.scan('cli srv');
            await s.scramble('k1v', '5c2b…e81f（例）', { dur: 1200 });
            s.pulse('k1');
          },
        },
        {
          title: 'Handshake Secret → handshake traffic secret',
          text: 'ECDHE 共有秘密を HKDF-Extract に通して <strong>Handshake Secret</strong> を作り、そこから方向ごとに <code>"c hs traffic"</code> / <code>"s hs traffic"</code> のラベルで secret を導出します。コンテキストは ClientHello‥ServerHello のトランスクリプトハッシュ（SHA-384）です。',
          code: { title: 'RFC 8446 §7.1（要約）', lang: 'text', src: `
            early_secret     = HKDF-Extract(salt=0, IKM=00…00)       # PSK なし
            derived          = Derive-Secret(early_secret, "derived", "")
            handshake_secret = HKDF-Extract(salt=derived, IKM=ECDHE 共有秘密)

            c_hs_traffic = Derive-Secret(handshake_secret, ⟪"c hs traffic"⟫, CH‥SH)
            s_hs_traffic = Derive-Secret(handshake_secret, ⟪"s hs traffic"⟫, CH‥SH)
              CH‥SH = SHA-384(ClientHello ‖ ServerHello)   # 48 B` },
          run: async (s) => {
            await s.show('k2', { fx: 'zoom' });
            await s.line('k1:r', 'k2:l', { cls: 'acc' });
            await s.show('k3', { fx: 'zoom' });
            await s.line('k2:r', 'k3:l', { cls: 'acc' });
            s.scan('k3');
          },
        },
        {
          title: 'HKDF-Expand-Label で key / iv を切り出す',
          text: 'secret から AEAD の鍵（AES-256-GCM なので 32 B）と IV（12 B）を <code>HKDF-Expand-Label</code> で取り出します。ラベルには <code>"tls13 "</code> が前置されます。クライアント→サーバー方向とサーバー→クライアント方向で<strong>別々の鍵</strong>です。',
          code: { title: 'RFC 8446 §7.1 / §7.3', lang: 'text', src: `
            HKDF-Expand-Label(Secret, Label, Context, Length) =
                HKDF-Expand(Secret, HkdfLabel, Length)
            struct {
                uint16 length = Length;
                opaque label<7..255>   = ⟪"tls13 "⟫ + Label;
                opaque context<0..255> = Context;
            } HkdfLabel;

            server_write_key = HKDF-Expand-Label(s_hs_traffic, "key", "", 32)
            server_write_iv  = HKDF-Expand-Label(s_hs_traffic, "iv",  "", 12)` },
          run: async (s) => {
            await s.show('k4', { fx: 'zoom' });
            await s.line('k3:r', 'k4:l', { cls: 'acc' });
            await s.show('hkc hks', { fx: 'pop' });
          },
        },
        {
          title: 'ここから暗号化：{EncryptedExtensions}',
          text: '互換用の ChangeCipherSpec（<code>14 03 03 00 01 01</code>）の後は、すべて外側 type <code>23</code> のレコードです。最初の中身は EncryptedExtensions：SNI を受け付けた印と、ALPN の結果 <code>h2</code>。実測ではサーバーが 4 メッセージを 3853 バイトの 1 レコードにまとめて送っていました。',
          code: { title: 'openssl s_client -trace（実測）', lang: 'text', src: `
            Received TLS Record
            Header:
              Version = TLS 1.2 (0x303)
              Content Type = ⟪ApplicationData (23)⟫
              Length = 3853
              Inner Content Type = ⟪Handshake (22)⟫
                EncryptedExtensions, Length=15
                  extensions, length = 13
                    extension_type=server_name(0), length=0
                    extension_type=application_layer_protocol_negotiation(16), length=5
                      h2` },
          run: async (s) => {
            s.show('r-ccs', { fx: 'right' });
            await s.show('bound boundl', { fx: 'fade' });
            await s.show('r-enc', { fx: 'right' });
            await s.fly('srv:l', 'cli:r', { label: LK + '{EncryptedExtensions}', cls: 'c-green' });
            await showMsg(s, '{EncryptedExtensions} (8) · 15 bytes · 暗号化', `
              extensions length = 13
                server_name (0)   length 0   ← SNI を受け付けた印（中身は空）
                ALPN (16)         length 5   → "h2"

              外側のレコード:  17 03 03 0f 0d（application_data, 3853 B）
              内側の型:        TLSInnerPlaintext.type = 22（handshake）
              暗号鍵:          server_write_key / iv（s hs traffic 由来）`);
          },
        },
        {
          title: '{Certificate}：証明書チェーン',
          text: 'サーバーの証明書チェーンです。TLS 1.2 まではここが平文でしたが、TLS 1.3 では<strong>暗号化</strong>されるため、経路上からはどの証明書が使われたか見えません。各エントリは DER の証明書と、OCSP / SCT を入れられる拡張欄の組です。',
          code: { title: 'openssl s_client -trace（実測）', lang: 'text', src: `
            Certificate, Length=3682
              context (len=0):
              certificate_list, length=3678
                ASN.1Cert, length=1002   # [0] CN=example.com
                No extensions
                ASN.1Cert, length=742    # [1] Cloudflare TLS Issuing ECC CA 3
                No extensions
                ASN.1Cert, length=824    # [2] SSL.com TLS Transit ECC CA R2
                No extensions
                ASN.1Cert, length=1090   # [3] SSL.com TLS ECC Root CA 2022（クロス署名）` },
          run: async (s) => {
            await s.fly('srv:l', 'cli:r', { label: LK + '{Certificate}', cls: 'c-green' });
            await showMsg(s, '{Certificate} (11) · 3682 bytes', `
              certificate_request_context   長さ 0（サーバー認証では空）
              certificate_list              3678 B
                [0] 1002 B  CN=example.com
                [1]  742 B  Cloudflare TLS Issuing ECC CA 3
                [2]  824 B  SSL.com TLS Transit ECC CA R2
                [3] 1090 B  SSL.com TLS ECC Root CA 2022（クロス署名版）
              各エントリ = 長さ 3 B + DER + 拡張長 2 B（+ OCSP / SCT）`);
          },
        },
        {
          title: '{CertificateVerify}：秘密鍵で署名',
          text: 'サーバーは <code>privkey.pem</code> の秘密鍵で、<strong>ここまでのハンドシェイク全体のハッシュ</strong>に署名します。ハッシュには両者の key_share も含まれるので、「この証明書の持ち主が、いまこの ECDHE に参加している」ことの証明になります。',
          code: { title: 'openssl s_client -trace（実測）＋ 署名対象（RFC 8446 §4.4.3）', lang: 'text', src: `
            CertificateVerify, Length=76
              Signature Algorithm: ⟪ecdsa_secp256r1_sha256 (0x0403)⟫
              Signature (len=72): 3046022100B8E07602FEC9FFF46B928C2CDCAC7068156A4946EE5AFA11985B0251563
                                  0EB650221008BDEA934AFFC21AC70713B00B6C487D1564556029E73FFBF1E01CF1FC29372A8

            署名対象 = 0x20 × 64
                     ‖ "TLS 1.3, server CertificateVerify"
                     ‖ 0x00
                     ‖ Transcript-Hash(ClientHello … Certificate)` },
          run: async (s) => {
            await s.show('pk', { fx: 'pop' });
            s.state('srv', 'active');
            await s.scan('srv');
            await s.fly('srv:l', 'cli:r', { label: LK + '{CertificateVerify}', cls: 'c-green' });
            s.state('srv', null);
            await showMsg(s, '{CertificateVerify} (15) · 76 bytes', `
              algorithm   04 03  ecdsa_secp256r1_sha256
              signature   72 B (DER): 3046022100b8e07602fec9fff4…1fc29372a8
              署名される内容（サーバーが privkey.pem で署名）:
                20 20 20 … 20                          ← 0x20 × 64
                "TLS 1.3, server CertificateVerify"    ← コンテキスト文字列
                00                                     ← 区切り
                Transcript-Hash(ClientHello … Certificate)   ← SHA-384`);
          },
        },
        {
          title: '{Finished}：HMAC でハンドシェイク全体を封印',
          text: '最後に、handshake secret から作った <code>finished_key</code> で、CertificateVerify までのトランスクリプトハッシュの HMAC を取ります。途中のどのバイトが改ざんされても値が合わなくなります。',
          code: { title: 'openssl s_client -trace（実測）＋ RFC 8446 §4.4.4', lang: 'text', src: `
            Finished, Length=48
              verify_data (len=48): AC0D2290E586F23AB55F6F9520A68941097D0DB99EFF2BC0E39B24A5FD54FB18B8CE3CAA80949C6417948E1C02DF68FF

            finished_key = HKDF-Expand-Label(s_hs_traffic, "finished", "", 48)
            verify_data  = HMAC-SHA384(finished_key,
                              Transcript-Hash(ClientHello … CertificateVerify))` },
          run: async (s) => {
            await s.fly('srv:l', 'cli:r', { label: LK + '{Finished}', cls: 'c-green' });
            await showMsg(s, '{Finished} (20) · 4 + 48 bytes', `
              finished_key = HKDF-Expand-Label(s_hs_traffic, "finished", "", 48)
              verify_data  = HMAC-SHA384(finished_key,
                               Transcript-Hash(ClientHello … CertificateVerify))
                           = ac0d2290e586f23ab55f6f9520a68941097d0db99eff2bc0
                             e39b24a5fd54fb18b8ce3caa80949c6417948e1c02df68ff
              → 改ざんが無いこと・同じ鍵を導出できたことの証明`);
          },
        },
        {
          title: 'Master Secret → application traffic secret',
          text: 'Handshake Secret からさらに <strong>Master Secret</strong> を作り、ClientHello‥server Finished のハッシュで application traffic secret を導出します。サーバーはこの時点で送信を始められます（0.5-RTT）。クライアントは次のシーンの検証を終えてから同じ値を導出します。',
          code: { title: 'RFC 8446 §7.1（要約）', lang: 'text', src: `
            derived        = Derive-Secret(handshake_secret, "derived", "")
            master_secret  = HKDF-Extract(salt=derived, IKM=00…00)

            c_ap_traffic_0 = Derive-Secret(master_secret, ⟪"c ap traffic"⟫, CH‥server Finished)
            s_ap_traffic_0 = Derive-Secret(master_secret, ⟪"s ap traffic"⟫, CH‥server Finished)
            exporter       = Derive-Secret(master_secret, "exp master", CH‥server Finished)
            resumption     = Derive-Secret(master_secret, "res master", CH‥client Finished)` },
          run: async (s) => {
            await s.show('k5', { fx: 'zoom' });
            await s.line('k2:b', 'k5:t', { cls: 'acc' });
            await s.show('k6', { fx: 'zoom' });
            await s.line('k5:r', 'k6:l', { cls: 'acc' });
            await s.show('k7', { fx: 'zoom' });
            await s.line('k6:r', 'k7:l', { cls: 'acc' });
            await s.show('aks', { fx: 'pop' });
          },
        },
      ],
    });
  })();

  /* =====================================================================
   * SCENE 4 — クライアント側の検証
   * ===================================================================*/
  (function () {
    const cv = (s, title, src) => { s.set('cvf', card(title, src)); return s.show('cvf', { fx: 'fade', dur: 300 }); };

    TIM.scene('#sc-verify', {
      intro: 'クライアント（curl が使う OpenSSL）の内部で、受け取った証明書チェーンとハンドシェイクをどの順に検証するかを見ます。右上のチェックリストが順に緑になっていき、最後にレコード層の暗号化の形を確認します。',
      steps: [
        {
          title: '{Certificate} から 4 枚の証明書を取り出す',
          text: 'サーバーが送ってきたのは leaf（<code>CN=example.com</code>）と中間 CA 2 枚、そしてルート CA のクロス署名版の 4 枚です。<strong>どれを信頼するかはクライアントが決めます</strong>。サーバーから届いた証明書自体は、まだ何も信用されていません。',
          code: { title: 'openssl s_client（実測・OpenSSL 3.5.7）', lang: 'cert', src: `
            Certificate chain
             0 s:CN=example.com
               i:C=US, O=SSL Corporation, CN=Cloudflare TLS Issuing ECC CA 3
               a:PKEY: EC, (prime256v1); sigalg: ecdsa-with-SHA256
               v:NotBefore: Sep 26 22:49:11 2026 GMT; NotAfter: Dec 25 22:56:35 2026 GMT
             1 s:C=US, O=SSL Corporation, CN=Cloudflare TLS Issuing ECC CA 3
               i:C=US, O=SSL Corporation, CN=SSL.com TLS Transit ECC CA R2
             2 s:C=US, O=SSL Corporation, CN=SSL.com TLS Transit ECC CA R2
               i:C=US, O=SSL Corporation, CN=SSL.com TLS ECC Root CA 2022
             3 s:C=US, O=SSL Corporation, CN=SSL.com TLS ECC Root CA 2022
               i:C=GB, ST=Greater Manchester, L=Salford, O=Comodo CA Limited, CN=AAA Certificate Services` },
          run: async (s) => {
            await s.show('c0 c1 c2 c3', { fx: 'left', stagger: 140 });
          },
        },
        {
          title: '① チェーンを組み立て、trust store のルートに届くか',
          text: 'OpenSSL は issuer → subject をたどってパスを組み、最後に <code>/etc/ssl/certs/ca-certificates.crt</code>（Ubuntu の場合）にある<strong>自己署名ルート</strong>に届くかを確かめます。今回は trust store の <code>SSL.com TLS ECC Root CA 2022</code> が見つかったので、[3] のクロス署名版は使われません。',
          code: [
            { title: 'openssl s_client の検証ログ（実測）', lang: 'text', src: `
              depth=3 C=US, O=SSL Corporation, CN=SSL.com TLS ECC Root CA 2022
              verify return:1
              depth=2 C=US, O=SSL Corporation, CN=SSL.com TLS Transit ECC CA R2
              verify return:1
              depth=1 C=US, O=SSL Corporation, CN=Cloudflare TLS Issuing ECC CA 3
              verify return:1
              depth=0 CN=example.com
              verify return:1` },
            { title: 'trust store の実体（Ubuntu 24.04）', lang: 'bash', src: `
              $ ls -l /etc/ssl/certs/ | grep SSL.com_TLS_ECC
              865fbdf9.0 -> SSL.com_TLS_ECC_Root_CA_2022.pem
              SSL.com_TLS_ECC_Root_CA_2022.pem -> /usr/share/ca-certificates/mozilla/SSL.com_TLS_ECC_Root_CA_2022.crt
              $ grep -c 'BEGIN CERTIFICATE' /etc/ssl/certs/ca-certificates.crt
              121` },
          ],
          run: async (s) => {
            s.state('c3', 'dim');
            await s.scan('ts');
            await s.show('tsz root', { fx: 'zoom' });
            await s.line('c0:b', 'c1:t', { cls: 'ok' });
            await s.line('c1:b', 'c2:t', { cls: 'ok' });
            await s.line('c2:b', 'root:t', { cls: 'ok' });
            s.state('q1', 'ok');
          },
        },
        {
          title: '② 各証明書の署名を親の公開鍵で検証',
          text: 'パスの各段で「子の証明書の署名を、親（issuer）の公開鍵で検証」します。leaf は中間 CA の P-256 鍵で <code>ecdsa-with-SHA256</code>、中間は上位の鍵で <code>ecdsa-with-SHA384</code>。1 か所でも合わなければ <code>certificate signature failure</code> です。',
          code: [
            { title: 'curl -v（実測）', lang: 'text', src: `
              *   Certificate level 0: Public key type EC/prime256v1 (256/128 Bits/secBits), signed using ⟪ecdsa-with-SHA256⟫
              *   Certificate level 1: Public key type EC/prime256v1 (256/128 Bits/secBits), signed using ecdsa-with-SHA384
              *   Certificate level 2: Public key type EC/secp384r1 (384/192 Bits/secBits), signed using ecdsa-with-SHA384
              *   Certificate level 3: Public key type EC/secp384r1 (384/192 Bits/secBits), signed using ecdsa-with-SHA384` },
            { title: '同じ検証を手で', lang: 'bash', src: `
              $ openssl verify -CAfile /etc/ssl/certs/ca-certificates.crt \\
                  -untrusted intermediates.pem leaf.pem
              leaf.pem: OK` },
          ],
          run: async (s) => {
            await s.scan('c2');
            s.state('c2', 'ok');
            await s.scan('c1');
            s.state('c1', 'ok');
            await s.scan('c0');
            s.state('c0', 'ok');
            s.state('q2', 'ok');
          },
        },
        {
          title: '③ 有効期間をローカル時計と比べる',
          text: '<code>notBefore ≤ 現在時刻 ≤ notAfter</code> をチェーンの全証明書で確かめます。比べる「現在時刻」は<strong>クライアントのローカル時計</strong>です。leaf は 90 日弱の短い証明書でした。',
          code: [
            { title: 'openssl s_client（実測）', lang: 'cert', src: `
              0 s:CN=example.com
                v:NotBefore: ⟪Sep 26 22:49:11 2026 GMT⟫; NotAfter: ⟪Dec 25 22:56:35 2026 GMT⟫` },
            { title: '手元で', lang: 'bash', src: `
              $ openssl x509 -in leaf.pem -noout -dates
              notBefore=Sep 26 22:49:11 2026 GMT
              notAfter=Dec 25 22:56:35 2026 GMT` },
          ],
          run: async (s) => {
            s.set('c0s', 'notBefore Sep 26 22:49:11 2026 GMT<br>notAfter  Dec 25 22:56:35 2026 GMT');
            await s.scan('c0');
            s.state('q3', 'ok');
          },
        },
        {
          title: '④ ホスト名を subjectAltName と照合',
          text: 'URL のホスト名 <code>example.com</code> を leaf の <code>subjectAltName</code> の <code>DNS:</code> と照合します（CN は見ません）。<code>*.example.com</code> は 1 ラベル分だけに一致するので <code>example.com</code> 自体には使えず、別途 <code>DNS:example.com</code> が入っています。',
          code: [
            { title: 'openssl s_client -trace の証明書詳細（実測）', lang: 'cert', src: `
              X509v3 Subject Alternative Name:
                  ⟪DNS:example.com⟫, DNS:*.example.com
              X509v3 Extended Key Usage:
                  TLS Web Server Authentication
              X509v3 Key Usage: critical
                  Digital Signature` },
            { title: 'curl -v（実測）', lang: 'text', src: `
              *  subjectAltName: host "example.com" matched cert's "example.com"` },
          ],
          run: async (s) => {
            s.set('c0s', 'SAN: DNS:example.com, DNS:*.example.com<br>host "example.com" → matched');
            await s.scan('c0');
            s.state('q4', 'ok');
          },
        },
        {
          title: '⑤ CertificateVerify を leaf の公開鍵で検証',
          text: 'クライアントは自分が見てきたトランスクリプトから署名対象を<strong>自分で組み立て</strong>、leaf 証明書の公開鍵で ECDSA 署名を検証します。通れば「この証明書の秘密鍵を持つ相手が、いまのこのハンドシェイク（この key_share）に署名した」ことが確定します。',
          code: { title: '検証の中身（RFC 8446 §4.4.3）', lang: 'text', src: `
            content = 0x20 × 64 ‖ "TLS 1.3, server CertificateVerify" ‖ 0x00
                    ‖ SHA-384(ClientHello ‖ ServerHello ‖ EncryptedExtensions ‖ Certificate)
            ECDSA-Verify(pub = leaf の公開鍵 04:6a:69:d1:31:5b:…,
                         alg = ecdsa_secp256r1_sha256, msg = content, sig = 3046022100b8e0…)
            → 失敗なら alert ⟪decrypt_error (51)⟫ で終了` },
          run: async (s) => {
            await cv(s, '⑤ CertificateVerify の検証（クライアント側で再計算）', `
              content = 0x20 × 64 ‖ "TLS 1.3, server CertificateVerify" ‖ 0x00
                      ‖ SHA-384(CH ‖ SH ‖ EE ‖ Certificate)       ← 自分で計算
              pub     = leaf の SubjectPublicKeyInfo（EC P-256, 04:6a:69:d1:…）
              verify(pub, content, 受信した signature 72 B)     → OK
              ⇒ 相手は example.com の秘密鍵を持っている`);
            s.pulse('c0');
            await s.scan('cvf');
            s.state('q5', 'ok');
          },
        },
        {
          title: '⑥ server Finished を照合し、client Finished を送る',
          text: 'クライアントも自分の <code>s_hs_traffic</code> から <code>finished_key</code> を作って HMAC を計算し、受信した <code>verify_data</code>（48 B）と比べます。一致したら ChangeCipherSpec と自分の <code>{Finished}</code>（<code>c_hs_traffic</code> 由来）を送ります。',
          code: { title: 'openssl s_client -trace：client Finished（実測）', lang: 'text', src: `
            Sent TLS Record
            Header:
              Version = TLS 1.2 (0x303)
              Content Type = ChangeCipherSpec (20)
              Length = 1
                change_cipher_spec (1)
            Sent TLS Record
            Header:
              Version = TLS 1.2 (0x303)
              Content Type = ⟪ApplicationData (23)⟫
              Length = ⟪69⟫
              Inner Content Type = Handshake (22)
                Finished, Length=48
                  verify_data (len=48): E8E58E98F0D5ECCC413E110473B36172DC50DDBD5431279A3C29240140247AA542E9EC3780D56F0BAE5EE02CD7D3F69A` },
          run: async (s) => {
            await cv(s, '⑥ Finished の照合', `
              expected = HMAC-SHA384(finished_key, Hash(CH … CertificateVerify))
              received = ac0d2290e586f23ab55f6f9520a68941…1c02df68ff (48 B)
              expected == received → OK（不一致なら decrypt_error (51)）
              送信: 14 03 03 00 01 01（CCS）
                    17 03 03 00 45 {Finished: e8e58e98f0d5eccc…d7d3f69a}`);
            await s.scan('cvf');
            s.state('q6', 'ok');
          },
        },
        {
          title: 'application traffic keys で HTTP を暗号化',
          text: 'ここからは <code>c_ap_traffic_0</code> 由来の鍵で HTTP/2 を送ります。レコードごとの nonce は <code>iv XOR シーケンス番号</code>、AEAD の追加データは 5 バイトのレコードヘッダそのもの。中身の本当の型（23 = application_data）は暗号文の内側の末尾にあります。',
          code: { title: 'TLSCiphertext（RFC 8446 §5.2 / §5.3）', lang: 'text', src: `
            17 03 03 LL LL                    ← opaque_type=23, legacy_record_version, length
            encrypted_record = AES-256-GCM(
                key   = client_write_key (c_ap_traffic_0 → "key", 32 B),
                nonce = client_write_iv (12 B) XOR 00…00‖seq(8 B),
                aad   = 17 03 03 LL LL,
                pt    = HTTP/2 フレーム ‖ 0x17 ‖ 00…(padding))
              ‖ tag 16 B` },
          run: async (s) => {
            await cv(s, 'レコード保護（client → server、application data）', `
              key   = HKDF-Expand-Label(c_ap_traffic_0, "key", "", 32)
              iv    = HKDF-Expand-Label(c_ap_traffic_0, "iv",  "", 12)
              nonce = iv XOR (seq を左ゼロ詰めで 12 B に)   seq = 0, 1, 2, …
              aad   = 5 B のレコードヘッダ（17 03 03 + 長さ）
              pt    = HTTP/2 フレーム ‖ 0x17（本当の型）‖ 0x00…（padding）`);
            await s.show('rseg', { fx: 'up' });
          },
        },
      ],
    });
  })();

  /* =====================================================================
   * SCENE 5 — セッション再開と 0-RTT
   * ===================================================================*/
  (function () {
    const L = 120, R = 840;
    const Y = { nst: 126, ch: 298, sh: 328, cf: 358, ed: 396, rp: 447 };
    const tk = (s, title, src, hl) => { s.set('tk', card(title, src, 'text', hl)); return s.show('tk', { fx: 'fade', dur: 300 }); };

    TIM.scene('#sc-resume', {
      intro: '1 回目の接続の後に届く NewSessionTicket を使って、2 回目の接続を短縮する流れです。チケットの値と pre_shared_key 拡張のバイトは <code>openssl s_client -sess_out / -sess_in</code> で example.com に接続した実測値です。',
      steps: [
        {
          title: '{NewSessionTicket} が届く',
          text: 'ハンドシェイク完了後、サーバーは <strong>application key で暗号化された</strong> NewSessionTicket を送ります。中身の <code>ticket</code> はサーバーだけが読める不透明な値です。実測ではチケットに <code>early_data</code> 拡張が無く、このサーバーは 0-RTT を許可していませんでした。',
          code: { title: 'openssl s_client -trace（実測）', lang: 'text', src: `
            NewSessionTicket, Length=210
                ticket_lifetime_hint=⟪64800⟫
                ticket_age_add=479331732
                ticket_nonce (len=1): 00
                ticket (len=192): 204BECA6FBE2B1617D4D6A04754C1BC6D64749E95C60B14384048A8CA9AB1B0795ACE4…
                extensions, length = 4
                  extension_type=UNKNOWN(47802), length=0     # 0xbaba = GREASE` },
          run: async (s) => {
            s.line(P(R, Y.nst), P(L, Y.nst), { label: '[NewSessionTicket] ×2', cls: 'ok' });
            await s.fly(P(R, Y.nst), P(L, Y.nst), { label: LK + 'NewSessionTicket', cls: 'c-green' });
            await tk(s, '{NewSessionTicket} (4) · 210 bytes（実測）', `
              ticket_lifetime  64800 s（18 時間）      ticket_age_add  479331732
              ticket_nonce     00                        extensions      0xbaba（GREASE）のみ
              ticket (192 B)   204beca6fbe2b1617d4d6a04754c1bc6d64749e95c60b143…
              → early_data 拡張が無い = このチケットでは 0-RTT 不可`);
          },
        },
        {
          title: 'クライアントが PSK を計算して保存',
          text: 'クライアントは <code>resumption_master_secret</code> とチケットの <code>ticket_nonce</code> から PSK を導出し、チケット本体・受信時刻・<code>ticket_age_add</code> と一緒に保存します。<code>openssl s_client -sess_out</code> ならこれがファイルに書き出されます。',
          code: { title: 'RFC 8446 §4.6.1 ＋ s_client', lang: 'bash', src: `
            # PSK = HKDF-Expand-Label(resumption_master_secret, "resumption", ticket_nonce, 48)
            $ openssl s_client -connect example.com:443 -servername example.com \\
                -sess_out sess.pem -ign_eof <<< $'HEAD / HTTP/1.1\\r\\nHost: example.com\\r\\nConnection: close\\r\\n\\r\\n'
            $ head -1 sess.pem
            -----BEGIN SSL SESSION PARAMETERS-----` },
          run: async (s) => {
            await s.show('pskc', { fx: 'pop' });
            s.scan('cli');
            await tk(s, 'クライアント側：チケットと PSK を保存', `
              PSK = HKDF-Expand-Label(resumption_master_secret, "resumption", ticket_nonce, 48)
              resumption_master_secret = Derive-Secret(MS, "res master", CH‥client Finished)
              保存: ticket (192 B) · PSK · 受信時刻 · ticket_age_add · cipher suite · SNI
              s_client -sess_out sess.pem → -----BEGIN SSL SESSION PARAMETERS-----`, [1]);
          },
        },
        {
          title: '2 回目の ClientHello に pre_shared_key',
          text: '次の接続の ClientHello には <code>pre_shared_key</code>（41）が付きます。中身はチケット（identity）、経過時間をずらした <code>obfuscated_ticket_age</code>、そして PSK を知っていることを示す <code>binder</code>（HMAC）。この拡張は必ず<strong>最後</strong>に置かれます。',
          code: { title: 'openssl s_client -sess_in -trace（実測）', lang: 'text', src: `
            extension_type=psk_key_exchange_modes(45), length=2
              psk_dhe_ke (1)
            extension_type=key_share(51), length=38
                NamedGroup: ecdh_x25519 (29)
                key_exchange:  (len=32): 76E6993502FEA2D5FA1995A85924D777C254CD2C6F662F31E95C828705EED86A
            extension_type=compress_certificate(27), length=3
            ⟪extension_type=psk(41), length=251⟫
              0000 - ⟪00 c6 00 c0⟫ 20 4b ec a6-fb e2 b1 61 7d 4d 6a   .... K.....a}Mj
              000f - 04 75 4c 1b c6 80 b9 88-e6 04 06 a9 20 22 55   .uL......... "U
              …` },
          run: async (s) => {
            s.line(P(L, Y.ch), P(R, Y.ch), { label: 'ClientHello + key_share + pre_shared_key(41)', cls: 'warn' });
            await s.fly(P(L, Y.ch), P(R, Y.ch), { label: 'ClientHello + PSK', cls: 'c-amber' });
            await tk(s, 'ClientHello の pre_shared_key (41) · 251 bytes（実測）', `
              identities (00 c6 = 198 B) = 00 c0 ‖ ticket 192 B ‖ obfuscated_ticket_age 4 B
              binders    (00 33 =  51 B) = 30 ‖ binder 48 B（"res binder" 由来の鍵で HMAC）
              obfuscated_ticket_age = (受信からの経過 ms + ticket_age_add) mod 2^32
              psk_dhe_ke なので key_share（ECDHE）も同時に送る → 前方秘匿性を維持`);
          },
        },
        {
          title: 'サーバーは Certificate を送らない',
          text: 'サーバーはチケットを復号して PSK を取り出し、<code>pre_shared_key: 0</code>（identity #0 を採用）を返します。認証は「前回検証済みの PSK を共有している」ことで済むため、<strong>Certificate と CertificateVerify が省略</strong>されます。',
          code: { title: 'openssl s_client -sess_in -msg（実測）', lang: 'text', src: `
            >>> TLS 1.3, Handshake [length 0237], ClientHello
            <<< TLS 1.3, Handshake [length 0080], ServerHello
            <<< TLS 1.3, ChangeCipherSpec [length 0001]
            <<< TLS 1.3, Handshake [length 0006], ⟪EncryptedExtensions⟫
            <<< TLS 1.3, Handshake [length 0034], ⟪Finished⟫
            >>> TLS 1.3, ChangeCipherSpec [length 0001]
            >>> TLS 1.3, Handshake [length 0034], Finished
            ---
            ⟪Reused, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384⟫` },
          run: async (s) => {
            s.line(P(R, Y.sh), P(L, Y.sh), { label: 'ServerHello (psk: 0) {EncryptedExtensions} {Finished}', cls: 'ok' });
            await s.fly(P(R, Y.sh), P(L, Y.sh), { label: LK + '{EE}{Finished}', cls: 'c-green' });
            s.line(P(L, Y.cf), P(R, Y.cf), { label: '{Finished} [GET /]', cls: 'ok' });
            await s.fly(P(L, Y.cf), P(R, Y.cf), { label: LK + '{Finished}', cls: 'c-green' });
            await tk(s, '再開ハンドシェイク：送られないもの', `
              ServerHello  pre_shared_key (41) = 00 00 → identity #0 を採用
              {EncryptedExtensions} {Finished}   ← Certificate / CertificateVerify は無い
              サーバー認証は「前回の接続で検証済みの PSK を持っている」ことで代替
              s_client: Reused, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384`);
            s.state('cli srv', 'ok');
          },
        },
        {
          title: '0-RTT：ClientHello と同時にリクエスト',
          text: 'チケットが <code>early_data</code> を許可していれば、クライアントは ClientHello の直後に <code>"c e traffic"</code> 鍵で暗号化した early data（例：<code>GET /</code>）を、サーバーの応答を待たずに送れます。受理されたかは EncryptedExtensions の <code>early_data</code> 拡張で分かります。',
          code: [
            { title: 'RFC 8446 §7.1', lang: 'text', src: `
              early_secret                = HKDF-Extract(0, PSK)
              client_early_traffic_secret = Derive-Secret(early_secret, ⟪"c e traffic"⟫, ClientHello)` },
            { title: '試す（サーバーが 0-RTT を許可している場合）', lang: 'bash', src: `
              $ printf 'GET / HTTP/1.1\\r\\nHost: example.com\\r\\n\\r\\n' > req.txt
              $ openssl s_client -connect example.com:443 -servername example.com \\
                  -sess_in sess.pem -early_data req.txt
              # nginx 側: ssl_early_data on;` },
          ],
          run: async (s) => {
            s.state('cli srv', null);
            s.line(P(L, Y.ed), P(R, Y.ed), { label: 'ClientHello + early_data(42) + (GET /) ← 0-RTT', cls: 'warn' });
            await s.fly(P(L, Y.ed), P(R, Y.ed), { label: 'CH + (GET /)', cls: 'c-amber' });
            await tk(s, '0-RTT（early data）', `
              条件: チケットに early_data(max_early_data_size) が付いていること
              c_e_traffic = Derive-Secret(early_secret, "c e traffic", ClientHello)
              ClientHello と同じフライトで (GET /) を送る（サーバーの応答を待たない）
              受理されたかは EncryptedExtensions の early_data 拡張で分かる`);
          },
        },
        {
          title: '0-RTT のリプレイ攻撃',
          text: 'early data の鍵は PSK と ClientHello だけで決まるため、経路上の攻撃者が録画した ClientHello＋early data を<strong>そのまま再送</strong>すると、サーバーは区別できずに同じリクエストをもう一度処理しかねません。冪等でない操作は 0-RTT で受けず、<code>425 Too Early</code>（RFC 8470）で断ります。',
          code: [
            { title: 'nginx（リバースプロキシ）', lang: 'text', src: `
              ssl_early_data on;
              location / {
                  proxy_pass http://127.0.0.1:8080;
                  proxy_set_header ⟪Early-Data $ssl_early_data⟫;   # early data 中なら "1"
              }` },
            { title: 'バックエンドの応答（RFC 8470）', lang: 'http', src: `
              HTTP/1.1 425 Too Early
              Content-Type: text/plain

              retry after handshake` },
          ],
          run: async (s) => {
            await s.show('atk', { fx: 'up' });
            await s.fly('atk:r', P(R, Y.rp), { label: '(POST /transfer) 再送', cls: 'c-red' });
            s.shake('srv');
            await s.show('tooearly', { fx: 'pop' });
            await tk(s, 'リプレイ：録画した 0-RTT をもう一度', `
              attacker は ClientHello + early data を録画し、そのまま再送できる
              early data の鍵は PSK と ClientHello だけで決まる → サーバーは区別できない
              対策: 冪等なリクエストだけ許可 / チケット単回利用・ClientHello の記録（§8）
              HTTP: Early-Data: 1 を後段に渡し、危険なら 425 Too Early（RFC 8470）`, [4]);
          },
        },
      ],
    });
  })();

  /* =====================================================================
   * SCENE 6 — MITM
   * ===================================================================*/
  (function () {
    const reset = (s) => {
      s.state('q1 q2 q3', null);
      s.unstamp('q1 q2 q3');
    };

    TIM.scene('#sc-mitm', {
      intro: '経路の途中に攻撃者がいて、TCP を横取りできる状況です。攻撃者が出せる証明書は A（自己署名）、B（本物のコピー）、C（自分のドメインの正規証明書）の 3 通り。それぞれクライアントのどの検証で止まるかを見ます。最後に <code>-k</code> を付けた場合。',
      steps: [
        {
          title: '攻撃者が経路に入る',
          text: '偽のアクセスポイントや ARP spoofing で、クライアントのデフォルトゲートウェイが攻撃者 <code>192.0.2.66</code> に置き換わっています。curl から見れば、宛先 IP は正しい <code>203.0.113.10</code> のままです。',
          code: { title: 'クライアントの ARP テーブル', lang: 'bash', src: `
            $ ip neigh show 192.0.2.1
            192.0.2.1 dev wlan0 lladdr ⟪00:00:5e:00:53:66⟫ REACHABLE    # ← 攻撃者の MAC
            $ curl -v https://example.com/account` },
          run: async (s) => {
            await s.show('atk', { fx: 'down' });
            s.line('cli:r', 'atk:l', { cls: 'bad', label: 'TCP :443' });
            await s.line('atk:r', 'srv:l', { cls: 'dash', label: '中継' });
            await s.term('t', `
              $ curl -v https://example.com/account
              *   Trying 203.0.113.10:443...
              * Connected to example.com (203.0.113.10) port 443`);
          },
        },
        {
          title: 'ClientHello は攻撃者に届く',
          text: 'ClientHello は平文なので、攻撃者は SNI から接続先 <code>example.com</code> を知り、それに合わせた証明書を用意できます。ここまでは何も防げません。',
          code: { title: 'ClientHello の server_name（平文）', lang: 'text', src: `
            00 00 00 10 00 0e 00 00 0b ⟪65 78 61 6d 70 6c 65 2e 63 6f 6d⟫    "example.com"` },
          run: async (s) => {
            await s.fly('cli:r', 'atk:l', { label: 'ClientHello', cls: 'c-amber' });
            await s.show('sni', { fx: 'pop' });
            await s.term('t', `
              * ALPN: curl offers h2,http/1.1
              * TLSv1.3 (OUT), TLS handshake, Client hello (1):`);
          },
        },
        {
          title: '攻撃者の key_share で ECDHE は成立してしまう',
          text: '攻撃者は自分の X25519 鍵で ServerHello を返します。クライアントと攻撃者の間で ECDHE は正常に成立し、以降のメッセージも暗号化されます。<strong>鍵交換そのものは相手が誰かを保証しません</strong>。',
          code: { title: '成立している鍵', lang: 'text', src: `
            client ⇄ attacker : shared = X25519(client_priv, attacker_pub)   ← 成立
            attacker ⇄ server : 別の ECDHE（攻撃者が中継する場合）
            → 暗号化されていても「誰と」話しているかはまだ分からない` },
          run: async (s) => {
            await s.fly('atk:l', 'cli:r', { label: 'ServerHello (attacker key_share)', cls: 'c-amber' });
            await s.show('ecdh', { fx: 'pop' });
            await s.term('t', `
              * TLSv1.3 (IN), TLS handshake, Server hello (2):
              * TLSv1.3 (IN), TLS handshake, Encrypted Extensions (8):`);
          },
        },
        {
          title: 'A：自己署名証明書 → チェーン検証で停止',
          text: '攻撃者がその場で作った <code>CN=example.com</code> の自己署名証明書は、trust store のどのルートにもつながりません。curl は <strong>Certificate (11) を受け取った直後</strong>に <code>unknown_ca</code> alert を送って切断し、CertificateVerify は読みもしません（手元の <code>openssl s_server</code> で TLS 1.3 を実測）。',
          code: [
            { title: 'curl -v（実測）', lang: 'text', src: `
              * TLSv1.3 (IN), TLS handshake, Certificate (11):
              * TLSv1.3 (OUT), TLS alert, ⟪unknown CA (560)⟫:
              * SSL certificate problem: self-signed certificate
              curl: (60) SSL certificate problem: self-signed certificate` },
            { title: '攻撃者側（openssl s_server）のログ（実測）', lang: 'text', src: `
              error:0A000418:SSL routines:ssl3_read_bytes:tlsv1 alert unknown ca:…:SSL alert number 48` },
          ],
          run: async (s) => {
            reset(s);
            await s.show('mA', { fx: 'zoom' });
            await s.fly('atk:l', 'cli:r', { label: LK + '{Certificate A}', cls: 'c-red' });
            s.state('q1', 'bad');
            s.shake('cli');
            await s.term('t', `
              * TLSv1.3 (IN), TLS handshake, Certificate (11):
              * TLSv1.3 (OUT), TLS alert, unknown CA (560):
              * SSL certificate problem: self-signed certificate
              curl: (60) SSL certificate problem: self-signed certificate`);
            s.stamp('q1', 'STOP', { cls: 'st-bad' });
          },
        },
        {
          title: 'B：本物の証明書チェーンを複製して送る',
          text: '証明書は公開情報なので、攻撃者は本物のサーバーから取ってきたチェーンをそのまま送れます。すると<strong>チェーン検証もホスト名検証も通ります</strong>。証明書だけでは本人確認にならない、ということです。',
          code: { title: '本物のチェーンは誰でも取得できる', lang: 'bash', src: `
            $ openssl s_client -connect example.com:443 -servername example.com -showcerts </dev/null \\
                | sed -n '/BEGIN CERTIFICATE/,/END CERTIFICATE/p' > real-chain.pem
            # 攻撃者の手元にないのは /etc/…/privkey.pem（サーバーの秘密鍵）だけ` },
          run: async (s) => {
            reset(s);
            s.hide('mA');
            await s.show('mB', { fx: 'zoom' });
            await s.term('t', `
              $ curl -v https://example.com/account
              * TLSv1.3 (OUT), TLS handshake, Client hello (1):
              * TLSv1.3 (IN), TLS handshake, Server hello (2):
              * TLSv1.3 (IN), TLS handshake, Encrypted Extensions (8):
              * TLSv1.3 (IN), TLS handshake, Certificate (11):`, { clear: true });
            await s.fly('atk:l', 'cli:r', { label: LK + '{Certificate B}', cls: 'c-amber' });
            s.state('q1', 'ok');
            s.state('q2', 'ok');
          },
        },
        {
          title: 'B の続き：CertificateVerify に署名できない',
          text: 'CertificateVerify は「本物の証明書の公開鍵」で検証されます。署名対象には攻撃者自身の key_share を含むトランスクリプトハッシュが入るので、過去の署名の使い回しもできません。本物の秘密鍵が無い攻撃者は正しい署名を作れず、クライアントは <code>decrypt_error</code>（51）で切断します。',
          code: { title: 'RFC 8446 §4.4.3', lang: 'text', src: `
            署名対象 = 0x20 × 64 ‖ "TLS 1.3, server CertificateVerify" ‖ 0x00
                     ‖ Transcript-Hash(ClientHello ‖ ⟪ServerHello(attacker の key_share)⟫ ‖ … ‖ Certificate)
            検証鍵   = 本物の leaf 証明書の公開鍵
            → 秘密鍵なしでは作れない。検証失敗時は alert ⟪decrypt_error (51)⟫ で終了（MUST）` },
          run: async (s) => {
            await s.fly('atk:l', 'cli:r', { label: LK + '{CertificateVerify ✗}', cls: 'c-red' });
            s.state('q3', 'bad');
            s.shake('cli');
            await s.term('t', `
              * TLSv1.3 (IN), TLS handshake, CERT verify (15):
              # ← 署名検証に失敗 → decrypt_error(51) alert を送って切断。HTTP は送られない`);
            s.stamp('q3', 'STOP', { cls: 'st-bad' });
          },
        },
        {
          title: 'C：攻撃者ドメインの正規証明書 → ホスト名で停止',
          text: '攻撃者が自分のドメイン <code>attacker.example.net</code> の正規の証明書（と秘密鍵）を使うと、チェーンも CertificateVerify も通ります。止めるのは<strong>ホスト名検証</strong>です。curl はハンドシェイク完了後に SAN を照合し、一致しないので切断します（<code>wrong.host.badssl.com</code> で実測、ホスト名を置換）。',
          code: { title: 'curl -v（curl 8.5.0 の実測形式）', lang: 'text', src: `
            * SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384 / X25519 / id-ecPublicKey
            * Server certificate:
            *  subject: CN=attacker.example.net
            *  subjectAltName does not match example.com
            * Closing connection
            * TLSv1.3 (OUT), TLS alert, close notify (256):
            curl: (60) SSL: ⟪no alternative certificate subject name matches target host name 'example.com'⟫
            # curl 8.10 以降は "… matches target hostname 'example.com'"` },
          run: async (s) => {
            reset(s);
            s.hide('mB');
            await s.show('mC', { fx: 'zoom' });
            await s.fly('atk:l', 'cli:r', { label: LK + '{Certificate C}{CV}{Fin}', cls: 'c-amber' });
            s.state('q1', 'ok');
            s.state('q3', 'ok');
            s.state('q2', 'bad');
            s.shake('cli');
            await s.term('t', `
              * SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384 / X25519 / id-ecPublicKey
              *  subjectAltName does not match example.com
              * TLSv1.3 (OUT), TLS alert, close notify (256):
              curl: (60) SSL: no alternative certificate subject name matches target host name 'example.com'`, { clear: true });
            s.stamp('q2', 'STOP', { cls: 'st-bad' });
          },
        },
        {
          title: '-k / --insecure：すべて素通り',
          text: '<code>-k</code> を付けると上の検証がすべてスキップされ、A の自己署名証明書でも接続が完了します。攻撃者はクライアントとの ECDHE の鍵を持っているので、<code>Authorization</code> ヘッダも Cookie も<strong>平文で読めます</strong>。curl の警告は 1 行だけです。',
          code: { title: 'curl -k -v（実測形式）', lang: 'text', src: `
            $ curl -k -v https://example.com/account -H "Authorization: Bearer eyJhbGciOi…"
            * SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384 / X25519 / id-ecPublicKey
            *  ⟪SSL certificate verify result: self-signed certificate (18), continuing anyway.⟫
            > GET /account HTTP/2
            > Host: example.com
            > Authorization: Bearer eyJhbGciOi…` },
          run: async (s) => {
            reset(s);
            s.hide('mC sni');
            await s.show('mA', { fx: 'zoom' });
            s.state('q1 q2 q3', 'warn');
            await s.term('t', `
              $ curl -k -v https://example.com/account -H "Authorization: Bearer eyJhbGciOi…"
              *  SSL certificate verify result: self-signed certificate (18), continuing anyway.
              > GET /account HTTP/2
              > Authorization: Bearer eyJhbGciOi…`, { clear: true });
            await s.fly('cli:r', 'atk:l', { label: LK + '[GET /account]', cls: 'c-green' });
            await s.show('leak', { fx: 'right' });
            s.state('leak', 'bad');
            s.stamp('atk', 'DECRYPTED', { cls: 'st-bad' });
          },
        },
      ],
    });
  })();

  /* =====================================================================
   * SCENE 7 — nginx 設定と設定ミス
   * ===================================================================*/
  (function () {
    const CONF = (cert) => `
      server {
          listen 443 ssl;
          http2 on;                          # nginx 1.25.1+
          server_name example.com;

          ssl_certificate     /etc/letsencrypt/live/example.com/${cert};
          ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

          ssl_protocols   TLSv1.2 TLSv1.3;
          ssl_ecdh_curve  X25519:prime256v1:secp384r1;
          ssl_session_cache shared:SSL:10m;
          ssl_early_data  off;               # 0-RTT（既定 off）
      }`;
    const conf = (s, cert, hl) => { s.set('conf', card('/etc/nginx/conf.d/example.com.conf', CONF(cert), 'text', hl)); return s.show('conf', { fx: 'fade', dur: 300 }); };

    TIM.scene('#sc-server', {
      intro: 'サーバー側の実物は、証明書チェーンのファイルと秘密鍵、nginx の数行です。正しい設定を反映・確認したあと、現場でよく起きる 3 つの設定ミスが<strong>クライアント側でどう見えるか</strong>を再現します。',
      steps: [
        {
          title: 'certbot が置くファイル',
          text: 'Let\'s Encrypt（certbot）は <code>/etc/letsencrypt/live/example.com/</code> に 4 つのシンボリックリンクを置きます。実体は <code>archive/</code> 側で、更新のたびに番号が増えます。nginx に渡すのは <code>fullchain.pem</code> と <code>privkey.pem</code> です。',
          code: { title: 'shell', lang: 'bash', src: `
            $ sudo ls -l /etc/letsencrypt/live/example.com/*.pem
            lrwxrwxrwx 1 root root 35 Sep 27 03:12 cert.pem -> ../../archive/example.com/cert1.pem
            lrwxrwxrwx 1 root root 36 Sep 27 03:12 chain.pem -> ../../archive/example.com/chain1.pem
            lrwxrwxrwx 1 root root 40 Sep 27 03:12 ⟪fullchain.pem⟫ -> ../../archive/example.com/fullchain1.pem
            lrwxrwxrwx 1 root root 38 Sep 27 03:12 ⟪privkey.pem⟫ -> ../../archive/example.com/privkey1.pem` },
          run: async (s) => {
            await s.show('tree', { fx: 'right' });
            await s.term('t', `
              $ sudo ls -l /etc/letsencrypt/live/example.com/*.pem
              lrwxrwxrwx 1 root root 35 Sep 27 03:12 cert.pem -> ../../archive/example.com/cert1.pem
              lrwxrwxrwx 1 root root 36 Sep 27 03:12 chain.pem -> ../../archive/example.com/chain1.pem
              lrwxrwxrwx 1 root root 40 Sep 27 03:12 fullchain.pem -> ../../archive/example.com/fullchain1.pem
              lrwxrwxrwx 1 root root 38 Sep 27 03:12 privkey.pem -> ../../archive/example.com/privkey1.pem`);
          },
        },
        {
          title: 'server ブロック：証明書と秘密鍵',
          text: '<code>ssl_certificate</code> のファイルは、そのまま TLS の <code>Certificate</code> メッセージの中身になります（leaf → 中間の順）。<code>ssl_certificate_key</code> の秘密鍵は <code>CertificateVerify</code> の署名にだけ使われ、ネットワークには出ません。',
          code: { title: 'nginx', lang: 'text', hl: [6, 7], src: CONF('fullchain.pem') },
          run: async (s) => {
            await conf(s, 'fullchain.pem', [6, 7]);
            await s.show('chainv keyv', { fx: 'left', stagger: 160 });
            s.pulse('tree');
          },
        },
        {
          title: 'プロトコル・鍵交換グループ・セッション',
          text: '<code>ssl_protocols TLSv1.2 TLSv1.3</code> は nginx 1.23.4 以降の既定値と同じです。<code>ssl_ecdh_curve</code> は <code>supported_groups</code> / <code>key_share</code> の選択に効きます。TLS 1.3 の cipher suite は <code>ssl_ciphers</code> では変わらず、<code>ssl_conf_command Ciphersuites</code> を使います。',
          code: { title: 'nginx（追加で使うもの）', lang: 'text', src: `
            ssl_protocols   TLSv1.2 TLSv1.3;
            ssl_ecdh_curve  X25519:prime256v1:secp384r1;
            # TLS 1.3 の suite（nginx 1.19.4+）
            ssl_conf_command Ciphersuites TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256;
            # ログに交渉結果を残す
            log_format tls '$remote_addr $ssl_protocol $ssl_cipher $ssl_curve "$request"';` },
          run: async (s) => {
            await conf(s, 'fullchain.pem', [9, 10, 11, 12]);
            await s.scan('conf');
          },
        },
        {
          title: '反映して、外から確かめる',
          text: '<code>nginx -t</code> で構文と<strong>証明書・鍵の読み込み</strong>を検査してから reload します。確認は必ずサーバーの外から、<code>openssl s_client -brief</code> で。',
          code: { title: 'shell', lang: 'bash', src: `
            $ sudo nginx -t && sudo systemctl reload nginx
            nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
            nginx: configuration file /etc/nginx/nginx.conf test is successful
            $ openssl s_client -connect example.com:443 -servername example.com -brief </dev/null
            Connecting to 203.0.113.10
            CONNECTION ESTABLISHED
            Protocol version: TLSv1.3
            Ciphersuite: TLS_AES_256_GCM_SHA384
            Peer certificate: CN=example.com
            Hash used: SHA256
            Signature type: ecdsa_secp256r1_sha256
            ⟪Verification: OK⟫
            Negotiated TLS1.3 group: X25519` },
          run: async (s) => {
            await conf(s, 'fullchain.pem');
            await s.term('t', `
              $ sudo nginx -t && sudo systemctl reload nginx
              nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
              nginx: configuration file /etc/nginx/nginx.conf test is successful
              $ openssl s_client -connect example.com:443 -servername example.com -brief </dev/null
              CONNECTION ESTABLISHED
              Protocol version: TLSv1.3
              Ciphersuite: TLS_AES_256_GCM_SHA384
              Verification: OK`, { clear: true });
            s.state('conf chainv keyv', 'ok');
          },
        },
        {
          title: 'ミス①：cert.pem を指定（中間証明書なし）',
          text: 'よくあるのが <code>fullchain.pem</code> ではなく <code>cert.pem</code> を指定するミスです。leaf しか送られないので、クライアントは中間 CA を見つけられません。ブラウザは中間を補えることがあるため<strong>「ブラウザでは開けるのに curl だけ失敗」</strong>になります（<code>incomplete-chain.badssl.com</code> で実測）。',
          code: { title: 'shell（実測）', lang: 'bash', src: `
            $ curl https://example.com/
            curl: (60) SSL certificate problem: ⟪unable to get local issuer certificate⟫
            $ openssl s_client -connect example.com:443 -servername example.com </dev/null 2>&1 | grep -E 'verify error|Verify return'
            verify error:num=20:unable to get local issuer certificate
            verify error:num=21:unable to verify the first certificate
                Verify return code: 21 (unable to verify the first certificate)` },
          run: async (s) => {
            s.state('conf chainv keyv', null);
            await conf(s, '⟪cert.pem⟫', [6]);
            s.set('chaint', 'cert.pem → Certificate');
            s.set('chains', 'leaf だけ。中間 CA が届かない<br>curl / Java / Go などが失敗');
            s.state('chainv', 'bad');
            await s.term('t', `
              $ curl https://example.com/
              curl: (60) SSL certificate problem: unable to get local issuer certificate
              $ openssl s_client -connect example.com:443 -servername example.com </dev/null 2>&1 | grep 'verify error'
              verify error:num=20:unable to get local issuer certificate
              verify error:num=21:unable to verify the first certificate`, { clear: true });
            s.shake('chainv');
          },
        },
        {
          title: 'ミス②：更新に失敗して期限切れ',
          text: '自動更新が止まっていると、ある日突然 <code>certificate has expired</code> になります。クライアントは <code>certificate_expired</code>（45）alert を送って切断します。<code>notAfter</code> を監視し、更新後は <code>--deploy-hook</code> で nginx を reload します。',
          code: { title: 'shell（実測形式）', lang: 'bash', src: `
            $ sudo openssl x509 -in /etc/letsencrypt/live/example.com/fullchain.pem -noout -enddate
            notAfter=Sep 20 03:11:59 2026 GMT
            $ curl -v https://example.com/ 2>&1 | grep -E 'alert|problem'
            * TLSv1.3 (OUT), TLS alert, ⟪certificate expired (557)⟫:
            * SSL certificate problem: certificate has expired
            curl: (60) SSL certificate problem: certificate has expired
            $ sudo certbot renew --deploy-hook "systemctl reload nginx"` },
          run: async (s) => {
            await conf(s, 'fullchain.pem', [6]);
            s.set('chaint', 'fullchain.pem → Certificate');
            s.set('chains', 'notAfter=Sep 20 03:11:59 2026 GMT<br>→ 期限切れ（今日は 2026-09-28）');
            s.state('chainv', 'warn');
            await s.term('t', `
              $ sudo openssl x509 -in /etc/letsencrypt/live/example.com/fullchain.pem -noout -enddate
              notAfter=Sep 20 03:11:59 2026 GMT
              $ curl -v https://example.com/ 2>&1 | grep -E 'alert|problem'
              * TLSv1.3 (OUT), TLS alert, certificate expired (557):
              * SSL certificate problem: certificate has expired
              curl: (60) SSL certificate problem: certificate has expired`, { clear: true });
          },
        },
        {
          title: 'ミス③：証明書と秘密鍵の組み合わせ違い',
          text: '別の証明書の鍵を指定すると、nginx は起動（reload）時点で失敗します。CertificateVerify が作れない組み合わせを、ここで先に弾いているわけです。公開鍵のハッシュを比べれば一致しているか確認できます。',
          code: { title: 'shell（OpenSSL 3.0 のエラー形式）', lang: 'bash', src: `
            $ sudo nginx -t
            nginx: [emerg] SSL_CTX_use_PrivateKey("/etc/letsencrypt/live/example.com/privkey.pem") failed (SSL: error:05800074:x509 certificate routines::⟪key values mismatch⟫)
            nginx: configuration file /etc/nginx/nginx.conf test failed
            $ openssl x509 -in fullchain.pem -noout -pubkey | openssl sha256
            SHA2-256(stdin)= 34811e8bc80e595fb28b3ff434d3425b19934a02a5cc0fca3ba11ae4f46fd403
            $ openssl pkey -in privkey.pem -pubout | openssl sha256
            SHA2-256(stdin)= 110a73f54fa7a0938688fae4c4d6054e2936c7046c8fe851779acffaaeaca806` },
          run: async (s) => {
            s.state('chainv', null);
            s.set('chains', 'leaf + 中間 CA をこの順で送る<br>ルート CA は送らなくてよい');
            await conf(s, 'fullchain.pem', [7]);
            s.state('keyv', 'bad');
            await s.term('t', `
              $ sudo nginx -t
              nginx: [emerg] SSL_CTX_use_PrivateKey("/etc/letsencrypt/live/example.com/privkey.pem") failed (SSL: error:05800074:x509 certificate routines::key values mismatch)
              nginx: configuration file /etc/nginx/nginx.conf test failed`, { clear: true });
            s.shake('keyv');
          },
        },
      ],
    });
  })();

  /* =====================================================================
   * SCENE 8 — SSLKEYLOGFILE
   * ===================================================================*/
  (function () {
    const WS_ENC = `
      No.  Source          Destination     Protocol  Info
        4  198.51.100.7    203.0.113.10    TLSv1.3   Client Hello
        6  203.0.113.10    198.51.100.7    TLSv1.3   Server Hello, Change Cipher Spec, Application Data
        8  198.51.100.7    203.0.113.10    TLSv1.3   Change Cipher Spec, Application Data
        9  198.51.100.7    203.0.113.10    TLSv1.3   Application Data
       11  203.0.113.10    198.51.100.7    TLSv1.3   Application Data, Application Data`;
    const WS_DEC = `
      No.  Source          Destination     Protocol  Info
        4  198.51.100.7    203.0.113.10    TLSv1.3   Client Hello
        6  203.0.113.10    198.51.100.7    TLSv1.3   Server Hello, Change Cipher Spec, Encrypted Extensions, Certificate, …
        8  198.51.100.7    203.0.113.10    TLSv1.3   Change Cipher Spec, Finished
        9  198.51.100.7    203.0.113.10    HTTP2     Magic, SETTINGS[0], WINDOW_UPDATE[0], ⟪HEADERS[1]: GET /⟫
       11  203.0.113.10    198.51.100.7    HTTP2     SETTINGS[0], ⟪HEADERS[1]: 200 OK⟫, DATA[1]`;

    TIM.scene('#sc-keylog', {
      intro: 'TLS 1.3 のキャプチャは ServerHello 以降が読めません。クライアントに鍵をファイルへ書き出させ（<code>SSLKEYLOGFILE</code>）、Wireshark に読ませて復号するまでの流れです。鍵ログの行は curl 8.5.0 / OpenSSL 3.0.13 の実測（値は先頭だけ表示）。',
      steps: [
        {
          title: '鍵ログを有効にしてアクセスし、キャプチャする',
          text: '環境変数 <code>SSLKEYLOGFILE</code> を付けて curl を実行し、同時に <code>tcpdump</code> で 443 番の通信を <code>tls.pcapng</code> に保存します。回線上の内容は通常と何も変わりません。',
          code: { title: 'shell', lang: 'bash', src: `
            $ sudo tcpdump -i any -w tls.pcapng 'host example.com and tcp port 443' &
            $ ⟪SSLKEYLOGFILE=$HOME/tls-keys.log⟫ curl -s -o /dev/null https://example.com/` },
          run: async (s) => {
            await s.show('cap', { fx: 'down' });
            s.line('cli:r', 'srv:l', { cls: 'flow', label: 'TLS 1.3 :443' });
            await s.line('cap:t', { x: 480, y: 54 }, { cls: 'dash', arrow: false });
            s.count('npk', 0, 14, { dur: 1600, fmt: (v) => String(Math.round(v)) });
            await s.fly('cli:r', 'srv:l', { label: 'ClientHello', cls: 'c-amber' });
            await s.fly('srv:l', 'cli:r', { label: LK + 'ServerHello…', cls: 'c-green' });
          },
        },
        {
          title: 'OpenSSL が secret を 5 行書き出す',
          text: 'OpenSSL の keylog コールバックが、secret が確定するたびに 1 行ずつ追記します。各行は「ラベル・<code>client_random</code>（ClientHello の random, 64 hex）・secret（SHA-384 なので 96 hex）」。書式は RFC 9850 です。',
          code: { title: '~/tls-keys.log（実測・値は先頭 16 hex のみ）', lang: 'text', src: `
            SERVER_HANDSHAKE_TRAFFIC_SECRET 520ea890a1f66028…(64) e79365cc879d2320…(96)
            EXPORTER_SECRET                 520ea890a1f66028…(64) 124dcef5bb41a733…(96)
            SERVER_TRAFFIC_SECRET_0         520ea890a1f66028…(64) c3aa8448a31b3d93…(96)
            CLIENT_HANDSHAKE_TRAFFIC_SECRET 520ea890a1f66028…(64) eb81953403e2607a…(96)
            CLIENT_TRAFFIC_SECRET_0         520ea890a1f66028…(64) 35d962a656e7bdc2…(96)` },
          run: async (s) => {
            await s.show('kl', { fx: 'up' });
            await s.scan('kl');
            await s.show('cols', { fx: 'left' });
          },
        },
        {
          title: '鍵なしの Wireshark：Application Data しか見えない',
          text: '鍵を与えずに開くと、読めるのは平文の ClientHello と ServerHello だけです（SNI も読めます）。その先は外側 type <code>23</code> の「Application Data」としか表示されず、証明書すら見えません。',
          code: { title: 'Wireshark 表示フィルタ', lang: 'text', src: `
            tls.handshake.type == 1                          # ClientHello（平文）
            tls.handshake.extensions_server_name == "example.com"
            tls.record.opaque_type == 23                     # 暗号化レコード` },
          run: async (s) => {
            s.set('ws', card('Wireshark — tls.pcapng（鍵なし・表示例）', WS_ENC));
            await s.show('ws', { fx: 'up' });
          },
        },
        {
          title: '鍵ログを読ませる',
          text: 'Wireshark の <b>Preferences → Protocols → TLS → (Pre)-Master-Secret log filename</b>、または <code>tshark -o tls.keylog_file:…</code> で鍵ログを指定します。Wireshark はキャプチャ中の <code>ClientHello.random</code> と同じ 2 列目を持つ行を探し、secret から key / iv を導出して復号します。',
          code: { title: 'tshark', lang: 'bash', src: `
            $ tshark -r tls.pcapng -o ⟪tls.keylog_file:$HOME/tls-keys.log⟫ -Y http2
            # ClientHello.random（Wireshark: tls.handshake.random）が鍵ログの 2 列目と一致する行を使う` },
          run: async (s) => {
            s.pulse('cols');
            await s.scan('kl');
            s.line('kl:b', 'ws:t', { cls: 'acc', label: 'tls.keylog_file' });
            await s.scan('ws');
          },
        },
        {
          title: '復号後：証明書も HTTP/2 も読める',
          text: '同じキャプチャが、EncryptedExtensions・Certificate・Finished、そして HTTP/2 の <code>HEADERS[1]: GET /</code> まで読めるようになります。外側の <code>opaque_type</code> は 23 のまま、内側の本当の型で表示されます。',
          code: { title: 'Wireshark（鍵あり・表示例）', lang: 'text', src: WS_DEC },
          run: async (s) => {
            s.set('ws', card('Wireshark — tls.pcapng（鍵あり・表示例）', WS_DEC));
            s.state('ws', 'ok');
          },
        },
        {
          title: 'このファイルは「全通信の鍵」',
          text: '鍵ログがあれば、そのキャプチャは誰でも復号できます。本番サーバーや共有端末の環境変数に設定したままにしない、使い終わったら消す、が鉄則です。なお Windows 標準の <code>curl.exe</code>（Schannel）はこの変数を無視しました（実測）。',
          code: { title: 'shell', lang: 'bash', src: `
            $ shred -u ~/tls-keys.log
            $ unset SSLKEYLOGFILE
            # openssl s_client なら -keylogfile file でも同じ形式で書き出せる` },
          run: async (s) => {
            s.state('kl', 'bad');
            await s.show('danger', { fx: 'pop' });
            s.stamp('kl', 'SECRET', { cls: 'st-bad' });
          },
        },
      ],
    });
  })();
})();
