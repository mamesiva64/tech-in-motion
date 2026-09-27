/* OAuth 2.0 / OIDC — scenes (see AGENT.md §7) */
(function () {
  'use strict';

  /* ---------- demo values (RFC 6749 / RFC 7636 / OIDC Core examples) ---------- */
  const CID = 's6BhdRkqt3';
  const BASIC = 'czZCaGRSa3F0MzpnWDFmQmF0M2JW'; // base64("s6BhdRkqt3:gX1fBat3bV")
  const V = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'; // RFC 7636 Appendix B
  const C = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  const ST = 'af0ifjsldkj';
  const NO = 'n-0S6_WzA2Mj';
  const CODE = 'SplxlOBeZQQYbYS6WxSbIA';
  const ATK_CODE = 'Hq3ZrV9xLw2PkT7sNd4bYc';
  const ATK_V = 'Qx7mZp2VtL9wR4sNc8yHbE1kJf6uGd3aTo5iXe0nWq-';
  const IDH = TIM.b64u.enc(JSON.stringify({ alg: 'RS256', kid: '1e9gdk7', typ: 'JWT' }));
  const IDP = TIM.b64u.enc(JSON.stringify({ iss: 'https://idp.example', sub: '24400320', aud: CID, exp: 1790586000, iat: 1790582400, auth_time: 1790582395, nonce: NO }));
  const IDS = 'Phe6lq4EzTuZhp5W8K2_Om-3TSVVF13MbosJFFeasDbP1igLs8cH267ycNyVBQluZ2vn8Q1G2Ce67Sci-7nk_tZnhxqFs4aor3J2Y6eBN2mBmq3rs78pif0AUcaf5OD1DnEFLX7v6bPlPkKbz3WAOLW-oGAL-EoXPv0dhGLACcqRgVQ1ewrqkrH6BnR8jrmHgBgQ4ESA6hUn7u6A0mRRJTV3CU4gS72r1A2uEfLVmrBElQNJryiGEZY_DYwbacBMqOA_BYRrZzRaZQw20dgiUVQ-PDxgB3UM8fi34D0xkGpNYWgSlpQr2C3P70ocUD--Hbw33CyD66FqMhSLtIb3KA'; // demo (not a real signature)
  const B64U = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  const s256 = async (v) => TIM.b64u.enc(await TIM.sha256(v));
  const HTTP = (src, lang) => '<code>' + TIM.codeLines(TIM.dedent(src), lang || 'http') + '</code>';
  const unstamp = (s, name) => s.$('[data-el="' + name + '"] > .stamp').forEach((e) => e.remove());
  const verdict = (s, name, text, cls) => { s.cls(name, cls, 'ok bad warn'); return s.text(name, text); };

  /* =====================================================================
   * Scene 1: roles & discovery
   * ===================================================================*/
  TIM.scene('#sc-roles', {
    intro: 'OAuth 2.0 の 4 つの役割と、Discovery 文書に並ぶ実際のエンドポイントを対応付けます。どのエンドポイントを<b>ブラウザ</b>が開き、どれを <b>Client のサーバー</b>が直接呼ぶのかが、後のシーンの前提になります。',
    steps: [
      {
        title: '4 つの役割',
        text: '<b>Resource Owner</b>（alice）がブラウザを操作し、<b>Client</b>（app.example のサーバー）が alice の代わりに <b>Resource Server</b>（api.example）を呼ぶ許可を、<b>Authorization Server</b>（idp.example）から「トークン」として受け取ります。',
        code: { title: 'RFC 6749 §1.1 の用語 ↔ このページの例', lang: 'text', src: `
          resource owner        alice（ブラウザ）
          client                https://app.example      client_id=${CID}
          authorization server  https://idp.example      （OIDC では OpenID Provider）
          resource server       https://api.example` },
        run: async (s) => {
          await s.pulse('ro as cl rs');
        },
      },
      {
        title: 'Client を AS に登録しておく',
        text: '事前に AS の管理画面（または RFC 7591 の動的登録 <code>POST /register</code>）で Client を登録し、<code>client_id</code> と <code>client_secret</code> を受け取ります。<code>redirect_uris</code> はここで登録した値と<strong>完全一致</strong>しないと使えません。',
        code: { title: 'クライアントメタデータ（RFC 7591）', lang: 'json', src: `
          {
            "client_id": "${CID}",
            "client_secret": "gX1fBat3bV",
            ⟪"redirect_uris": ["https://app.example/callback"]⟫,
            "grant_types": ["authorization_code", "refresh_token"],
            "token_endpoint_auth_method": "client_secret_basic"
          }` },
        run: async (s) => {
          await s.show('reg', { fx: 'up' });
          s.state('cl', 'active');
          await s.pulse('as');
        },
      },
      {
        title: 'Discovery：/.well-known/openid-configuration',
        text: 'Client は issuer の URL に <code>/.well-known/openid-configuration</code> を付けて GET し、各エンドポイントの URL・対応アルゴリズム・PKCE の対応状況を取得します（OIDC Discovery 1.0 §4）。',
        code: [
          { title: 'bash', lang: 'bash', src: `
            $ curl -s https://idp.example/.well-known/openid-configuration | jq .` },
          { title: 'レスポンス（抜粋）', lang: 'json', src: `
            {
              "issuer": "https://idp.example",
              "authorization_endpoint": "https://idp.example/authorize",
              "token_endpoint": "https://idp.example/token",
              "userinfo_endpoint": "https://idp.example/userinfo",
              "jwks_uri": "https://idp.example/.well-known/jwks.json",
              "response_types_supported": ["code"],
              "grant_types_supported": ["authorization_code", "refresh_token", "client_credentials"],
              "subject_types_supported": ["public"],
              "id_token_signing_alg_values_supported": ["RS256"],
              "code_challenge_methods_supported": ["S256"],
              "token_endpoint_auth_methods_supported": ["client_secret_basic", "private_key_jwt"],
              "scopes_supported": ["openid", "profile", "email", "offline_access"]
            }` },
        ],
        run: async (s) => {
          s.state('cl', 'active');
          await s.fly('cl:tr', 'as:bl', { label: 'GET /.well-known/openid-configuration', cls: 'c-cyan' });
          await s.show('disc', { fx: 'left' });
          await s.fly('as:bl', 'cl:tr', { label: 'JSON', cls: 'c-cyan', arc: 30 });
        },
      },
      {
        title: 'authorization_endpoint はブラウザが開く（フロントチャネル）',
        text: '<code>authorization_endpoint</code>（<code>/authorize</code>）は <strong>ブラウザ</strong>が開く URL です。Client はブラウザを 302 でここへ送り、AS はログイン・同意後にブラウザを <code>redirect_uri</code> へ 302 で戻します。この経路（<span style="color:var(--amber)">橙</span>）の値は URL に載るので、ユーザーや攻撃者から見えます。',
        code: { title: 'ブラウザが通る 2 つのリダイレクト', lang: 'http', src: `
          HTTP/1.1 302 Found                       ← app.example が返す
          Location: ⟪https://idp.example/authorize⟫?response_type=code&client_id=${CID}&…

          HTTP/1.1 302 Found                       ← idp.example が返す
          Location: ⟪https://app.example/callback⟫?code=${CODE}&state=${ST}` },
        run: async (s) => {
          s.state('cl', null);
          s.line('ro:r', 'as:l', { cls: 'acc c-amber', label: 'GET /authorize', ly: -13, both: true });
          await s.line('ro:b', 'cl:t', { cls: 'acc c-amber', label: '302 / callback', both: true });
          await s.show('lg1', { fx: 'pop' });
          s.state('disc', 'active');
          s.hl([3]);
        },
      },
      {
        title: 'token_endpoint は Client のサーバーが直接呼ぶ（バックチャネル）',
        text: '<code>token_endpoint</code>（<code>/token</code>）は <strong>Client のサーバー</strong>が HTTPS で直接呼びます（<span style="color:var(--cyan)">水色</span>）。<code>client_secret</code> による認証と <code>code_verifier</code> はこの経路だけを通り、トークンもこの経路でだけ返ります。',
        code: { title: 'Client → AS（ブラウザを経由しない）', lang: 'http', src: `
          POST /token HTTP/1.1
          Host: idp.example
          Authorization: Basic ${BASIC}
          Content-Type: application/x-www-form-urlencoded

          grant_type=authorization_code&code=${CODE}&redirect_uri=…&code_verifier=…` },
        run: async (s) => {
          await s.line('cl:tr', 'as:bl', { cls: 'acc c-cyan', label: 'POST /token', ly: -14 });
          await s.show('lg2', { fx: 'pop' });
          s.hl([4]);
        },
      },
      {
        title: 'jwks_uri：id_token の署名検証用の公開鍵',
        text: 'Client は <code>jwks_uri</code> から AS の公開鍵（JWK Set）を取得してキャッシュし、<code>id_token</code> の署名を検証します。鍵は <code>kid</code> で選びます。',
        code: { title: 'Client → AS', lang: 'bash', src: `
          $ curl -s https://idp.example/.well-known/jwks.json | jq '.keys[] | {kid, kty, alg, use}'
          {
            "kid": "1e9gdk7",
            "kty": "RSA",
            "alg": "RS256",
            "use": "sig"
          }` },
        run: async (s) => {
          await s.line('cl:r', 'as:b', { cls: 'acc c-cyan dash', label: 'GET jwks_uri', ly: 16 });
          s.hl([6]);
        },
      },
      {
        title: 'Resource Server：Bearer トークンで API を呼ぶ',
        text: 'Client は <code>access_token</code> を <code>Authorization: Bearer</code> ヘッダに入れて API を呼びます（RFC 6750）。API は AS のイントロスペクション（RFC 7662）や JWKS を使ってトークンを検証します。',
        code: { title: 'Client → Resource Server', lang: 'http', src: `
          GET /v1/me HTTP/1.1
          Host: api.example
          ⟪Authorization: Bearer SlAV32hkKG⟫` },
        run: async (s) => {
          await s.line('cl:r', 'rs:l', { cls: 'acc c-cyan', label: 'Bearer …' });
          await s.fly('cl:r', 'rs:l', { label: 'GET /v1/me', cls: 'c-cyan' });
          await s.line('rs:tr', 'as:br', { cls: 'dash', label: 'introspect / JWKS', lx: -46 });
          s.state('rs', 'active');
        },
      },
      {
        title: 'まとめ：トークンはバックチャネルだけを通る',
        text: 'ブラウザ（橙）を通るのは <code>client_id</code>・<code>redirect_uri</code>・<code>state</code>・<code>code_challenge</code>・一度きりの <code>code</code> だけ。<code>client_secret</code>・<code>code_verifier</code>・各トークンは Client のサーバーと AS / API の間（水色）だけを流れます。',
        code: { title: '経路ごとに流れる値', lang: 'text', src: `
          フロントチャネル（ブラウザ経由・URL に載る）
            → client_id, redirect_uri, scope, ⟪state⟫, ⟪nonce⟫, ⟪code_challenge⟫, ⟪code⟫
          バックチャネル（サーバー間・TLS）
            → client_secret, ⟪code_verifier⟫, ⟪access_token⟫, ⟪refresh_token⟫, ⟪id_token⟫` },
        run: async (s) => {
          s.state('disc', null);
          s.state('ro', 'warn');
          s.state('cl', 'ok');
          await s.pulse('lg1 lg2');
        },
      },
    ],
  });

  /* =====================================================================
   * Scene 2: authorization code + PKCE (sequence diagram)
   * ===================================================================*/
  const X = { br: 100, cl: 320, as: 540 };
  const msg = (s, from, to, y, label, ch) => {
    const cls = ch === 'b' ? 'c-cyan' : 'c-amber';
    const dir = X[to] > X[from] ? 1 : -1;
    const a = { x: X[from] + dir * 3, y }, b = { x: X[to] - dir * 3, y };
    s.line(a, b, { cls: 'acc ' + cls, label, ly: -11 });
    return s.fly(a, b, { cls, dur: 800 });
  };

  TIM.scene('#sc-pkce', {
    intro: '縦線はそれぞれ Browser / Client / AS。<span style="color:var(--amber)">橙の矢印</span>はブラウザのリダイレクトで運ばれる<b>フロントチャネル</b>、<span style="color:var(--cyan)">水色の矢印</span>は Client のサーバーから AS への<b>バックチャネル</b>です。右側は各時点で Client と AS が保持している値です。<code>code_challenge</code> はページ上で WebCrypto により実際に計算しています。',
    steps: [
      {
        title: 'Client が code_verifier・state・nonce を生成',
        text: 'ログインボタンが押されると、Client のサーバーは 3 つの乱数を作ってセッションに保存します。<code>code_verifier</code> は <code>[A-Z] [a-z] [0-9] - . _ ~</code> の 43〜128 文字（32 バイト乱数を base64url にすると 43 文字）。表示値は RFC 7636 付録 B と OIDC Core の例です。',
        code: { title: 'Client（Node.js）', lang: 'js', src: `
          import { randomBytes } from 'node:crypto';
          const rnd = (n) => randomBytes(n).toString('base64url');

          req.session.code_verifier = rnd(32);  // 例 "${V}"
          req.session.state         = rnd(16);  // 例 "${ST}"
          req.session.nonce         = rnd(16);  // 例 "${NO}"` },
        run: async (s) => {
          await s.show('a1', { fx: 'pop' });
          s.state('sess', 'active');
          await Promise.all([
            s.scramble('v-st', ST, { dur: 700, chars: B64U }),
            s.scramble('v-no', NO, { dur: 800, chars: B64U }),
            s.scramble('v-cv', V, { dur: 1100, chars: B64U }),
          ]);
        },
      },
      {
        title: 'code_challenge = BASE64URL(SHA256(code_verifier))',
        text: 'verifier の SHA-256（32 バイト）を base64url（パディングなし）にした 43 文字が <code>code_challenge</code> です。この値は<strong>このページ上で <code>crypto.subtle.digest</code> を使って計算</strong>しています。verifier 自体はまだどこにも送りません。',
        code: { title: 'WebCrypto での計算（このページで実行）', lang: 'js', src: `
          const data = new TextEncoder().encode(code_verifier);      // ASCII
          const hash = await crypto.subtle.digest('SHA-256', data);   // 32 bytes
          const code_challenge = base64url(hash);                     // 43 文字
          // → "${C}"` },
        run: async (s) => {
          await s.show('a2', { fx: 'pop' });
          const c = await s256(V);
          await s.scramble('v-cc', c, { dur: 1100, chars: B64U });
          s.state('a2', c === C ? 'ok' : 'bad');
        },
      },
      {
        title: 'Client → Browser：302 で /authorize へ（フロント）',
        text: 'Client はブラウザを AS の <code>authorization_endpoint</code> へリダイレクトします。送るのは <code>code_challenge</code> と <code>code_challenge_method=S256</code>。同時にログイン前のセッション Cookie を発行し、state・nonce・verifier をこのセッションに紐付けます。',
        code: { title: 'app.example → Browser（読みやすさのため改行）', lang: 'http', src: `
          HTTP/1.1 302 Found
          Location: https://idp.example/authorize?⟪response_type=code⟫
              &client_id=${CID}
              &redirect_uri=https%3A%2F%2Fapp.example%2Fcallback
              &scope=openid%20profile%20email
              &⟪state=${ST}⟫
              &⟪nonce=${NO}⟫
              &⟪code_challenge=${C}⟫
              &⟪code_challenge_method=S256⟫
          Set-Cookie: __Host-sid=q8Zk2nV0pXw4; Path=/; Secure; HttpOnly; SameSite=Lax` },
        run: async (s) => {
          s.state('sess', null);
          await msg(s, 'cl', 'br', 176, '302 → /authorize?…', 'f');
          await s.show('lg1', { fx: 'pop' });
        },
      },
      {
        title: 'Browser → AS：GET /authorize（フロント）',
        text: 'この URL はブラウザ履歴・プロキシ・ログに残り得ます。だから送るのは verifier ではなく <strong>challenge</strong>（ハッシュ）です。AS は <code>client_id</code> と <code>redirect_uri</code> が登録値と完全一致するかを確認し、<code>code_challenge</code> と <code>nonce</code> を保存します。',
        code: { title: 'Browser → idp.example', lang: 'http', src: `
          GET /authorize?response_type=code&client_id=${CID}&redirect_uri=https%3A%2F%2Fapp.example%2Fcallback&scope=openid%20profile%20email&state=${ST}&nonce=${NO}&code_challenge=${C}&code_challenge_method=S256 HTTP/1.1
          Host: idp.example
          Referer: https://app.example/` },
        run: async (s) => {
          await msg(s, 'br', 'as', 212, 'GET /authorize?response_type=code&…', 'f');
          s.state('as', 'active');
          await s.show('asst', { fx: 'up' });
        },
      },
      {
        title: 'AS でログインと同意',
        text: 'alice は <strong>idp.example のドメイン上で</strong>パスワード（や MFA）を入力し、<code>openid profile email</code> の提供に同意します。Client はパスワードを一切見ません。ログイン画面の URL やフォームは AS の実装次第です。',
        code: { title: 'AS 内部のログイン（例。パスや項目は実装依存）', lang: 'http', src: `
          POST /login HTTP/1.1
          Host: idp.example
          Content-Type: application/x-www-form-urlencoded

          username=alice&password=********` },
        run: async (s) => {
          await s.show('a5', { fx: 'pop' });
          await s.fly({ x: X.br + 3, y: 248 }, { x: X.as - 3, y: 248 }, { label: 'alice / ********', cls: 'c-gray', dur: 900 });
          s.state('a5', 'ok');
        },
      },
      {
        title: 'AS → Browser：code を付けて redirect_uri へ（フロント）',
        text: 'AS は短命で 1 回限りの認可コード <code>code</code> を発行し、ブラウザを登録済みの <code>redirect_uri</code> へ戻します。<code>state</code> は受け取った値をそのまま返します。code は URL に載るので、<strong>漏れる前提</strong>で扱います。',
        code: { title: 'idp.example → Browser', lang: 'http', src: `
          HTTP/1.1 302 Found
          Location: https://app.example/callback?⟪code=${CODE}⟫&⟪state=${ST}⟫` },
        run: async (s) => {
          await s.scramble('v-code', CODE, { dur: 800, chars: B64U });
          s.state('asst', 'active');
          await msg(s, 'as', 'br', 284, '302 → /callback?code=…&state=…', 'f');
          s.state('asst', null);
        },
      },
      {
        title: 'Browser → Client：GET /callback（フロント）',
        text: 'ブラウザは <code>code</code> と <code>state</code> をクエリに載せて Client の <code>/callback</code> を開きます。ステップ 3 のセッション Cookie も一緒に届くので、Client はどのセッションの応答かを特定できます。',
        code: { title: 'Browser → app.example', lang: 'http', src: `
          GET /callback?code=${CODE}&state=${ST} HTTP/1.1
          Host: app.example
          Cookie: __Host-sid=q8Zk2nV0pXw4` },
        run: async (s) => {
          s.state('as', null);
          await msg(s, 'br', 'cl', 320, 'GET /callback?code=…&state=…', 'f');
        },
      },
      {
        title: 'Client が state を照合',
        text: 'クエリの <code>state</code> とセッションの <code>state</code> を比較します。一致しなければここで中断（→ §4 の CSRF）。一致したらセッションから消して、同じ state を二度と受け付けないようにします。',
        code: { title: 'Client（Express）', lang: 'js', src: `
          app.get('/callback', async (req, res) => {
            if (!req.session.state || ⟪req.query.state !== req.session.state⟫) {
              return res.status(400).send('state mismatch');
            }
            delete req.session.state;   // 1 回限り
            // → 次はトークンリクエスト
          });` },
        run: async (s) => {
          await s.show('a8', { fx: 'pop' });
          await s.pulse('v-st');
          s.state('a8', 'ok');
        },
      },
      {
        title: 'Client → AS：POST /token（バック）',
        text: 'Client のサーバーが AS のトークンエンドポイントを<strong>直接</strong>呼びます。ブラウザは関与しません。<code>Authorization: Basic</code> でクライアント認証し、<strong>ここで初めて <code>code_verifier</code> を送ります</strong>。',
        code: { title: 'app.example → idp.example', lang: 'http', src: `
          POST /token HTTP/1.1
          Host: idp.example
          Authorization: Basic ${BASIC}
          Content-Type: application/x-www-form-urlencoded

          grant_type=authorization_code
          &code=${CODE}
          &redirect_uri=https%3A%2F%2Fapp.example%2Fcallback
          &⟪code_verifier=${V}⟫` },
        run: async (s) => {
          await msg(s, 'cl', 'as', 392, 'POST /token (code + code_verifier)', 'b');
          await s.show('lg2', { fx: 'pop' });
          s.state('v-cv', 'active');
        },
      },
      {
        title: 'AS が PKCE を検証',
        text: 'AS は受け取った <code>code_verifier</code> を SHA-256 → base64url し、code 発行時に保存した <code>code_challenge</code> と比較します（RFC 7636 §4.6）。さらに code が未使用・期限内・同じ <code>client_id</code> 宛てで、<code>redirect_uri</code> が認可リクエストと同一であることも確認します。',
        code: { title: 'AS の検証', lang: 'text', src: `
          BASE64URL(SHA256("${V}"))
            = ${C}   ← 計算
            = ${C}   ← 保存済み code_challenge  ✓
          code 未使用 ✓ / 期限内 ✓ / client_id = ${CID} ✓
          redirect_uri 同一 ✓ / Basic 認証 ✓` },
        run: async (s) => {
          await s.show('a10', { fx: 'pop' });
          await s.scan('asst');
          const c = await s256(V);
          s.state('a10', c === C ? 'ok' : 'bad');
          s.state('asst', c === C ? 'ok' : 'bad');
        },
      },
      {
        title: 'AS → Client：トークンレスポンス（バック）',
        text: 'AS は <code>access_token</code>・<code>refresh_token</code>・<code>id_token</code> を JSON で返します（<code>Cache-Control: no-store</code>）。<strong>トークンはバックチャネルでだけ</strong>受け渡されました。',
        code: { title: 'idp.example → app.example', lang: 'http', src: `
          HTTP/1.1 200 OK
          Content-Type: application/json
          Cache-Control: no-store

          {
            "access_token": "SlAV32hkKG",
            "token_type": "Bearer",
            "expires_in": 3600,
            "refresh_token": "8xLOxBtZp8",
            ⟪"id_token": "${IDH}.${IDP.slice(0, 24)}…"⟫,
            "scope": "openid profile email"
          }` },
        run: async (s) => {
          s.state('asst', null);
          s.state('v-cv', null);
          await msg(s, 'as', 'cl', 464, '200 {access_token, id_token, …}', 'b');
          await s.show('tok', { fx: 'up' });
          s.state('tok', 'active');
        },
      },
      {
        title: 'Client → Browser：セッション Cookie だけを返す（フロント）',
        text: 'Client は <code>id_token</code> を検証して（次章）ログインを確立し、トークンはサーバー側セッションに保存します。ブラウザにはセッション ID を再発行した <code>HttpOnly</code> Cookie だけを返します。<strong>ブラウザには最後までトークンが渡っていません。</strong>',
        code: { title: 'app.example → Browser', lang: 'http', src: `
          HTTP/1.1 302 Found
          Location: https://app.example/
          Set-Cookie: __Host-sid=Yt7uQ2cM9aLr; Path=/; Secure; HttpOnly; SameSite=Lax` },
        run: async (s) => {
          s.state('tok', null);
          await msg(s, 'cl', 'br', 500, '302 / + Set-Cookie（トークンなし）', 'f');
          s.state('br', 'ok');
          s.state('cl', 'ok');
        },
      },
    ],
  });

  /* =====================================================================
   * Scene 3: id_token validation, Bearer, refresh
   * ===================================================================*/
  const API_GET = (tok) => `
    GET /v1/me HTTP/1.1
    Host: api.example
    ⟪Authorization: Bearer ${tok}⟫`;
  const API_200 = `
    HTTP/1.1 200 OK
    Content-Type: application/json

    {"sub":"24400320","name":"Alice","email":"alice@example.com"}`;
  const API_401 = `
    HTTP/1.1 ⟪401 Unauthorized⟫
    WWW-Authenticate: Bearer realm="api.example",
                      ⟪error="invalid_token"⟫,
                      error_description="The access token expired"`;
  const REFRESH_REQ = `
    POST /token HTTP/1.1
    Host: idp.example
    Authorization: Basic ${BASIC}
    Content-Type: application/x-www-form-urlencoded

    ⟪grant_type=refresh_token⟫&refresh_token=8xLOxBtZp8`;
  const REFRESH_RES = `
    HTTP/1.1 200 OK
    Content-Type: application/json
    Cache-Control: no-store

    {"access_token":"eVw3PqZs7K","token_type":"Bearer","expires_in":3600,
     "refresh_token":"Tq2nLb8XwR"}`;

  const clearId = (s) => s.hide('idt hdr jwks pay chk');

  TIM.scene('#sc-verify', {
    intro: 'トークンレスポンスを受け取った Client が <code>id_token</code> を検証してログインを確立し、<code>access_token</code> で API を呼び、期限切れを <code>refresh_token</code> で更新するまでです。<code>id_token</code> の署名部分はデモ用のダミー値です。',
    steps: [
      {
        title: 'id_token は header.payload.signature',
        text: '<code>id_token</code> を <code>.</code> で 3 つに分けます。各部分は base64url（パディングなし）。署名部分は RS256・2048 ビット鍵なら 256 バイト = 342 文字です（ここではダミー値）。',
        code: { title: 'id_token（3 部分）', lang: 'text', src: `
          ${IDH}
          .
          ${IDP}
          .
          ${IDS.slice(0, 64)}…（342 文字）` },
        run: async (s) => {
          await s.show('idt', { fx: 'zoom' });
          await s.pulse('p-h p-p p-s');
        },
      },
      {
        title: 'header をデコード：alg と kid',
        text: '<code>alg</code> は署名アルゴリズム、<code>kid</code> はどの鍵で署名したかの ID です。<strong><code>alg</code> はトークン自身の値を鵜呑みにせず</strong>、Client が想定する値（既定 RS256）と照合します（<code>none</code> や HS256 への差し替え対策）。',
        code: { title: 'bash', lang: 'bash', src: `
          $ printf '%s' '${IDH}' | tr '_-' '/+' | base64 -d
          {"alg":"RS256","kid":"1e9gdk7","typ":"JWT"}` },
        run: async (s) => {
          s.state('p-h', 'active');
          await s.show('hdr', { fx: 'up' });
        },
      },
      {
        title: 'jwks_uri から公開鍵を取得し、kid で選ぶ',
        text: 'Discovery の <code>jwks_uri</code> から JWK Set を取得（キャッシュ）し、<code>kid</code> が一致する鍵を選びます。未知の <code>kid</code> なら鍵がローテーションされた可能性があるので、JWKS を取り直します。',
        code: [
          { title: 'Client → AS', lang: 'bash', src: `
            $ curl -s https://idp.example/.well-known/jwks.json` },
          { title: 'レスポンス（n は RFC 7517 付録 A.1 の例を省略表示）', lang: 'json', src: `
            {"keys": [{
              "kty": "RSA",
              ⟪"kid": "1e9gdk7"⟫,
              "use": "sig",
              "alg": "RS256",
              "n": "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4…",
              "e": "AQAB"
            }]}` },
        ],
        run: async (s) => {
          s.state('p-h', null);
          await s.fly('cl:r', 'as:l', { label: 'GET /.well-known/jwks.json', cls: 'c-cyan', arc: -70 });
          await s.show('jwks', { fx: 'down' });
          await s.fly('as:l', 'cl:r', { label: 'JWK Set', cls: 'c-cyan', arc: 70 });
          s.state('jwks', 'active');
        },
      },
      {
        title: '署名を検証する（RS256 = RSASSA-PKCS1-v1_5 + SHA-256）',
        text: '署名対象は <code>ASCII(base64url(header) + "." + base64url(payload))</code>。選んだ公開鍵で signature を検証します。WebCrypto なら <code>crypto.subtle.verify</code>、実務では <code>jose</code> などのライブラリを使います。',
        code: { title: 'WebCrypto での検証', lang: 'js', src: `
          const key = await crypto.subtle.importKey('jwk', jwk,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
          const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key,
            base64urlDecode(signature),                        // 256 bytes
            new TextEncoder().encode(⟪header + '.' + payload⟫));` },
        run: async (s) => {
          s.state('jwks', null);
          await s.show('chk', { fx: 'up' });
          await s.scan('idt');
          s.state('p-s', 'ok');
          await verdict(s, 'k-sig', '✓ RS256 / kid 1e9gdk7', 'ok');
        },
      },
      {
        title: 'payload をデコードする',
        text: 'payload はクレームの JSON です。<code>sub</code> がユーザーの識別子（AS 内で一意・不変）。メールアドレスや名前ではなく <code>iss</code> + <code>sub</code> の組でユーザーを識別します。',
        code: { title: 'payload（base64url デコード）', lang: 'json', src: `
          {
            "iss": "https://idp.example",
            "sub": "24400320",
            "aud": "${CID}",
            "exp": 1790586000,
            "iat": 1790582400,
            "auth_time": 1790582395,
            "nonce": "${NO}"
          }` },
        run: async (s) => {
          s.state('p-p', 'active');
          await s.show('pay', { fx: 'up' });
        },
      },
      {
        title: 'iss と aud を確認する',
        text: '<code>iss</code> は Discovery の <code>issuer</code> と完全一致、<code>aud</code> は自分の <code>client_id</code> を含むこと。別の IdP のトークンや、同じ IdP で別アプリ向けに発行されたトークンをここで弾きます。',
        code: { title: '比較', lang: 'text', src: `
          iss  "https://idp.example"  == issuer（Discovery）   ✓
          aud  "${CID}"           ∋ client_id            ✓` },
        run: async (s) => {
          s.state('p-p', null);
          await verdict(s, 'k-iss', '= issuer ✓', 'ok');
          await verdict(s, 'k-aud', '= client_id ✓', 'ok');
        },
      },
      {
        title: 'exp・iat・nonce を確認 → ログイン確立',
        text: '現在時刻が <code>exp</code>（2026-09-28 09:00 UTC）より前か、<code>iat</code> が古すぎないか、<code>nonce</code> が認可リクエスト時にセッションへ保存した値と一致するかを確認します。すべて通ったので、<code>sub=24400320</code> としてログインを確立します。',
        code: { title: '比較（now = 1790582460 = 2026-09-28 08:01 UTC）', lang: 'text', src: `
          exp    1790586000  >  now 1790582460            ✓
          iat    1790582400  （60 秒前）                   ✓
          nonce  "${NO}"  ==  session.nonce         ✓
          ⟪→ ログイン確立：iss=https://idp.example, sub=24400320⟫` },
        run: async (s) => {
          await verdict(s, 'k-exp', '1790586000 > now ✓', 'ok');
          await verdict(s, 'k-non', '= session.nonce ✓', 'ok');
          s.state('chk', 'ok');
          s.state('cl', 'ok');
          await s.show('sub', { fx: 'pop' });
        },
      },
      {
        title: 'access_token を Bearer で API に送る',
        text: 'API を呼ぶときは <code>access_token</code> を <code>Authorization: Bearer</code> に入れます（RFC 6750 §2.1）。Client はこの文字列の中身を解釈しません（opaque として扱う）。',
        code: { title: 'Client → Resource Server', lang: 'http', src: API_GET('SlAV32hkKG') },
        run: async (s) => {
          await clearId(s);
          s.state('cl', null);
          await s.text('areqh', 'Client → Resource Server');
          await s.set('areqp', HTTP(API_GET('SlAV32hkKG')), { flash: false });
          await s.show('areq', { fx: 'up' });
          await s.fly('cl:br', 'rs:l', { label: 'Bearer SlAV32hkKG', cls: 'c-cyan' });
          s.state('rs', 'active');
        },
      },
      {
        title: 'API がトークンを検証して 200',
        text: 'この例の access_token は opaque なので、API は AS のイントロスペクションエンドポイント（RFC 7662）に問い合わせて有効性・スコープ・<code>sub</code> を確認します（JWT 形式なら JWKS でローカル検証）。',
        code: [
          { title: 'Resource Server → AS', lang: 'http', src: `
            POST /introspect HTTP/1.1
            Host: idp.example
            Authorization: Basic YXBpLmV4YW1wbGU6cjNzMHVyY2U=
            Content-Type: application/x-www-form-urlencoded

            token=SlAV32hkKG&token_type_hint=access_token` },
          { title: 'AS → Resource Server', lang: 'json', src: `
            {"active":true,"client_id":"${CID}","scope":"openid profile email",
             "sub":"24400320","exp":1790586000}` },
        ],
        run: async (s) => {
          await s.fly('rs:t', 'as:b', { label: 'POST /introspect', cls: 'c-violet' });
          await s.fly('as:b', 'rs:t', { label: '{"active":true}', cls: 'c-violet' });
          await s.text('aresh', 'Resource Server → Client');
          await s.set('aresp', HTTP(API_200), { flash: false });
          await s.show('ares', { fx: 'up' });
          await s.fly('rs:l', 'cl:br', { label: '200 OK', cls: 'c-green' });
          s.state('rs', 'ok');
        },
      },
      {
        title: '1 時間後：期限切れで 401 invalid_token',
        text: '<code>expires_in: 3600</code> を過ぎると、API は <code>401</code> と <code>WWW-Authenticate: Bearer error="invalid_token"</code> を返します（RFC 6750 §3）。スコープ不足なら <code>403</code> + <code>insufficient_scope</code> です。',
        code: { title: 'Resource Server → Client', lang: 'http', src: API_401 },
        run: async (s) => {
          s.state('rs', 'active');
          await s.fly('cl:br', 'rs:l', { label: 'Bearer SlAV32hkKG', cls: 'c-cyan' });
          await s.set('aresp', HTTP(API_401));
          s.state('ares', 'bad');
          await s.fly('rs:l', 'cl:br', { label: '401', cls: 'c-red' });
          s.state('cl', 'warn');
          s.state('rs', null);
        },
      },
      {
        title: 'refresh_token で access_token を更新する',
        text: 'Client は AS に <code>grant_type=refresh_token</code> を送り、新しい access_token を得ます（RFC 6749 §6）。ブラウザは関与しません。AS がローテーションしていれば新しい <code>refresh_token</code> も返り、古いものは使えなくなります。',
        code: [
          { title: 'Client → AS', lang: 'http', src: REFRESH_REQ },
          { title: 'AS → Client', lang: 'http', src: REFRESH_RES },
        ],
        run: async (s) => {
          await s.text('areqh', 'Client → AS（バックチャネル）');
          await s.set('areqp', HTTP(REFRESH_REQ));
          await s.fly('cl:r', 'as:l', { label: 'POST /token refresh_token', cls: 'c-cyan', arc: -70 });
          await s.text('aresh', 'AS → Client');
          await s.set('aresp', HTTP(REFRESH_RES));
          s.state('ares', 'ok');
          await s.fly('as:l', 'cl:r', { label: 'new access_token', cls: 'c-cyan', arc: 70 });
          s.state('cl', 'ok');
        },
      },
      {
        title: '新しいトークンで再試行 → 200',
        text: '新しい access_token で同じ API を呼び直して成功します。401 を受けたら 1 回だけ refresh → 再試行、refresh も失敗したら再ログイン（<code>/authorize</code> からやり直し）という制御が一般的です。',
        code: { title: 'Client → Resource Server', lang: 'http', src: API_GET('eVw3PqZs7K') },
        run: async (s) => {
          s.state('cl', null);
          await s.text('areqh', 'Client → Resource Server');
          await s.set('areqp', HTTP(API_GET('eVw3PqZs7K')));
          await s.fly('cl:br', 'rs:l', { label: 'Bearer eVw3PqZs7K', cls: 'c-cyan' });
          await s.text('aresh', 'Resource Server → Client');
          await s.set('aresp', HTTP(API_200));
          s.state('ares', 'ok');
          await s.fly('rs:l', 'cl:br', { label: '200 OK', cls: 'c-green' });
          s.state('rs', 'ok');
        },
      },
    ],
  });

  /* =====================================================================
   * Scene 4: attacks
   * ===================================================================*/
  const ERR_STATE = `
    HTTP/1.1 400 Bad Request          ← Client（app.example）自身の応答
    Content-Type: text/plain; charset=utf-8

    state mismatch`;
  const ERR_PKCE = `
    HTTP/1.1 400 Bad Request
    Content-Type: application/json
    Cache-Control: no-store

    {"error":"⟪invalid_grant⟫","error_description":"code_verifier does not match code_challenge"}`;
  const ERR_REDIR = `
    HTTP/1.1 400 Bad Request          ← AS のエラー画面（中身は実装依存）。evil.example へは 302 しない
    Content-Type: text/html; charset=utf-8

    <h1>invalid_request</h1><p>redirect_uri does not match the registered value</p>`;
  const ERR_DENIED = `
    HTTP/1.1 302 Found
    Location: https://app.example/callback?⟪error=access_denied⟫
        &error_description=The%20user%20denied%20the%20request
        &state=${ST}`;

  TIM.scene('#sc-attack', {
    intro: '攻撃者 mallory が、(1) 自分の認可コードを alice のブラウザに注入する login CSRF、(2) alice の認可コードを横取りしてトークンと交換、(3) <code>redirect_uri</code> をすり替えてコードを自分に送らせる、の 3 つを試みます。それぞれ <code>state</code>・PKCE・<code>redirect_uri</code> の完全一致がどこで止めるかを見ます。',
    steps: [
      {
        title: '攻撃者が自分のアカウントで code を入手する',
        text: 'mallory は自分のアカウントで app.example のログインを始め、AS から <code>/callback?code=…</code> へのリダイレクトを受け取ったところで止めます（自分では callback を開かない）。この code は <strong>mallory のアカウント</strong>に紐付いています。',
        code: { title: 'idp.example → mallory のブラウザ', lang: 'http', src: `
          HTTP/1.1 302 Found
          Location: https://app.example/callback?⟪code=${ATK_CODE}⟫&state=Zm9vYmFy` },
        run: async (s) => {
          await s.fly('atk:tr', 'as:bl', { label: 'mallory でログイン', cls: 'c-red' });
          await s.fly('as:bl', 'atk:tr', { label: '302 …/callback?code=Hq3Z…', cls: 'c-red', arc: 40 });
          await s.show('acode', { fx: 'pop' });
        },
      },
      {
        title: 'alice のブラウザに callback URL を開かせる（login CSRF）',
        text: '罠ページの <code>&lt;img&gt;</code> などで、mallory の code を載せた callback URL を alice のブラウザに読み込ませます。state を検証しない Client だと、alice のブラウザが<strong>mallory のアカウントでログインした状態</strong>になり、alice が入力したデータ（カード情報など）が mallory のアカウントに保存されます。',
        code: [
          { title: 'https://evil.example/ の罠ページ', lang: 'text', src: `
            <img src="https://app.example/callback?code=${ATK_CODE}&state=Zm9vYmFy">` },
          { title: 'alice のブラウザ → app.example', lang: 'http', src: `
            GET /callback?⟪code=${ATK_CODE}⟫&⟪state=Zm9vYmFy⟫ HTTP/1.1
            Host: app.example
            Cookie: __Host-sid=q8Zk2nV0pXw4` },
        ],
        run: async (s) => {
          await s.fly('atk:t', 'vb:b', { label: '&lt;img src=…/callback?code=…&gt;', cls: 'c-red' });
          await s.fly('vb:r', 'cl:l', { label: 'GET /callback?code=Hq3Z…', cls: 'c-amber' });
          s.state('cl', 'active');
        },
      },
      {
        title: 'Client：state 不一致で拒否',
        text: 'alice のセッションに保存された state（alice 自身がログインを開始していなければ「無し」）と、クエリの <code>state=Zm9vYmFy</code> が一致しません。Client は code をトークンと交換せずに 400 を返します。PKCE を使っていれば、mallory のセッションの verifier を alice のセッションが持っていないため、ここを抜けてもトークン交換で失敗します。',
        code: { title: 'Client の判定', lang: 'text', src: `
          session.state = "${ST}"（または無し）
          query.state   = "Zm9vYmFy"
          ⟪→ 不一致：code を /token に送らずに中断⟫` },
        run: async (s) => {
          await s.show('stc', { fx: 'up' });
          await s.text('st-s', ST + '（または無し）');
          await s.text('st-q', 'Zm9vYmFy');
          await verdict(s, 'st-r', '✗ 不一致 → 400', 'bad');
          s.state('cl', 'bad');
          s.shake('cl');
          await s.text('errh', 'Client のエラーレスポンス');
          await s.set('errp', HTTP(ERR_STATE), { flash: false });
          await s.show('err', { fx: 'up' });
          await s.stamp('cl', 'REJECTED', { cls: 'st-ok' });
        },
      },
      {
        title: '正規のフロー中に code が漏れる',
        text: '今度は alice 自身の正規ログインで発行された code が漏れたとします。例：モバイルで同じカスタム URL スキームを登録した悪意あるアプリ、ログやプロキシ、<code>Referer</code>。code は URL に載るフロントチャネルの値なので、<strong>漏れても使えない</strong>ようにしておく必要があります。',
        code: { title: '漏れた値', lang: 'text', src: `
          https://app.example/callback?⟪code=${CODE}⟫&state=${ST}
          （code_verifier は Client のサーバー側セッションにしかないので漏れない）` },
        run: async (s) => {
          unstamp(s, 'cl');
          s.state('cl', null);
          s.hide('stc err');
          await s.fly('vb:r', 'cl:l', { label: 'GET /callback?code=Splx…', cls: 'c-amber' });
          await s.fly('vb:b', 'atk:t', { label: 'code 漏えい', cls: 'c-red' });
          await s.text('acode', 'code=SplxlOBeZQQYbYS6…');
          s.state('acode', 'warn');
        },
      },
      {
        title: '攻撃者が code を /token に持ち込む',
        text: 'SPA やモバイルアプリなどの<strong>公開クライアント</strong>には <code>client_secret</code> がないので、PKCE がなければ code だけでトークンと交換できてしまいます。mallory は <code>code_verifier</code> を知らないので、推測した値を送るしかありません。',
        code: { title: 'mallory → idp.example', lang: 'http', src: `
          POST /token HTTP/1.1
          Host: idp.example
          Content-Type: application/x-www-form-urlencoded

          grant_type=authorization_code
          &code=${CODE}
          &redirect_uri=https%3A%2F%2Fapp.example%2Fcallback
          &client_id=${CID}
          &⟪code_verifier=${ATK_V}⟫   ← 推測` },
        run: async (s) => {
          s.state('acode', null);
          await s.fly('atk:tr', 'as:bl', { label: 'POST /token code=Splx…', cls: 'c-red' });
          await s.show('pkc', { fx: 'up' });
          await s.text('pk-v', ATK_V + '（推測）');
          s.state('as', 'active');
        },
      },
      {
        title: 'AS：S256(verifier) ≠ code_challenge → invalid_grant',
        text: 'AS は受け取った verifier をハッシュし、保存済みの <code>code_challenge</code> と比較します。一致しないので <code>400</code> <code>{"error":"invalid_grant"}</code>（RFC 7636 §4.6）。この比較値も<strong>ページ上で実際に SHA-256 を計算</strong>しています。',
        code: { title: 'idp.example → mallory（RFC 6749 §5.2 の形式）', lang: 'http', src: ERR_PKCE },
        run: async (s) => {
          await s.scan('pkc');
          const h = await s256(ATK_V);
          await s.scramble('pk-h', h, { dur: 900, chars: B64U });
          await verdict(s, 'pk-r', h === C ? '一致' : '✗ 不一致 → invalid_grant', h === C ? 'ok' : 'bad');
          s.state('pkc', 'bad');
          s.state('as', 'ok');
          await s.text('errh', 'AS のエラーレスポンス');
          await s.set('errp', HTTP(ERR_PKCE), { flash: false });
          await s.show('err', { fx: 'up' });
          await s.fly('as:bl', 'atk:tr', { label: '400 invalid_grant', cls: 'c-red', arc: 40 });
          s.state('atk', 'bad');
          s.shake('atk');
          await s.stamp('atk', 'DENIED', { cls: 'st-bad' });
        },
      },
      {
        title: '正規の Client は verifier を持っているので交換できる',
        text: 'code_verifier は Client のサーバー側セッションにしかなく、URL にもログにも載っていません。一致する verifier を送れるのは、認可リクエストを始めた正規の Client だけです。PKCE がなければ、ひとつ前の攻撃者の要求がそのまま通っていました。',
        code: { title: 'AS の検証（正規 Client の要求）', lang: 'text', src: `
          BASE64URL(SHA256("${V}"))
            = ${C}  == code_challenge ✓
          ⟪→ 200 access_token / id_token を発行⟫` },
        run: async (s) => {
          s.hide('err');
          await s.fly('cl:r', 'as:l', { label: 'POST /token（正しい verifier）', cls: 'c-cyan' });
          await s.text('pk-v', V);
          const h = await s256(V);
          await s.scramble('pk-h', h, { dur: 900, chars: B64U });
          await verdict(s, 'pk-r', h === C ? '✓ 一致 → トークン発行' : '不一致', h === C ? 'ok' : 'bad');
          s.state('pkc', 'ok');
          await s.fly('as:l', 'cl:r', { label: '200 tokens', cls: 'c-cyan', arc: 30 });
          s.state('cl', 'ok');
        },
      },
      {
        title: 'redirect_uri をすり替えた認可 URL を踏ませる',
        text: '次に mallory は、<code>redirect_uri=https://evil.example/cb</code> に書き換えた認可 URL を alice に踏ませ、alice の code を自分のサーバーに届けさせようとします。',
        code: { title: 'alice のブラウザ → idp.example', lang: 'http', src: `
          GET /authorize?response_type=code&client_id=${CID}
              &⟪redirect_uri=https%3A%2F%2Fevil.example%2Fcb⟫
              &scope=openid&state=xyz&code_challenge=…&code_challenge_method=S256 HTTP/1.1
          Host: idp.example` },
        run: async (s) => {
          s.hide('pkc');
          unstamp(s, 'atk');
          s.state('atk cl', null);
          await s.fly('atk:t', 'vb:b', { label: 'リンク …redirect_uri=evil…', cls: 'c-red' });
          await s.fly('vb:r', 'as:l', { label: 'GET /authorize?…redirect_uri=https://evil.example/cb', cls: 'c-amber', arc: -80 });
          s.state('as', 'active');
        },
      },
      {
        title: 'AS：完全一致しない → エラー画面（リダイレクトしない）',
        text: 'AS は <code>redirect_uri</code> を登録値と<strong>文字列の完全一致</strong>で比較します（RFC 9700 §2.1）。不一致ならユーザーにエラーを表示し、<strong>その URI へは自動でリダイレクトしません</strong>（RFC 6749 §4.1.2.1）。前方一致やワイルドカードでの照合は、オープンリダイレクトやコード漏えいの原因になります。',
        code: { title: 'idp.example → alice のブラウザ', lang: 'http', src: ERR_REDIR },
        run: async (s) => {
          await s.show('rdc', { fx: 'up' });
          await s.scan('rdc');
          await verdict(s, 'rd-r', '✗ 不一致 → リダイレクトしない', 'bad');
          s.state('as', 'ok');
          await s.text('errh', 'AS の応答（エラー画面）');
          await s.set('errp', HTTP(ERR_REDIR), { flash: false });
          await s.show('err', { fx: 'up' });
          await s.fly('as:l', 'vb:r', { label: '400 エラー画面', cls: 'c-gray', arc: 80 });
          await s.stamp('as', 'BLOCKED', { cls: 'st-ok' });
        },
      },
      {
        title: '認可エンドポイントのエラーは redirect_uri へ（例：同意拒否）',
        text: 'redirect_uri が正しい場合のエラー（ユーザーが同意を拒否した等）は、<code>redirect_uri</code> へのクエリ <code>error</code>・<code>error_description</code>・<code>state</code> で Client に伝えます（RFC 6749 §4.1.2.1）。トークンエンドポイントのエラーは JSON 本文です（§5.2）。',
        code: [
          { title: '認可エンドポイント → Browser → Client', lang: 'http', src: ERR_DENIED },
          { title: 'トークンエンドポイントのエラー（§5.2）', lang: 'json', src: `
            {"error": "invalid_grant", "error_description": "…", "error_uri": "…(任意)"}` },
        ],
        run: async (s) => {
          unstamp(s, 'as');
          s.hide('rdc');
          s.state('as', null);
          await s.text('errh', '認可エラーのリダイレクト（state 付き）');
          await s.set('errp', HTTP(ERR_DENIED));
          await s.fly('as:l', 'vb:r', { label: '302 ?error=access_denied&state=…', cls: 'c-amber', arc: 80 });
          await s.fly('vb:r', 'cl:l', { label: 'GET /callback?error=…', cls: 'c-amber' });
          s.state('cl', 'warn');
        },
      },
    ],
  });

  /* =====================================================================
   * Scene 5: other grants
   * ===================================================================*/
  const CC_REQ = `
    POST /token HTTP/1.1
    Host: idp.example
    Authorization: Basic cmVwb3J0cy1qb2I6N3FXZXJ0eVVpb3A=
    Content-Type: application/x-www-form-urlencoded

    ⟪grant_type=client_credentials⟫&scope=reports.read`;
  const CC_RES = `
    HTTP/1.1 200 OK
    Content-Type: application/json
    Cache-Control: no-store

    {
      "access_token": "Zx8cV2bN4mQ7",
      "token_type": "Bearer",
      "expires_in": 3600,
      "scope": "reports.read"
    }`;
  const DA_RES = `
    HTTP/1.1 200 OK
    Content-Type: application/json

    {
      "device_code": "GmRhmhcxhwAzkoEqiMEg_DnyEysNkuNhszIySk9eS",
      ⟪"user_code": "WDJB-MJHT"⟫,
      "verification_uri": "https://idp.example/device",
      "expires_in": 1800,
      "interval": 5
    }`;
  const DA_POLL = (res) => `
    POST /token HTTP/1.1
    Host: idp.example
    Content-Type: application/x-www-form-urlencoded

    grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code
    &device_code=GmRhmhcxhwAzkoEqiMEg_DnyEysNkuNhszIySk9eS
    &client_id=tv-app

    ${res}`;

  TIM.scene('#sc-grants', {
    intro: 'ユーザーがいないバッチ処理の <code>client_credentials</code>、ブラウザ操作が難しい端末の Device Authorization Grant（RFC 8628）、そして今は使わない Implicit と ROPC を並べます。',
    steps: [
      {
        title: 'client_credentials：Client 自身の権限でトークンを取る',
        text: 'ユーザーが関与しないサーバー間通信（夜間バッチなど）では、Client が自分の資格情報だけで <code>POST /token</code> します（RFC 6749 §4.4）。リダイレクトも同意画面もありません。',
        code: { title: 'reports-job → idp.example', lang: 'http', src: CC_REQ },
        run: async (s) => {
          await s.text('cardh', 'reports-job → AS');
          await s.set('cardp', HTTP(CC_REQ), { flash: false });
          await s.show('card', { fx: 'up' });
          await s.fly('job:r', 'as:l', { label: 'POST /token', cls: 'c-cyan' });
          s.state('as', 'active');
        },
      },
      {
        title: 'access_token だけが返り、API を呼ぶ',
        text: 'ユーザーがいないので <code>id_token</code> はなく、<code>refresh_token</code> も通常含まれません（必要になれば同じ要求をやり直す）。取得した access_token を Bearer で API に送ります。',
        code: { title: 'idp.example → reports-job', lang: 'http', src: CC_RES },
        run: async (s) => {
          await s.text('cardh', 'AS → reports-job');
          await s.set('cardp', HTTP(CC_RES));
          await s.fly('as:l', 'job:r', { label: '200 access_token', cls: 'c-cyan', arc: 30 });
          await s.fly('job:r', 'rs:l', { label: 'Bearer Zx8cV2bN4mQ7', cls: 'c-cyan', arc: 130 });
          s.state('as', null);
          s.state('rs', 'ok');
        },
      },
      {
        title: 'Device Grant：端末が device_code と user_code を受け取る',
        text: 'TV や CLI は <code>POST /device_authorization</code>（RFC 8628 §3.1）で、ポーリング用の <code>device_code</code> と、人間が入力する短い <code>user_code</code> を受け取ります。',
        code: [
          { title: 'Device → idp.example', lang: 'http', src: `
            POST /device_authorization HTTP/1.1
            Host: idp.example
            Content-Type: application/x-www-form-urlencoded

            client_id=tv-app&scope=openid%20profile` },
          { title: 'idp.example → Device（device_code・user_code は RFC 8628 §3.2 の例）', lang: 'http', src: DA_RES.replace('"verification_uri": "https://idp.example/device",', '"verification_uri": "https://idp.example/device",\n      "verification_uri_complete": "https://idp.example/device?user_code=WDJB-MJHT",') },
        ],
        run: async (s) => {
          s.state('rs', null);
          await s.show('dev', { fx: 'right' });
          await s.fly('dev:tr', 'as:bl', { label: 'POST /device_authorization', cls: 'c-cyan' });
          await s.text('cardh', 'AS → Device');
          await s.set('cardp', HTTP(DA_RES));
          await s.fly('as:bl', 'dev:tr', { label: 'device_code / user_code', cls: 'c-cyan', arc: 40 });
        },
      },
      {
        title: '端末は user_code を表示し、ポーリングを始める',
        text: '端末は「<code>https://idp.example/device</code> で <code>WDJB-MJHT</code> を入力してください」と表示し、<code>interval</code>（5 秒）ごとにトークンエンドポイントをポーリングします。ユーザーの承認前は <code>authorization_pending</code>、速すぎると <code>slow_down</code>（間隔を 5 秒延ばす）が返ります。',
        code: { title: 'Device → idp.example（ポーリング）', lang: 'http', src: DA_POLL('HTTP/1.1 400 Bad Request\n    {"error":"⟪authorization_pending⟫"}') },
        run: async (s) => {
          await s.show('uc', { fx: 'pop' });
          await s.text('cardh', 'Device ⇄ AS（ポーリング）');
          await s.set('cardp', HTTP(DA_POLL('HTTP/1.1 400 Bad Request\n    {"error":"⟪authorization_pending⟫"}')));
          await s.fly('dev:tr', 'as:bl', { label: 'POST /token device_code', cls: 'c-cyan' });
          await s.fly('as:bl', 'dev:tr', { label: '400 authorization_pending', cls: 'c-amber', arc: 40 });
          s.state('dev', 'warn');
        },
      },
      {
        title: 'alice がスマホで user_code を入力して承認',
        text: 'alice は別の端末（スマホ）のブラウザで <code>verification_uri</code> を開き、<code>user_code</code> を入力、ログインして同意します。端末側はパスワードを一切扱いません。攻撃者が自分の user_code を入力させるフィッシングがあるので、承認画面では端末名やスコープを確認させます。',
        code: { title: 'alice のスマホ（画面は AS の実装）', lang: 'text', src: `
          1. https://idp.example/device を開く
          2. コード ⟪WDJB-MJHT⟫ を入力
          3. idp.example にログイン（パスワード / パスキー）
          4. 「tv-app が openid profile へのアクセスを求めています」→ 許可` },
        run: async (s) => {
          await s.show('ph', { fx: 'left' });
          await s.fly('ph:tl', 'as:br', { label: 'WDJB-MJHT + ログイン + 同意', cls: 'c-amber' });
          s.state('ph', 'ok');
          s.state('as', 'active');
        },
      },
      {
        title: '次のポーリングでトークンが返る',
        text: '承認後のポーリングで <code>200</code> とトークンが返ります。<code>device_code</code> の期限（<code>expires_in: 1800</code> 秒）を過ぎると <code>expired_token</code>、拒否されると <code>access_denied</code> です。',
        code: { title: 'idp.example → Device', lang: 'http', src: DA_POLL('HTTP/1.1 200 OK\n    {"access_token":"W9pLk2Xv7a","token_type":"Bearer","expires_in":3600,\n     "id_token":"eyJhbGciOiJSUzI1NiIs…"}') },
        run: async (s) => {
          await s.set('cardp', HTTP(DA_POLL('HTTP/1.1 200 OK\n    {"access_token":"W9pLk2Xv7a","token_type":"Bearer",\n     "expires_in":3600,"id_token":"eyJhbGciOiJSUzI1NiIs…"}')));
          await s.fly('dev:tr', 'as:bl', { label: 'POST /token device_code', cls: 'c-cyan' });
          await s.fly('as:bl', 'dev:tr', { label: '200 tokens', cls: 'c-green', arc: 40 });
          s.state('dev', 'ok');
          s.state('as', null);
        },
      },
      {
        title: '使わない 2 つ：Implicit と Resource Owner Password Credentials',
        text: '<b>Implicit</b>（<code>response_type=token</code>）は access_token を URL フラグメントで直接ブラウザに渡すため漏えい・注入に弱く、RFC 9700 は使うべきでない（SHOULD NOT）としています。<b>ROPC</b>（<code>grant_type=password</code>）は Client がユーザーのパスワードを扱うため、使ってはならない（MUST NOT）とされています。どちらも認可コード + PKCE に置き換えます。',
        code: { title: '非推奨フローの実物（参考）', lang: 'http', src: `
          # Implicit：トークンがブラウザの URL に載る
          HTTP/1.1 302 Found
          Location: https://app.example/cb⟪#access_token=SlAV32hkKG⟫&token_type=Bearer&expires_in=3600&state=${ST}

          # ROPC：Client がパスワードを受け取って送る
          POST /token HTTP/1.1
          Content-Type: application/x-www-form-urlencoded

          ⟪grant_type=password&username=alice&password=********⟫` },
        run: async (s) => {
          s.hide('card');
          await s.show('imp ropc', { fx: 'up', stagger: 150 });
          await s.stamp('imp', 'SHOULD NOT', { cls: 'st-warn' });
          await s.stamp('ropc', 'MUST NOT', { cls: 'st-bad' });
        },
      },
    ],
  });

  /* =====================================================================
   * Lab: PKCE calculator
   * ===================================================================*/
  function pkceLab() {
    const $ = (id) => document.getElementById(id);
    const inp = $('pk-v');
    if (!inp) return;
    const out = $('pk-c'), st = $('pk-st'), url = $('pk-url');
    const RE = /^[A-Za-z0-9\-._~]+$/;
    let seq = 0;
    async function update() {
      const v = inp.value.trim();
      const my = ++seq;
      if (v.length < 43 || v.length > 128 || !RE.test(v)) {
        out.textContent = '—';
        st.className = 'lab-st bad';
        st.textContent = !RE.test(v) ? '使えない文字が含まれています（A-Z a-z 0-9 - . _ ~ のみ）' : '長さ ' + v.length + ' 文字：43〜128 文字にしてください（RFC 7636 §4.1）';
        url.innerHTML = '';
        return;
      }
      if (!window.crypto || !crypto.subtle) {
        st.className = 'lab-st bad';
        st.textContent = 'このコンテキストでは crypto.subtle が使えません（https か localhost で開いてください）';
        return;
      }
      const c = await s256(v);
      if (my !== seq) return;
      out.textContent = c;
      st.className = 'lab-st ok';
      st.textContent = '✓ verifier ' + v.length + ' 文字 → SHA-256（32 バイト）→ base64url ' + c.length + ' 文字' + (v === V ? (c === C ? '　RFC 7636 付録 B の期待値と一致' : '　期待値と不一致') : '');
      const q = [
        ['response_type', 'code'], ['client_id', CID], ['redirect_uri', 'https://app.example/callback'],
        ['scope', 'openid profile email'], ['state', ST], ['nonce', NO],
        ['code_challenge', c], ['code_challenge_method', 'S256'],
      ];
      const lines = ['HTTP/1.1 302 Found', 'Location: https://idp.example/authorize?' + q[0][0] + '=' + q[0][1]];
      q.slice(1).forEach(([k, x]) => {
        const kv = k + '=' + encodeURIComponent(x);
        lines.push('    &' + (k === 'code_challenge' ? '⟪' + kv + '⟫' : kv));
      });
      url.innerHTML = '<code>' + TIM.codeLines(lines.join('\n'), 'http') + '</code>';
    }
    inp.addEventListener('input', update);
    $('pk-gen').addEventListener('click', () => {
      inp.value = TIM.b64u.enc(crypto.getRandomValues(new Uint8Array(32)));
      update();
    });
    $('pk-rfc').addEventListener('click', () => { inp.value = V; update(); });
    update();
  }
  pkceLab();
})();
