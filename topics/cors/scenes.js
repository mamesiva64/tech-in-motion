/* CORS — scenes (see AGENT.md §7) */
(function () {
  'use strict';

  /* ---------- helpers ---------- */
  const HTTP = (src, lang) => '<code>' + TIM.codeLines(TIM.dedent(src), lang || 'http') + '</code>';
  const LINES = (rows) => rows.map(([c, t]) => '<div class="tl ' + c + '">' + TIM.esc(t) + '</div>').join('');
  const unstamp = (s, name) => s.$('[data-el="' + name + '"] > .stamp').forEach((e) => e.remove());

  const API = 'https://api.example';
  const APP = 'https://app.example';
  const blocked = (url, origin, reason) => "Access to fetch at '" + url + "' from origin '" + origin + "' has been blocked by CORS policy: " + reason;
  const R_NOACAO = "No 'Access-Control-Allow-Origin' header is present on the requested resource.";
  const R_OPAQUE = " If an opaque response serves your needs, set the request's mode to 'no-cors' to fetch the resource with CORS disabled.";
  const R_PFSTATUS = "Response to preflight request doesn't pass access control check: It does not have HTTP ok status.";
  const R_HDR = (h) => 'Request header field ' + h + ' is not allowed by Access-Control-Allow-Headers in preflight response.';
  const R_WILD = "The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the request's credentials mode is 'include'.";
  const R_ACAC = "The value of the 'Access-Control-Allow-Credentials' header in the response is '' which must be 'true' when the request's credentials mode is 'include'.";

  /* =====================================================================
   * Scene 1: origin
   * ===================================================================*/
  const row = (name) => async (s) => { await s.show(name, { fx: 'left' }); s.pulse(name); };

  TIM.scene('#sc-origin', {
    intro: '基準となる <code>https://app.example.com/dashboard?tab=1</code> をオリジン（scheme, host, port）に分解し、6 つの URL と同一オリジンかどうかを判定します。最後に、ブラウザがクロスオリジンのリクエストに付ける <code>Origin</code> ヘッダを見ます。',
    steps: [
      {
        title: 'URL をオリジンの 3 つ組に分解する',
        text: 'オリジンは <code>(scheme, host, port)</code> のタプルです。port が省略されていれば scheme の既定値（https は 443、http は 80）。<strong>path・query・fragment はオリジンに含まれません。</strong>JS では <code>location.origin</code> で確認できます。',
        code: { title: 'DevTools Console', lang: 'js', src: `
          location.href
          // "https://app.example.com/dashboard?tab=1"
          ⟪location.origin⟫
          // "https://app.example.com"   ← scheme://host(:port) だけ
          new URL('https://app.example.com:443/x').origin
          // "https://app.example.com"   ← 既定 port はシリアライズ時に省略` },
        run: async (s) => {
          await s.pulse('url');
          s.state('u-r', 'dim');
          await s.show('ser', { fx: 'pop' });
        },
      },
      {
        title: 'path が違うだけ → 同一オリジン',
        text: '<code>/api/users</code> は path が違うだけなので同一オリジン。同一オリジンの <code>fetch()</code> には CORS は関係なく、レスポンスはそのまま読めます。',
        code: { lang: 'js', src: `
          new URL('https://app.example.com/api/users').origin === location.origin
          // true` },
        run: row('r1'),
      },
      {
        title: 'scheme が違う → クロスオリジン',
        text: '<code>http://</code> と <code>https://</code> は別オリジンです。暗黙の port も 80 と 443 で異なります。',
        code: { lang: 'js', src: `
          new URL('http://app.example.com/').origin
          // "⟪http⟫://app.example.com"  ≠ "https://app.example.com"` },
        run: row('r2'),
      },
      {
        title: 'port が違う → クロスオリジン',
        text: '同じホストでも port が違えば別オリジンです。開発時の <code>localhost:5173</code>（フロント）→ <code>localhost:8080</code>（API）で CORS エラーになるのはこのためです。',
        code: { lang: 'js', src: `
          new URL('https://app.example.com:8443/').origin
          // "https://app.example.com⟪:8443⟫"` },
        run: row('r3'),
      },
      {
        title: 'サブドメインが違う → クロスオリジン（でも same-site）',
        text: '<code>api.example.com</code> は host が違うのでクロスオリジンです。一方「site」（scheme + 登録可能ドメイン）は同じ <code>https://example.com</code> なので <strong>same-site</strong> です。CORS が見るのは origin、Cookie の <code>SameSite</code> が見るのは site です。',
        code: { title: 'origin と site', lang: 'text', src: `
          origin : https://app.example.com  vs  https://api.example.com  → ⟪cross-origin⟫
          site   : https://example.com      vs  https://example.com      → ⟪same-site⟫
          （site = scheme + 登録可能ドメイン。Public Suffix List で決まる）` },
        run: row('r4'),
      },
      {
        title: '既定 port を明示 → 同一オリジン',
        text: '<code>:443</code> を明示しても https の既定 port と同じなので同一オリジンです。<code>Origin</code> ヘッダにも <code>:443</code> は付きません。',
        code: { lang: 'js', src: `
          new URL('https://app.example.com:443/').origin
          // "https://app.example.com"` },
        run: row('r5'),
      },
      {
        title: '親ドメイン → クロスオリジン',
        text: '<code>example.com</code> は <code>app.example.com</code> の親ドメインですが、host が完全一致しないので別オリジンです。オリジンに「包含関係」はありません。',
        code: { lang: 'js', src: `
          new URL('https://example.com/').origin
          // "https://example.com"  ≠ "https://app.example.com"` },
        run: row('r6'),
      },
      {
        title: 'クロスオリジンの fetch には Origin ヘッダが付く',
        text: 'クロスオリジンの <code>fetch()</code> では、ブラウザがリクエストに <code>Origin</code> を自動で付けます（JS からは設定できない forbidden request-header）。値は path を含まないシリアライズ済みオリジンです。サーバーはこの値を見て <code>Access-Control-Allow-Origin</code> を返します。',
        code: { title: 'https://app.example.com → https://api.example.com', lang: 'http', src: `
          GET /v1/items HTTP/1.1
          Host: api.example.com
          ⟪Origin: https://app.example.com⟫
          Referer: https://app.example.com/
          Sec-Fetch-Mode: cors
          Sec-Fetch-Site: same-site` },
        run: async (s) => {
          await s.show('hdr', { fx: 'down' });
          s.state('r4', 'active');
          await s.scan('hdr');
        },
      },
    ],
  });

  /* =====================================================================
   * Scene 2: simple request
   * ===================================================================*/
  const RES_OK = `
    HTTP/1.1 200 OK
    Content-Type: application/json
    ⟪Access-Control-Allow-Origin: https://app.example⟫
    Vary: Origin

    {"items":[{"id":42,"name":"pen"}]}`;
  const RES_NO = `
    HTTP/1.1 200 OK
    Content-Type: application/json
    ⟪（Access-Control-Allow-Origin なし）⟫

    {"items":[{"id":42,"name":"pen"}]}`;

  TIM.scene('#sc-simple', {
    intro: '<code>https://app.example</code> の JS が <code>https://api.example/v1/items</code> を <code>GET</code> します。<strong>リクエストはサーバーに届いて処理される</strong>こと、そしてブロックするかどうかは<strong>レスポンス受信後にブラウザが</strong>決めることを確認します。後半は ACAO を返さないサーバーの場合です。',
    steps: [
      {
        title: 'JS が fetch() でクロスオリジンの API を呼ぶ',
        text: '<code>https://app.example</code> のページで動くスクリプトが、別オリジン <code>https://api.example</code> を呼びます。<code>fetch()</code> の既定は <code>mode: "cors"</code>、<code>credentials: "same-origin"</code>（クロスオリジンには Cookie を送らない）です。',
        code: { title: 'app.js', lang: 'js', src: `
          // https://app.example/app.js
          const res = await ⟪fetch('https://api.example/v1/items')⟫;
          //            既定: { mode: 'cors', credentials: 'same-origin' }
          console.log(await res.json());` },
        run: async (s) => {
          await s.show('app', { fx: 'right' });
          s.state('js', 'active');
        },
      },
      {
        title: 'ブラウザが Origin ヘッダを付けて送信する',
        text: 'メソッドは <code>GET</code>、独自ヘッダもないので<strong>プリフライトは不要</strong>（単純リクエスト）。ブラウザは本リクエストに <code>Origin</code> を付けて、そのまま送信します。',
        code: { title: 'ブラウザ → api.example', lang: 'http', src: `
          GET /v1/items HTTP/1.1
          Host: api.example
          ⟪Origin: https://app.example⟫
          Accept: */*
          Referer: https://app.example/
          Sec-Fetch-Mode: cors
          Sec-Fetch-Site: cross-site
          Sec-Fetch-Dest: empty` },
        run: async (s) => {
          await s.fly('js:r', 'net:l', { label: 'fetch()' });
          s.state('js', null);
          s.state('net', 'active');
          await s.show('req', { fx: 'left' });
        },
      },
      {
        title: 'リクエストはサーバーに届き、処理される',
        text: 'ここが最重要ポイントです。<strong>CORS の判定より前に、リクエストはサーバーに届いています。</strong>サーバーは普通に処理して 200 を返し、アクセスログにも残ります。これが書き込み API なら、書き込みもこの時点で実行済みです。',
        code: { title: 'api.example（Express）', lang: 'js', src: `
          app.get('/v1/items', (req, res) => {
            console.log(req.method, req.path, 200, 'origin=' + req.get('Origin'));
            ⟪res.set('Access-Control-Allow-Origin', 'https://app.example');⟫
            res.set('Vary', 'Origin');
            res.json({ items: [{ id: 42, name: 'pen' }] });
          });` },
        run: async (s) => {
          s.line('net:r', 'api:l', { cls: 'flow' });
          await s.fly('net:r', 'api:l', { label: 'GET /v1/items' });
          s.state('api', 'active');
          await s.term('log', 'GET /v1/items 200 origin=https://app.example');
          await s.stamp('api', '処理済み', { cls: 'st-ok' });
        },
      },
      {
        title: 'レスポンスがブラウザに戻る（まだ JS には渡らない）',
        text: 'サーバーは <code>Access-Control-Allow-Origin: https://app.example</code> を付けて返しました。レスポンスを受け取るのはブラウザのネットワーク層で、<strong>JS にはまだ渡っていません</strong>。',
        code: { title: 'api.example → ブラウザ', lang: 'http', src: RES_OK },
        run: async (s) => {
          await s.show('res', { fx: 'up' });
          await s.fly('api:l', 'net:r', { label: '200 OK', arc: 30 });
        },
      },
      {
        title: 'CORS check：ACAO と Origin を比較する',
        text: 'Fetch Standard の <b>CORS check</b> は、<code>Access-Control-Allow-Origin</code> の値がリクエストの <code>Origin</code> と<strong>バイト単位で完全一致</strong>するか、資格情報なしで <code>*</code> かを見ます。一致したので成功です。',
        code: { title: 'CORS check（Fetch Standard の手順を要約）', lang: 'text', src: `
          1. origin ← レスポンスの Access-Control-Allow-Origin
          2. origin が無い                                   → 失敗
          3. credentials mode ≠ "include" かつ origin = "*"  → 成功
          4. origin ≠ リクエストの Origin（バイト比較）        → 失敗
          5. credentials mode ≠ "include"                     → ⟪成功⟫
          6. Access-Control-Allow-Credentials = "true"        → 成功、それ以外は失敗` },
        run: async (s) => {
          await s.show('chk', { fx: 'zoom' });
          await s.scan('net');
          await s.text('ka', 'https://app.example');
          await s.text('kr', '✓ 一致 → JS に渡す');
          s.cls('kr', 'ok', 'bad');
          s.state('net', 'ok');
          await s.stamp('net', 'PASS', { cls: 'st-ok' });
        },
      },
      {
        title: 'JS が Response を受け取る',
        text: 'CORS check を通ったので <code>fetch()</code> の Promise が解決されます。ただし JS から読める応答ヘッダは CORS-safelisted なもの（<code>Content-Type</code> など）と、<code>Access-Control-Expose-Headers</code> に列挙したものだけです。',
        code: { title: 'DevTools Console', lang: 'js', src: `
          res.status                        // 200
          res.type                          // "cors"
          await res.json()                  // {items: Array(1)}
          res.headers.get('Content-Type')   // "application/json"
          res.headers.get('X-Request-Id')   // ⟪null⟫（Expose-Headers に無いと読めない）` },
        run: async (s) => {
          await s.fly('net:l', 'js:r', { label: 'Response', arc: 20 });
          s.state('js', 'ok');
          await s.set('conb', LINES([['ok', '{items: Array(1)}'], ['dim', '  items: [{id: 42, name: "pen"}]']]));
        },
      },
      {
        title: 'ACAO を返さないサーバーの場合も、リクエストは届く',
        text: '次に、CORS 設定をしていないサーバーに同じリクエストを送ります。<strong>リクエストは同じように届き、サーバーは 200 を返し、ログにも残ります。</strong>違うのはレスポンスに <code>Access-Control-Allow-Origin</code> が無いことだけです。',
        code: { title: 'api.example → ブラウザ', lang: 'http', src: RES_NO },
        run: async (s) => {
          unstamp(s, 'net');
          s.state('net', 'active');
          s.state('js', null);
          s.text('ka', '—', { flash: false });
          s.text('kr', '—', { flash: false });
          s.cls('kr', '', 'ok bad');
          s.set('conb', '', { flash: false });
          await s.fly('net:r', 'api:l', { label: 'GET /v1/items' });
          await s.term('log', 'GET /v1/items 200 origin=https://app.example');
          await s.set('resp', HTTP(RES_NO));
          await s.fly('api:l', 'net:r', { label: '200 OK', arc: 30 });
        },
      },
      {
        title: 'ブラウザが遮断し、JS には TypeError だけが届く',
        text: 'CORS check が失敗し、ブラウザはレスポンスを破棄します。JS から見えるのは <code>TypeError: Failed to fetch</code> だけで、ステータスも本文も読めません。<strong>サーバーは処理を終えている</strong>ことに注意してください。',
        code: { title: 'Chrome の Console に出る実際のメッセージ', lang: 'text', src: `
          ${blocked(API + '/v1/items', APP, R_NOACAO + R_OPAQUE)}

          GET https://api.example/v1/items net::ERR_FAILED 200 (OK)
          Uncaught (in promise) TypeError: Failed to fetch` },
        run: async (s) => {
          await s.scan('net');
          await s.text('ka', '（ヘッダなし）');
          await s.text('kr', '✗ 失敗 → レスポンスを破棄');
          s.cls('kr', 'bad', 'ok');
          s.state('net', 'bad');
          await s.stamp('net', 'BLOCKED', { cls: 'st-bad' });
          await s.fly('net:l', 'js:r', { label: 'TypeError', cls: 'c-red', arc: 20 });
          s.state('js', 'bad');
          s.shake('js');
          await s.set('conb', LINES([
            ['err', blocked(API + '/v1/items', APP, R_NOACAO)],
            ['err', 'GET https://api.example/v1/items net::ERR_FAILED 200 (OK)'],
            ['err', 'Uncaught (in promise) TypeError: Failed to fetch'],
          ]));
        },
      },
    ],
  });

  /* =====================================================================
   * Scene 3: preflight
   * ===================================================================*/
  const PF_REQ = `
    ⟪OPTIONS⟫ /v1/items/42 HTTP/1.1
    Host: api.example
    Origin: https://app.example
    ⟪Access-Control-Request-Method: PUT⟫
    ⟪Access-Control-Request-Headers: authorization,content-type⟫`;
  const PF_RES = `
    HTTP/1.1 204 No Content
    Access-Control-Allow-Origin: https://app.example
    ⟪Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE⟫
    ⟪Access-Control-Allow-Headers: Authorization,Content-Type⟫
    ⟪Access-Control-Max-Age: 600⟫
    Vary: Origin`;
  const PUT_REQ = `
    ⟪PUT⟫ /v1/items/42 HTTP/1.1
    Host: api.example
    Origin: https://app.example
    ⟪Authorization: Bearer eyJhbGciOiJSUzI1NiJ9…⟫
    Content-Type: application/json`;
  const PUT_REQ_FULL = PUT_REQ + `
    Content-Length: 14

    {"name":"pen"}`;
  const PUT_RES = `
    HTTP/1.1 200 OK
    ⟪Access-Control-Allow-Origin: https://app.example⟫
    Vary: Origin
    Content-Type: application/json

    {"id":42,"name":"pen"}`;
  const PF_REQ2 = `
    ⟪OPTIONS⟫ /v1/items/42 HTTP/1.1
    Host: api.example
    Origin: https://app.example
    Access-Control-Request-Method: PUT
    ⟪Access-Control-Request-Headers: authorization,content-type,x-trace-id⟫`;

  TIM.scene('#sc-preflight', {
    intro: '<code>PUT</code> + <code>application/json</code> + <code>Authorization</code> の API 呼び出しで、ブラウザが先に <code>OPTIONS</code> を送り、許可を確認してから本リクエストを送る流れです。結果は <code>Access-Control-Max-Age</code> の間キャッシュされます。最後に、許可されていないヘッダを足して失敗させます。',
    steps: [
      {
        title: 'JS が PUT + JSON + Authorization で API を呼ぶ',
        text: 'REST API でよくある更新リクエストです。この 3 つの要素のどれか 1 つでもあれば、プリフライトが必要になります。',
        code: { title: 'app.js', lang: 'js', src: `
          await fetch('https://api.example/v1/items/42', {
            ⟪method: 'PUT'⟫,
            headers: {
              ⟪'Content-Type': 'application/json'⟫,
              ⟪'Authorization': \`Bearer \${token}\`⟫,
            },
            body: JSON.stringify({ name: 'pen' }),
          });` },
        run: async (s) => {
          await s.show('app', { fx: 'right' });
          s.state('js', 'active');
        },
      },
      {
        title: 'ブラウザが「プリフライトが必要」と判定する',
        text: '<code>PUT</code> は CORS-safelisted method（GET/HEAD/POST）ではなく、<code>Authorization</code> は CORS-safelisted request-header ではなく、<code>Content-Type</code> の値 <code>application/json</code> も safelisted な値ではありません。本リクエストは<strong>保留</strong>されます。',
        code: { title: '判定に使われる定義（Fetch Standard）', lang: 'text', src: `
          CORS-safelisted method          : GET, HEAD, POST            → ⟪PUT は外れる⟫
          CORS-safelisted request-header  : Accept, Accept-Language,
                                            Content-Language, Content-Type*, Range
            * Content-Type は次の値のときだけ safelisted
              application/x-www-form-urlencoded / multipart/form-data / text/plain
                                                                       → ⟪application/json は外れる⟫
          Authorization                   : safelisted ではない        → ⟪外れる⟫` },
        run: async (s) => {
          await s.fly('js:r', 'net:l', { label: 'fetch()' });
          s.state('js', null);
          await s.show('nl', { fx: 'fade' });
          await s.show('c1 c3 c2', { fx: 'pop', stagger: 140 });
          s.state('net', 'warn');
        },
      },
      {
        title: '先に OPTIONS（プリフライト）を送る',
        text: '同じ URL に <code>OPTIONS</code> を送ります。<code>Access-Control-Request-Method</code> に予定のメソッド、<code>Access-Control-Request-Headers</code> に safelisted でないヘッダ名を<strong>小文字・ソート・カンマ区切り</strong>で入れます。本文も <code>Authorization</code> も Cookie も付きません。',
        code: { title: 'ブラウザ → api.example（自動送信）', lang: 'http', src: `
          OPTIONS /v1/items/42 HTTP/1.1
          Host: api.example
          Origin: https://app.example
          ⟪Access-Control-Request-Method: PUT⟫
          ⟪Access-Control-Request-Headers: authorization,content-type⟫
          Sec-Fetch-Mode: cors
          Sec-Fetch-Site: cross-site
          Sec-Fetch-Dest: empty` },
        run: async (s) => {
          await s.show('req', { fx: 'left' });
          s.line('net:r', 'api:l', { cls: 'dash' });
          await s.fly('net:r', 'api:l', { label: 'OPTIONS /v1/items/42', cls: 'c-amber' });
          s.state('api', 'active');
        },
      },
      {
        title: 'サーバーが許可内容を 204 で返す',
        text: 'サーバー（ここでは Express の <code>cors</code> ミドルウェア）が、許可するオリジン・メソッド・ヘッダと、結果をキャッシュしてよい秒数を返します。ステータスは <strong>2xx（ok status）</strong>である必要があります。',
        code: [
          { title: 'api.example → ブラウザ', lang: 'http', src: PF_RES },
          { title: 'api.example のコード', lang: 'js', src: `
            app.use('/v1', cors({
              origin: ['https://app.example'],
              allowedHeaders: ['Authorization', 'Content-Type'],
              maxAge: 600,
            }));  // methods 省略時は GET,HEAD,PUT,PATCH,POST,DELETE` },
        ],
        run: async (s) => {
          await s.term('log', 'OPTIONS /v1/items/42 204 origin=https://app.example');
          await s.show('res', { fx: 'up' });
          await s.fly('api:l', 'net:r', { label: '204 No Content', arc: 30 });
        },
      },
      {
        title: 'ブラウザが照合し、結果をキャッシュする',
        text: 'ステータスが 2xx、ACAO が Origin と一致、<code>PUT</code> が <code>Allow-Methods</code> に、<code>authorization</code> と <code>content-type</code> が <code>Allow-Headers</code> に含まれる（大文字小文字は無視）→ 成功。結果は <strong>preflight cache</strong> に 600 秒保存されます。',
        code: { title: 'プリフライト応答のチェック', lang: 'text', src: `
          status 204                         ∈ 200..299                → ✓
          Access-Control-Allow-Origin        = https://app.example     → ✓
          Access-Control-Request-Method PUT  ∈ Allow-Methods           → ✓
          authorization, content-type        ⊆ Allow-Headers           → ✓
          ⟪→ cache: (app.example, /v1/items/42, PUT, authorization, content-type) 600 秒⟫` },
        run: async (s) => {
          await s.scan('net');
          s.state('net', 'ok');
          s.state('c1 c2 c3', 'ok');
          await s.stamp('net', 'OK', { cls: 'st-ok' });
          await s.show('cache', { fx: 'up' });
        },
      },
      {
        title: '本リクエスト（PUT）を送る',
        text: 'ここで初めて本リクエストが送られます。今度は <code>Authorization</code> ヘッダと JSON 本文が付きます。',
        code: { title: 'ブラウザ → api.example', lang: 'http', src: PUT_REQ_FULL },
        run: async (s) => {
          unstamp(s, 'net');
          s.state('net', 'active');
          s.hide('res');
          await s.text('reqh', '本リクエスト（保留が解除された）');
          await s.set('reqp', HTTP(PUT_REQ));
          await s.fly('net:r', 'api:l', { label: 'PUT /v1/items/42' });
          await s.term('log', 'PUT /v1/items/42 200 origin=https://app.example');
        },
      },
      {
        title: '本レスポンスにも ACAO が必要',
        text: 'プリフライトが通っても、<strong>本レスポンスにも <code>Access-Control-Allow-Origin</code> が必要</strong>です（ここでも CORS check が行われます）。一致したので JS に渡されます。',
        code: { title: 'api.example → ブラウザ', lang: 'http', src: PUT_RES },
        run: async (s) => {
          await s.text('resh', '本レスポンス');
          await s.set('resp', HTTP(PUT_RES), { flash: false });
          await s.show('res', { fx: 'up' });
          await s.fly('api:l', 'net:r', { label: '200 OK', arc: 30 });
          await s.scan('net');
          s.state('net', 'ok');
          await s.fly('net:l', 'js:r', { label: 'Response', arc: 20 });
          s.state('js', 'ok');
        },
      },
      {
        title: '2 回目はキャッシュが効き、OPTIONS を省略する',
        text: 'Max-Age 内に同じ (origin, URL, メソッド, ヘッダ) で呼ぶと、ブラウザは preflight cache を使って<strong>いきなり PUT を送ります</strong>（ログに OPTIONS が増えない）。Max-Age 省略時は 5 秒、上限は Chromium 7200 秒・Firefox 86400 秒です。',
        code: { title: 'access.log の違い', lang: 'text', src: `
          OPTIONS /v1/items/42 204   ← 1 回目: プリフライト
          PUT     /v1/items/42 200   ← 1 回目: 本リクエスト
          ⟪PUT     /v1/items/42 200   ← 2 回目: キャッシュヒットで PUT だけ⟫` },
        run: async (s) => {
          s.state('js', null);
          s.state('net', 'active');
          s.hide('res');
          s.state('cache', 'active');
          await s.text('ttl', '600 秒（残り 541 秒 → ヒット）');
          await s.fly('net:r', 'api:l', { label: 'PUT /v1/items/42' });
          await s.term('log', 'PUT /v1/items/42 200 origin=https://app.example');
          await s.fly('api:l', 'net:r', { label: '200 OK', arc: 30 });
          s.state('net', 'ok');
        },
      },
      {
        title: 'ヘッダを 1 つ足すと再びプリフライト → 失敗',
        text: 'JS に <code>X-Trace-Id</code> ヘッダを追加すると、キャッシュに無いヘッダなので再び <code>OPTIONS</code> が飛びます。サーバーの <code>Allow-Headers</code> に無いので失敗し、<strong>本リクエストは送信されません</strong>（ログに PUT が無い）。',
        code: { title: 'Chrome の Console', lang: 'text', src: `
          ${blocked(API + '/v1/items/42', APP, R_HDR('x-trace-id'))}

          Uncaught (in promise) TypeError: Failed to fetch` },
        run: async (s) => {
          s.state('cache', null);
          s.state('net', 'active');
          await s.show('c4', { fx: 'pop' });
          await s.text('reqh', 'プリフライト（ヘッダが増えたので再送）');
          await s.set('reqp', HTTP(PF_REQ2));
          await s.fly('net:r', 'api:l', { label: 'OPTIONS /v1/items/42', cls: 'c-amber' });
          await s.term('log', 'OPTIONS /v1/items/42 204 origin=https://app.example');
          await s.text('resh', 'プリフライトへの応答（Allow-Headers は同じ）');
          await s.set('resp', HTTP(PF_RES), { flash: false });
          await s.show('res', { fx: 'up' });
          await s.fly('api:l', 'net:r', { label: '204 No Content', arc: 30 });
          await s.scan('net');
          s.state('net', 'bad');
          s.state('c4', 'bad');
          await s.stamp('net', 'BLOCKED', { cls: 'st-bad' });
          s.state('js', 'bad');
          s.shake('js');
        },
      },
    ],
  });

  /* =====================================================================
   * Scene 4: credentials
   * ===================================================================*/
  const CR_REQ = (origin) => `
    GET /v1/me HTTP/1.1
    Host: api.example
    ⟪Origin: ${origin}⟫
    ⟪Cookie: sid=8f2c1e9a7b40d3⟫
    Sec-Fetch-Site: cross-site`;
  const CR_RES1 = `
    HTTP/1.1 200 OK
    ⟪Access-Control-Allow-Origin: *⟫
    Content-Type: application/json

    {"user":"alice","email":"alice@example.com"}`;
  const CR_RES2 = `
    HTTP/1.1 200 OK
    ⟪Access-Control-Allow-Origin: https://app.example⟫
    Vary: Origin
    Content-Type: application/json

    {"user":"alice","email":"alice@example.com"}`;
  const CR_RES3 = `
    HTTP/1.1 200 OK
    Access-Control-Allow-Origin: https://app.example
    ⟪Access-Control-Allow-Credentials: true⟫
    Vary: Origin
    Content-Type: application/json

    {"user":"alice","email":"alice@example.com"}`;
  const CR_RES_EVIL = `
    HTTP/1.1 200 OK
    ⟪Access-Control-Allow-Origin: https://evil.example⟫
    ⟪Access-Control-Allow-Credentials: true⟫
    Vary: Origin
    Content-Type: application/json

    {"user":"alice","email":"alice@example.com"}`;

  TIM.scene('#sc-cred', {
    intro: '<code>credentials: "include"</code> で Cookie 付きの API 呼び出しをします。<code>*</code> では通らないこと、<code>Access-Control-Allow-Credentials: true</code> が要ること、<code>Vary: Origin</code> の意味、そして Origin を無条件に反射する危険な設定を順に見ます。',
    steps: [
      {
        title: 'credentials: "include" を指定する',
        text: '既定の <code>credentials: "same-origin"</code> では、クロスオリジンに Cookie は送られません。ログイン状態を API に伝えたいので <code>"include"</code> を指定します。',
        code: { title: 'app.js', lang: 'js', src: `
          const res = await fetch('https://api.example/v1/me', {
            ⟪credentials: 'include'⟫,   // 'omit' | 'same-origin'(既定) | 'include'
          });
          // XMLHttpRequest なら xhr.withCredentials = true` },
        run: async (s) => {
          await s.show('app', { fx: 'right' });
          s.state('js', 'active');
        },
      },
      {
        title: 'Cookie jar から api.example の Cookie が付く',
        text: 'ブラウザは <code>api.example</code> 用に保存している <code>sid</code> Cookie を付けます。<code>app.example</code> → <code>api.example</code> はクロスサイトなので、送られるのは <code>SameSite=None; Secure</code> の Cookie だけです（ブラウザのサードパーティ Cookie 制限にも左右されます）。',
        code: { title: 'ブラウザ → api.example', lang: 'http', src: CR_REQ('https://app.example') },
        run: async (s) => {
          await s.show('jar', { fx: 'up' });
          await s.fly('js:r', 'net:l', { label: 'fetch()' });
          s.state('js', null);
          s.state('net', 'active');
          await s.pulse('jar');
          await s.show('req', { fx: 'left' });
        },
      },
      {
        title: 'サーバーは Cookie でユーザーを特定して応答する',
        text: 'サーバーは <code>sid</code> から alice を特定し、個人データを返します。CORS は <code>Access-Control-Allow-Origin: *</code> のままです。<strong>この時点でサーバー側の処理は完了しています。</strong>',
        code: { title: 'api.example → ブラウザ', lang: 'http', src: CR_RES1 },
        run: async (s) => {
          s.line('net:r', 'api:l', { cls: 'flow' });
          await s.fly('net:r', 'api:l', { label: 'GET /v1/me + Cookie' });
          s.state('api', 'active');
          await s.term('log', 'GET /v1/me 200 user=alice origin=https://app.example');
          await s.show('res', { fx: 'up' });
          await s.fly('api:l', 'net:r', { label: '200 OK', arc: 30 });
        },
      },
      {
        title: 'ブラウザが遮断：* と include は両立しない',
        text: '資格情報付きモードでは、ACAO は <code>*</code> ではなく<strong>リクエストの Origin そのもの</strong>でなければなりません。<code>*</code> を許すと「どのサイトからでもログイン中ユーザーのデータが読める」ことになるためです。',
        code: { title: 'Chrome の Console', lang: 'text', src: `
          ${blocked(API + '/v1/me', APP, R_WILD)}` },
        run: async (s) => {
          await s.scan('net');
          s.state('net', 'bad');
          await s.stamp('net', 'BLOCKED', { cls: 'st-bad' });
          s.state('js', 'bad');
          await s.set('conb', LINES([
            ['err', blocked(API + '/v1/me', APP, R_WILD)],
            ['err', 'GET https://api.example/v1/me net::ERR_FAILED 200 (OK)'],
          ]));
        },
      },
      {
        title: 'ACAO を Origin にしても、Allow-Credentials が無ければ遮断',
        text: 'サーバーを直して ACAO に <code>https://app.example</code> を返すようにしました。しかし資格情報付きモードでは、さらに <code>Access-Control-Allow-Credentials: true</code> が必要です（CORS check の手順 6）。',
        code: [
          { title: 'api.example → ブラウザ', lang: 'http', src: CR_RES2 },
          { title: 'Chrome の Console', lang: 'text', src: blocked(API + '/v1/me', APP, R_ACAC) },
        ],
        run: async (s) => {
          unstamp(s, 'net');
          s.state('net', 'active');
          s.state('js', null);
          s.set('conb', '', { flash: false });
          await s.fly('net:r', 'api:l', { label: 'GET /v1/me + Cookie' });
          await s.term('log', 'GET /v1/me 200 user=alice origin=https://app.example');
          await s.set('resp', HTTP(CR_RES2));
          await s.fly('api:l', 'net:r', { label: '200 OK', arc: 30 });
          await s.scan('net');
          s.state('net', 'bad');
          await s.stamp('net', 'BLOCKED', { cls: 'st-bad' });
          s.state('js', 'bad');
          await s.set('conb', LINES([['err', blocked(API + '/v1/me', APP, R_ACAC)]]));
        },
      },
      {
        title: 'ACAO = Origin + Allow-Credentials: true で成功',
        text: '<code>Access-Control-Allow-Origin: https://app.example</code> と <code>Access-Control-Allow-Credentials: true</code> が揃ったので CORS check に通り、JS が alice のデータを読めます。プリフライトが発生する場合は、<strong>プリフライト応答にも</strong> <code>Allow-Credentials: true</code> が必要です。',
        code: [
          { title: 'api.example → ブラウザ', lang: 'http', src: CR_RES3 },
          { title: 'api.example（Express + cors）', lang: 'js', src: `
            app.use('/v1', cors({
              origin: ['https://app.example'],   // 一致したら Origin をそのまま返す
              ⟪credentials: true⟫,                 // Access-Control-Allow-Credentials: true
            }));` },
        ],
        run: async (s) => {
          unstamp(s, 'net');
          s.state('net', 'active');
          s.state('js', null);
          s.set('conb', '', { flash: false });
          await s.fly('net:r', 'api:l', { label: 'GET /v1/me + Cookie' });
          await s.term('log', 'GET /v1/me 200 user=alice origin=https://app.example');
          await s.set('resp', HTTP(CR_RES3));
          await s.fly('api:l', 'net:r', { label: '200 OK', arc: 30 });
          await s.scan('net');
          s.state('net', 'ok');
          await s.stamp('net', 'PASS', { cls: 'st-ok' });
          await s.fly('net:l', 'js:r', { label: 'Response', arc: 20 });
          s.state('js', 'ok');
          await s.set('conb', LINES([['ok', '{user: "alice", email: "alice@example.com"}']]));
        },
      },
      {
        title: 'Vary: Origin — 共有キャッシュへの指示',
        text: 'ACAO の値が Origin ごとに変わる応答を CDN やプロキシがキャッシュするとき、URL だけをキーにすると「app.example 向けの応答」を別オリジンに返してしまいます。<code>Vary: Origin</code> で、キャッシュキーに <code>Origin</code> を含めさせます（個人データの応答はそもそも <code>Cache-Control: private</code> 等で共有キャッシュさせません）。',
        code: { title: 'Vary: Origin があるときのキャッシュキー（例：公開 API /v1/items）', lang: 'text', src: `
          key = GET https://api.example/v1/items + ⟪Origin: https://app.example⟫
                → ACAO: https://app.example   の応答を保存
          key = GET https://api.example/v1/items + ⟪Origin: https://admin.example⟫
                → ACAO: https://admin.example の応答を保存（別エントリ）

          Vary が無いと、2 つ目のリクエストに 1 つ目の応答が返り、
          admin.example 側で "ACAO が Origin と一致しない" CORS エラーになる` },
        run: async (s) => {
          await s.show('cdn', { fx: 'pop' });
          await s.fly('net:r', 'cdn:l', { label: 'Origin: app' });
          await s.scan('cdn');
          s.state('cdn', 'active');
          await s.hl([1, 3]);
        },
      },
      {
        title: '危険な設定：Origin を無条件に反射する',
        text: '「どのオリジンでも動くように」とリクエストの <code>Origin</code> をそのまま ACAO に返し、<code>Allow-Credentials: true</code> も付けると、alice が罠ページ <code>https://evil.example</code> を開いただけで、罠ページの JS が alice の Cookie 付きで API を呼び、<strong>応答を読めてしまいます</strong>。許可リストとの完全一致で判定します。',
        code: [
          { title: '脆弱なサーバー', lang: 'js', src: `
            // ✗ どんな Origin も許可してしまう
            res.set('Access-Control-Allow-Origin', ⟪req.get('Origin')⟫);
            res.set('Access-Control-Allow-Credentials', 'true');` },
          { title: '修正', lang: 'js', src: `
            const ALLOWED = new Set(['https://app.example']);
            const origin = req.get('Origin');
            if (⟪ALLOWED.has(origin)⟫) {          // 完全一致（endsWith や部分一致は NG）
              res.set('Access-Control-Allow-Origin', origin);
              res.set('Access-Control-Allow-Credentials', 'true');
            }
            res.set('Vary', 'Origin');` },
        ],
        run: async (s) => {
          s.hide('cdn');
          unstamp(s, 'net');
          s.state('net', 'active');
          s.state('js', null);
          s.set('conb', '', { flash: false });
          s.el('bz').dataset.label = 'Browser (Chrome) · alice はログイン中';
          await s.swap('js', 'evil');
          await s.text('apph', 'evil.example の JS（罠ページ）');
          await s.set('reqp', HTTP(CR_REQ('https://evil.example')));
          await s.fly('evil:r', 'net:l', { label: 'fetch()', cls: 'c-red' });
          await s.fly('net:r', 'api:l', { label: 'GET /v1/me + Cookie', cls: 'c-red' });
          await s.term('log', 'GET /v1/me 200 user=alice origin=https://evil.example');
          await s.set('resp', HTTP(CR_RES_EVIL));
          await s.fly('api:l', 'net:r', { label: '200 OK', arc: 30 });
          s.state('net', 'warn');
          await s.fly('net:l', 'evil:r', { label: 'alice のデータ', cls: 'c-red', arc: 20 });
          s.state('evil', 'bad');
          await s.stamp('evil', 'LEAK', { cls: 'st-bad' });
          await s.set('conb', LINES([['wrn', '{user: "alice", email: "alice@example.com"}  ← 攻撃者が読めた']]));
        },
      },
    ],
  });

  /* =====================================================================
   * Scene 5: failures & misconceptions
   * ===================================================================*/
  const F_NOACAO = `
    HTTP/1.1 200 OK
    Content-Type: application/json
    ⟪（Access-Control-Allow-Origin なし）⟫

    {"items":[{"id":42,"name":"pen"}]}`;
  const F_401 = `
    HTTP/1.1 ⟪401 Unauthorized⟫
    WWW-Authenticate: Bearer realm="api"
    Content-Type: application/json

    {"error":"missing_token"}`;
  const F_HDR = `
    HTTP/1.1 204 No Content
    Access-Control-Allow-Origin: https://app.example
    Access-Control-Allow-Methods: GET, POST, PUT, DELETE
    ⟪Access-Control-Allow-Headers: Content-Type⟫
    Access-Control-Max-Age: 600`;
  const F_500 = `
    HTTP/1.1 ⟪500 Internal Server Error⟫
    Server: nginx
    Content-Type: application/json
    ⟪（add_header が付かず ACAO なし）⟫

    {"error":"db connection refused"}`;
  const F_CSRF = `
    POST /v1/transfer HTTP/1.1
    Host: api.example
    ⟪Origin: https://evil.example⟫
    ⟪Cookie: sid=8f2c1e9a7b40d3⟫
    Content-Type: application/x-www-form-urlencoded

    to=mallory&amount=1000`;
  const F_403 = `
    HTTP/1.1 ⟪403 Forbidden⟫
    Content-Type: application/json

    {"error":"forbidden_origin"}`;
  const NGX_BAD = `
    location /v1/ {
      add_header Access-Control-Allow-Origin https://app.example;
      proxy_pass http://127.0.0.1:8080;
    }`;
  const NGX_OK = `
    location /v1/ {
      add_header Access-Control-Allow-Origin https://app.example ⟪always⟫;
      proxy_pass http://127.0.0.1:8080;
    }`;

  const failReset = (s, { res = true } = {}) => {
    unstamp(s, 'net');
    unstamp(s, 'api');
    s.state('net js api', null);
    s.hide('sh ngx');
    if (res && s.el('res').classList.contains('hide')) s.show('res');
  };

  TIM.scene('#sc-fail', {
    intro: 'よくある 4 つの設定ミスを、Chrome のコンソールに出る実際のエラー文とサーバーのアクセスログで突き合わせます。後半は「curl では通る」「no-cors で消える」「CORS があれば CSRF は大丈夫」という 3 つの誤解です。',
    steps: [
      {
        title: 'ACAO が無い：No \'Access-Control-Allow-Origin\' header',
        text: '最も多いエラーです。アクセスログには <strong>200</strong> が残っていて、サーバーは正常に応答しています。足りないのはレスポンスの <code>Access-Control-Allow-Origin</code> だけです。',
        code: { title: 'Chrome の Console', lang: 'text', src: `
          ${blocked(API + '/v1/items', APP, R_NOACAO + R_OPAQUE)}

          GET https://api.example/v1/items net::ERR_FAILED 200 (OK)` },
        run: async (s) => {
          await s.set('resp', HTTP(F_NOACAO), { flash: false });
          await s.show('res', { fx: 'up' });
          await s.fly('js:r', 'net:l', { label: 'GET' });
          await s.fly('net:r', 'api:l', { label: 'GET /v1/items' });
          await s.term('log', '"GET /v1/items HTTP/1.1" 200 origin=https://app.example');
          await s.fly('api:l', 'net:r', { label: '200 OK', arc: 30 });
          s.state('net', 'bad');
          await s.stamp('net', 'BLOCKED', { cls: 'st-bad' });
          await s.set('conb', LINES([
            ['err', blocked(API + '/v1/items', APP, R_NOACAO + R_OPAQUE)],
            ['err', 'GET https://api.example/v1/items net::ERR_FAILED 200 (OK)'],
          ]));
        },
      },
      {
        title: 'プリフライトが 401：It does not have HTTP ok status',
        text: 'API 全体に認証ミドルウェアをかけていると、<code>Authorization</code> の付かない <code>OPTIONS</code> が 401 になります。プリフライト応答は 2xx でなければならないので失敗し、本リクエストは送られません。<strong>OPTIONS は認証より前で 204 を返します。</strong>',
        code: [
          { title: 'Chrome の Console', lang: 'text', src: blocked(API + '/v1/items/42', APP, R_PFSTATUS) },
          { title: '修正（Express）：cors を認証より先に', lang: 'js', src: `
            app.use(cors(corsOptions));   // OPTIONS はここで 204 を返して終わる
            app.use(requireAuth);         // その後で Authorization を検査` },
        ],
        run: async (s) => {
          failReset(s);
          await s.text('resh', 'プリフライトへの応答');
          await s.set('resp', HTTP(F_401));
          await s.fly('net:r', 'api:l', { label: 'OPTIONS /v1/items/42', cls: 'c-amber' });
          await s.term('log', '"OPTIONS /v1/items/42 HTTP/1.1" 401 origin=https://app.example');
          await s.fly('api:l', 'net:r', { label: '401', cls: 'c-red', arc: 30 });
          s.state('net', 'bad');
          await s.stamp('net', 'BLOCKED', { cls: 'st-bad' });
          await s.set('conb', LINES([
            ['err', blocked(API + '/v1/items/42', APP, R_PFSTATUS)],
            ['err', 'Uncaught (in promise) TypeError: Failed to fetch'],
          ]));
        },
      },
      {
        title: 'Allow-Headers に Authorization が無い',
        text: 'プリフライトは 204 で返ったものの、<code>Access-Control-Allow-Headers</code> に <code>Authorization</code> がありません。<code>Allow-Headers: *</code> にしても <code>Authorization</code> だけはワイルドカードに含まれないので、明示が必要です。ログには OPTIONS だけが残り、PUT はありません。',
        code: { title: 'Chrome の Console', lang: 'text', src: blocked(API + '/v1/items/42', APP, R_HDR('authorization')) },
        run: async (s) => {
          failReset(s);
          await s.text('resh', 'プリフライトへの応答');
          await s.set('resp', HTTP(F_HDR));
          await s.fly('net:r', 'api:l', { label: 'OPTIONS /v1/items/42', cls: 'c-amber' });
          await s.term('log', '"OPTIONS /v1/items/42 HTTP/1.1" 204 origin=https://app.example');
          await s.fly('api:l', 'net:r', { label: '204', arc: 30 });
          await s.scan('net');
          s.state('net', 'bad');
          await s.stamp('net', 'BLOCKED', { cls: 'st-bad' });
          await s.set('conb', LINES([
            ['err', blocked(API + '/v1/items/42', APP, R_HDR('authorization'))],
            ['err', 'Uncaught (in promise) TypeError: Failed to fetch'],
          ]));
        },
      },
      {
        title: '本当は 500：エラー応答にだけ CORS ヘッダが無い',
        text: 'nginx の <code>add_header</code> は既定で 200/201/204/206/301/302/303/304/307/308 にしか付きません。アプリが 500 を返すと ACAO が消え、コンソールには <strong>CORS エラーとして</strong>表示されます。本当の原因はサーバーログの 500 です。<code>always</code> を付けると全ステータスに付きます。',
        code: [
          { title: 'Chrome の Console', lang: 'text', src: `
            ${blocked(API + '/v1/items', APP, R_NOACAO + R_OPAQUE)}

            GET https://api.example/v1/items net::ERR_FAILED ⟪500 (Internal Server Error)⟫` },
          { title: '修正：/etc/nginx/conf.d/api.conf', lang: 'diff', src: `
            -  add_header Access-Control-Allow-Origin https://app.example;
            +  add_header Access-Control-Allow-Origin https://app.example always;` },
        ],
        run: async (s) => {
          failReset(s);
          await s.text('resh', 'サーバーのレスポンス');
          await s.set('resp', HTTP(F_500));
          await s.show('ngx', { fx: 'up' });
          await s.fly('net:r', 'api:l', { label: 'GET /v1/items' });
          await s.term('log', '"GET /v1/items HTTP/1.1" 500 upstream error');
          await s.fly('api:l', 'net:r', { label: '500', cls: 'c-red', arc: 30 });
          s.state('net', 'bad');
          await s.stamp('net', 'BLOCKED', { cls: 'st-bad' });
          await s.set('conb', LINES([
            ['err', blocked(API + '/v1/items', APP, R_NOACAO + R_OPAQUE)],
            ['err', 'GET https://api.example/v1/items net::ERR_FAILED 500 (Internal Server Error)'],
          ]));
          s.state('ngx', 'warn');
          await s.set('ngxp', HTTP(NGX_OK, 'text'));
        },
      },
      {
        title: '誤解 1：curl では通る → CORS はブラウザだけの仕組み',
        text: 'curl や Postman、サーバー間通信は CORS を<strong>一切チェックしません</strong>。<code>Origin: https://evil.example</code> を付けても普通にデータが返ります。CORS は「ブラウザ上の他サイトの JS に読ませるか」の制御であって、API のアクセス制御（認証・認可）ではありません。',
        code: { title: 'bash', lang: 'bash', src: `
          $ curl -i -H 'Origin: https://evil.example' https://api.example/v1/items
          HTTP/2 200
          content-type: application/json
          vary: Origin

          {"items":[{"id":42,"name":"pen"}]}` },
        run: async (s) => {
          failReset(s, { res: false });
          s.hide('res');
          s.set('conb', '', { flash: false });
          await s.show('sh', { fx: 'up' });
          await s.term('sh', `
            $ curl -i -H 'Origin: https://evil.example' https://api.example/v1/items
            HTTP/2 200
            content-type: application/json
            vary: Origin

            {"items":[{"id":42,"name":"pen"}]}`);
          await s.term('log', '"GET /v1/items HTTP/2.0" 200 origin=https://evil.example');
          s.state('sh', 'warn');
          s.state('api', 'active');
        },
      },
      {
        title: '誤解 2：mode: "no-cors" でエラーが消えた → 読めない',
        text: '<code>mode: "no-cors"</code> にするとコンソールのエラーは消えますが、返るのは <strong>opaque response</strong>（<code>type: "opaque"</code>, <code>status: 0</code>、本文もヘッダも空）です。JS からは何も読めず、解決にはなりません。',
        code: { title: 'DevTools Console', lang: 'js', src: `
          const r = await fetch('https://api.example/v1/items', { ⟪mode: 'no-cors'⟫ });
          r.type     // "opaque"
          r.status   // 0
          r.ok       // false
          await r.text()   // ""` },
        run: async (s) => {
          failReset(s, { res: false });
          s.hide('res');
          await s.fly('js:r', 'net:l', { label: "mode: 'no-cors'" });
          await s.fly('net:r', 'api:l', { label: 'GET /v1/items' });
          await s.term('log', '"GET /v1/items HTTP/1.1" 200 origin=https://app.example');
          await s.fly('api:l', 'net:r', { label: '200 OK', arc: 30 });
          await s.fly('net:l', 'js:r', { label: 'opaque', cls: 'c-gray', arc: 20 });
          s.state('js', 'warn');
          await s.set('conb', LINES([
            ['in', "const r = await fetch('https://api.example/v1/items', {mode: 'no-cors'})"],
            ['in', 'r'],
            ['rv', "Response {type: 'opaque', url: '', redirected: false, status: 0, ok: false, …}"],
            ['in', 'await r.text()'],
            ['rv', "''"],
          ]));
        },
      },
      {
        title: '誤解 3：CORS があるから CSRF は大丈夫 → 書き込みは実行される',
        text: 'alice がログイン中に罠ページ <code>https://evil.example</code> を開くと、罠ページの JS が <code>application/x-www-form-urlencoded</code> の <code>POST</code>（単純リクエスト＝プリフライトなし）を Cookie 付きで送ります。<strong>送金はサーバーで実行され</strong>、ブラウザが止めるのはレスポンスの読み取りだけです。',
        code: [
          { title: 'evil.example の JS', lang: 'js', src: `
            fetch('https://api.example/v1/transfer', {
              method: 'POST', credentials: 'include',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: 'to=mallory&amount=1000',
            });   // 応答は読めなくても、攻撃者は困らない` },
          { title: 'ブラウザ → api.example', lang: 'http', src: F_CSRF },
        ],
        run: async (s) => {
          failReset(s);
          await s.swap('js', 'evil');
          await s.text('resh', 'ブラウザが送ったリクエスト（Cookie 付き）');
          await s.set('resp', HTTP(F_CSRF));
          await s.fly('evil:r', 'net:l', { label: 'POST', cls: 'c-red' });
          await s.fly('net:r', 'api:l', { label: 'POST /v1/transfer + Cookie', cls: 'c-red' });
          await s.term('log', '"POST /v1/transfer HTTP/1.1" 200 user=alice to=mallory');
          s.state('api', 'bad');
          await s.stamp('api', '送金 実行済み', { cls: 'st-bad' });
          await s.fly('api:l', 'net:r', { label: '200 OK', arc: 30 });
          await s.stamp('net', '読取のみ BLOCK', { cls: 'st-warn' });
          await s.set('conb', LINES([
            ['err', blocked(API + '/v1/transfer', 'https://evil.example', R_NOACAO + R_OPAQUE)],
            ['wrn', '（しかしサーバー側では送金処理が完了している）'],
          ]));
        },
      },
      {
        title: 'CSRF 対策はサーバー側で：Origin 検査・SameSite・トークン',
        text: '状態を変えるリクエストでは、サーバーが <code>Origin</code>（または <code>Sec-Fetch-Site</code>）を許可リストで検査して 403 を返します。加えて Cookie を <code>SameSite=Lax</code>/<code>Strict</code> にする、CSRF トークンを要求する、<code>Content-Type: application/json</code> 以外を拒否して<strong>必ずプリフライトを発生させる</strong>、などを組み合わせます。',
        code: { title: 'api.example（Express）', lang: 'js', src: `
          const ALLOWED = new Set(['https://app.example']);
          app.use((req, res, next) => {
            if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
            if (⟪!ALLOWED.has(req.get('Origin'))⟫) {
              return res.status(403).json({ error: 'forbidden_origin' });
            }
            next();
          });
          // Set-Cookie: sid=…; Path=/; Secure; HttpOnly; ⟪SameSite=Lax⟫` },
        run: async (s) => {
          failReset(s);
          await s.text('resh', 'サーバーのレスポンス');
          await s.set('resp', HTTP(F_403));
          await s.fly('evil:r', 'net:l', { label: 'POST', cls: 'c-red' });
          await s.fly('net:r', 'api:l', { label: 'POST /v1/transfer', cls: 'c-red' });
          await s.term('log', '"POST /v1/transfer HTTP/1.1" 403 origin=https://evil.example');
          s.state('api', 'ok');
          await s.stamp('api', 'REJECTED', { cls: 'st-ok' });
          await s.fly('api:l', 'net:r', { label: '403', cls: 'c-red', arc: 30 });
          await s.set('conb', LINES([['dim', 'POST https://api.example/v1/transfer 403 (Forbidden)']]));
        },
      },
    ],
  });

  /* =====================================================================
   * Lab: does this request need a preflight?
   * ===================================================================*/
  function pfLab() {
    const $ = (id) => document.getElementById(id);
    const m = $('pf-m');
    if (!m) return;
    const ct = $('pf-ct'), au = $('pf-auth'), xr = $('pf-xrw'), al = $('pf-al'), cr = $('pf-cred');
    const verdict = $('pf-verdict'), why = $('pf-why'), out = $('pf-out');
    const SAFE_M = ['GET', 'HEAD', 'POST'];
    const SAFE_CT = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];

    function update() {
      const method = m.value;
      const reasons = [];
      const unsafe = [];
      const sent = [];
      if (!SAFE_M.includes(method)) reasons.push('method ' + method + ' は CORS-safelisted method（GET / HEAD / POST）ではない');
      if (ct.value) {
        const essence = ct.value.split(';')[0].trim().toLowerCase();
        sent.push('Content-Type: ' + ct.value);
        if (!SAFE_CT.includes(essence)) { unsafe.push('content-type'); reasons.push('Content-Type の値 ' + essence + ' は safelisted な値ではない'); }
      }
      if (au.checked) { sent.push('Authorization: Bearer eyJhbGciOi…'); unsafe.push('authorization'); reasons.push('Authorization は CORS-safelisted request-header ではない'); }
      if (xr.checked) { sent.push('X-Requested-With: XMLHttpRequest'); unsafe.push('x-requested-with'); reasons.push('X-Requested-With は独自ヘッダ（safelisted ではない）'); }
      if (al.checked) sent.push('Accept-Language: ja,en;q=0.8');
      unsafe.sort();
      const need = reasons.length > 0;
      verdict.className = 'verdict ' + (need ? 'warn' : 'ok');
      verdict.textContent = need ? 'プリフライトあり（OPTIONS が先に飛ぶ）' : 'プリフライトなし（いきなり本リクエスト）';
      const notes = need ? reasons.slice() : ['メソッドもヘッダもすべて CORS-safelisted'];
      if (al.checked) notes.push('Accept-Language は safelisted（値の文字種と長さの条件を満たす限り）');
      if (cr.checked) notes.push("credentials: 'include' はプリフライトの要否には影響しない。ただし応答に具体的な ACAO と Allow-Credentials: true が必要");
      why.innerHTML = notes.map((t) => '<li>' + TIM.esc(t) + '</li>').join('');

      let src;
      if (need) {
        src = [
          '# ① ブラウザが先に送るプリフライト',
          'OPTIONS /v1/items HTTP/1.1',
          'Host: api.example',
          'Origin: https://app.example',
          'Access-Control-Request-Method: ' + method,
        ];
        if (unsafe.length) src.push('Access-Control-Request-Headers: ' + unsafe.join(','));
        src.push('', '# ② 通すためにサーバーが返すべき応答', 'HTTP/1.1 204 No Content', 'Access-Control-Allow-Origin: https://app.example');
        if (!SAFE_M.includes(method)) src.push('Access-Control-Allow-Methods: ' + method);
        if (unsafe.length) src.push('Access-Control-Allow-Headers: ' + unsafe.join(', '));
        if (cr.checked) src.push('Access-Control-Allow-Credentials: true');
        src.push('Vary: Origin');
      } else {
        src = ['# プリフライトなしで送られる本リクエスト', method + ' /v1/items HTTP/1.1', 'Host: api.example', 'Origin: https://app.example'];
        sent.forEach((h) => src.push(h));
        if (cr.checked) src.push('Cookie: sid=…');
        src.push('', '# 応答を JS が読むために必要なヘッダ', 'Access-Control-Allow-Origin: https://app.example');
        if (cr.checked) src.push('Access-Control-Allow-Credentials: true');
      }
      out.innerHTML = '<code>' + TIM.codeLines(src.join('\n').replace(/^# (.*)$/gm, '⟪$1⟫'), 'http') + '</code>';
    }
    [m, ct, au, xr, al, cr].forEach((e) => e.addEventListener('change', update));
    update();
  }
  pfLab();
})();
