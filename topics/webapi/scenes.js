/* topics/webapi/scenes.js — Web API (REST) のシーン定義（AGENT.md §7） */
(function () {
  'use strict';
  const esc = TIM.esc;
  const pre = (lang, src) => '<pre data-lang="' + lang + '">' + esc(src) + '</pre>';
  const L = (...lines) => lines.join('\n');
  const clearStamps = (s) => s.$('.stamp').forEach((e) => e.remove());

  const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsInNjb3BlIjoidXNlcnM6cmVhZCB1c2Vyczp3cml0ZSIsImlhdCI6MTc5MDU2NDQwMCwiZXhwIjoxNzkwNTY4MDAwfQ.NXJtp6PdE6Y6VBHmvlWtTVkRcTYEYYSLbBfLXj3OEMk';
  const RID = '7f3c9a0e5b2d4c1f8e6a9b0c3d2e1f40';

  /* =====================================================================
   * SCENE 1 : 1 リクエストが通る経路
   * ===================================================================*/
  const Y = 93;
  const P = { cli: { x: 200, y: Y }, ngxL: { x: 242, y: Y }, ngxR: { x: 442, y: Y }, appL: { x: 486, y: Y }, appR: { x: 686, y: Y }, dbL: { x: 730, y: Y } };
  const src = (s, title, lang, code) => { s.text('srch', title, { flash: false }); return s.set('srcbox', pre(lang, code)); };
  const wire = (s, title, lang, code) => { s.text('wireh', title, { flash: false }); return s.set('wirebox', pre(lang, code)); };

  TIM.scene('#sc-path', {
    intro: '<code>curl https://api.example.com/v1/users/42</code> が、nginx の設定ファイル → Express のミドルウェアとルートハンドラ → PostgreSQL の SQL → JSON と形を変えて戻ってくるまでを、各ホップの実物（左：設定・コード、右：そのホップでのメッセージ）で追います。',
    steps: [
      {
        title: 'クライアントが送るもの',
        text: 'curl（またはブラウザの <code>fetch</code>）が TLS 接続の中に HTTP リクエストを書きます。<code>Host</code> と、認証用の <code>Authorization: Bearer …</code> はクライアントが付けるヘッダです。',
        code: [
          { title: 'shell', lang: 'bash', src: `
            $ curl -s https://api.example.com/v1/users/42 \\
                -H 'Accept: application/json' \\
                -H "Authorization: Bearer $TOKEN"` },
          { title: 'ブラウザ（SPA）', lang: 'js', src: `
            const res = await fetch('https://api.example.com/v1/users/42', {
              headers: { Accept: 'application/json', Authorization: \`Bearer \${token}\` },
            });` },
        ],
        run: async (s) => {
          s.line(P.cli, P.ngxL, {});
          s.line(P.ngxR, P.appL, {});
          s.line(P.appR, P.dbL, {});
          src(s, 'shell（client 198.51.100.23）', 'bash', L('$ curl -s https://api.example.com/v1/users/42 \\', '    -H \'Accept: application/json\' \\', '    -H "Authorization: Bearer $TOKEN"'));
          wire(s, 'client → nginx（TLS の中身）', 'http', L('GET /v1/users/42 HTTP/1.1', 'Host: api.example.com', 'User-Agent: curl/8.21.0', 'Accept: application/json', 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs…'));
          await s.fly(P.cli, P.ngxL, { label: 'GET /v1/users/42 (TLS)', arc: -30 });
          s.state('ngx', 'active');
        },
      },
      {
        title: 'nginx：TLS を終端し、server_name と location で行き先を決める',
        text: 'nginx は <code>ssl_certificate</code> の鍵で TLS を終端（復号）し、<code>Host: api.example.com</code> に一致する <code>server</code> ブロックを選び、パス <code>/v1/users/42</code> に最長一致する <code>location /v1/</code> を選びます。',
        code: { title: '/etc/nginx/conf.d/api.conf', lang: 'text', src: `
          server {
              listen 443 ssl;
              ⟪server_name api.example.com;⟫
              ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
              ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

              ⟪location /v1/ {⟫
                  proxy_pass http://app;     # upstream app { server 127.0.0.1:3000; }
              }
          }` },
        run: async (s) => {
          s.state('ngx', 'active');
          src(s, '/etc/nginx/conf.d/api.conf', 'text', L('server {', '    listen 443 ssl;', '    ⟪server_name api.example.com;⟫       # ← Host で選ぶ', '    ssl_certificate     …/api.example.com/fullchain.pem;', '    ssl_certificate_key …/api.example.com/privkey.pem;', '', '    ⟪location /v1/ {⟫                    # ← パスで選ぶ', '        proxy_pass http://app;', '    }', '}'));
          wire(s, 'nginx の中（復号後）', 'http', L('GET ⟪/v1/users/42⟫ HTTP/1.1', 'Host: ⟪api.example.com⟫', '', '# TLS はここで終わり。', '# ここから先（→ app）は平文 HTTP'));
          await s.scan('ngx');
        },
      },
      {
        title: 'nginx → app：ヘッダを付け替えて平文で転送',
        text: 'ループバックの <code>127.0.0.1:3000</code> へは平文 HTTP。nginx は <code>proxy_set_header</code> で <b>元のクライアント情報</b>を足します。<code>$proxy_add_x_forwarded_for</code> は既存の <code>X-Forwarded-For</code> に <code>$remote_addr</code> を追記した値、<code>$request_id</code> は nginx が生成する 32 桁の 16 進です。',
        code: { title: '/etc/nginx/conf.d/api.conf（location 内）', lang: 'text', src: `
          location /v1/ {
              proxy_pass http://app;
              proxy_http_version 1.1;
              proxy_set_header Connection "";
              proxy_set_header Host              $host;
              proxy_set_header X-Real-IP         $remote_addr;
              ⟪proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;⟫
              proxy_set_header X-Forwarded-Proto $scheme;
              proxy_set_header X-Request-ID      $request_id;
          }` },
        run: async (s) => {
          s.state('ngx', null);
          src(s, 'location /v1/ { … }', 'text', L('location /v1/ {', '    proxy_pass http://app;', '    proxy_http_version 1.1;', '    proxy_set_header Connection "";', '    proxy_set_header Host              $host;', '    proxy_set_header X-Real-IP         $remote_addr;', '    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;', '    proxy_set_header X-Forwarded-Proto $scheme;', '    proxy_set_header X-Request-ID      $request_id;', '}'));
          wire(s, 'nginx → 127.0.0.1:3000（平文）', 'http', L('GET /v1/users/42 HTTP/1.1', 'Host: api.example.com', '⟪X-Real-IP: 198.51.100.23⟫', '⟪X-Forwarded-For: 198.51.100.23⟫', '⟪X-Forwarded-Proto: https⟫', '⟪X-Request-ID: ' + RID + '⟫', 'User-Agent: curl/8.21.0', 'Accept: application/json', 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs…'));
          await s.fly(P.ngxR, P.appL, { label: 'http://127.0.0.1:3000', arc: -30 });
          s.state('app', 'active');
        },
      },
      {
        title: 'Express：ミドルウェアがヘッダを req に変える',
        text: '<code>trust proxy</code> を <code>loopback</code> にすると、127.0.0.1 から来た <code>X-Forwarded-For</code> / <code>X-Forwarded-Proto</code> が信頼され、<code>req.ip</code> が本当のクライアント IP、<code>req.protocol</code> が <code>https</code> になります。<code>req.params.id</code> は<b>文字列</b> <code>\'42\'</code> です。<code>req.auth</code> はこの API の認証ミドルウェアが JWT を検証して入れた値です。',
        code: { title: 'src/app.js', lang: 'js', src: `
          const express = require('express');
          const app = express();
          app.set(⟪'trust proxy', 'loopback'⟫);   // 127.0.0.1 の X-Forwarded-* を信頼
          app.use(express.json());              // application/json の本文を req.body に
          app.use(requireAuth);                 // Authorization: Bearer → req.auth
          app.use('/v1', require('./routes/users'));
          app.listen(3000, '127.0.0.1');` },
        run: async (s) => {
          s.state('app', 'active');
          src(s, 'src/app.js', 'js', L('const app = express();', 'app.set(\'trust proxy\', \'loopback\');  // X-Forwarded-*', 'app.use(express.json());', 'app.use(requireAuth);           // Bearer → req.auth', 'app.use(\'/v1\', usersRouter);   // GET /users/:id', 'app.listen(3000, \'127.0.0.1\');'));
          wire(s, 'ルートハンドラから見た req', 'js', L('req.method       \'GET\'', 'req.originalUrl  \'/v1/users/42\'', 'req.params       { id: \'42\' }     // 文字列', 'req.ip           \'198.51.100.23\'  // ← XFF', 'req.protocol     \'https\'          // ← XFP', 'req.hostname     \'api.example.com\'', 'req.get(\'x-request-id\')  \'7f3c9a0e…\'', 'req.auth         { sub: \'42\', scope: \'users:read …\' }'));
          await s.scan('app');
        },
      },
      {
        title: 'ルートハンドラ → SQL（プレースホルダ $1）',
        text: 'node-postgres の <code>pool.query(text, values)</code> は SQL 本文と値を<b>別々に</b>送ります（拡張クエリプロトコル）。<code>req.params.id</code> を SQL 文字列に連結しないので、<code>42 OR 1=1</code> が来ても SQL にはなりません。',
        code: { title: 'src/routes/users.js', lang: 'js', src: `
          router.get('/users/:id', async (req, res) => {
            const { rows } = await pool.query(
              \`SELECT id, name, email, created_at, version
                 FROM users WHERE id = ⟪$1⟫\`,
              ⟪[req.params.id]⟫);
            if (rows.length === 0) return notFound(req, res);
            const u = rows[0];
            res.set('ETag', \`"v\${u.version}"\`);
            res.json({ id: u.id, name: u.name, email: u.email, created_at: u.created_at });
          });` },
        run: async (s) => {
          s.state('app', 'active');
          src(s, 'src/routes/users.js', 'js', L('router.get(\'/users/:id\', async (req, res) => {', '  const { rows } = await pool.query(', '    `SELECT id, name, email, created_at, version', '       FROM users WHERE id = ⟪$1⟫`,', '    ⟪[req.params.id]⟫);', '  if (rows.length === 0) return notFound(req, res);', '  const u = rows[0];', '  res.set(\'ETag\', `"v${u.version}"`);', '  res.json({ id: u.id, name: u.name, email: u.email,', '             created_at: u.created_at });', '});'));
          wire(s, 'app → PostgreSQL（Parse / Bind）', 'text', L('Parse:  SELECT id, name, email, created_at,', '               version', '          FROM users WHERE id = $1', 'Bind:   $1 = \'42\'', 'Execute'));
          await s.fly(P.appR, P.dbL, { label: 'SELECT … WHERE id = $1', arc: -30 });
          s.state('db', 'active');
        },
      },
      {
        title: 'DB の行 → JS オブジェクト → JSON',
        text: '<code>timestamptz</code> は JS の <code>Date</code> になり、<code>res.json()</code> 内の <code>JSON.stringify</code> で <code>"2026-09-01T09:12:34.000Z"</code>（RFC 3339 形式の UTC）になります。Express は <code>Content-Type: application/json; charset=utf-8</code> と <code>Content-Length</code> を付けます。',
        code: { title: 'app が返すレスポンス（nginx に渡る前）', lang: 'http', src: `
          HTTP/1.1 200 OK
          X-Powered-By: Express
          ETag: "v7"
          Content-Type: application/json; charset=utf-8
          Content-Length: 92

          {"id":42,"name":"alice","email":"alice@example.com","created_at":"2026-09-01T09:12:34.000Z"}` },
        run: async (s) => {
          await s.fly(P.dbL, P.appR, { label: 'rows[0]', cls: 'c-green', arc: -30 });
          s.state('db', null);
          s.state('app', 'active');
          wire(s, 'console.log(rows[0])', 'js', L('{', '  id: 42,', '  name: \'alice\',', '  email: \'alice@example.com\',', '  created_at: ⟪2026-09-01T09:12:34.000Z⟫,  // Date', '  version: 7', '}'));
          src(s, 'app → nginx（res.json() の結果）', 'http', L('HTTP/1.1 200 OK', 'X-Powered-By: Express', 'ETag: "v7"', 'Content-Type: application/json; charset=utf-8', 'Content-Length: 92', '', '{"id":42,"name":"alice","email":"alice@example.com",', ' "created_at":"⟪2026-09-01T09:12:34.000Z⟫"}', '# ↑ 実際は 1 行・92 バイト'));
        },
      },
      {
        title: 'nginx を通ってクライアントへ（ヘッダが整えられる）',
        text: 'nginx は <code>proxy_hide_header X-Powered-By;</code> で実装の手がかりを消し、<code>Server: nginx</code> を付け、<code>add_header X-Request-ID $request_id always;</code> でリクエスト ID を返します。問い合わせ時にこの ID を聞けば、nginx とアプリの両方のログを突き合わせられます。',
        code: [
          { title: '/etc/nginx/conf.d/api.conf', lang: 'text', src: `
            log_format api '$remote_addr "$request" $status $body_bytes_sent '
                           'rt=$request_time urt=$upstream_response_time rid=$request_id';
            location /v1/ {
                ...
                proxy_hide_header X-Powered-By;
                add_header X-Request-ID $request_id always;
            }` },
          { title: '/var/log/nginx/api.access.log', lang: 'text', src: `
            198.51.100.23 "GET /v1/users/42 HTTP/1.1" 200 92 rt=0.012 urt=0.011 rid=${RID}` },
        ],
        run: async (s) => {
          await s.fly(P.appL, P.ngxR, { label: '200 OK', cls: 'c-green', arc: -30 });
          s.state('app', null);
          await s.fly(P.ngxL, P.cli, { label: '200 OK · 92 B', cls: 'c-green', arc: -30 });
          wire(s, 'nginx → client', 'http', L('HTTP/1.1 200 OK', 'Server: nginx', 'Date: Mon, 28 Sep 2026 03:00:00 GMT', 'Content-Type: application/json; charset=utf-8', 'Content-Length: 92', 'Connection: keep-alive', 'ETag: "v7"', '⟪X-Request-ID: ' + RID + '⟫'));
          src(s, '/var/log/nginx/api.access.log（log_format api）', 'text', L('198.51.100.23 "GET /v1/users/42 HTTP/1.1" 200 92', '    rt=0.012 urt=0.011', '    rid=' + RID, '# ↑ 実際は 1 行。rt = nginx 全体、urt = app の応答時間'));
          s.state('cli', 'ok');
        },
      },
      {
        title: 'クライアントが受け取る',
        text: 'curl なら <code>jq</code> で整形。ブラウザの <code>fetch</code> では、別オリジン（例：<code>app.example.com</code> の SPA）から <code>ETag</code> や <code>X-Request-ID</code> を読むには、サーバーが <code>Access-Control-Expose-Headers</code> で公開している必要があります（<a href="../cors/">CORS</a>）。',
        code: { title: 'fetch（別オリジンの SPA から）', lang: 'js', src: `
          const res = await fetch('https://api.example.com/v1/users/42', {
            headers: { Authorization: \`Bearer \${token}\` },
          });
          res.status;                        // 200
          res.headers.get('content-type');   // 'application/json; charset=utf-8'
          res.headers.get('etag');           // null ← Expose されていないと読めない
          const user = await res.json();     // { id: 42, name: 'alice', ... }` },
        run: async (s) => {
          s.state('cli', 'ok');
          src(s, 'shell', 'bash', L('$ curl -s https://api.example.com/v1/users/42 \\', '    -H "Authorization: Bearer $TOKEN" | jq .', '{', '  "id": 42,', '  "name": "alice",', '  "email": "alice@example.com",', '  "created_at": "2026-09-01T09:12:34.000Z"', '}'));
          wire(s, 'fetch の Response（別オリジンから）', 'js', L('res.ok                   true', 'res.status               200', 'res.headers.get(\'etag\')  null  // 要 Expose', 'await res.json()', '  → { id: 42, name: \'alice\', … }'));
          await s.pulse('cli');
        },
      },
      {
        title: '失敗：proxy_set_header を書き忘れると、全員が 127.0.0.1 になる',
        text: '<code>proxy_set_header</code> がないと、アプリに届く <code>Host</code> は <code>$proxy_host</code>（ここでは upstream 名 <code>app</code>）、<code>X-Forwarded-*</code> はなし。<code>req.ip</code> は全リクエストで <code>127.0.0.1</code> になり、IP 単位のレート制限は全ユーザーで 1 つのバケツを共有し、監査ログから送信元が消えます。',
        code: [
          { title: '書き忘れた設定', lang: 'text', src: `
            location /v1/ {
                proxy_pass http://app;
                # proxy_set_header … がない
            }` },
          { title: 'アプリから見える値', lang: 'js', src: `
            req.get('host')   // 'app'          ← $proxy_host
            req.ip            // '127.0.0.1'    ← 全員同じ
            req.protocol      // 'http'         ← https だったことが分からない
            \`\${req.protocol}://\${req.get('host')}/v1/users/43\`
                              // 'http://app/v1/users/43' ← 壊れた絶対 URL` },
        ],
        run: async (s) => {
          s.state('cli', null);
          src(s, '/etc/nginx/conf.d/api.conf（誤り）', 'text', L('location /v1/ {', '    proxy_pass http://app;', '    ⟪# proxy_set_header … を書き忘れ⟫', '}'));
          await s.fly(P.ngxR, P.appL, { label: 'Host: app / XFF なし', cls: 'c-red', arc: -30 });
          s.state('app', 'bad');
          s.shake('app');
          wire(s, 'アプリから見える値', 'js', L('req.get(\'host\')  \'app\'        // $proxy_host', 'req.ip           \'127.0.0.1\'  // 全員同じ', 'req.protocol     \'http\'', '', '// 絶対 URL を作ると…', '\'http://app/v1/users/43\''));
          await s.caption('送信元 IP・スキーム・ホスト名が消える → レート制限と監査ログが壊れる', { cls: 'bad' });
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 2 : CRUD
   * ===================================================================*/
  const rowsHtml = (list) => '<div class="wl hd"> id  name   email                ver</div>' +
    list.map((r) => '<div class="wl ' + (r[1] || '') + '">' + esc(r[0]) + '</div>').join('');
  const R = {
    r41: [' 41  dave   dave@example.com      v3'],
    r42: [' 42  alice  alice@example.com     v7'],
    dots: ['  …  （id 43〜142）'],
    r143: ['143  erin   erin@example.com      v1'],
  };
  const sql = (s, code) => s.set('sqlbox', pre('text', code), { flash: false });
  const status = (s, text, cls) => { s.cls('st', cls, 'st-ok st-bad st-warn'); return s.text('stv', text); };

  TIM.scene('#sc-crud', {
    intro: '<code>$TOKEN</code>（<code>users:read users:write</code> スコープの JWT）を使って、<code>/v1/users</code> に POST → 一覧 → 1 件取得 → PATCH → DELETE → 404 と操作します。右側は実行された SQL と users テーブルの状態です。',
    steps: [
      {
        title: 'POST /v1/users → 201 Created + Location',
        text: 'コレクションに POST すると、サーバーが ID を採番して <code>201 Created</code>。作成先の URL を <code>Location</code> に入れて返します。本文には作成された表現（サーバーが決めた <code>id</code> と <code>created_at</code> を含む）を返すのが一般的です。',
        code: [
          { title: 'shell', lang: 'bash', src: `
            $ curl -si https://api.example.com/v1/users \\
                -H "Authorization: Bearer $TOKEN" \\
                --json '{"name":"carol","email":"carol@example.com"}'
            HTTP/1.1 ⟪201 Created⟫
            ⟪Location: /v1/users/144⟫
            ETag: "v1"
            Content-Type: application/json; charset=utf-8
            Content-Length: 93

            {"id":144,"name":"carol","email":"carol@example.com","created_at":"2026-09-28T03:00:00.000Z"}` },
          { title: 'SQL', lang: 'text', src: `
            INSERT INTO users (name, email) VALUES ($1, $2)
            RETURNING id, name, email, created_at, version;` },
        ],
        run: async (s) => {
          s.set('rows', rowsHtml([R.r41, R.r42, R.dots, R.r143]), { flash: false });
          await s.term('t', L(
            '$ curl -si https://api.example.com/v1/users -H "Authorization: Bearer $TOKEN" --json \'{"name":"carol","email":"carol@example.com"}\'',
            'HTTP/1.1 201 Created',
            'Location: /v1/users/144',
            'ETag: "v1"',
            'Content-Type: application/json; charset=utf-8',
            'Content-Length: 93',
            '',
            '{"id":144,"name":"carol","email":"carol@example.com","created_at":"2026-09-28T03:00:00.000Z"}'), { clear: true });
          await s.show('sql');
          sql(s, L('INSERT INTO users (name, email)', 'VALUES ($1, $2)', 'RETURNING id, name, email,', '          created_at, version;', '-- $1=\'carol\' $2=\'carol@example.com\''));
          await s.set('rows', rowsHtml([R.r41, R.r42, R.dots, R.r143, ['144  carol  carol@example.com     v1', 'new']]));
          await s.show('st', { fx: 'pop' });
          await status(s, '201 Created', 'st-ok');
        },
      },
      {
        title: '一覧：?page=2&per_page=20 と Link ヘッダ',
        text: 'オフセット方式のページング。次・前・最後のページの URL を <code>Link</code> ヘッダ（RFC 8288）の <code>rel="next"</code> などで返すと、クライアントは URL を組み立てずに辿れます。総件数は本文の <code>total</code> で返しています。',
        code: [
          { title: 'response header（実際は Link が 1 行）', lang: 'http', src: `
            HTTP/1.1 200 OK
            Content-Type: application/json; charset=utf-8
            Link: <https://api.example.com/v1/users?page=3&per_page=20>; ⟪rel="next"⟫,
                  <https://api.example.com/v1/users?page=1&per_page=20>; rel="prev",
                  <https://api.example.com/v1/users?page=8&per_page=20>; rel="last"` },
          { title: 'SQL', lang: 'text', src: `
            SELECT id, name, email, created_at FROM users
             ORDER BY id LIMIT 20 OFFSET 20;
            SELECT count(*) FROM users;` },
        ],
        run: async (s) => {
          s.set('rows', rowsHtml([R.r41, R.r42, R.dots, R.r143, ['144  carol  carol@example.com     v1']]), { flash: false });
          await s.term('t', L(
            '$ curl -si \'https://api.example.com/v1/users?page=2&per_page=20\' -H "Authorization: Bearer $TOKEN"',
            'HTTP/1.1 200 OK',
            'Content-Type: application/json; charset=utf-8',
            'Link: <https://api.example.com/v1/users?page=3&per_page=20>; rel="next", <https://api.example.com/v1/users?page=1&per_page=20>; rel="prev", <https://api.example.com/v1/users?page=8&per_page=20>; rel="last"',
            '',
            '{"data":[{"id":21,"name":"…","email":"…"}, … 20 件 …],"page":2,"per_page":20,"total":144}'), { clear: true });
          sql(s, L('SELECT id, name, email, created_at', '  FROM users', ' ORDER BY id', ' LIMIT 20 OFFSET 20;', 'SELECT count(*) FROM users;  -- 144'));
          await status(s, '200 OK', 'st-ok');
        },
      },
      {
        title: '失敗：オフセットはページ間の削除でずれる → カーソル方式',
        text: '1 ページ目（id 1〜20）を読んだ直後に id 5 が削除されると、<code>OFFSET 20</code> の 2 ページ目は id 22 から始まり、<b>id 21 を読み飛ばします</b>。カーソル方式は「最後に見た id より後」を <code>WHERE id &gt; $1</code> で取るので、削除や追加があってもずれません。<code>LIMIT 21</code> は「次ページがあるか」を知るための 1 件余分です。',
        code: [
          { title: 'shell', lang: 'bash', src: `
            # page=1 を読んだあと、誰かが id=5 を削除した
            $ curl -s '…/v1/users?page=2&per_page=20' | jq '.data[0].id'
            ⟪22⟫           # id 21 を読み飛ばした
            $ curl -s '…/v1/users?limit=20&cursor=eyJpZCI6MjB9' | jq '.data[0].id, .next_cursor'
            21
            "eyJpZCI6NDB9"   # base64url('{"id":40}')` },
          { title: 'SQL（カーソル方式）', lang: 'text', src: `
            SELECT id, name, email, created_at FROM users
             WHERE id > $1        -- cursor を decode → 20
             ORDER BY id
             LIMIT 21;            -- 21 件目があれば next_cursor を返す` },
        ],
        run: async (s) => {
          await s.term('t', L(
            '# page=1 を読んだ直後に id=5 が DELETE された',
            '$ curl -s \'https://api.example.com/v1/users?page=2&per_page=20\' -H "Authorization: Bearer $TOKEN" | jq \'.data[0].id\'',
            '22        # ← id 21 が抜けた',
            '$ curl -s \'https://api.example.com/v1/users?limit=20&cursor=eyJpZCI6MjB9\' -H "Authorization: Bearer $TOKEN" | jq \'.data[0].id, .next_cursor\'',
            '21',
            '"eyJpZCI6NDB9"'), { clear: true });
          sql(s, L('SELECT id, name, email, created_at', '  FROM users', ' WHERE id > $1   -- cursor → 20', ' ORDER BY id', ' LIMIT 21;       -- 21 件目 = 次あり'));
          await status(s, 'offset → cursor', 'st-warn');
          await s.caption('オフセットは「位置」、カーソルは「最後に見たキー」で続きを取る', { cls: 'bad' });
        },
      },
      {
        title: 'GET /v1/users/42 → 200 + ETag',
        text: '1 件取得。レスポンスの <code>ETag: "v7"</code> は行の <code>version</code> 列から作っています。更新時にこの値を <code>If-Match</code> に入れて送れば、他人の更新を上書きする事故を防げます（後述の 412）。',
        code: { title: 'shell', lang: 'bash', src: `
          $ curl -si https://api.example.com/v1/users/42 -H "Authorization: Bearer $TOKEN"
          HTTP/1.1 200 OK
          ⟪ETag: "v7"⟫
          Content-Type: application/json; charset=utf-8

          {"id":42,"name":"alice","email":"alice@example.com","created_at":"2026-09-01T09:12:34.000Z"}` },
        run: async (s) => {
          s.caption('');
          await s.term('t', L(
            '$ curl -si https://api.example.com/v1/users/42 -H "Authorization: Bearer $TOKEN"',
            'HTTP/1.1 200 OK',
            'ETag: "v7"',
            'Content-Type: application/json; charset=utf-8',
            'Content-Length: 92',
            '',
            '{"id":42,"name":"alice","email":"alice@example.com","created_at":"2026-09-01T09:12:34.000Z"}'), { clear: true });
          sql(s, L('SELECT id, name, email,', '       created_at, version', '  FROM users WHERE id = $1;', '-- $1=\'42\'  → version 7'));
          s.set('rows', rowsHtml([R.r41, [R.r42[0], 'upd'], R.dots, R.r143, ['144  carol  carol@example.com     v1']]), { flash: false });
          await status(s, '200 OK', 'st-ok');
        },
      },
      {
        title: 'PATCH /v1/users/42（merge patch + If-Match）→ 200',
        text: '<code>application/merge-patch+json</code> で email だけ送ります。<code>If-Match: "v7"</code> を付けているので、サーバーは <code>WHERE id = $2 AND version = $3</code> で「まだ v7 のときだけ」更新し、成功すると新しい <code>ETag: "v8"</code> を返します。',
        code: [
          { title: 'shell', lang: 'bash', src: `
            $ curl -si -X PATCH https://api.example.com/v1/users/42 \\
                -H "Authorization: Bearer $TOKEN" \\
                -H 'Content-Type: application/merge-patch+json' \\
                -H 'If-Match: "v7"' \\
                -d '{"email":"alice@example.net"}'
            HTTP/1.1 200 OK
            ⟪ETag: "v8"⟫` },
          { title: 'SQL', lang: 'text', src: `
            UPDATE users SET email = $1, version = version + 1
             WHERE id = $2 AND ⟪version = $3⟫
            RETURNING id, name, email, created_at, version;` },
        ],
        run: async (s) => {
          await s.term('t', L(
            '$ curl -si -X PATCH https://api.example.com/v1/users/42 -H "Authorization: Bearer $TOKEN" -H \'Content-Type: application/merge-patch+json\' -H \'If-Match: "v7"\' -d \'{"email":"alice@example.net"}\'',
            'HTTP/1.1 200 OK',
            'ETag: "v8"',
            'Content-Type: application/json; charset=utf-8',
            '',
            '{"id":42,"name":"alice","email":"alice@example.net","created_at":"2026-09-01T09:12:34.000Z"}'), { clear: true });
          sql(s, L('UPDATE users', '   SET email = $1,', '       version = version + 1', ' WHERE id = $2 AND version = $3', 'RETURNING …;', '-- $1=\'alice@example.net\' $2=\'42\' $3=7'));
          await s.set('rows', rowsHtml([R.r41, [' 42  alice  alice@example.net     v8', 'upd'], R.dots, R.r143, ['144  carol  carol@example.com     v1']]));
          await status(s, '200 OK', 'st-ok');
        },
      },
      {
        title: 'DELETE /v1/users/144 → 204 No Content',
        text: '削除成功は本文なしの <code>204</code>。この API では削除に <code>users:delete</code> スコープが必要なので、管理者用トークン <code>$ADMIN_TOKEN</code> を使っています（スコープ不足なら 403。次のシーン）。<code>rowCount</code> が 0 なら 404 を返します。',
        code: { title: 'shell', lang: 'bash', src: `
          $ curl -si -X DELETE https://api.example.com/v1/users/144 \\
              -H "Authorization: Bearer $ADMIN_TOKEN"
          HTTP/1.1 ⟪204 No Content⟫` },
        run: async (s) => {
          await s.term('t', L(
            '$ curl -si -X DELETE https://api.example.com/v1/users/144 -H "Authorization: Bearer $ADMIN_TOKEN"',
            'HTTP/1.1 204 No Content',
            '',
            '# 本文なし'), { clear: true });
          sql(s, L('DELETE FROM users WHERE id = $1;', '-- $1=\'144\'  → rowCount = 1', '-- rowCount = 0 なら 404'));
          await s.set('rows', rowsHtml([R.r41, [' 42  alice  alice@example.net     v8'], R.dots, R.r143, ['144  carol  carol@example.com     v1', 'gone']]));
          await status(s, '204 No Content', 'st-ok');
        },
      },
      {
        title: '消した ID を GET → 404（problem+json）',
        text: '存在しないリソースは <code>404</code>。本文は <code>application/problem+json</code>（RFC 9457）で、<code>type</code> <code>title</code> <code>status</code> <code>detail</code> <code>instance</code> を返します。クライアントは <code>type</code> で分岐し、<code>detail</code> は人間向けの表示にだけ使います。',
        code: { title: 'shell', lang: 'bash', src: `
          $ curl -si https://api.example.com/v1/users/144 -H "Authorization: Bearer $TOKEN"
          HTTP/1.1 404 Not Found
          Content-Type: ⟪application/problem+json⟫

          {"type":"https://api.example.com/problems/not-found","title":"Resource not found",
           "status":404,"detail":"User 144 does not exist","instance":"/v1/users/144"}` },
        run: async (s) => {
          await s.term('t', L(
            '$ curl -si https://api.example.com/v1/users/144 -H "Authorization: Bearer $TOKEN"',
            'HTTP/1.1 404 Not Found',
            'Content-Type: application/problem+json',
            '',
            '{"type":"https://api.example.com/problems/not-found","title":"Resource not found","status":404,"detail":"User 144 does not exist","instance":"/v1/users/144"}'), { clear: true });
          sql(s, L('SELECT id, name, email,', '       created_at, version', '  FROM users WHERE id = $1;', '-- $1=\'144\' → 0 rows → 404'));
          s.set('rows', rowsHtml([R.r41, [' 42  alice  alice@example.net     v8'], R.dots, R.r143]), { flash: false });
          await status(s, '404 Not Found', 'st-bad');
        },
      },
      {
        title: 'fetch では 404 でも例外にならない',
        text: '<code>fetch()</code> が reject するのはネットワークエラー（DNS 失敗・接続拒否・CORS 拒否など）だけです。4xx / 5xx は<b>正常に解決された Response</b> なので、<code>res.ok</code>（200〜299 なら true）か <code>res.status</code> を必ず確認します。',
        code: { title: 'DevTools Console', lang: 'js', src: `
          const r = await fetch('https://api.example.com/v1/users/144', {
            headers: { Authorization: \`Bearer \${token}\` },
          });
          r.ok                          // false  ← ここを見ないと成功扱いになる
          r.status                      // 404
          r.headers.get('content-type') // 'application/problem+json'
          (await r.json()).detail       // 'User 144 does not exist'` },
        run: async (s) => {
          await s.term('t', L(
            '// DevTools Console',
            '> const r = await fetch(\'https://api.example.com/v1/users/144\', { headers: { Authorization: `Bearer ${token}` } })',
            'undefined',
            '> r.ok',
            'false',
            '> r.status',
            '404',
            '> r.headers.get(\'content-type\')',
            '\'application/problem+json\'',
            '> (await r.json()).detail',
            '\'User 144 does not exist\''), { clear: true, lineDelay: 90 });
          await status(s, 'res.ok === false', 'st-bad');
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 3 : 認証ヘッダ
   * ===================================================================*/
  const C = { x: 220, y: 55 }, A = { x: 330, y: 55 };
  const req3 = (s, code) => s.set('reqbox', pre('http', code), { flash: false });
  const res3 = (s, code) => s.set('resbox', pre('http', code));
  const chk = (s, v) => ['c1', 'c2', 'c3', 'c4', 'c5'].forEach((k, i) => s.set(k, v[i], { flash: false }));
  const OK = (t) => '<span style="color:var(--green)">✓ ' + t + '</span>';
  const NG = (t) => '<span style="color:var(--red)">✗ ' + t + '</span>';
  const jwtSeg = (s, h, p, sig) => { s.text('jh', h, { flash: false }); s.text('jp', p, { flash: false }); s.text('js', sig, { flash: false }); };

  TIM.scene('#sc-auth', {
    intro: '同じ <code>GET /v1/users/42</code> に、認証ヘッダなし → 正しい JWT → 期限切れ → 改ざん → スコープ不足 → API キー の順でリクエストし、API の <code>requireAuth</code> がどこを見て 401 / 403 / 200 を決めるかを追います。',
    steps: [
      {
        title: 'Authorization なし → 401 + WWW-Authenticate',
        text: '認証情報がなければ <code>401 Unauthorized</code>。401 には <code>WWW-Authenticate</code> ヘッダが必須（RFC 9110 §15.5.2）で、「どの方式で認証すればよいか」を伝えます。Bearer トークンなら <code>Bearer realm="api"</code>。',
        code: { title: 'src/auth.js（requireAuth）', lang: 'js', src: `
          const jwt = require('jsonwebtoken');
          function requireAuth(req, res, next) {
            const m = /^Bearer (\\S+)$/.exec(req.get('Authorization') || '');
            if (!m) return problem(res, 401, ⟪{ 'WWW-Authenticate': 'Bearer realm="api"' }⟫);
            try {
              req.auth = jwt.verify(m[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
              next();
            } catch (e) {
              const desc = e.name === 'TokenExpiredError' ? 'The access token expired' : 'Invalid token';
              problem(res, 401, { 'WWW-Authenticate':
                \`Bearer realm="api", error="invalid_token", error_description="\${desc}"\` });
            }
          }` },
        run: async (s) => {
          await s.show('chk');
          req3(s, L('GET /v1/users/42 HTTP/1.1', 'Host: api.example.com', 'Accept: application/json', '# Authorization ヘッダなし'));
          chk(s, ['—', '—', '—', '—', NG('401')]);
          await s.fly(C, A, { label: 'GET /v1/users/42', arc: -24 });
          s.state('api', 'bad');
          s.stamp('api', '401', { cls: 'st-bad' });
          await s.fly(A, C, { label: '401', cls: 'c-red', arc: -24 });
          res3(s, L('HTTP/1.1 401 Unauthorized', '⟪WWW-Authenticate: Bearer realm="api"⟫', 'Content-Type: application/problem+json', '', '{"type":"about:blank","title":"Unauthorized","status":401}'));
        },
      },
      {
        title: 'Bearer JWT → 署名・exp・scope を検証 → 200',
        text: 'JWT は <code>header.payload.signature</code> の 3 つを base64url で <code>.</code> 連結したもの。API は <code>HMAC-SHA256(JWT_SECRET, header + "." + payload)</code> を計算して署名と比べ、<code>exp</code>（2026-09-28T04:00:00Z）と <code>scope</code> を確認します。詳しくは <a href="../jwt/">JWT</a>。',
        code: { title: 'payload（base64url をデコード）', lang: 'json', src: `
          {
            "sub": "42",
            "scope": "users:read users:write",
            "iat": 1790564400,
            "exp": ⟪1790568000⟫
          }
          // 1790568000 = 2026-09-28T04:00:00Z（いまは 03:00:00Z）` },
        run: async (s) => {
          clearStamps(s);
          s.state('api', null);
          req3(s, L('GET /v1/users/42 HTTP/1.1', 'Host: api.example.com', '⟪Authorization: Bearer ' + JWT.slice(0, 50) + '…⟫'));
          jwtSeg(s, 'eyJhbGciOiJIUzI1Ni…', '…ZXhwIjoxNzkwNTY4MDAwfQ', 'NXJtp6PdE6Y6VBHmvl…');
          await s.show('jwt', { fx: 'up' });
          await s.fly(C, A, { label: 'Bearer eyJ…', arc: -24 });
          await s.scan('api');
          chk(s, ['Bearer JWT (HS256)', OK('HMAC-SHA256 一致'), OK('04:00:00Z まで有効'), OK('users:read'), OK('200 OK')]);
          s.state('api', 'ok');
          s.stamp('api', '200', { cls: 'st-ok' });
          await s.fly(A, C, { label: '200 OK', cls: 'c-green', arc: -24 });
          res3(s, L('HTTP/1.1 200 OK', 'Content-Type: application/json; charset=utf-8', 'ETag: "v7"', '', '{"id":42,"name":"alice","email":"alice@example.com", …}'));
        },
      },
      {
        title: '失敗：期限切れ → 401 error="invalid_token"',
        text: '<code>exp</code> = 1790553600（2026-09-28T00:00:00Z）のトークン。署名は正しくても期限切れは <code>401</code>。RFC 6750 §3 の <code>error="invalid_token"</code> と <code>error_description</code> で理由を返すと、クライアントはリフレッシュトークンで取り直せばよいと判断できます。',
        code: { title: 'response（WWW-Authenticate は実際は 1 行）', lang: 'http', src: `
          HTTP/1.1 401 Unauthorized
          WWW-Authenticate: Bearer realm="api", ⟪error="invalid_token"⟫,
                            error_description="The access token expired"` },
        run: async (s) => {
          clearStamps(s);
          s.state('api', null);
          req3(s, L('GET /v1/users/42 HTTP/1.1', 'Host: api.example.com', 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0Mi…'));
          s.show('jwt');
          jwtSeg(s, 'eyJhbGciOiJIUzI1Ni…', '…ZXhwIjoxNzkwNTUzNjAwfQ', 'GsVuw5S5GJQIMwuK7Z…');
          await s.fly(C, A, { label: 'Bearer eyJ…（期限切れ）', arc: -24 });
          await s.scan('api');
          chk(s, ['Bearer JWT (HS256)', OK('HMAC-SHA256 一致'), NG('00:00:00Z で失効'), '—', NG('401 invalid_token')]);
          s.state('api', 'bad');
          s.stamp('api', '401', { cls: 'st-bad' });
          await s.fly(A, C, { label: '401', cls: 'c-red', arc: -24 });
          res3(s, L('HTTP/1.1 401 Unauthorized', 'WWW-Authenticate: Bearer realm="api", error="invalid_token",', '                  error_description="The access token expired"', '# ↑ 実際は 1 行'));
        },
      },
      {
        title: '失敗：payload を書き換えると署名が合わない → 401',
        text: '攻撃者が payload の <code>scope</code> を <code>admin</code> に書き換えて base64url し直しても、署名は元のまま。サーバーが再計算した HMAC は <code>7jV9xDHNxot5…</code> で、送られてきた <code>NXJtp6PdE6Y6…</code> と一致しないので拒否します。鍵を知らない限り正しい署名は作れません。',
        code: { title: '検証（サーバー内部）', lang: 'text', src: `
          payload(改ざん) = {"sub":"42","scope":"⟪admin⟫","iat":1790564400,"exp":1790568000}
          HMAC-SHA256(JWT_SECRET, header.payload) = ⟪7jV9xDHNxot5ZqvOtxvdj7n0TfGN06WBJlUPjb5xGLA⟫
          送られてきた signature                   = NXJtp6PdE6Y6VBHmvlWtTVkRcTYEYYSLbBfLXj3OEMk
          → 不一致: JsonWebTokenError: invalid signature → 401 invalid_token` },
        run: async (s) => {
          clearStamps(s);
          s.state('api', null);
          req3(s, L('GET /v1/users/42 HTTP/1.1', 'Host: api.example.com', 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0Mi…'));
          s.show('jwt');
          jwtSeg(s, 'eyJhbGciOiJIUzI1Ni…', '…InNjb3BlIjoiYWRtaW4i…', 'NXJtp6PdE6Y6VBHmvl…');
          s.state('jwt', 'bad');
          await s.fly(C, A, { label: 'Bearer（scope=admin に改ざん）', cls: 'c-red', arc: -24 });
          await s.scan('api');
          chk(s, ['Bearer JWT (HS256)', NG('7jV9xDHN… ≠ NXJtp6Pd…'), '—', '—', NG('401 invalid_token')]);
          s.state('api', 'bad');
          s.shake('api');
          s.stamp('api', '401', { cls: 'st-bad' });
          await s.fly(A, C, { label: '401', cls: 'c-red', arc: -24 });
          res3(s, L('HTTP/1.1 401 Unauthorized', 'WWW-Authenticate: Bearer realm="api", error="invalid_token",', '                  error_description="Invalid token"'));
        },
      },
      {
        title: '本人だが権限不足 → 403 insufficient_scope',
        text: 'トークンは正しく、誰なのか（<code>sub: "42"</code>）は分かった。しかし <code>DELETE</code> には <code>users:delete</code> スコープが要る。これは<b>認証（401）ではなく認可（403）</b>の失敗です。RFC 6750 §3.1 は <code>insufficient_scope</code> に 403 を使うよう定めています。',
        code: { title: 'src/routes/users.js', lang: 'js', src: `
          const needScope = (sc) => (req, res, next) =>
            req.auth.scope.split(' ').includes(sc) ? next()
              : problem(res, 403, { 'WWW-Authenticate':
                  \`Bearer error="insufficient_scope", scope="\${sc}"\` });

          router.delete('/users/:id', ⟪needScope('users:delete')⟫, deleteUser);` },
        run: async (s) => {
          clearStamps(s);
          s.state('api jwt', null);
          req3(s, L('⟪DELETE⟫ /v1/users/42 HTTP/1.1', 'Host: api.example.com', 'Authorization: Bearer ' + JWT.slice(0, 50) + '…'));
          jwtSeg(s, 'eyJhbGciOiJIUzI1Ni…', '…ZXhwIjoxNzkwNTY4MDAwfQ', 'NXJtp6PdE6Y6VBHmvl…');
          s.show('jwt');
          await s.fly(C, A, { label: 'DELETE /v1/users/42', arc: -24 });
          await s.scan('api');
          chk(s, ['Bearer JWT (HS256)', OK('一致'), OK('有効'), NG('users:delete がない'), NG('403 Forbidden')]);
          s.state('api', 'warn');
          s.stamp('api', '403', { cls: 'st-warn' });
          await s.fly(A, C, { label: '403', cls: 'c-amber', arc: -24 });
          res3(s, L('HTTP/1.1 403 Forbidden', '⟪WWW-Authenticate: Bearer error="insufficient_scope", scope="users:delete"⟫', 'Content-Type: application/problem+json', '', '{"type":"about:blank","title":"Forbidden","status":403,', ' "detail":"scope users:delete is required"}'));
        },
      },
      {
        title: 'API キー方式：ハッシュで照合する',
        text: 'サーバー間連携では長期の API キーもよく使われます。ヘッダ名は API 独自（ここでは <code>X-API-Key</code>）。サーバーは<b>平文を保存せず</b>、受け取ったキーの SHA-256 を <code>api_keys.key_hash</code> と照合し、失効（<code>revoked_at</code>）とスコープを確認します。',
        code: [
          { title: 'src/auth.js', lang: 'js', src: `
            const hash = crypto.createHash('sha256').update(req.get('X-API-Key')).digest('hex');
            const { rows } = await pool.query(
              'SELECT owner_id, scopes FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL',
              [hash]);` },
          { title: 'shell', lang: 'bash', src: `
            $ printf '%s' 'demo_k7Qx2mN9pL4vR8sT1wZ3' | openssl dgst -sha256
            SHA2-256(stdin)= ⟪da5afbfff67793a050d96fceb39ad62025e5fb7e97d8fb01c04811fca8734f92⟫` },
        ],
        run: async (s) => {
          clearStamps(s);
          s.state('api', null);
          s.hide('jwt', { dur: 200 });
          req3(s, L('GET /v1/users/42 HTTP/1.1', 'Host: api.example.com', '⟪X-API-Key: demo_k7Qx2mN9pL4vR8sT1wZ3⟫'));
          await s.fly(C, A, { label: 'X-API-Key', arc: -24 });
          await s.scan('keys');
          chk(s, ['API キー（X-API-Key）', OK('sha256 = key_hash'), OK('revoked_at IS NULL'), OK('users:read'), OK('200 OK')]);
          await s.show('why');
          s.set('why', 'sha256 = <code>da5afbff…8734f92</code> を <code>api_keys.key_hash</code> で検索。DB が漏れても鍵そのものは漏れない');
          s.state('api', 'ok');
          s.stamp('api', '200', { cls: 'st-ok' });
          await s.fly(A, C, { label: '200 OK', cls: 'c-green', arc: -24 });
          res3(s, L('HTTP/1.1 200 OK', 'Content-Type: application/json; charset=utf-8', '', '{"id":42,"name":"alice","email":"alice@example.com", …}'));
        },
      },
      {
        title: '失敗：API キーをクエリ文字列に入れるとログに残る',
        text: '<code>?api_key=…</code> は URL の一部なので、nginx の access.log（<code>$request</code>）、ブラウザ履歴、<code>Referer</code>、監視ツールにそのまま記録されます。認証情報はヘッダで送ります。',
        code: { title: '/var/log/nginx/api.access.log', lang: 'text', src: `
          198.51.100.23 "GET /v1/users/42?⟪api_key=demo_k7Qx2mN9pL4vR8sT1wZ3⟫ HTTP/1.1" 200 92 rt=0.010 …` },
        run: async (s) => {
          clearStamps(s);
          s.state('api', null);
          req3(s, L('GET /v1/users/42?⟪api_key=demo_k7Qx2mN9pL4vR8sT1wZ3⟫ HTTP/1.1', 'Host: api.example.com'));
          await s.fly(C, A, { label: '?api_key=…', cls: 'c-amber', arc: -24 });
          chk(s, ['API キー（クエリ）', OK('一致'), '—', OK('users:read'), '<span style="color:var(--amber)">△ 200 だが鍵が漏洩</span>']);
          s.set('why', 'URL はログ・履歴・Referer に残る。<b>鍵はヘッダで</b>');
          s.state('keys', 'warn');
          s.set('resbox', pre('text', L('# /var/log/nginx/api.access.log', '198.51.100.23 "GET /v1/users/42?api_key=demo_k7Qx2mN9pL4vR8sT1wZ3', '    HTTP/1.1" 200 92 rt=0.010 …', '# ↑ 平文の鍵がログファイルに')));
          await s.caption('ログを読める人全員が API キーを使えてしまう', { cls: 'bad' });
        },
      },
      {
        title: 'まとめ：401 と 403',
        text: '<b>401</b> は「あなたが誰か分からない／証明が無効」— 認証をやり直せば通る可能性がある。<b>403</b> は「誰かは分かったが許可しない」— 同じ資格情報で何度送っても通らない。どちらも本文は problem+json で理由を返します。',
        code: { title: '判定の順序', lang: 'text', src: `
          Authorization がない / 形式不正     → 401（WWW-Authenticate: Bearer realm="api"）
          署名不一致・期限切れ・失効          → 401（error="invalid_token"）
          本人確認 OK・スコープ／権限不足     → 403（error="insufficient_scope"）
          本人確認 OK・権限 OK・対象がない    → 404` },
        run: async (s) => {
          clearStamps(s);
          s.state('api keys', null);
          s.caption('');
          s.hide('why chk', { dur: 200 });
          req3(s, L('# 認証（Authentication）: あなたは誰？', '#   → 失敗は 401 + WWW-Authenticate', '# 認可（Authorization）  : それをしてよい？', '#   → 失敗は 403'));
          res3(s, L('HTTP/1.1 401 Unauthorized   # 資格情報を取り直せば通る', 'HTTP/1.1 403 Forbidden      # 同じ資格情報では何度でも拒否'));
          await s.pulse('req res');
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 4 : 並行更新・冪等性・レート制限
   * ===================================================================*/
  const AL = { x: 210, y: 55 }, BO = { x: 210, y: 155 }, API = { x: 320, y: 105 };
  const msg4 = (s, title, lang, code) => { s.text('msgh', title, { flash: false }); return s.set('msgbox', pre(lang, code)); };
  const side = async (s, title, lang, code) => { await s.show('side'); s.text('sideh', title, { flash: false }); return s.set('sidebox', pre(lang, code)); };
  const rowv = (s, name, email, ver) => { s.text('r-name', name, { flash: false }); s.text('r-email', email, { flash: false }); s.text('r-ver', ver + ' → ETag "v' + ver + '"', { flash: false }); };
  const IK = '"8e03978e-40d5-43e8-bc93-6894a57f9324"';

  TIM.scene('#sc-conflict', {
    intro: 'Alice と Bob が同じユーザー（id=42）を別タブで編集します。<code>If-Match</code> がないと後勝ちで変更が消える場面、<code>412</code> で止める場面、POST の再送を <code>Idempotency-Key</code> で安全にする場面、<code>429</code> で止められる場面を順に見ます。',
    steps: [
      {
        title: 'Alice と Bob が同じ行を GET（どちらも ETag "v7"）',
        text: '2 人とも <code>GET /v1/users/42</code> で編集画面を開き、<code>ETag: "v7"</code> を受け取りました。画面にはこの ETag を保持しておきます。',
        code: { title: 'response（2 人とも同じ）', lang: 'http', src: `
          HTTP/1.1 200 OK
          ⟪ETag: "v7"⟫
          Content-Type: application/json; charset=utf-8

          {"id":42,"name":"alice","email":"alice@example.com", …}` },
        run: async (s) => {
          rowv(s, 'alice', 'alice@example.com', 7);
          s.fly(AL, API, { label: 'GET', arc: -16, dur: 700 });
          await s.fly(BO, API, { label: 'GET', arc: 16, dur: 700 });
          s.fly(API, AL, { label: '200 · "v7"', cls: 'c-green', arc: 16, dur: 700 });
          await s.fly(API, BO, { label: '200 · "v7"', cls: 'c-green', arc: -16, dur: 700 });
          s.show('ea eb', { fx: 'pop' });
          s.text('ea', 'ETag "v7"', { flash: false });
          s.text('eb', 'ETag "v7"', { flash: false });
          msg4(s, 'GET /v1/users/42 → 200（Alice も Bob も）', 'http', L('HTTP/1.1 200 OK', '⟪ETag: "v7"⟫', 'Content-Type: application/json; charset=utf-8', '', '{"id":42,"name":"alice","email":"alice@example.com", …}'));
        },
      },
      {
        title: 'Alice が If-Match: "v7" で PATCH → 200、ETag は "v8" に',
        text: 'サーバーは <code>UPDATE … WHERE id = 42 AND version = 7</code> を実行。1 行更新できたので成功し、version は 8、新しい ETag は <code>"v8"</code> です。',
        code: { title: 'request / response', lang: 'http', src: `
          PATCH /v1/users/42 HTTP/1.1
          Content-Type: application/merge-patch+json
          ⟪If-Match: "v7"⟫

          {"name":"Alice Smith"}

          HTTP/1.1 200 OK
          ETag: "v8"` },
        run: async (s) => {
          await s.fly(AL, API, { label: 'PATCH If-Match "v7"', arc: -16 });
          await side(s, 'SQL（楽観的ロック）', 'text', L('UPDATE users', '   SET name = $1, version = version + 1', ' WHERE id = $2 AND ⟪version = $3⟫;', '-- $3 = 7 → ⟪rowCount = 1⟫ → 200'));
          rowv(s, 'Alice Smith', 'alice@example.com', 8);
          s.pulse('row');
          await s.fly(API, AL, { label: '200 · "v8"', cls: 'c-green', arc: 16 });
          await s.text('ea', 'ETag "v8"');
          msg4(s, 'Alice: PATCH → 200', 'http', L('PATCH /v1/users/42 HTTP/1.1', 'Content-Type: application/merge-patch+json', '⟪If-Match: "v7"⟫', '', '{"name":"Alice Smith"}', '', 'HTTP/1.1 200 OK', 'ETag: "v8"'));
        },
      },
      {
        title: '失敗：Bob が古い "v7" で PATCH → 412 Precondition Failed',
        text: 'Bob の画面はまだ v7 を元にしています。<code>If-Match: "v7"</code> は現在の <code>"v8"</code> と一致しないので、SQL の <code>rowCount</code> は 0、API は <code>412</code> を返します。<b>If-Match がなければ Bob の保存が Alice の変更を黙って上書きしていました</b>（lost update）。',
        code: { title: 'request / response', lang: 'http', src: `
          PATCH /v1/users/42 HTTP/1.1
          Content-Type: application/merge-patch+json
          ⟪If-Match: "v7"⟫

          {"email":"bob-edit@example.com"}

          HTTP/1.1 412 Precondition Failed
          Content-Type: application/problem+json

          {"type":"https://api.example.com/problems/stale-etag","title":"Precondition Failed",
           "status":412,"detail":"If-Match \\"v7\\" does not match current ETag \\"v8\\""}` },
        run: async (s) => {
          await s.fly(BO, API, { label: 'PATCH If-Match "v7"', cls: 'c-orange', arc: 16 });
          await side(s, 'SQL（楽観的ロック）', 'text', L('UPDATE users', '   SET email = $1, version = version + 1', ' WHERE id = $2 AND ⟪version = $3⟫;', '-- $3 = 7 だが現在 8 → ⟪rowCount = 0⟫ → 412'));
          s.state('api', 'bad');
          s.stamp('api', '412', { cls: 'st-bad' });
          await s.fly(API, BO, { label: '412', cls: 'c-red', arc: -16 });
          s.state('bo', 'bad');
          s.shake('bo');
          msg4(s, 'Bob: PATCH → 412', 'http', L('HTTP/1.1 412 Precondition Failed', 'Content-Type: application/problem+json', '', '{"type":"https://api.example.com/problems/stale-etag",', ' "title":"Precondition Failed","status":412,', ' "detail":"If-Match \\"v7\\" does not match current ETag \\"v8\\""}'));
          await s.caption('Alice の変更は守られた。Bob は再取得してやり直す', { cls: 'bad' });
        },
      },
      {
        title: '失敗：If-Match を付けずに PATCH → 428 Precondition Required',
        text: 'クライアントが If-Match を付け忘れると楽観的ロックが効きません。そこで API 側で「条件付きでなければ受け付けない」ようにし、<code>428 Precondition Required</code>（RFC 6585）を返します。openapi.yaml でも <code>If-Match</code> を <code>required: true</code> にしています。',
        code: { title: 'response', lang: 'http', src: `
          HTTP/1.1 428 Precondition Required
          Content-Type: application/problem+json

          {"type":"about:blank","title":"Precondition Required","status":428,
           "detail":"PATCH requires If-Match"}` },
        run: async (s) => {
          clearStamps(s);
          s.state('api bo', null);
          s.caption('');
          await s.fly(BO, API, { label: 'PATCH（If-Match なし）', cls: 'c-orange', arc: 16 });
          s.state('api', 'warn');
          s.stamp('api', '428', { cls: 'st-warn' });
          await s.fly(API, BO, { label: '428', cls: 'c-amber', arc: -16 });
          msg4(s, 'Bob: If-Match なし → 428', 'http', L('HTTP/1.1 428 Precondition Required', 'Content-Type: application/problem+json', '', '{"type":"about:blank","title":"Precondition Required",', ' "status":428,"detail":"PATCH requires If-Match"}'));
        },
      },
      {
        title: 'Bob は GET し直して "v8" で再送 → 200（"v9"）',
        text: 'Bob の画面は最新（Alice の名前変更を含む v8）を取り直し、自分の変更を乗せて <code>If-Match: "v8"</code> で送ります。今度は一致するので成功し、version は 9 になります。',
        code: { title: 'request / response', lang: 'http', src: `
          PATCH /v1/users/42 HTTP/1.1
          Content-Type: application/merge-patch+json
          ⟪If-Match: "v8"⟫

          {"email":"bob-edit@example.com"}

          HTTP/1.1 200 OK
          ETag: "v9"` },
        run: async (s) => {
          clearStamps(s);
          s.state('api', null);
          await s.fly(BO, API, { label: 'GET', cls: 'c-orange', arc: 16, dur: 700 });
          await s.fly(API, BO, { label: '200 · "v8"', cls: 'c-green', arc: -16, dur: 700 });
          await s.text('eb', 'ETag "v8"');
          await s.fly(BO, API, { label: 'PATCH If-Match "v8"', cls: 'c-orange', arc: 16 });
          rowv(s, 'Alice Smith', 'bob-edit@example.com', 9);
          await side(s, 'SQL（楽観的ロック）', 'text', L('UPDATE users', '   SET email = $1, version = version + 1', ' WHERE id = $2 AND version = $3;', '-- $3 = 8 → rowCount = 1 → 200'));
          await s.fly(API, BO, { label: '200 · "v9"', cls: 'c-green', arc: -16 });
          await s.text('eb', 'ETag "v9"');
          s.state('bo', 'ok');
          msg4(s, 'Bob: 再取得して PATCH → 200', 'http', L('PATCH /v1/users/42 HTTP/1.1', 'Content-Type: application/merge-patch+json', '⟪If-Match: "v8"⟫', '', '{"email":"bob-edit@example.com"}', '', 'HTTP/1.1 200 OK', 'ETag: "v9"'));
        },
      },
      {
        title: '失敗：POST の応答がタイムアウト（でもサーバーは作成済み）',
        text: 'Alice が新規ユーザーを POST。サーバーは INSERT を終え 201 を返しましたが、応答がネットワークで失われ、Alice のクライアントはタイムアウトしました。<b>作成されたかどうかクライアントには分かりません</b>。ここで何も考えずに再送すると二重作成です。',
        code: { title: 'request', lang: 'http', src: `
          POST /v1/users HTTP/1.1
          Content-Type: application/json
          ⟪Idempotency-Key: "8e03978e-40d5-43e8-bc93-6894a57f9324"⟫

          {"name":"frank","email":"frank@example.com"}` },
        run: async (s) => {
          s.state('bo', null);
          s.hide('eb', { dur: 200 });
          s.text('ea', 'Idempotency-Key', { flash: false });
          await s.fly(AL, API, { label: 'POST + Idempotency-Key', arc: -16 });
          await side(s, 'idempotency_keys（API 側の保存領域）', 'text', L('key          ' + IK.slice(0, 20) + '…"', 'fingerprint  sha256(body) = 9642d920…5cc76e', 'status       201', 'response     Location: /v1/users/145', 'expires_at   2026-09-29T03:00:00Z'));
          await s.fly(API, { x: 265, y: 80 }, { label: '201 ✕ lost', cls: 'c-red', arc: 16, dur: 800 });
          s.state('al', 'warn');
          msg4(s, 'Alice のクライアント', 'text', L('POST /v1/users', '  Idempotency-Key: "8e03978e-40d5-43e8-bc93-6894a57f9324"', '  {"name":"frank","email":"frank@example.com"}', '', '→ 30 秒待っても応答なし（Timeout）', '→ 作成された？ されていない？ → 分からない'));
          await s.caption('サーバーでは作成済み。応答だけが失われた', { cls: 'bad' });
        },
      },
      {
        title: '同じ Idempotency-Key で再送 → 保存済みの 201 がそのまま返る',
        text: '同じキー・同じ本文（fingerprint 一致）の再送なので、API は INSERT をせず、保存しておいた最初の応答（<code>201</code>、<code>Location: /v1/users/145</code>）を返します。何回再送しても作成は 1 件だけ。<b><code>Idempotency-Key</code> は IETF のドラフト（draft-ietf-httpapi-idempotency-key-header）で、まだ RFC ではありません</b>。',
        code: { title: 'response（1 回目と同じ内容）', lang: 'http', src: `
          HTTP/1.1 201 Created
          ⟪Location: /v1/users/145⟫
          Content-Type: application/json; charset=utf-8

          {"id":145,"name":"frank","email":"frank@example.com","created_at":"2026-09-28T03:10:00.000Z"}` },
        run: async (s) => {
          s.caption('');
          s.state('al', null);
          await s.fly(AL, API, { label: '再送（同じキー）', arc: -16 });
          await s.scan('side');
          s.state('side', 'ok');
          await s.fly(API, AL, { label: '201（保存済みの応答）', cls: 'c-green', arc: 16 });
          s.state('al', 'ok');
          msg4(s, '再送 → 保存済みの応答', 'http', L('HTTP/1.1 201 Created', '⟪Location: /v1/users/145⟫', 'Content-Type: application/json; charset=utf-8', '', '{"id":145,"name":"frank","email":"frank@example.com",', ' "created_at":"2026-09-28T03:10:00.000Z"}', '# INSERT は実行されない（users に frank は 1 件だけ）'));
        },
      },
      {
        title: '失敗：同じキーで別の本文 → 422 ／ 処理中に再送 → 409',
        text: 'ドラフトは、同じキーを<b>別のリクエスト本文</b>に使い回したら <code>422</code>、<b>最初のリクエストがまだ処理中</b>に再送が来たら <code>409</code>、キー必須の操作でキーがなければ <code>400</code> を返すよう推奨しています（いずれも SHOULD）。',
        code: { title: 'response（本文違い）', lang: 'http', src: `
          HTTP/1.1 422 Unprocessable Content
          Content-Type: application/problem+json

          {"type":"https://api.example.com/problems/idempotency-key-reused",
           "title":"Idempotency-Key reused with a different payload","status":422}` },
        run: async (s) => {
          s.state('al side', null);
          await s.fly(AL, API, { label: '同じキー + {"name":"grace"…}', cls: 'c-red', arc: -16 });
          s.state('side', 'bad');
          s.state('api', 'bad');
          s.stamp('api', '422', { cls: 'st-bad' });
          await s.fly(API, AL, { label: '422', cls: 'c-red', arc: 16 });
          s.state('al', 'bad');
          msg4(s, 'fingerprint 不一致 → 422', 'http', L('HTTP/1.1 422 Unprocessable Content', 'Content-Type: application/problem+json', '', '{"type":"https://api.example.com/problems/idempotency-key-reused",', ' "title":"Idempotency-Key reused with a different payload",', ' "status":422}', '', '# 処理中に同じキーが来たら 409 Conflict'));
        },
      },
      {
        title: '429 Too Many Requests + Retry-After',
        text: '60 秒で 100 リクエストの枠を使い切ると <code>429</code>（RFC 6585）。<code>Retry-After: 30</code> は「30 秒後に再試行してよい」。<code>RateLimit-Policy</code> / <code>RateLimit</code> は draft-ietf-httpapi-ratelimit-headers（-11）の形式で、<code>q</code>=枠、<code>w</code>=窓の秒数、<code>r</code>=残り、<code>t</code>=リセットまでの秒数です。',
        code: { title: 'response', lang: 'http', src: `
          HTTP/1.1 429 Too Many Requests
          ⟪Retry-After: 30⟫
          RateLimit-Policy: "default";q=100;w=60
          RateLimit: "default";r=0;t=30
          Content-Type: application/problem+json

          {"type":"about:blank","title":"Too Many Requests","status":429}` },
        run: async (s) => {
          clearStamps(s);
          s.state('al side api', null);
          s.hide('ea', { dur: 150 });
          await side(s, 'rate limit（API ゲートウェイ）', 'text', L('key     Alice のトークン（sub=42）', 'window  60 s', 'limit   100 req', 'used    100 / 100   ← 枠を使い切った'));
          s.fly(AL, API, { label: 'GET ×10', arc: -16, dur: 600 });
          await s.fly(AL, API, { label: 'GET ×10', arc: 10, dur: 700, delay: 120 });
          s.state('api', 'warn');
          s.stamp('api', '429', { cls: 'st-warn' });
          await s.fly(API, AL, { label: '429 · Retry-After: 30', cls: 'c-amber', arc: 16 });
          s.state('al', 'warn');
          msg4(s, '429 response', 'http', L('HTTP/1.1 429 Too Many Requests', '⟪Retry-After: 30⟫', 'RateLimit-Policy: "default";q=100;w=60', 'RateLimit: "default";r=0;t=30', 'Content-Type: application/problem+json', '', '{"type":"about:blank","title":"Too Many Requests","status":429}'));
          await s.caption('クライアントは 30 秒待つ（即リトライの連打は枠をさらに消費する）');
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 5 : OpenAPI
   * ===================================================================*/
  const yaml = (s, title, code) => { s.text('yamlh', title, { flash: false }); return s.set('yamlbox', pre('yaml', code)); };
  const req5 = (s, title, lang, code) => { s.text('reqh', title, { flash: false }); return s.set('reqbox', pre(lang, code)); };

  TIM.scene('#sc-openapi', {
    intro: 'openapi.yaml の各部分が、実際の URL・ヘッダ・JSON のどこに対応するかを並べ、最後に「スキーマに合わないリクエスト」が <code>422</code> + problem+json になるまでを見ます。',
    steps: [
      {
        title: '骨格：servers + paths が URL になる',
        text: '<code>servers[0].url</code> に <code>paths</code> のキー（<code>/users/{id}</code>）をつなげたものが実際の URL です。<code>security</code> をルートに書くと全オペレーションに適用されます。',
        code: { title: 'openapi.yaml', lang: 'yaml', src: `
          openapi: 3.1.0
          info: { title: Example Users API, version: 1.4.0 }
          servers:
            - url: https://api.example.com/v1
          security:
            - bearerAuth: []
          paths:
            /users: …
            /users/{id}: …
          components: …` },
        run: async (s) => {
          yaml(s, 'openapi.yaml', L('openapi: 3.1.0', 'info:', '  title: Example Users API', '  version: 1.4.0', 'servers:', '  - url: ⟪https://api.example.com/v1⟫', 'security:', '  - bearerAuth: []', 'paths:', '  ⟪/users/{id}⟫: …', '  /users: …', 'components:', '  securitySchemes: …', '  schemas: …', '  responses: …'));
          await req5(s, 'URL の組み立て', 'text', L('servers[0].url  https://api.example.com/v1', '+ path          /users/{id}   (id = 42)', '', '= ⟪https://api.example.com/v1/users/42⟫'));
          await s.pulse('req');
        },
      },
      {
        title: 'paths./users/{id}.get ↔ GET リクエストとレスポンス',
        text: 'パスパラメータ <code>id</code> は <code>type: integer, minimum: 1</code>。<code>responses.\'200\'</code> の <code>headers.ETag</code> と <code>content.application/json</code> が、実際のレスポンスの <code>ETag</code> と <code>Content-Type</code> に対応します。',
        code: { title: 'openapi.yaml（抜粋）', lang: 'yaml', src: `
          /users/{id}:
            parameters:
              - name: id
                in: path
                required: true
                schema: { type: integer, minimum: 1 }
            get:
              operationId: getUser
              responses:
                '200':
                  headers:
                    ETag: { schema: { type: string } }
                  content:
                    application/json:
                      schema: { $ref: '#/components/schemas/User' }
                '404': { $ref: '#/components/responses/Problem' }` },
        run: async (s) => {
          yaml(s, 'openapi.yaml › paths./users/{id}', L('/users/{id}:', '  parameters:', '    - name: ⟪id⟫', '      in: path', '      required: true', '      schema: { type: integer, minimum: 1 }', '  get:', '    operationId: getUser', '    responses:', '      \'200\':', '        headers:', '          ⟪ETag⟫: { schema: { type: string } }', '        content:', '          ⟪application/json⟫:', '            schema: { $ref: \'#/components/schemas/User\' }', '      \'404\': { $ref: \'#/components/responses/Problem\' }'));
          await req5(s, '実際の HTTP', 'http', L('GET /v1/users/⟪42⟫ HTTP/1.1', 'Host: api.example.com', 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs…', '', 'HTTP/1.1 200 OK', '⟪ETag: "v7"⟫', 'Content-Type: ⟪application/json⟫; charset=utf-8'));
        },
      },
      {
        title: 'components.schemas ↔ JSON 本文',
        text: '<code>User</code> スキーマが本文 JSON の形。<code>readOnly: true</code> の <code>id</code> と <code>created_at</code> はレスポンスにだけ現れ、作成用の <code>NewUser</code> には含めません。<code>format: date-time</code> は RFC 3339 の日時文字列です。',
        code: { title: 'openapi.yaml（抜粋）', lang: 'yaml', src: `
          components:
            schemas:
              User:
                type: object
                required: [id, name, email, created_at]
                properties:
                  id: { type: integer, readOnly: true }
                  name: { type: string }
                  email: { type: string, format: email }
                  created_at: { type: string, format: date-time, readOnly: true }` },
        run: async (s) => {
          yaml(s, 'openapi.yaml › components.schemas', L('User:', '  type: object', '  required: [id, name, email, created_at]', '  properties:', '    ⟪id⟫: { type: integer, readOnly: true }', '    ⟪name⟫: { type: string }', '    ⟪email⟫: { type: string, format: email }', '    ⟪created_at⟫:', '      { type: string, format: date-time, readOnly: true }', 'NewUser:', '  type: object', '  required: [name, email]', '  additionalProperties: false', '  properties:', '    name: { type: string, minLength: 1, maxLength: 100 }', '    email: { type: string, format: email }'));
          await req5(s, 'レスポンス本文（User）', 'json', L('{', '  "⟪id⟫": 42,', '  "⟪name⟫": "alice",', '  "⟪email⟫": "alice@example.com",', '  "⟪created_at⟫": "2026-09-01T09:12:34.000Z"', '}'));
        },
      },
      {
        title: 'securitySchemes ↔ Authorization / X-API-Key',
        text: '<code>type: http, scheme: bearer</code> は <code>Authorization: Bearer …</code>、<code>type: apiKey, in: header, name: X-API-Key</code> はそのヘッダを意味します。ドキュメントの「Authorize」ボタンや生成クライアントはここを読んでヘッダを付けます。',
        code: { title: 'openapi.yaml（抜粋）', lang: 'yaml', src: `
          security:
            - bearerAuth: []
          components:
            securitySchemes:
              bearerAuth: { type: http, scheme: bearer, bearerFormat: JWT }
              apiKey: { type: apiKey, in: header, name: X-API-Key }` },
        run: async (s) => {
          yaml(s, 'openapi.yaml › securitySchemes', L('security:', '  - bearerAuth: []', 'components:', '  securitySchemes:', '    bearerAuth:', '      type: http', '      scheme: ⟪bearer⟫', '      bearerFormat: JWT', '    apiKey:', '      type: apiKey', '      in: header', '      name: ⟪X-API-Key⟫'));
          await req5(s, '実際のヘッダ', 'http', L('⟪Authorization: Bearer⟫ eyJhbGciOiJIUzI1NiIs…', '', '# または apiKey 方式', '⟪X-API-Key⟫: demo_k7Qx2mN9pL4vR8sT1wZ3'));
        },
      },
      {
        title: 'スキーマに合わない POST が届く',
        text: '<code>name</code> が空文字、<code>email</code> がメール形式でない本文。API の入口のバリデータが、<code>paths./users.post.requestBody</code> が指す <code>NewUser</code> スキーマと照合します（手書きの if 文ではなく、openapi.yaml から検証するのがポイント）。',
        code: { title: 'request', lang: 'http', src: `
          POST /v1/users HTTP/1.1
          Host: api.example.com
          Content-Type: application/json
          Authorization: Bearer eyJhbGciOiJIUzI1NiIs…

          {"name":"","email":"alice@"}` },
        run: async (s) => {
          yaml(s, 'openapi.yaml › paths./users.post', L('/users:', '  post:', '    operationId: createUser', '    requestBody:', '      required: true', '      content:', '        application/json:', '          schema: { $ref: \'#/components/schemas/⟪NewUser⟫\' }', '    responses:', '      \'201\': …', '      \'415\': { $ref: \'#/components/responses/Problem\' }', '      \'422\': { $ref: \'#/components/responses/Problem\' }'));
          await req5(s, '実際のリクエスト', 'http', L('POST /v1/users HTTP/1.1', 'Host: api.example.com', 'Content-Type: application/json', 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs…', '', '{"name":⟪""⟫,"email":⟪"alice@"⟫}'));
          await s.show('val', { fx: 'up' });
          s.text('valv', 'NewUser スキーマと照合中…', { flash: false });
          s.state('val', 'active');
          await s.scan('val');
        },
      },
      {
        title: '違反を JSON Pointer で特定する',
        text: '<code>name</code> は <code>minLength: 1</code> に違反、<code>email</code> は <code>format: email</code> に違反。違反箇所は本文 JSON の中の位置を指す JSON Pointer（RFC 6901）<code>#/name</code> <code>#/email</code> で表します。',
        code: { title: '検証結果', lang: 'text', src: `
          #/name   minLength: 1       ← ""（0 文字）
          #/email  format: email      ← "alice@"` },
        run: async (s) => {
          yaml(s, 'openapi.yaml › components.schemas.NewUser', L('NewUser:', '  type: object', '  required: [name, email]', '  additionalProperties: false', '  properties:', '    name: { type: string, ⟪minLength: 1⟫, maxLength: 100 }', '    email: { type: string, ⟪format: email⟫ }'));
          s.state('val', 'bad');
          s.shake('val');
          await s.text('valv', '2 件の違反：#/name（minLength）, #/email（format）');
        },
      },
      {
        title: '422 Unprocessable Content + problem+json',
        text: 'JSON としては正しいが値が不正なので <code>422</code>。本文は RFC 9457 の problem+json で、§3 の例と同じ <code>errors</code> 拡張（<code>detail</code> + <code>pointer</code>）を使います。クライアントは <code>pointer</code> を見て、該当する入力欄の横にメッセージを出せます。',
        code: { title: 'src/app.js（検証エラーを problem+json に変換）', lang: 'js', src: `
          app.use((err, req, res, next) => {
            if (!err.validationErrors) return next(err);   // 検証エラー以外は次へ
            res.status(422).type('application/problem+json').json({
              type: 'https://api.example.com/problems/validation-error',
              title: 'Your request is not valid.',
              status: 422,
              errors: err.validationErrors.map((e) => ({ detail: e.message, pointer: '#' + e.path })),
            });
          });` },
        run: async (s) => {
          s.hide('yaml', { dur: 200 });
          s.state('val', 'bad');
          await s.show('res', { fx: 'right' });
          s.text('resh', 'response', { flash: false });
          await s.set('resbox', pre('http', L('HTTP/1.1 422 Unprocessable Content', 'Content-Type: ⟪application/problem+json⟫', '', '{"type":"https://api.example.com/problems/validation-error",', ' "title":"Your request is not valid.",', ' "status":422,', ' "errors":[', '   {"detail":"must NOT have fewer than 1 characters",', '    "pointer":⟪"#/name"⟫},', '   {"detail":"must match format \\"email\\"",', '    "pointer":⟪"#/email"⟫}]}')));
          await s.caption('契約（openapi.yaml）に合わない入力は、アプリのコードに届く前に 422');
        },
      },
    ],
  });
})();
