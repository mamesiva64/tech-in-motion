/* DNS 名前解決 — scenes
 * example.com の委任（ns1/ns2.example.com）とゾーンの中身は説明用の値。
 * ルートサーバー a.root-servers.net (198.41.0.4) と a.gtld-servers.net (192.5.6.30) は実在の値。
 */
(function () {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const code = (title, lang, lines) => ({ title, lang, src: Array.isArray(lines) ? lines.join('\n') : lines });
  const L = (el, ...ns) => ns.map((n) => '[data-el="' + el + '"] .ln:nth-child(' + n + ')').join(', ');
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const fileHTML = (title, lang, lines, small) => '<div class="file-h">' + esc(title) + (small ? '<small>' + esc(small) + '</small>' : '') + '</div><pre data-lang="' + lang + '">' + esc([].concat(lines).join('\n')) + '</pre>';

  /* ===============================================================
   * SCENE 1 — 解決経路
   * ============================================================= */
  const DIG_ROOT = [
    '$ dig @a.root-servers.net www.example.com A +norecurse',
    ';; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 20931',
    ';; flags: qr; QUERY: 1, ANSWER: ⟪0⟫, AUTHORITY: ⟪13⟫, ADDITIONAL: 27',
    '',
    ';; QUESTION SECTION:',
    ';www.example.com.\t\tIN\tA',
    '',
    ';; AUTHORITY SECTION:',
    'com.\t\t\t172800\tIN\tNS\ta.gtld-servers.net.',
    'com.\t\t\t172800\tIN\tNS\tb.gtld-servers.net.',
    '; … c〜m.gtld-servers.net まで計 13 行',
    '',
    ';; ADDITIONAL SECTION:',
    'a.gtld-servers.net.\t172800\tIN\tA\t192.5.6.30',
    'a.gtld-servers.net.\t172800\tIN\tAAAA\t2001:503:a83e::2:30',
    'b.gtld-servers.net.\t172800\tIN\tA\t192.33.14.30',
    '; … (glue: 13 × A/AAAA + OPT = 27)',
    '',
    ';; SERVER: 198.41.0.4#53(a.root-servers.net) (UDP)',
  ];
  const DIG_TLD = [
    '$ dig @a.gtld-servers.net www.example.com A +norecurse',
    ';; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 5122',
    ';; flags: qr; QUERY: 1, ANSWER: 0, AUTHORITY: 2, ADDITIONAL: 3',
    '',
    ';; AUTHORITY SECTION:',
    'example.com.\t\t172800\tIN\tNS\tns1.example.com.',
    'example.com.\t\t172800\tIN\tNS\tns2.example.com.',
    '',
    ';; ADDITIONAL SECTION:',
    'ns1.example.com.\t172800\tIN\tA\t203.0.113.53',
    'ns2.example.com.\t172800\tIN\tA\t198.51.100.53',
    '',
    ';; SERVER: 192.5.6.30#53(a.gtld-servers.net) (UDP)',
  ];
  const DIG_AUTH = [
    '$ dig @ns1.example.com www.example.com A +norecurse',
    ';; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 60318',
    ';; flags: qr ⟪aa⟫; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1',
    '',
    ';; ANSWER SECTION:',
    'www.example.com.\t3600\tIN\tA\t203.0.113.10',
    '',
    ';; SERVER: 203.0.113.53#53(ns1.example.com) (UDP)',
  ];
  const DIG_TRACE = [
    '$ dig +trace www.example.com',
    '.\t\t\t518123\tIN\tNS\ta.root-servers.net.',
    '; … m.root-servers.net まで',
    ';; Received 525 bytes from 127.0.0.53#53(127.0.0.53) in 0 ms',
    '',
    'com.\t\t\t172800\tIN\tNS\ta.gtld-servers.net.',
    '; …（+trace は +dnssec 付きなので DS / RRSIG の行も出る。省略）',
    ';; Received 1175 bytes from 198.41.0.4#53(a.root-servers.net) in 12 ms',
    '',
    'example.com.\t\t172800\tIN\tNS\tns1.example.com.',
    'example.com.\t\t172800\tIN\tNS\tns2.example.com.',
    ';; Received 131 bytes from 192.5.6.30#53(a.gtld-servers.net) in 20 ms',
    '',
    'www.example.com.\t3600\tIN\tA\t203.0.113.10',
    ';; Received 60 bytes from 203.0.113.53#53(ns1.example.com) in 8 ms',
  ];

  TIM.scene('#sc-path', {
    intro: '<code>curl https://www.example.com/</code> の裏で起きる名前解決を、クライアント内のファイル → スタブ → フルサービスリゾルバ → ルート → TLD → 権威の順に追います。パケットのラベルの <code>RD=1</code> / <code>RD=0</code> に注目してください。',
    steps: [
      {
        title: 'アプリが getaddrinfo() を呼ぶ',
        text: '<code>curl</code> は URL のホスト名を IP アドレスにするため、libc の <code>getaddrinfo()</code> を呼びます。アプリ自身は DNS のパケットを組み立てません。どこに・どの順で聞くかは libc の NSS（Name Service Switch）が設定ファイルで決めます。',
        code: [
          code('man 3 getaddrinfo', 'text', ['int getaddrinfo(const char *node, const char *service,', '                const struct addrinfo *hints,', '                struct addrinfo **res);']),
          code('アプリと同じ経路で引く', 'bash', ['$ getent ahostsv4 www.example.com', '203.0.113.10    STREAM www.example.com', '203.0.113.10    DGRAM', '203.0.113.10    RAW']),
        ],
        run: async (s) => {
          s.state('app', 'active');
          await s.pulse('app');
        },
      },
      {
        title: '/etc/nsswitch.conf の順に：まず /etc/hosts',
        text: 'NSS は <code>/etc/nsswitch.conf</code> の <code>hosts:</code> 行を左から順に試します。<code>files</code> は <code>/etc/hosts</code> を上から探しますが、<code>www.example.com</code> の行はないので次の <code>dns</code> に進みます。Ubuntu デスクトップの既定は <code>hosts: files mdns4_minimal [NOTFOUND=return] dns</code> のように mDNS が入ることもあります。',
        code: [
          code('/etc/nsswitch.conf', 'text', ['passwd:  files systemd', 'group:   files systemd', '⟪hosts:   files dns⟫', 'networks: files']),
          code('/etc/hosts', 'text', ['127.0.0.1  localhost', '127.0.1.1  client01', '::1        ip6-localhost ip6-loopback', '# www.example.com の行はない → dns へ']),
        ],
        run: async (s) => {
          await s.fly('app:b', 'nss:t', { dur: 600 });
          s.cls(L('nss', 1), 'hl');
          await s.fly('nss:b', 'hosts:t', { label: 'files', dur: 600 });
          await s.scan('hosts');
          s.state('hosts', 'dim');
        },
      },
      {
        title: 'dns：/etc/resolv.conf の nameserver に UDP で聞く',
        text: 'NSS の <code>dns</code>（glibc のスタブリゾルバ）は <code>/etc/resolv.conf</code> の <code>nameserver</code> に UDP/53 で問い合わせます。Ubuntu ではこれが systemd-resolved のスタブ <code>127.0.0.53</code> です。送るのは <strong>RD=1</strong>（Recursion Desired：答えだけ返して）の問い合わせです。',
        code: code('root@client01', 'bash', [
          '$ ls -l /etc/resolv.conf',
          'lrwxrwxrwx 1 root root 39 Sep 20 09:12 /etc/resolv.conf -> ../run/systemd/resolve/stub-resolv.conf',
          "$ grep -v '^#' /etc/resolv.conf",
          '⟪nameserver 127.0.0.53⟫',
          'options edns0 trust-ad',
          'search .',
        ]),
        run: async (s) => {
          s.cls(L('nss', 1), '', 'hl');
          await s.fly('hosts:b', 'resolv:t', { label: 'dns', dur: 600 });
          s.cls(L('resolv', 1), 'hl');
          await s.fly('resolv:b', 'stub:t', { label: 'A? www.example.com RD=1', dur: 900 });
          s.state('stub', 'active');
        },
      },
      {
        title: 'systemd-resolved が上流の DNS へ転送する',
        text: 'systemd-resolved は自分のキャッシュになければ、DHCP などで設定された上流の DNS サーバー（<code>192.0.2.1</code>）へ同じく <strong>RD=1</strong> で転送します。systemd-resolved もスタブなので、自分でルートから辿ることはしません。',
        code: code('resolvectl status（抜粋）', 'text', [
          'Global',
          '         Protocols: -LLMNR -mDNS -DNSOverTLS DNSSEC=no/unsupported',
          '  resolv.conf mode: stub',
          '',
          'Link 2 (eth0)',
          '    Current Scopes: DNS',
          '         Protocols: +DefaultRoute -LLMNR -mDNS -DNSOverTLS DNSSEC=no/unsupported',
          '⟪Current DNS Server: 192.0.2.1⟫',
          '       DNS Servers: 192.0.2.1',
        ]),
        run: async (s) => {
          await s.fly('stub:r', 'res:l', { label: 'RD=1', arc: -40, dur: 900 });
          s.state('res', 'active');
        },
      },
      {
        title: 'フルサービスリゾルバ → ルートへ（ここから RD=0）',
        text: 'キャッシュが空のリゾルバは、組み込みのルートヒント（<code>root.hints</code>）にあるルートサーバーから始めます。ここからは <strong>反復問い合わせ（RD=0）</strong>です。ルートは <code>www.example.com</code> を知りませんが、<code>com.</code> を誰に聞けばよいかは知っています。',
        code: code('/usr/share/dns/root.hints（抜粋）', 'dns', [
          '.                        3600000      NS    A.ROOT-SERVERS.NET.',
          'A.ROOT-SERVERS.NET.      3600000      A     198.41.0.4',
          'A.ROOT-SERVERS.NET.      3600000      AAAA  2001:503:ba3e::2:30',
          '; … M.ROOT-SERVERS.NET まで 13 組',
        ]),
        run: async (s) => {
          await s.fly('res:r', 'root:l', { label: 'A? www.example.com RD=0', arc: -30, dur: 1000 });
          s.state('root', 'active');
        },
      },
      {
        title: 'ルートの答え：com. への紹介（referral）',
        text: '応答の ANSWER は 0 件で、AUTHORITY に <code>com.</code> の NS が 13 件、ADDITIONAL にそのアドレス（<strong>glue</strong>）が入っています。これが「紹介（referral）」で、<code>aa</code> フラグは立っていません。',
        code: code('同じ問い合わせを dig で', 'dns', DIG_ROOT),
        run: async (s) => {
          await s.show('rootA', { fx: 'down' });
          await s.fly('root:l', 'res:r', { label: 'referral: com. NS', cls: 'c-violet', arc: -30, dur: 1000 });
          s.state('root', 'ok');
        },
      },
      {
        title: 'TLD（com.）への問い合わせ：example.com. への紹介',
        text: 'リゾルバは glue の <code>192.5.6.30</code>（a.gtld-servers.net）に同じ質問をします。<code>com.</code> のサーバーは <code>example.com.</code> の委任先 NS を返し、NS の名前がそのゾーンの中（<code>ns1.example.com</code>）にあるので glue のアドレスも付けます。',
        code: code('同じ問い合わせを dig で（example.com の委任は説明用の値）', 'dns', DIG_TLD),
        run: async (s) => {
          await s.fly('res:r', 'tld:l', { label: 'A? www.example.com RD=0', dur: 900 });
          s.state('tld', 'active');
          await s.show('tldA', { fx: 'down' });
          await s.fly('tld:l', 'res:r', { label: 'referral: example.com. NS', cls: 'c-cyan', arc: 30, dur: 900 });
          s.state('tld', 'ok');
        },
      },
      {
        title: '権威サーバーが aa 付きで答える',
        text: '<code>ns1.example.com</code>（203.0.113.53）はゾーン <code>example.com</code> を持っているので、ANSWER に A レコードを入れ、<strong><code>aa</code>（Authoritative Answer）</strong>を立てて返します。値と一緒に TTL（3600 秒）も届きます。',
        code: code('同じ問い合わせを dig で', 'dns', DIG_AUTH),
        run: async (s) => {
          await s.fly('res:r', 'auth:l', { label: 'A? www.example.com RD=0', arc: 30, dur: 900 });
          s.state('auth', 'active');
          await s.show('authA', { fx: 'down' });
          await s.fly('auth:l', 'res:r', { label: 'A 203.0.113.10 (aa)', cls: 'c-green', arc: 40, dur: 900 });
          s.state('auth', 'ok');
        },
      },
      {
        title: 'リゾルバはキャッシュしてからスタブへ返す',
        text: 'リゾルバは途中で得た NS・glue・答えを、それぞれの TTL の間キャッシュします。次に <code>example.com</code> 配下を聞かれたら、ルートと TLD を飛ばして直接 <code>ns1</code> に聞けます。スタブへの応答には <code>ra</code>（再帰可能）が立ち、<code>aa</code> は立ちません。',
        code: code('2 回目はキャッシュから', 'bash', [
          "$ dig @192.0.2.1 www.example.com +noall +answer +stats | grep -E 'IN|time'",
          'www.example.com.\t3600\tIN\tA\t203.0.113.10',
          ';; Query time: 52 msec',
          "$ dig @192.0.2.1 www.example.com +noall +answer +stats | grep -E 'IN|time'",
          'www.example.com.\t⟪3597⟫\tIN\tA\t203.0.113.10',
          ';; Query time: ⟪0 msec⟫',
        ]),
        run: async (s) => {
          s.state('res', 'ok');
          await s.show('rcache', { fx: 'up' });
          await s.fly('res:l', 'stub:r', { label: 'A 203.0.113.10 (qr rd ra)', cls: 'c-green', arc: 40, dur: 1000 });
          s.state('stub', 'ok');
        },
      },
      {
        title: 'getaddrinfo() が IP を返し、curl が接続する',
        text: 'systemd-resolved も結果をキャッシュし、glibc 経由で <code>getaddrinfo()</code> が <code>203.0.113.10</code> を返します。curl はここで初めて TCP 443 に接続します。',
        code: [
          code('スタブ（127.0.0.53）経由の dig', 'dns', [
            '$ dig www.example.com',
            ';; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 5871',
            ';; flags: qr ⟪rd ra⟫; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1',
            '; EDNS: version: 0, flags:; udp: 65494',
            ';; ANSWER SECTION:',
            'www.example.com.\t3600\tIN\tA\t203.0.113.10',
            ';; SERVER: 127.0.0.53#53(127.0.0.53) (UDP)',
          ]),
          code('curl -v', 'bash', ['$ curl -v https://www.example.com/ -o /dev/null 2>&1 | head -1', '*   Trying 203.0.113.10:443...']),
        ],
        run: async (s) => {
          await s.fly('stub:r', 'app:r', { label: '203.0.113.10', cls: 'c-green', arc: -60, dur: 1100 });
          s.state('app', 'ok');
          await s.stamp('app', ':443 へ接続', { cls: 'st-ok' });
        },
      },
      {
        title: '再帰と反復：dig +trace で同じ経路を見る',
        text: '実線（左）がクライアント側の<strong>再帰問い合わせ</strong>（RD=1：答えだけを要求）、破線（右）がリゾルバの<strong>反復問い合わせ</strong>（RD=0：紹介をたどる）です。<code>dig +trace</code> は dig 自身がリゾルバ役になってルートから反復問い合わせを行い、各段の応答を表示します。',
        code: code('dig +trace（抜粋）', 'dns', DIG_TRACE),
        run: async (s) => {
          s.line('stub:r', 'res:l', { cls: 'acc thick', arrow: true });
          s.line('res:r', 'root:l', { cls: 'dash' });
          s.line('res:r', 'tld:l', { cls: 'dash' });
          await s.line('res:r', 'auth:l', { cls: 'dash' });
          await s.caption('実線 = 再帰（RD=1）<br>破線 = 反復（RD=0）', { x: 503, y: 466 });
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 2 — DNS メッセージ
   * ============================================================= */
  const QB = [['id', 'a1 c4'], ['fl', '01 20'], ['ct', '00 01 00 00 00 00 00 01'], ['qn', '03 77 77 77 07 65 78 61 6d 70 6c 65 03 63 6f 6d 00'], ['qt', '00 01 00 01'], ['op', '00 00 29 04 d0 00 00 00 00 00 00']];
  const RB = [['id', 'a1 c4'], ['fl', '81 80'], ['ct', '00 01 00 01 00 00 00 01'], ['qn', '03 77 77 77 07 65 78 61 6d 70 6c 65 03 63 6f 6d 00'], ['qt', '00 01 00 01'], ['an', 'c0 0c 00 01 00 01 00 00 0e 10 00 04 cb 00 71 0a'], ['op', '00 00 29 04 d0 00 00 00 00 00 00']];
  function hexHTML(groups) {
    const bytes = [];
    groups.forEach((g) => g[1].split(' ').forEach((b) => bytes.push([g[0], b])));
    let out = '';
    for (let i = 0; i < bytes.length; i += 16) {
      out += (i ? '\n' : '') + '<span class="off">' + i.toString(16).padStart(4, '0') + '</span>  ' + bytes.slice(i, i + 16).map((x) => '<span class="g-' + x[0] + '">' + x[1] + '</span>').join(' ');
    }
    return out;
  }
  const qb = document.querySelector('#sc-msg [data-el="qhexb"]');
  const rb = document.querySelector('#sc-msg [data-el="rhexb"]');
  if (qb) qb.innerHTML = hexHTML(QB);
  if (rb) rb.innerHTML = hexHTML(RB);
  const focus = (s, el, f) => s.cls(el, f ? 'f-' + f.split(' ').join(' f-') : '', 'f-id f-fl f-ct f-qn f-qt f-op f-an');
  const HDR_DIAGRAM = [
    '                                1  1  1  1  1  1',
    '  0  1  2  3  4  5  6  7  8  9  0  1  2  3  4  5',
    '+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+',
    '|                      ID                       |',
    '+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+',
    '|QR|   Opcode  |AA|TC|RD|RA| Z|AD|CD|   RCODE   |',
    '+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+',
    '|                    QDCOUNT                    |',
    '|                    ANCOUNT                    |',
    '|                    NSCOUNT                    |',
    '|                    ARCOUNT                    |',
    '+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+',
  ];
  TIM.scene('#sc-msg', {
    intro: '<code>dig @192.0.2.1 www.example.com +nocookie</code> が送る 44 バイトのクエリと、返ってくる 60 バイトの応答を、ヘッダ → Question → OPT → Answer の順に 1 バイトずつ読みます。右上の 16 進ダンプの色付き部分が、下の各フィールドに対応します。',
    steps: [
      {
        title: 'dig が UDP で 44 バイトのクエリを送る',
        text: 'dig は既定で EDNS(0) を使い、UDP の宛先ポート 53 に 1 個のデータグラムを送ります（<code>+nocookie</code> は説明を簡単にするため EDNS Cookie を省く指定）。44 バイトの内訳は、ヘッダ 12 + Question 21 + OPT 疑似 RR 11 です。',
        code: code('root@client01', 'bash', ['$ dig @192.0.2.1 www.example.com +nocookie', '# 送信：UDP 192.0.2.77:41852 → 192.0.2.1:53（44 バイト）', '# ヘッダ 12 + Question 21（名前 17 + TYPE 2 + CLASS 2）+ OPT 11']),
        run: async (s) => {
          await s.term('t', '$ dig @192.0.2.1 www.example.com +nocookie');
          await s.show('qhex', { fx: 'right' });
          await s.scan('qhex');
        },
      },
      {
        title: 'ヘッダ 12 バイト：ID・フラグ・4 つの件数',
        text: '先頭 2 バイト <code>a1 c4</code> が ID（41412）で、応答はこれと同じ ID で返ります。次の 2 バイトがフラグ、その後に Question / Answer / Authority / Additional の件数が 2 バイトずつ続きます。クエリなので QDCOUNT=1、Additional に OPT が 1 件です。',
        code: code('ヘッダの形式（RFC 1035 §4.1.1 + RFC 4035 の AD/CD）', 'text', HDR_DIAGRAM),
        run: async (s) => {
          focus(s, 'qhexb', 'id fl ct');
          await s.show('lh h1 h2', { stagger: 120 });
          s.cls('vid', 'on');
        },
      },
      {
        title: 'フラグ 0x0120 をビットに分解する',
        text: '<code>01 20</code> = <code>0000 0001 0010 0000</code>。QR=0（問い合わせ）、OPCODE=0（QUERY）、<strong>RD=1</strong>（再帰を要求）、<strong>AD=1</strong>（dig は既定で AD ビットを立てる。<code>+noadflag</code> で外せる）、RCODE=0 です。',
        code: code('0x0120 のビット', 'text', [
          ' QR Opcode AA TC RD RA Z  AD CD RCODE',
          '  0  0000   0  0 ⟪ 1⟫  0 0 ⟪ 1⟫  0  0000',
          '=  0000 0001 0010 0000  = 0x0120',
        ]),
        run: async (s) => {
          focus(s, 'qhexb', 'fl');
          s.cls('vid', '', 'on');
          s.cls('vrd vad', 'on');
          await s.pulse('h1');
        },
      },
      {
        title: 'Question：名前はラベル長 + 文字列の並び',
        text: '名前はドット区切りではなく「長さ 1 バイト + 文字列」の並びで、最後の <code>00</code>（長さ 0 = ルート）で終わります：<code>03</code> www <code>07</code> example <code>03</code> com <code>00</code>。続く <code>00 01</code> が QTYPE=A、<code>00 01</code> が QCLASS=IN です。',
        code: code('QNAME のバイト', 'text', ['03 77 77 77             → 3 "www"', '07 65 78 61 6d 70 6c 65 → 7 "example"', '03 63 6f 6d             → 3 "com"', '00                      → ルート（名前の終わり）', '00 01 00 01             → QTYPE=1 (A), QCLASS=1 (IN)']),
        run: async (s) => {
          focus(s, 'qhexb', 'qn qt');
          s.cls('vrd vad', '', 'on');
          await s.show('lq q1');
        },
      },
      {
        title: 'Additional：OPT 疑似 RR（EDNS0）',
        text: 'Additional の 1 件は本物のレコードではなく、EDNS(0) の OPT 疑似 RR です（RFC 6891）。名前はルート（<code>00</code>）、TYPE=41、CLASS の位置に「受け取れる UDP の最大サイズ」<code>04 d0</code> = 1232 を入れ、TTL の位置に拡張 RCODE・バージョン・<code>DO</code> ビット（DNSSEC 要求）を入れます。',
        code: code('OPT のバイト', 'text', ['00          NAME     = ルート', '00 29       TYPE     = 41 (OPT)', '04 d0       CLASS    = UDP ペイロードサイズ 1232', '00 00 00 00 TTL      = EXT-RCODE 0, VERSION 0, DO=0', '00 00       RDLENGTH = 0（オプションなし）']),
        run: async (s) => {
          focus(s, 'qhexb', 'op');
          await s.show('lo o1');
        },
      },
      {
        title: '60 バイトの応答が返る',
        text: '応答の ID は同じ <code>a1 c4</code>。フラグ <code>81 80</code> は QR=1（応答）・RD=1（コピー）・RA=1（再帰可能）で、AA は 0（キャッシュ DNS の答えなので権威ではない）、AD も 0（DNSSEC 検証済みではない）です。ANCOUNT が 1 になりました。Question は問い合わせをそのまま繰り返します。',
        code: code('0x8180 のビット', 'text', [
          ' QR Opcode AA TC RD RA Z  AD CD RCODE',
          '⟪  1⟫  0000   0  0  1 ⟪ 1⟫ 0  0  0  0000',
          '=  1000 0001 1000 0000  = 0x8180 → dig の表示は flags: qr rd ra',
        ]),
        run: async (s) => {
          await s.swap('qhex', 'rhex');
          focus(s, 'rhexb', 'id fl ct');
          await s.set('vqr', '<small>QR</small>1');
          s.set('vra', '<small>RA</small>1');
          s.set('vad', '<small>AD</small>0');
          s.set('van', '<small>ANCOUNT</small>1');
          s.cls('vqr vra van', 'on');
        },
      },
      {
        title: 'Answer：名前の圧縮ポインタと RDATA',
        text: 'Answer の名前は <code>c0 0c</code> の 2 バイトだけです。上位 2 ビットが <code>11</code> なら「メッセージ先頭から 0x0c = 12 バイト目にある名前を参照」という圧縮ポインタで（RFC 1035 §4.1.4）、Question の <code>www.example.com</code> を指します。TTL <code>00 00 0e 10</code> = 3600 秒、RDATA <code>cb 00 71 0a</code> = 203.0.113.10 です。',
        code: code('Answer RR のバイト', 'text', ['c0 0c        NAME     = ポインタ → offset 12（www.example.com）', '00 01        TYPE     = 1 (A)', '00 01        CLASS    = 1 (IN)', '00 00 0e 10  TTL      = 3600', '00 04        RDLENGTH = 4', 'cb 00 71 0a  RDATA    = 203.0.113.10']),
        run: async (s) => {
          focus(s, 'rhexb', 'an');
          s.cls('vqr vra van', '', 'on');
          await s.show('la a1');
          await s.pulse('a1');
        },
      },
      {
        title: 'dig の出力と対応づける',
        text: 'dig の表示は、このバイト列をそのまま読み下したものです。<code>id</code>・<code>flags</code>・4 つの件数がヘッダ、<code>OPT PSEUDOSECTION</code> が Additional の OPT、<code>MSG SIZE rcvd: 60</code> が応答のバイト数です。',
        code: code('dig @192.0.2.1 www.example.com +nocookie', 'dns', [
          ';; Got answer:',
          ';; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: ⟪41412⟫',
          ';; flags: ⟪qr rd ra⟫; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1',
          '',
          ';; OPT PSEUDOSECTION:',
          '; EDNS: version: 0, flags:; udp: ⟪1232⟫',
          ';; QUESTION SECTION:',
          ';www.example.com.\t\tIN\tA',
          '',
          ';; ANSWER SECTION:',
          'www.example.com.\t⟪3600⟫\tIN\tA\t⟪203.0.113.10⟫',
          '',
          ';; Query time: 23 msec',
          ';; SERVER: 192.0.2.1#53(192.0.2.1) (UDP)',
          ';; WHEN: Mon Sep 28 10:30:12 JST 2026',
          ';; MSG SIZE  rcvd: ⟪60⟫',
        ]),
        run: async (s) => {
          focus(s, 'rhexb', '');
          s.hide('lh h1 h2 lq q1 lo o1 la a1', { dur: 200 });
          await s.show('out', { fx: 'up', delay: 150 });
        },
      },
      {
        title: 'UDP に収まらないと TC → TCP で問い直す',
        text: '応答が広告した UDP サイズ（EDNS なしなら 512 バイト）を超えると、サーバーは切り詰めて <code>tc</code> フラグを立てます。クライアントは同じ質問を TCP/53 で送り直し、TCP では各メッセージの前に 2 バイトの長さ（60 バイトなら <code>00 3c</code>）が付きます。<code>+ignore</code> を付けると dig は再試行せず <code>tc</code> をそのまま見せます。',
        code: code('大きな TXT を持つ名前（説明用）', 'bash', [
          '$ dig @192.0.2.1 big.example.com TXT +bufsize=512 +ignore | grep flags',
          ';; flags: qr ⟪tc⟫ rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 0, ADDITIONAL: 1',
          '$ dig @192.0.2.1 big.example.com TXT +bufsize=512 | head -2',
          ';; ⟪Truncated, retrying in TCP mode.⟫',
        ]),
        run: async (s) => {
          await s.term('t', [
            '$ dig @192.0.2.1 big.example.com TXT +bufsize=512 +ignore | grep flags',
            ';; flags: qr tc rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 0, ADDITIONAL: 1',
            '$ dig @192.0.2.1 big.example.com TXT +bufsize=512 | head -1',
            ';; Truncated, retrying in TCP mode.',
          ].join('\n'), { lang: 'dns' });
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 3 — ゾーンファイル
   * ============================================================= */
  const ZL = range(1, 22);
  const zhl = (s, ...ns) => { s.cls(L('zone', ...ZL), '', 'hl'); if (ns.length) s.cls(L('zone', ...ns), 'hl'); };
  TIM.scene('#sc-zone', {
    intro: '権威サーバー <code>ns1.example.com</code> のゾーンファイル 1 行 1 行が、どの問い合わせの答えになるかを <code>dig +short</code> で確かめます。最後に CNAME の追跡と、末尾のドットを忘れたときの結果を見ます。',
    steps: [
      {
        title: 'ゾーンの定義と $ORIGIN / $TTL',
        text: '<code>named.conf.local</code> の <code>zone</code> 文でゾーン名とファイルを結び付けます。ファイル内の末尾に <code>.</code> のない名前には <code>$ORIGIN</code>（<code>example.com.</code>）が補われ、TTL を書かない行には <code>$TTL</code>（3600 秒）が使われます。<code>@</code> は <code>$ORIGIN</code> そのものです。',
        code: [
          code('/etc/bind/named.conf.local', 'text', ['zone "example.com" {', '    type primary;', '    file "/etc/bind/db.example.com";', '};']),
          code('root@ns1', 'bash', ['$ named-checkzone example.com /etc/bind/db.example.com', 'zone example.com/IN: loaded serial 2026092801', 'OK']),
        ],
        run: async (s) => {
          zhl(s, 1, 2);
          await s.term('t', '$ named-checkzone example.com /etc/bind/db.example.com\nzone example.com/IN: loaded serial 2026092801\nOK');
        },
      },
      {
        title: 'SOA：ゾーンの起点',
        text: 'SOA はプライマリサーバー名・管理者のメールアドレス（<code>hostmaster.example.com.</code> = hostmaster@example.com）・シリアル・セカンダリの更新間隔（refresh / retry / expire）と、<strong>ネガティブキャッシュの TTL</strong>（最後の値 300）を持ちます。ゾーンを変えたらシリアルを上げます。',
        code: code('root@client01', 'bash', ['$ dig +short SOA example.com', 'ns1.example.com. hostmaster.example.com. 2026092801 7200 3600 1209600 300']),
        run: async (s) => {
          zhl(s, 3, 4, 5, 6, 7, 8);
          await s.term('t', '$ dig +short SOA example.com\nns1.example.com. hostmaster.example.com. 2026092801 7200 3600 1209600 300');
        },
      },
      {
        title: 'NS と glue',
        text: '<code>NS</code> はこのゾーンの権威サーバーです。同じ NS を親の <code>com.</code> にも登録して「委任」します。NS の名前 <code>ns1.example.com</code> がこのゾーンの中にあるので、親にはそのアドレス（glue）も登録しないと、誰も最初の 1 回を引けません。',
        code: code('root@client01', 'bash', ['$ dig +short NS example.com', 'ns1.example.com.', 'ns2.example.com.', '$ dig +short ns1.example.com', '203.0.113.53']),
        run: async (s) => {
          zhl(s, 9, 10, 15, 16);
          await s.term('t', '$ dig +short NS example.com\nns1.example.com.\nns2.example.com.');
        },
      },
      {
        title: 'A と AAAA',
        text: '<code>www</code> には IPv4 の <code>A</code> と IPv6 の <code>AAAA</code> があり、<code>getaddrinfo()</code> は通常両方を問い合わせます。ゾーン頂点（<code>@</code>）自身にも A があります。',
        code: code('root@client01', 'bash', ['$ dig +short www.example.com', '203.0.113.10', '$ dig +short AAAA www.example.com', '2001:db8::10']),
        run: async (s) => {
          zhl(s, 11, 17, 18);
          await s.term('t', '$ dig +short www.example.com\n203.0.113.10\n$ dig +short AAAA www.example.com\n2001:db8::10');
        },
      },
      {
        title: 'MX・TXT・CAA',
        text: '<code>MX</code> はメールの配送先（優先度 10 の <code>mail.example.com.</code>）、<code>TXT</code> は SPF などの文字列、<code>CAA</code> は証明書を発行してよい CA です。MX の値は相対名 <code>mail</code> なので <code>mail.example.com.</code> になります。',
        code: code('root@client01', 'bash', ['$ dig +short MX example.com', '10 mail.example.com.', '$ dig +short TXT example.com', '"v=spf1 ip4:203.0.113.0/24 -all"', '$ dig +short CAA example.com', '0 issue "letsencrypt.org"']),
        run: async (s) => {
          zhl(s, 12, 13, 14, 19);
          await s.term('t', '$ dig +short MX example.com\n10 mail.example.com.\n$ dig +short TXT example.com\n"v=spf1 ip4:203.0.113.0/24 -all"');
        },
      },
      {
        title: 'SRV：サービスの場所とポート',
        text: '<code>_sip._tcp</code> のように「<code>_サービス._プロトコル</code>」の名前に、優先度・重み・ポート・ホストを置きます（RFC 2782）。',
        code: code('root@client01', 'bash', ['$ dig +short SRV _sip._tcp.example.com', '10 60 5060 sip.example.com.']),
        run: async (s) => {
          zhl(s, 21, 22);
          await s.term('t', '$ dig +short SRV _sip._tcp.example.com\n10 60 5060 sip.example.com.');
        },
      },
      {
        title: 'CNAME：別の名前へ',
        text: '<code>shop.example.com</code> は <code>shops.example.net.</code> の別名です。権威 <code>ns1</code> は自分のゾーンにある CNAME を返しますが、<code>example.net</code> は自分の担当ではないので、その先の A は返せません。',
        code: code('権威サーバーの答え', 'dns', ['$ dig +norecurse @ns1.example.com shop.example.com A', ';; flags: qr aa; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1', ';; ANSWER SECTION:', 'shop.example.com.\t3600\tIN\t⟪CNAME\tshops.example.net.⟫']),
        run: async (s) => {
          zhl(s, 20);
          await s.fly('res:l', 'zone:r', { label: 'A? shop.example.com', dur: 900 });
          await s.fly('zone:r', 'res:t', { label: 'CNAME shops.example.net.', cls: 'c-amber', arc: -40, dur: 900 });
          s.state('res', 'active');
        },
      },
      {
        title: 'リゾルバが CNAME の先を追う',
        text: 'フルサービスリゾルバは CNAME の先 <code>shops.example.net</code> の A を改めて解決し（<code>example.net</code> の権威へ）、CNAME と A の両方を ANSWER に入れて返します。そのため <code>ANSWER: 2</code> になり、各レコードの TTL は別々です。',
        code: code('root@client01', 'dns', [
          '$ dig shop.example.com',
          ';; flags: qr rd ra; QUERY: 1, ANSWER: ⟪2⟫, AUTHORITY: 0, ADDITIONAL: 1',
          ';; ANSWER SECTION:',
          'shop.example.com.\t3600\tIN\tCNAME\tshops.example.net.',
          'shops.example.net.\t300\tIN\tA\t198.51.100.80',
        ]),
        run: async (s) => {
          await s.show('nsnet', { fx: 'pop' });
          await s.fly('res:r', 'nsnet:l', { label: 'A? shops.example.net', dur: 800 });
          await s.fly('nsnet:b', 'res:b', { label: 'A 198.51.100.80', cls: 'c-green', arc: -40, dur: 800 });
          s.state('res', 'ok');
          await s.show('ans', { fx: 'up' });
          s.cls(L('ans', 1, 2), 'ok');
        },
      },
      {
        title: '末尾のドットを忘れると',
        text: 'CNAME の値を <code>shops.example.net</code>（ドットなし）と書くと、相対名として <code>$ORIGIN</code> が付き、<code>shops.example.net.example.com.</code> を指してしまいます。<code>named-checkzone</code> は文法上正しいのでエラーを出しません。',
        code: code('root@client01', 'bash', ['$ dig +short CNAME shop.example.com', '⟪shops.example.net.example.com.⟫']),
        run: async (s) => {
          zhl(s, 20);
          s.cls(L('zone', 20), 'bad', 'hl');
          await s.show('dot', { fx: 'up' });
          await s.term('t', '$ dig +short CNAME shop.example.com\nshops.example.net.example.com.', { cls: 'c-red' });
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 4 — キャッシュと TTL
   * ============================================================= */
  const cacheHTML = (lines) => fileHTML('キャッシュ（名前 / タイプ / 値 / 残り TTL）', 'dns', lines.length ? lines : ['; （空）']);
  const clock = (s, from, to) => s.count('clkv', from, to, { dur: 1100, fmt: (v) => '経過 ' + Math.round(v).toLocaleString() + ' 秒' });
  const Q1 = "$ dig @192.0.2.1 www.example.com +noall +answer +stats | grep -E 'IN|time'";
  TIM.scene('#sc-cache', {
    intro: 'リゾルバ <code>192.0.2.1</code> のキャッシュと時計を並べ、同じ問い合わせを時間をずらして繰り返します。TTL が減る・切れる・「存在しない」もキャッシュされる・値を変えても古い答えが残る、を順に見ます。',
    steps: [
      {
        title: '1 回目：キャッシュが空なので権威まで聞きに行く',
        text: 'リゾルバのキャッシュは空です。権威 <code>ns1</code> まで問い合わせ、TTL 3600 の答えを受け取ってキャッシュに入れてからクライアントに返します。<code>Query time</code> は往復分の 48 ms です。',
        code: code('root@client01', 'bash', [Q1, 'www.example.com.\t⟪3600⟫\tIN\tA\t203.0.113.10', ';; Query time: 48 msec']),
        run: async (s) => {
          await s.fly('cli:r', 'res:l', { label: 'A? www', dur: 600 });
          await s.fly('res:r', 'auth:l', { label: 'A? www RD=0', dur: 600 });
          await s.fly('auth:l', 'res:r', { label: 'A 203.0.113.10 TTL 3600', cls: 'c-green', arc: 30, dur: 700 });
          await s.set('cache', cacheHTML(['www.example.com.  A  203.0.113.10   TTL 3600']));
          s.cls(L('cache', 1), 'ok');
          await s.fly('res:l', 'cli:r', { label: '3600', cls: 'c-green', arc: 30, dur: 600 });
          await s.term('t', Q1 + '\nwww.example.com.\t3600\tIN\tA\t203.0.113.10\n;; Query time: 48 msec', { lang: 'dns' });
        },
      },
      {
        title: '時間が経つと、キャッシュの TTL が減っていく',
        text: 'キャッシュ内のレコードは、受け取ったときの TTL から経過秒数だけ減っていきます。1000 秒後には残り 2600 秒です。',
        code: code('残り TTL の計算', 'text', ['受信時 TTL 3600 − 経過 1000 秒 = 残り 2600 秒']),
        run: async (s) => {
          await clock(s, 0, 1000);
          await s.set('cache', cacheHTML(['www.example.com.  A  203.0.113.10   TTL 2600']));
        },
      },
      {
        title: '2 回目：キャッシュから即答（TTL は残り時間）',
        text: '同じ問い合わせに、リゾルバは権威に聞かずキャッシュから答えます。応答の TTL は<strong>残り時間</strong>の 2600 で、<code>Query time</code> は 0 ms。クライアント側から見ると「TTL が減った」ように見えます。',
        code: code('root@client01', 'bash', [Q1, 'www.example.com.\t⟪2600⟫\tIN\tA\t203.0.113.10', ';; Query time: ⟪0 msec⟫']),
        run: async (s) => {
          await s.fly('cli:r', 'res:l', { label: 'A? www', dur: 600 });
          s.pulse('cache');
          await s.fly('res:l', 'cli:r', { label: '2600（キャッシュ）', cls: 'c-green', arc: 30, dur: 600 });
          await s.term('t', Q1 + '\nwww.example.com.\t2600\tIN\tA\t203.0.113.10\n;; Query time: 0 msec', { lang: 'dns' });
        },
      },
      {
        title: 'TTL が切れると、もう一度権威へ',
        text: '3600 秒を過ぎるとキャッシュから消え、次の問い合わせは再び権威まで行きます。TTL は「どれだけの間、変更が反映されなくてもよいか」と「どれだけ権威への問い合わせを減らすか」のトレードオフです。',
        code: code('root@client01', 'bash', [Q1, 'www.example.com.\t3600\tIN\tA\t203.0.113.10', ';; Query time: 45 msec']),
        run: async (s) => {
          await clock(s, 1000, 3700);
          await s.set('cache', cacheHTML(['; www.example.com. A … TTL 0 → 削除']));
          s.cls(L('cache', 1), 'dim');
          await s.fly('cli:r', 'res:l', { label: 'A? www', dur: 500 });
          await s.fly('res:r', 'auth:l', { label: 'A? www RD=0', dur: 500 });
          await s.fly('auth:l', 'res:r', { label: 'TTL 3600', cls: 'c-green', arc: 30, dur: 600 });
          await s.set('cache', cacheHTML(['www.example.com.  A  203.0.113.10   TTL 3600']));
          await s.term('t', Q1 + '\nwww.example.com.\t3600\tIN\tA\t203.0.113.10\n;; Query time: 45 msec', { lang: 'dns' });
        },
      },
      {
        title: 'ネガティブキャッシュ：NXDOMAIN も覚える',
        text: '存在しない <code>nosuch.example.com</code> を聞くと、権威は <code>NXDOMAIN</code> と、根拠としてゾーンの SOA を Authority に付けて返します。リゾルバは「ない」ことを <code>min(SOA の TTL, SOA の MINIMUM) = 300</code> 秒キャッシュします（RFC 2308）。',
        code: code('root@client01', 'bash', [
          "$ dig @192.0.2.1 nosuch.example.com +noall +comments +authority | grep -E 'status|SOA'",
          ';; ->>HEADER<<- opcode: QUERY, status: ⟪NXDOMAIN⟫, id: 7310',
          'example.com.\t⟪300⟫\tIN\tSOA\tns1.example.com. hostmaster.example.com. 2026092801 7200 3600 1209600 ⟪300⟫',
        ]),
        run: async (s) => {
          await s.fly('cli:r', 'res:l', { label: 'A? nosuch', dur: 500 });
          await s.fly('res:r', 'auth:l', { label: 'A? nosuch RD=0', dur: 500 });
          await s.fly('auth:l', 'res:r', { label: 'NXDOMAIN + SOA', cls: 'c-red', arc: 30, dur: 600 });
          await s.set('cache', cacheHTML(['www.example.com.  A  203.0.113.10   TTL 3600', 'nosuch.example.com.  NXDOMAIN (SOA) TTL 300']));
          s.cls(L('cache', 2), 'bad');
          await s.term('t', "$ dig @192.0.2.1 nosuch.example.com +noall +comments +authority | grep -E 'status|SOA'\n;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 7310\nexample.com.\t300\tIN\tSOA\tns1.example.com. hostmaster.example.com. 2026092801 7200 3600 1209600 300", { lang: 'dns' });
        },
      },
      {
        title: '作った直後なのに NXDOMAIN が返る',
        text: '120 秒後、管理者がゾーンに <code>nosuch</code> を追加しました。しかしリゾルバはネガティブキャッシュの残り 180 秒の間、権威に聞かずに <code>NXDOMAIN</code> を返し続けます。',
        code: code('root@client01', 'bash', [
          "$ dig @192.0.2.1 nosuch.example.com +noall +comments +authority | grep -E 'status|SOA'",
          ';; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 29554',
          'example.com.\t⟪180⟫\tIN\tSOA\tns1.example.com. hostmaster.example.com. 2026092801 7200 3600 1209600 300',
        ]),
        run: async (s) => {
          await clock(s, 3700, 3820);
          await s.set('azone', fileHTML('db.example.com', 'dns', ['www    3600 IN A 203.0.113.10', 'nosuch 3600 IN A 203.0.113.99'], 'serial 2026092802'));
          s.cls(L('azone', 2), 'ok');
          await s.set('cache', cacheHTML(['www.example.com.  A  203.0.113.10   TTL 3480', 'nosuch.example.com.  NXDOMAIN (SOA) TTL 180']));
          s.cls(L('cache', 2), 'bad');
          await s.fly('cli:r', 'res:l', { label: 'A? nosuch', dur: 500 });
          await s.fly('res:l', 'cli:r', { label: 'NXDOMAIN（キャッシュ）', cls: 'c-red', arc: 30, dur: 600 });
          await s.term('t', "$ dig @192.0.2.1 nosuch.example.com +noall +comments +authority | grep -E 'status|SOA'\n;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 29554\nexample.com.\t180\tIN\tSOA\tns1.example.com. hostmaster.example.com. 2026092801 7200 3600 1209600 300", { lang: 'dns' });
        },
      },
      {
        title: 'IP を変えたのに、古い答えが返り続ける',
        text: '権威で <code>www</code> を <code>203.0.113.20</code> に変えました。権威に直接聞けば新しい値（<code>aa</code> 付き）ですが、リゾルバはキャッシュの TTL が残っている間（あと 3480 秒）古い <code>203.0.113.10</code> を返します。',
        code: code('root@client01', 'bash', [
          '$ dig @192.0.2.1 www.example.com +noall +answer',
          'www.example.com.\t3480\tIN\tA\t⟪203.0.113.10⟫',
          '$ dig @ns1.example.com www.example.com +norecurse +noall +answer',
          'www.example.com.\t3600\tIN\tA\t⟪203.0.113.20⟫',
        ]),
        run: async (s) => {
          await s.set('azone', fileHTML('db.example.com', 'dns', ['www    3600 IN A 203.0.113.20', 'nosuch 3600 IN A 203.0.113.99'], 'serial 2026092803'));
          s.cls(L('azone', 1), 'warn');
          s.cls(L('cache', 1), 'warn');
          await s.term('t', '$ dig @192.0.2.1 www.example.com +noall +answer\nwww.example.com.\t3480\tIN\tA\t203.0.113.10\n$ dig @ns1.example.com www.example.com +norecurse +noall +answer\nwww.example.com.\t3600\tIN\tA\t203.0.113.20', { lang: 'dns' });
          s.state('res', 'warn');
        },
      },
      {
        title: '対策：事前に TTL を下げる／キャッシュを消す',
        text: '計画的な変更なら、<strong>元の TTL（3600 秒）以上前</strong>に TTL を 300 などへ下げておき、切り替え後に戻します。管理しているリゾルバなら名前単位でキャッシュを消せます（Unbound: <code>unbound-control flush</code>、BIND: <code>rndc flushname</code>、systemd-resolved: <code>resolvectl flush-caches</code>）。',
        code: code('root@resolver（Unbound）', 'bash', [
          '$ sudo unbound-control flush www.example.com',
          'ok',
          '$ dig @192.0.2.1 www.example.com +noall +answer',
          'www.example.com.\t3600\tIN\tA\t⟪203.0.113.20⟫',
        ]),
        run: async (s) => {
          await s.set('cache', cacheHTML(['; www.example.com. → flush で削除', 'nosuch.example.com.  NXDOMAIN (SOA) TTL 180']));
          s.cls(L('cache', 1), 'dim');
          await s.fly('res:r', 'auth:l', { label: 'A? www RD=0', dur: 500 });
          await s.fly('auth:l', 'res:r', { label: 'A 203.0.113.20', cls: 'c-green', arc: 30, dur: 600 });
          await s.set('cache', cacheHTML(['www.example.com.  A  203.0.113.20   TTL 3600', 'nosuch.example.com.  NXDOMAIN (SOA) TTL 180']));
          s.cls(L('cache', 1), 'ok');
          s.state('res', 'ok');
          await s.term('t', '$ sudo unbound-control flush www.example.com\nok\n$ dig @192.0.2.1 www.example.com +noall +answer\nwww.example.com.\t3600\tIN\tA\t203.0.113.20', { lang: 'dns' });
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 5 — 失敗ケース
   * ============================================================= */
  const kv = (rows) => rows.map((r) => '<dt>' + r[0] + '</dt><dd' + (r[2] ? ' class="' + r[2] + '"' : '') + '>' + r[1] + '</dd>').join('');
  async function status(s, text, cls, hdr, rows) {
    s.cls('st', cls, 'ok bad warn');
    await s.text('stv', text);
    await s.set('hdr', fileHTML('dig の要点', 'dns', hdr));
    await s.set('sumkv', kv(rows));
  }
  TIM.scene('#sc-fail', {
    intro: '同じ「引けない」でも、<code>status:</code> と Authority セクションを見れば、どこで何が起きたかが分かります。名前がない・型がない・リゾルバが答えを得られない・委任先が壊れている・ゾーンが読み込めない、を順に再現します。',
    steps: [
      {
        title: 'NXDOMAIN：名前そのものが存在しない',
        text: '権威 <code>ns1</code> が「この名前はゾーンにない」と答えたケースです。<code>status: NXDOMAIN</code>、ANSWER は 0 で、Authority にゾーンの SOA が付きます。これは<strong>正常な否定応答</strong>で、SOA に基づきキャッシュされます。',
        code: code('root@client01', 'dns', [
          '$ dig nosuch.example.com',
          ';; ->>HEADER<<- opcode: QUERY, status: ⟪NXDOMAIN⟫, id: 7310',
          ';; flags: qr rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 1',
          ';; AUTHORITY SECTION:',
          'example.com.\t300\tIN\tSOA\tns1.example.com. hostmaster.example.com. 2026092801 7200 3600 1209600 300',
        ]),
        run: async (s) => {
          await s.fly('cli:r', 'res:l', { label: 'A? nosuch', dur: 500 });
          await s.fly('res:r', 'ns1:l', { label: 'RD=0', dur: 500 });
          await s.fly('ns1:l', 'res:r', { label: 'NXDOMAIN (aa)', cls: 'c-red', arc: 30, dur: 600 });
          await s.fly('res:l', 'cli:r', { label: 'NXDOMAIN', cls: 'c-red', arc: 30, dur: 500 });
          await status(s, 'NXDOMAIN', 'bad', [
            ';; ->>HEADER<<- … status: NXDOMAIN',
            ';; flags: qr rd ra; … ANSWER: 0, AUTHORITY: 1',
            ';; AUTHORITY SECTION:',
            'example.com. 300 IN SOA ns1.example.com. …',
          ], [['意味', '名前そのものが存在しない'], ['決めた所', '権威 ns1（aa 付きで NXDOMAIN）'], ['キャッシュ', 'SOA により 300 秒（ネガティブ）', 'warn']]);
          await s.term('t', '$ dig nosuch.example.com | grep -E "status|SOA"\n;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 7310\nexample.com.\t300\tIN\tSOA\tns1.example.com. hostmaster.example.com. 2026092801 7200 3600 1209600 300', { lang: 'dns' });
        },
      },
      {
        title: 'NOERROR / NODATA：名前はあるが、その型がない',
        text: '<code>mail.example.com</code> には A はありますが AAAA はありません。この場合は <code>NOERROR</code> で ANSWER が 0、Authority に SOA が付きます（NODATA）。NXDOMAIN と違い「名前はある」ので、他の型は引けます。',
        code: code('root@client01', 'dns', [
          '$ dig mail.example.com AAAA',
          ';; ->>HEADER<<- opcode: QUERY, status: ⟪NOERROR⟫, id: 45872',
          ';; flags: qr rd ra; QUERY: 1, ANSWER: ⟪0⟫, AUTHORITY: 1, ADDITIONAL: 1',
          ';; AUTHORITY SECTION:',
          'example.com.\t300\tIN\tSOA\tns1.example.com. hostmaster.example.com. 2026092801 7200 3600 1209600 300',
        ]),
        run: async (s) => {
          await s.fly('cli:r', 'res:l', { label: 'AAAA? mail', dur: 500 });
          await s.fly('res:l', 'cli:r', { label: 'NOERROR · ANSWER 0', cls: 'c-amber', arc: 30, dur: 600 });
          await status(s, 'NOERROR (NODATA)', 'warn', [
            ';; ->>HEADER<<- … status: NOERROR',
            ';; flags: qr rd ra; … ANSWER: 0, AUTHORITY: 1',
            ';; AUTHORITY SECTION:',
            'example.com. 300 IN SOA ns1.example.com. …',
          ], [['意味', '名前はあるが AAAA レコードがない'], ['決めた所', '権威 ns1'], ['キャッシュ', 'NXDOMAIN と同じく SOA により 300 秒', 'warn']]);
          await s.term('t', '$ dig mail.example.com AAAA | grep -E "status|ANSWER:"\n;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 45872\n;; flags: qr rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 1', { lang: 'dns' });
        },
      },
      {
        title: 'SERVFAIL：リゾルバが答えを得られなかった',
        text: '権威 <code>ns1</code> と <code>ns2</code> がどちらも応答しない（停止・ネットワーク断・ファイアウォール）と、リゾルバはタイムアウト後に <code>SERVFAIL</code> を返します。決めたのは権威ではなく<strong>リゾルバ</strong>です。Extended DNS Errors（RFC 8914）に対応したリゾルバは理由を <code>; EDE:</code> 行で添えます。',
        code: code('root@client01', 'dns', [
          '$ dig www.example.com',
          ';; ->>HEADER<<- opcode: QUERY, status: ⟪SERVFAIL⟫, id: 18841',
          ';; flags: qr rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 0, ADDITIONAL: 1',
          ';; OPT PSEUDOSECTION:',
          '; EDNS: version: 0, flags:; udp: 1232',
          '; EDE: 22 (No Reachable Authority)      ; ← EDE 対応リゾルバの場合',
        ]),
        run: async (s) => {
          await s.fly('cli:r', 'res:l', { label: 'A? www', dur: 500 });
          s.state('ns1 ns2', 'bad');
          await s.fly('res:r', 'ns1:l', { label: 'timeout', cls: 'c-red', dur: 700 });
          await s.fly('res:r', 'ns2:l', { label: 'timeout', cls: 'c-red', arc: -30, dur: 700 });
          await s.fly('res:l', 'cli:r', { label: 'SERVFAIL', cls: 'c-red', arc: 30, dur: 600 });
          s.state('res', 'bad');
          await status(s, 'SERVFAIL', 'bad', [
            ';; ->>HEADER<<- … status: SERVFAIL',
            ';; flags: qr rd ra; … ANSWER: 0, AUTHORITY: 0',
            '; EDE: 22 (No Reachable Authority)',
          ], [['意味', 'リゾルバが答えを得られなかった'], ['決めた所', 'フルサービスリゾルバ（権威は答えていない）'], ['キャッシュ', 'してもよいが最大 5 分（RFC 2308 §7.1）', 'warn']]);
          await s.term('t', '$ dig www.example.com | grep -E "status|EDE"\n;; ->>HEADER<<- opcode: QUERY, status: SERVFAIL, id: 18841\n; EDE: 22 (No Reachable Authority)', { lang: 'dns' });
        },
      },
      {
        title: 'lame delegation：委任先がゾーンを持っていない',
        text: '親（<code>com.</code>）には NS として <code>ns2.example.com</code>（198.51.100.53）が載っているのに、そのサーバーに <code>example.com</code> のゾーンがありません。直接聞くと <code>REFUSED</code>（または <code>aa</code> なし）です。リゾルバは <code>ns1</code> に回るので答えは得られますが遅くなり、<code>ns1</code> も落ちると SERVFAIL になります。',
        code: [
          code('root@client01', 'dns', [
            '$ dig +norecurse @198.51.100.53 www.example.com',
            ';; ->>HEADER<<- opcode: QUERY, status: ⟪REFUSED⟫, id: 3317',
            ';; flags: qr; QUERY: 1, ANSWER: 0, AUTHORITY: 0, ADDITIONAL: 1',
          ]),
          code('リゾルバ（BIND）のログ', 'text', "lame-servers: info: REFUSED unexpected RCODE resolving 'www.example.com/A/IN': 198.51.100.53#53"),
        ],
        run: async (s) => {
          s.state('ns1', 'ok');
          s.state('ns2', 'bad');
          s.state('res', 'active');
          await s.fly('res:r', 'ns2:l', { label: 'A? www RD=0', arc: -30, dur: 600 });
          await s.fly('ns2:l', 'res:r', { label: 'REFUSED', cls: 'c-red', arc: -30, dur: 600 });
          await s.fly('res:r', 'ns1:l', { label: 'retry → ns1', dur: 600 });
          await s.fly('ns1:l', 'res:r', { label: 'A (aa)', cls: 'c-green', arc: 30, dur: 600 });
          s.state('res', 'warn');
          await status(s, 'REFUSED (ns2)', 'warn', [
            '$ dig +norecurse @198.51.100.53 www.example.com',
            ';; ->>HEADER<<- … status: REFUSED',
            ';; flags: qr; … ANSWER: 0   ← aa がない',
          ], [['意味', '委任されているのにゾーンを持っていない（lame）'], ['決めた所', 'ns2（198.51.100.53）'], ['影響', 'リゾルバは ns1 に回るので遅延。全 NS が lame なら SERVFAIL', 'warn']]);
          await s.term('t', '$ dig +norecurse @198.51.100.53 www.example.com | grep -E "status|flags"\n;; ->>HEADER<<- opcode: QUERY, status: REFUSED, id: 3317\n;; flags: qr; QUERY: 1, ANSWER: 0, AUTHORITY: 0, ADDITIONAL: 1', { lang: 'dns' });
        },
      },
      {
        title: 'ゾーン頂点に CNAME：ゾーンが読み込まれない',
        text: '<code>@ IN CNAME lb.example.net.</code> と書くと、頂点には SOA と NS もあるので「CNAME と他のデータの共存」になり、BIND はゾーンを読み込みません（RFC 1034 §3.6.2、RFC 2181 §10.1）。<code>named-checkzone</code> で事前に検出できます。読み込めなければ権威は答えられず、リゾルバからは SERVFAIL に見えます。',
        code: code('root@ns1', 'bash', [
          '$ named-checkzone example.com /etc/bind/db.example.com',
          'dns_master_load: /etc/bind/db.example.com:12: example.com: ⟪CNAME and other data⟫',
          'zone example.com/IN: loading from master file /etc/bind/db.example.com failed: CNAME and other data',
          'zone example.com/IN: not loaded due to errors.',
        ]),
        run: async (s) => {
          s.state('ns2', null);
          s.state('res', null);
          s.state('ns1', 'bad');
          await status(s, 'CNAME and other data', 'bad', [
            '@  IN SOA   ns1 hostmaster ( … )',
            '   IN NS    ns1',
            '   IN CNAME lb.example.net.   ; ← 頂点に CNAME',
          ], [['意味', '同じ名前に CNAME と SOA/NS が共存している'], ['決めた所', '権威サーバーのゾーン読み込み'], ['対処', 'A/AAAA を直接書く・ALIAS/ANAME・HTTPS レコード', 'warn']]);
          s.cls(L('hdr', 3), 'bad');
          await s.term('t', '$ named-checkzone example.com /etc/bind/db.example.com\ndns_master_load: /etc/bind/db.example.com:12: example.com: CNAME and other data\nzone example.com/IN: loading from master file /etc/bind/db.example.com failed: CNAME and other data\nzone example.com/IN: not loaded due to errors.', { cls: 'c-red' });
        },
      },
      {
        title: '変更が反映されない：TTL の間は古い値',
        text: '<code>status</code> は <code>NOERROR</code> で一見正常ですが、値が古いケースです。リゾルバのキャッシュが残っている間は、権威で変えた値は見えません。権威に直接 <code>+norecurse</code> で聞いて比べると切り分けられます（詳しくは前のシーン）。',
        code: code('root@client01', 'dns', [
          '$ dig +noall +answer www.example.com',
          'www.example.com.\t2974\tIN\tA\t⟪203.0.113.10⟫   ; キャッシュの残り TTL',
          '$ dig +noall +answer +norecurse @ns1.example.com www.example.com',
          'www.example.com.\t3600\tIN\tA\t⟪203.0.113.20⟫   ; 権威の現在値',
        ]),
        run: async (s) => {
          s.state('ns1', 'ok');
          s.state('res', 'warn');
          await status(s, 'NOERROR（古い値）', 'warn', [
            'resolver: www.example.com. 2974 IN A 203.0.113.10',
            'ns1 (aa): www.example.com. 3600 IN A 203.0.113.20',
          ], [['意味', 'キャッシュの TTL が残っている間は古い値'], ['決めた所', 'リゾルバのキャッシュ'], ['対処', '事前に TTL を下げる・flush する', 'warn']]);
          s.cls(L('hdr', 1), 'warn');
          s.cls(L('hdr', 2), 'ok');
          await s.term('t', '$ dig +noall +answer www.example.com\nwww.example.com.\t2974\tIN\tA\t203.0.113.10\n$ dig +noall +answer +norecurse @ns1.example.com www.example.com\nwww.example.com.\t3600\tIN\tA\t203.0.113.20', { lang: 'dns' });
        },
      },
      {
        title: '切り分けの順番',
        text: '(1) <code>getent hosts</code> と <code>dig</code> を比べて <code>/etc/hosts</code> や NSS の問題かを見る → (2) <code>dig</code> の <code>status</code> を読む → (3) SERVFAIL なら <code>+cd</code> で DNSSEC を外して比べる → (4) <code>dig +trace</code> でどの段で止まるかを見る → (5) 各 NS に <code>+norecurse</code> で直接聞き、<code>aa</code> とシリアルが揃っているか確認します。',
        code: code('切り分けコマンド', 'bash', [
          '$ getent hosts www.example.com                    # アプリと同じ経路',
          '$ dig www.example.com | grep status               # RCODE',
          '$ dig +cd www.example.com | grep status           # DNSSEC を外すと引けるか',
          '$ dig +trace www.example.com                      # どの段で止まるか',
          '$ for ns in ns1 ns2; do dig +norecurse +short @$ns.example.com example.com SOA; done',
        ]),
        run: async (s) => {
          s.state('res', null);
          await status(s, 'status を読む', '', [
            'NXDOMAIN → 名前の綴り・登録',
            'NOERROR/0 → 型（AAAA/MX/TXT）',
            'SERVFAIL → 権威・委任・DNSSEC',
            'REFUSED  → 問い合わせ先・ACL',
          ], [['1', 'getent と dig を比べる（/etc/hosts・NSS）'], ['2', 'status と Authority を読む'], ['3', '+cd / +trace / 各 NS に +norecurse', 'ok']]);
          await s.term('t', '$ for ns in ns1 ns2; do dig +norecurse +short @$ns.example.com example.com SOA; done\nns1.example.com. hostmaster.example.com. 2026092803 7200 3600 1209600 300\nns1.example.com. hostmaster.example.com. 2026092801 7200 3600 1209600 300', { lang: 'dns' });
        },
      },
    ],
  });
})();
