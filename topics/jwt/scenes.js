/* JWT — scenes + live lab.
 * Every token / hash / signature shown on this page is computed in the browser with WebCrypto.
 */
(async function () {
  'use strict';
  const b64 = TIM.b64u.enc;
  const esc = TIM.esc;
  const J = (o) => JSON.stringify(o);
  const PJ = (o) => JSON.stringify(o, null, 2);
  const cut = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);
  const B64CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const code = (lang, src) => '<pre data-lang="' + lang + '" data-done="1"><code>' + TIM.codeLines(TIM.dedent(src), lang) + '</code></pre>';
  const tokHTML = (t) => {
    const p = String(t).split('.');
    if (p.length < 2) return esc(t);
    return '<span class="th">' + esc(p[0]) + '</span><span class="td">.</span><span class="tp">' + esc(p[1]) + '</span><span class="td">.</span><span class="ts">' + esc(p.slice(2).join('.')) + '</span>';
  };
  const pemOf = (label, buf) => {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return '-----BEGIN ' + label + '-----\n' + btoa(s).match(/.{1,64}/g).join('\n') + '\n-----END ' + label + '-----';
  };
  const rnd = (n) => Array.from({ length: n }, () => B64CH[(Math.random() * 64) | 0]).join('');
  // bash helper (plain string on purpose: contains ${...} that must not be JS-interpolated)
  const DECODE_FN = '$ b64url_decode() { local s="${1//-/+}"; s="${s//_//}"; case $(( ${#s} % 4 )) in 2) s+="==";; 3) s+="=";; esac; printf \'%s\' "$s" | base64 -d; }';

  /* ------------------------------------------------------------------
   * Data (computed live)
   * ----------------------------------------------------------------*/
  const SECRET = 'demo-only-7fK2pQ9xV4mL8sR1tW6zY3bN';
  const HS_H = { alg: 'HS256', typ: 'JWT' };
  const HS_P = { sub: '42', name: 'alice', role: 'user', iat: 1790000000, exp: 1790000900 };
  const RS_H = { alg: 'RS256', typ: 'JWT', kid: '2026-09' };
  const RS_P = { iss: 'https://auth.example.com', sub: '42', aud: 'api.example.com', scope: 'users:read', iat: 1790000000, exp: 1790000900 };
  const D = { live: false };
  D.hsH = b64(J(HS_H));
  D.hsP = b64(J(HS_P));
  D.hsIn = D.hsH + '.' + D.hsP;
  D.tP = b64(J(Object.assign({}, HS_P, { role: 'admin' })));
  D.tIn = D.hsH + '.' + D.tP;
  D.rsIn = b64(J(RS_H)) + '.' + b64(J(RS_P));
  try {
    const mac = await TIM.hmac('SHA-256', SECRET, D.hsIn);
    D.hsHex = TIM.hex(mac);
    D.hsSig = b64(mac);
    D.tSig = b64(await TIM.hmac('SHA-256', SECRET, D.tIn));
    const kp = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true, ['sign', 'verify']);
    D.jwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
    D.privPem = pemOf('PRIVATE KEY', await crypto.subtle.exportKey('pkcs8', kp.privateKey));
    D.pubPem = pemOf('PUBLIC KEY', await crypto.subtle.exportKey('spki', kp.publicKey));
    D.rsSha = TIM.hex(await TIM.sha256(D.rsIn));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, TIM.te.encode(D.rsIn));
    D.rsSig = b64(sig);
    D.rsOk = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', kp.publicKey, sig, TIM.te.encode(D.rsIn));
    D.live = true;
  } catch (e) {
    console.warn('[jwt] WebCrypto unavailable — falling back to format-only sample values', e);
    D.hsHex = Array.from({ length: 64 }, () => '0123456789abcdef'[(Math.random() * 16) | 0]).join('');
    D.hsSig = rnd(43); D.tSig = rnd(43); D.rsSig = rnd(342); D.rsSha = D.hsHex; D.rsOk = true;
    D.jwk = { kty: 'RSA', n: rnd(342), e: 'AQAB' };
    D.privPem = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQ' + rnd(14) + '\n-----END PRIVATE KEY-----';
    D.pubPem = '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA' + rnd(20) + '\n-----END PUBLIC KEY-----';
  }
  D.hsTok = D.hsIn + '.' + D.hsSig;
  D.forged = D.tIn + '.' + D.hsSig;
  D.rsTok = D.rsIn + '.' + D.rsSig;
  const pemHead = (pem, n, w) => pem.split('\n').slice(0, n).map((l) => cut(l, w)).join('\n') + '\n…';

  const hero = document.getElementById('tokhero');
  if (hero) hero.innerHTML = tokHTML(D.hsTok);

  /* ------------------------------------------------------------------
   * Scene 1 — overview (RS256)
   * ----------------------------------------------------------------*/
  const jwksJson = (nLen) => '{\n  "keys": [\n    {\n      "kty": "RSA",\n      "use": "sig",\n      "alg": "RS256",\n      "kid": "2026-09",\n      "n": "' + cut(D.jwk.n, nLen) + '",\n      "e": "' + D.jwk.e + '"\n    }\n  ]\n}';

  TIM.scene('#sc-overview', {
    intro: 'ログイン済みの SPA がアクセストークン（JWT）を受け取り、それを使って API を呼び、API が署名を検証するまで。<b>署名する鍵</b>と<b>検証する鍵</b>が別のホストにあることに注目してください。',
    steps: [
      {
        title: '登場人物と、鍵の置き場所',
        text: '署名用の<b>秘密鍵は認可サーバーだけ</b>が持ちます（ファイル、または KMS / HSM）。対になる<b>公開鍵</b>は JWK Set として <code>/.well-known/jwks.json</code> で誰でも取得できるように公開します。API は公開鍵しか持ちません。',
        code: { title: 'どこに何があるか', lang: 'tree', src: `
          auth.example.com
          ├── /etc/auth/keys/2026-09.pem        # 秘密鍵 (0600) ← 署名に使う
          └── /.well-known/jwks.json            # 公開鍵 (JWK Set) を配信
          api.example.com
          └── (memory) JWKS キャッシュ           # 検証に使う` },
        run: async (s) => {
          await s.show('priv', { fx: 'pop' });
          await s.show('jwksep', { fx: 'pop' });
          s.pulse('priv');
        },
      },
      {
        title: 'SPA がトークンを要求する',
        text: 'ログイン（認可コードフロー）を終えた SPA が、認可コードと PKCE の <code>code_verifier</code> をトークンエンドポイントに送ります。フローの詳細は <a href="../oauth-oidc/">OAuth 2.0 / OIDC</a> で。',
        code: { title: 'HTTP request', lang: 'http', src: `
          POST /oauth/token HTTP/1.1
          Host: auth.example.com
          Content-Type: application/x-www-form-urlencoded

          grant_type=authorization_code&code=SplxlOBeZQQYbYS6WxSbIA
          &redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback
          &client_id=spa&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk` },
        run: async (s) => {
          s.line('spa:r', 'idp:l', { cls: 'dash', arrow: false, id: 'l1' });
          await s.fly('spa:r', 'idp:l', { label: 'POST /oauth/token', cls: 'c-blue', arc: -20 });
          s.state('idp', 'active');
        },
      },
      {
        title: '認可コードとユーザーを確認する',
        text: '認可サーバーは DB で認可コードの有効性・<code>client_id</code>・<code>code_challenge</code> との一致を確認し、誰のトークンを発行するか（<code>sub</code>）を決めます。',
        code: { title: 'SQL', lang: 'text', src: `
          SELECT user_id, client_id, code_challenge, expires_at
            FROM authorization_codes
           WHERE code = 'SplxlOBeZQQYbYS6WxSbIA' AND used = false;
          -- → user_id = 42, client_id = 'spa'` },
        run: async (s) => {
          await s.fly('idp:b', 'udb:t', { label: 'SELECT', cls: 'c-pink', dur: 600 });
          s.state('udb', 'ok');
          await s.fly('udb:t', 'idp:b', { label: 'user 42', cls: 'c-pink', dur: 600 });
          s.state('udb', null);
        },
      },
      {
        title: 'ヘッダとクレーム（payload）を組み立てる',
        text: '誰の（<code>sub</code>）、誰が発行した（<code>iss</code>）、どの API 向けの（<code>aud</code>）、いつまで有効な（<code>exp</code>）トークンかを JSON で表します。<code>kid</code> は「どの鍵で署名したか」の目印です。',
        code: [
          { title: 'JOSE header', lang: 'json', src: J(RS_H) },
          { title: 'payload (claims)', lang: 'json', src: PJ(RS_P) },
        ],
        run: async (s) => {
          await s.show('claims', { fx: 'right' });
        },
      },
      {
        title: '秘密鍵で署名する（RS256）',
        text: '<code>BASE64URL(header) + "." + BASE64URL(payload)</code> の ASCII バイト列を SHA-256 でハッシュし、RSA 秘密鍵で署名（RSASSA-PKCS1-v1_5）。署名を base64url して 3 つ目のパートにします。右の値は、このページで生成した鍵で実際に署名したものです。',
        code: [
          { title: 'Node.js (jose)', lang: 'js', src: `
            const token = await new SignJWT({ scope: 'users:read' })
              .setProtectedHeader({ alg: 'RS256', kid: '2026-09' })
              .setIssuer('https://auth.example.com')
              .setSubject('42').setAudience('api.example.com')
              .setIssuedAt().setExpirationTime('15m')
              .sign(privateKey);   // ← /etc/auth/keys/2026-09.pem` },
          { title: 'signature (base64url, live)', lang: 'text', src: cut(D.rsSig, 120) },
        ],
        run: async (s) => {
          s.pulse('priv');
          await s.fly('priv:r', 'claims:l', { label: 'RS256 sign', cls: 'c-pink', arc: 30 });
          await s.scan('claims');
          await s.swap('claims', 'tok');
          s.text('t1', cut(D.rsIn.split('.')[0], 9), { flash: false });
          s.text('t2', cut(D.rsIn.split('.')[1], 9), { flash: false });
          await s.scramble('t3', cut(D.rsSig, 12), { chars: B64CH, dur: 900 });
          await s.stamp('tok', 'SIGNED', { cls: 'st-acc' });
          s.state('idp', null);
        },
      },
      {
        title: 'トークンを SPA に返す',
        text: 'トークンレスポンス（RFC 6749 §5.1）として JSON で返します。SPA はこれを<b>メモリ</b>に保持し、API 呼び出しのたびに付けます。',
        code: { title: 'HTTP response', lang: 'http', src: `
          HTTP/1.1 200 OK
          Content-Type: application/json
          Cache-Control: no-store

          {
            "access_token": "${cut(D.rsTok, 48)}",
            "token_type": "Bearer",
            "expires_in": 900
          }` },
        run: async (s) => {
          s.hide('l1');
          await s.fly('idp:l', 'spa:r', { label: 'access_token (JWT)', cls: 'c-pink', arc: 20 });
          await s.show('resp');
          await s.show('mem', { fx: 'pop' });
        },
      },
      {
        title: 'API を呼ぶ：Authorization: Bearer',
        text: 'SPA は <code>Authorization</code> ヘッダに <code>Bearer</code> スキーム（RFC 6750）でトークンを載せます。API から見れば、このヘッダがすべてです。',
        code: { title: 'HTTP request', lang: 'http', src: `
          GET /v1/me HTTP/1.1
          Host: api.example.com
          Authorization: Bearer ${cut(D.rsTok, 40)}` },
        run: async (s) => {
          await s.show('req');
          s.line('req:r', 'api:l', { cls: 'dash c-lime', arrow: false, id: 'l2' });
          await s.fly('req:r', 'api:l', { label: 'Bearer eyJhbGci…', cls: 'c-lime' });
          s.state('api', 'active');
        },
      },
      {
        title: '公開鍵（JWKS）を取得してキャッシュする',
        text: 'API は起動時または未知の <code>kid</code> を見たときだけ JWKS を取得し、メモリにキャッシュします。<code>n</code> は RSA の法（modulus）、<code>e</code> は公開指数（65537 = <code>AQAB</code>）で、どちらも base64url です。',
        code: [
          { title: 'GET https://auth.example.com/.well-known/jwks.json', lang: 'json', src: jwksJson(64) },
        ],
        run: async (s) => {
          s.line('jwkc:t', 'jwksep:b', { cls: 'dash c-green', label: 'fetch & cache', id: 'l3' });
          await s.fly('jwksep:b', 'jwkc:t', { label: 'JWKS', cls: 'c-green', dur: 700 });
          await s.set('jwkcb', TIM.codeLines('{ "keys": [ { "kty": "RSA",\n    "kid": "2026-09", "use": "sig",\n    "alg": "RS256", "e": "' + D.jwk.e + '",\n    "n": "' + cut(D.jwk.n, 18) + '" } ] }', 'json'), { flash: false });
          await s.show('jwkc', { fx: 'zoom' });
        },
      },
      {
        title: '公開鍵で署名を検証して、200 を返す',
        text: 'ヘッダの <code>kid</code> で JWKS から鍵を選び、署名を検証。続けて <code>exp</code>（期限）・<code>iss</code>（発行者）・<code>aud</code>（自分宛てか）を確認し、通ったら <code>sub</code> をユーザー ID として処理します。',
        code: { title: 'API (jose)', lang: 'js', src: `
          const JWKS = createRemoteJWKSet(
            new URL('https://auth.example.com/.well-known/jwks.json'));
          const { payload } = await jwtVerify(token, JWKS, {
            issuer: 'https://auth.example.com',
            audience: 'api.example.com',
            algorithms: ['RS256'],
          });
          // payload.sub === '42'` },
        run: async (s) => {
          await s.fly('jwkc:l', 'api:r', { label: 'n, e', cls: 'c-green', dur: 600 });
          await s.scan('api');
          await s.show('chk', { fx: 'pop' });
          await s.stamp('api', 'VERIFIED', { cls: 'st-ok' });
          s.state('api', 'ok');
          await s.fly('api:l', 'req:r', { label: '200 OK', cls: 'c-green' });
          await s.show('got', { fx: 'pop' });
        },
      },
      {
        title: '認可サーバーには毎回問い合わせない',
        text: '検証は API のメモリ内で完結するため、認可サーバーが遅くても・落ちていても（JWKS がキャッシュにある限り）API は動きます。その代わり、<b>発行済みトークンは <code>exp</code> まで取り消せません</b>。これが JWT の最大のトレードオフです。',
        run: async (s) => {
          s.state('idp udb', 'dim');
          await s.caption('検証 = 公開鍵 + 時計だけ。<code>exp</code> までは取り消せない');
        },
      },
    ],
  });

  /* ------------------------------------------------------------------
   * Scene 2 — structure (HS256)
   * ----------------------------------------------------------------*/
  const hsPc = J(HS_P);
  TIM.scene('#sc-structure', {
    intro: 'header → base64url、payload → base64url、その 2 つを <code>.</code> でつないだ文字列に HMAC-SHA256 → base64url。表示している値はすべてこのブラウザで計算した本物です（シークレットは <code>' + SECRET + '</code>）。',
    steps: [
      {
        title: 'Header：どのアルゴリズムで署名したか',
        text: '<code>alg</code> は署名アルゴリズム、<code>typ</code> はメディアタイプ。最初はこの 2 つだけの小さな JSON です。空白の有無も含めて<b>このバイト列そのもの</b>が署名対象になります。',
        code: { title: 'header', lang: 'json', src: J(HS_H) },
        run: async (s) => { await s.show('hj', { fx: 'right' }); },
      },
      {
        title: 'Header を base64url する',
        text: 'UTF-8 のバイト列を base64 にして、<code>+</code>→<code>-</code>、<code>/</code>→<code>_</code>、末尾の <code>=</code> を削除。<code>{"alg"</code> で始まる JSON は必ず <code>eyJhbGci</code> で始まるので、「eyJ で始まる文字列を見たら JWT を疑え」と言われます。',
        code: { title: 'shell', lang: 'bash', src: `
          $ printf '%s' '${J(HS_H)}' | base64 | tr '+/' '-_' | tr -d '=\\n'
          ⟪${D.hsH}⟫` },
        run: async (s) => {
          s.line('hj:r', 'hb:l', { cls: 'acc c-pink', label: 'base64url' });
          await s.show('hb', { fx: 'left' });
          s.text('hbn', String(D.hsH.length), { flash: false });
          await s.scramble('hbv', D.hsH, { chars: B64CH, dur: 1000 });
        },
      },
      {
        title: 'Payload：クレーム（主張）の集合',
        text: '<code>sub</code> = 誰の、<code>iat</code> = いつ発行、<code>exp</code> = いつまで（UNIX 秒）。<code>name</code> や <code>role</code> のような独自クレームも自由に入れられますが、<b>誰でも読める</b>ことを忘れずに。',
        code: { title: 'payload', lang: 'json', src: PJ(HS_P) },
        run: async (s) => { await s.show('pj', { fx: 'right' }); },
      },
      {
        title: 'Payload を base64url する',
        text: '実際のトークンでは空白を詰めた JSON（' + hsPc.length + ' bytes）をエンコードします。整形の違いでも base64url は変わる＝署名も変わる点に注意。',
        code: { title: 'shell', lang: 'bash', src: `
          $ printf '%s' '${hsPc}' | base64 | tr '+/' '-_' | tr -d '=\\n'
          ⟪${D.hsP}⟫` },
        run: async (s) => {
          s.line('pj:r', 'pb:l', { cls: 'acc c-violet', label: 'base64url' });
          await s.show('pb', { fx: 'left' });
          s.text('pbn', String(D.hsP.length), { flash: false });
          await s.scramble('pbv', D.hsP, { chars: B64CH, dur: 1300 });
        },
      },
      {
        title: '署名対象 = header "." payload',
        text: '2 つの base64url 文字列をピリオドでつないだ ASCII 文字列が <b>JWS Signing Input</b>（RFC 7515 §5.1）です。署名はこのバイト列に対して計算されるので、header か payload のどちらを 1 文字変えても署名は一致しなくなります。',
        code: { title: 'JWS Signing Input', lang: 'text', src: D.hsIn },
        run: async (s) => {
          s.line('pb:b', 'si:t', { cls: 'acc c-amber', label: '+ "." +' });
          await s.show('si', { fx: 'up' });
          await s.set('siv', '<span class="th">' + D.hsH + '</span><span class="td">.</span><span class="tp">' + D.hsP + '</span>');
        },
      },
      {
        title: 'HMAC-SHA256 で署名する',
        text: '<code>HS256</code> は、共有シークレットを鍵にした HMAC-SHA256 です。出力は常に 32 バイト。<b>検証する側も同じシークレットを持つ</b>必要があります。',
        code: { title: 'shell', lang: 'bash', src: `
          $ SECRET='${SECRET}'
          $ INPUT='${D.hsIn}'
          $ printf '%s' "$INPUT" | openssl dgst -sha256 -hmac "$SECRET" -binary | xxd -p -c 32
          ⟪${D.hsHex}⟫` },
        run: async (s) => {
          await s.show('mac', { fx: 'pop' });
          s.line('mac:r', 'hx:l', { cls: 'acc c-cyan' });
          await s.show('hx', { fx: 'left' });
          await s.scramble('hxv', D.hsHex, { dur: 1100 });
        },
      },
      {
        title: '署名を base64url → 3 つをつないで完成',
        text: '32 バイトの HMAC を base64url すると 43 文字。これを 3 つ目のパートとしてつなげば JWT の完成です。',
        code: [
          { title: 'shell', lang: 'bash', src: `
            $ printf '%s' "$INPUT" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64 | tr '+/' '-_' | tr -d '=\\n'
            ⟪${D.hsSig}⟫` },
          { title: 'JWT', lang: 'text', src: D.hsTok },
        ],
        run: async (s) => {
          await s.show('tk', { fx: 'up' });
          await s.set('tkv', tokHTML(D.hsIn + '.' + D.hsSig), { flash: false });
          await s.scramble('[data-el="tkv"] .ts', D.hsSig, { chars: B64CH, dur: 900 });
          s.pulse('tk');
        },
      },
      {
        title: '誰でも中身を読める（暗号化ではない）',
        text: 'header と payload は base64url を戻すだけで読めます。秘密にできるのは「改ざんされていないこと」であって「中身」ではありません。中身を隠したいなら JWE（RFC 7516）を使います。',
        code: { title: 'shell（署名の検証はしていない点に注意）', lang: 'bash', src: DECODE_FN + '\n$ b64url_decode "$(cut -d. -f2 <<< "$TOKEN")"; echo\n' + hsPc },
        run: async (s) => {
          s.state('pj', 'warn');
          await s.caption('base64url は<b>エンコード</b>。payload は誰でも読める', { cls: 'bad', x: 668, y: 222 });
        },
      },
    ],
  });

  /* ------------------------------------------------------------------
   * Scene 3 — RS256 keys: where signed, where verified
   * ----------------------------------------------------------------*/
  const now1 = 1790000060;
  TIM.scene('#sc-rs256', {
    intro: 'ページ表示時に WebCrypto で RSA 2048bit の鍵ペアを生成し、その鍵で実際に署名・検証しています。左が署名する側（認可サーバー）、右が検証する側（API）です。',
    steps: [
      {
        title: '秘密鍵を生成する（認可サーバー上）',
        text: 'OpenSSL 3 の <code>genpkey</code> は PKCS#8 形式（<code>-----BEGIN PRIVATE KEY-----</code>）で書き出します。このファイルが漏れると誰でもトークンを発行できるので、パーミッションは <code>0600</code>、できれば KMS / HSM に置きます。',
        code: [
          { title: 'shell', lang: 'bash', src: `
            $ openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out 2026-09.pem
            $ chmod 600 2026-09.pem
            $ head -c 120 2026-09.pem` },
          { title: '2026-09.pem（このページで生成した実物の先頭）', lang: 'pem', src: pemHead(D.privPem, 3, 64) },
        ],
        run: async (s) => {
          await s.term('kt', '$ openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out 2026-09.pem\n$ chmod 600 2026-09.pem');
          await s.set('privb', TIM.codeLines(pemHead(D.privPem, 3, 26), 'pem'), { flash: false });
          await s.show('privf', { fx: 'up' });
        },
      },
      {
        title: '公開鍵を取り出す',
        text: '秘密鍵から公開鍵（SubjectPublicKeyInfo）を取り出します。こちらは公開して構いません。',
        code: [
          { title: 'shell', lang: 'bash', src: `$ openssl pkey -in 2026-09.pem -pubout -out 2026-09.pub.pem` },
          { title: '2026-09.pub.pem（実物）', lang: 'pem', src: D.pubPem },
        ],
        run: async (s) => {
          await s.term('kt', '$ openssl pkey -in 2026-09.pem -pubout -out 2026-09.pub.pem');
          await s.set('pubb', TIM.codeLines(pemHead(D.pubPem, 3, 26), 'pem'), { flash: false });
          await s.show('pubf', { fx: 'up' });
        },
      },
      {
        title: 'JWK Set として公開する',
        text: '公開鍵を JWK（RFC 7517）に変換して <code>jwks.json</code> で配信します。RSA の場合は法 <code>n</code>（256 バイト → base64url 342 文字）と公開指数 <code>e</code>。<code>kid</code> を付けて、どの鍵かを識別できるようにします。',
        code: { title: 'jwks.json（このページの鍵）', lang: 'json', src: jwksJson(80) },
        run: async (s) => {
          await s.set('jwksb', TIM.codeLines('{ "keys": [ {\n    "kty": "RSA", "use": "sig",\n    "kid": "2026-09", "alg": "RS256",\n    "e": "' + D.jwk.e + '",\n    "n": "' + cut(D.jwk.n, 34) + '"\n} ] }', 'json'), { flash: false });
          s.line('pubf:r', 'jwksf:l', { cls: 'acc c-green', label: 'JWK (n, e) で公開', curve: -30 });
          await s.show('jwksf', { fx: 'left' });
        },
      },
      {
        title: '署名：SHA-256 → 秘密鍵で RSA 演算',
        text: '署名対象（<code>header.payload</code>）の SHA-256 を計算し、DigestInfo でくるんで PKCS#1 v1.5 パディングした値を秘密鍵で累乗します。結果は鍵長と同じ 256 バイト。',
        code: [
          { title: 'shell', lang: 'bash', src: `
            $ printf '%s' "$HEADER.$PAYLOAD" > input.txt
            $ openssl dgst -sha256 -sign 2026-09.pem -out sig.bin input.txt
            $ wc -c < sig.bin
            256` },
          { title: 'SHA-256(input)（実測）', lang: 'text', src: D.rsSha },
          { title: 'signature → base64url（実測, 先頭）', lang: 'text', src: cut(D.rsSig, 110) },
        ],
        run: async (s) => {
          await s.show('signer', { fx: 'up' });
          s.line('privf:b', 'signer:t', { cls: 'acc c-pink', label: 'private key' });
          s.pulse('privf');
          await s.scramble('shav', cut(D.rsSha, 34), { dur: 900 });
          await s.scramble('sigv', cut(D.rsSig, 34), { chars: B64CH, dur: 1100 });
        },
      },
      {
        title: 'トークンが API に届く',
        text: 'API は受け取ったトークンを <code>.</code> で 3 つに分け、header をデコードして <code>alg</code> と <code>kid</code> を読みます（この時点ではまだ何も信用していません）。',
        code: { title: 'decoded header（未検証）', lang: 'json', src: J(RS_H) },
        run: async (s) => {
          await s.show('ver', { fx: 'left' });
          await s.fly('signer:r', 'ver:l', { label: 'eyJhbGciOiJSUzI1NiIs…', cls: 'c-pink', arc: -20 });
          s.state('ver', 'active');
        },
      },
      {
        title: 'kid で公開鍵を選ぶ',
        text: 'JWKS（キャッシュ）から <code>kid</code> が一致する鍵を選びます。見つからなければ JWKS を 1 回だけ再取得し、それでもなければ拒否。<b>トークン内の <code>jku</code> や <code>jwk</code> から鍵を取ってはいけません</b>。',
        code: { title: 'pseudo', lang: 'js', src: `
          const jwk = jwks.keys.find(k => k.kid === header.kid && k.alg === 'RS256');
          if (!jwk) throw new Error('unknown kid');   // → 401` },
        run: async (s) => {
          s.pulse('jwksf');
          await s.line('jwksf:b', 'ver:t', { cls: 'acc c-green', label: 'kid = 2026-09' });
        },
      },
      {
        title: '公開鍵で署名を検証する',
        text: '公開鍵で署名を戻した値と、受け取った <code>header.payload</code> の SHA-256 が一致するかを確認します。右の結果は、このページで実際に <code>crypto.subtle.verify()</code> を呼んだ戻り値です。',
        code: [
          { title: 'shell', lang: 'bash', src: `
            $ openssl dgst -sha256 -verify 2026-09.pub.pem -signature sig.bin input.txt
            ⟪Verified OK⟫` },
          { title: 'WebCrypto（このページ）', lang: 'js', src: `crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, sig, input)  // → ${D.rsOk}` },
        ],
        run: async (s) => {
          await s.scan('ver');
          await s.text('okv', D.rsOk ? '✔ true（crypto.subtle.verify の実測値）' : '✘ false');
          s.cls('okv', D.rsOk ? 'ok' : 'bad');
          s.state('ver', D.rsOk ? 'ok' : 'bad');
        },
      },
      {
        title: 'クレームを検証する',
        text: '署名が正しいのは「認可サーバーが発行した」ことの証明にすぎません。<b>このトークンが今・この API で使ってよいもの</b>かは、<code>alg</code> の固定、<code>exp</code>、<code>iss</code>、<code>aud</code> で確認します（ここでは now = ' + now1 + ' とします）。',
        code: { title: 'jose — jwtVerify options', lang: 'js', src: `
          await jwtVerify(token, JWKS, {
            algorithms: ['RS256'],               // alg ∈ allowlist
            issuer: 'https://auth.example.com',  // iss
            audience: 'api.example.com',         // aud
            clockTolerance: 60,                  // exp / nbf の許容誤差（秒）
          });` },
        run: async (s) => {
          await s.show('claimchk', { fx: 'up' });
          const rows = [['v1', '✔ RS256'], ['v2', '✔ ' + RS_P.exp + ' > ' + now1], ['v3', '✔ https://auth.example.com'], ['v4', '✔ api.example.com']];
          for (const [k, v] of rows) { await s.text(k, v); s.cls(k, 'ok'); await s.wait(250); }
          s.state('claimchk', 'ok');
        },
      },
      {
        title: 'HS256（共有鍵）との決定的な違い',
        text: 'HS256 では検証する側も同じシークレットを持つので、<b>検証できる者は署名もできます</b>。API が 1 つでも侵害されればトークンを偽造されます。複数のサービスが検証する構成では RS256 / ES256 / EdDSA を使い、秘密鍵を認可サーバーから出さないのが原則です。',
        run: async (s) => {
          await s.caption('署名できるのは <code>2026-09.pem</code> を持つホストだけ。API は公開鍵しか持たない', { cls: 'ok' });
        },
      },
    ],
  });

  /* ------------------------------------------------------------------
   * Scene 4 — tamper
   * ----------------------------------------------------------------*/
  const tamperedJson = PJ(Object.assign({}, HS_P, { role: 'admin' })).replace('"admin"', '⟪"admin"⟫');
  TIM.scene('#sc-tamper', {
    intro: 'HS256 のトークンの payload を書き換えて API に送ります。API 側の「期待される署名」は、改ざん後の payload に対して実際に HMAC を再計算した値です。',
    steps: [
      {
        title: 'トークンを入手する',
        text: 'トークンは DevTools（Network タブの <code>Authorization</code> ヘッダ、Application タブの Storage）やプロキシのログから簡単に見えます。「見られても困らない」前提の設計が必要です。',
        code: { title: 'DevTools Console', lang: 'js', src: `localStorage.getItem('access_token')\n// '${cut(D.hsTok, 60)}'` },
        run: async (s) => {
          await s.show('otok', { fx: 'left' });
          await s.set('otokv', tokHTML(D.hsTok), { flash: false });
          await s.fly('otok:l', 'atk:r', { label: 'copy', cls: 'c-red', dur: 600 });
        },
      },
      {
        title: 'payload をデコードする',
        text: '2 つ目のパートを base64url デコードすれば JSON がそのまま出てきます。',
        code: { title: 'shell', lang: 'bash', src: DECODE_FN + '\n$ b64url_decode "$(cut -d. -f2 <<< "$TOKEN")"; echo\n' + J(HS_P) },
        run: async (s) => {
          await s.set('djb', TIM.codeLines(PJ(HS_P), 'json'), { flash: false });
          await s.show('dj', { fx: 'up' });
        },
      },
      {
        title: 'role を admin に書き換える',
        text: 'JSON を編集するのは自由です。問題は、これを API に受け入れさせられるかどうか。',
        code: { title: 'diff', lang: 'diff', src: `
          @@ payload @@
          -  "role": "user",
          +  "role": "admin",` },
        run: async (s) => {
          await s.set('djb', TIM.codeLines(tamperedJson, 'json'));
          s.state('dj', 'warn');
        },
      },
      {
        title: '再エンコードして差し替える（署名はそのまま）',
        text: '新しい payload を base64url し、元の header と<b>元の署名</b>でサンドイッチします。見た目は完全に正しい JWT です。',
        code: [
          { title: 'shell', lang: 'bash', src: `
            $ NEWP=$(printf '%s' '${J(Object.assign({}, HS_P, { role: 'admin' }))}' | base64 | tr '+/' '-_' | tr -d '=\\n')
            $ FORGED="$(cut -d. -f1 <<< "$TOKEN").$NEWP.$(cut -d. -f3 <<< "$TOKEN")"` },
          { title: 'forged token', lang: 'text', src: D.forged },
        ],
        run: async (s) => {
          await s.show('ftok', { fx: 'left' });
          await s.set('ftokv', tokHTML(D.hsH + '.' + D.hsP + '.' + D.hsSig), { flash: false });
          await s.scramble('[data-el="ftokv"] .tp', D.tP, { chars: B64CH, dur: 1100 });
          s.cls('[data-el="ftokv"] .tp', 'warnp');
        },
      },
      {
        title: '改ざんトークンを API に送る',
        text: '管理者専用のエンドポイントに、改ざんしたトークンを付けてリクエストします。',
        code: { title: 'shell', lang: 'bash', src: `$ curl -i -H "Authorization: Bearer $FORGED" https://api.example.com/v1/admin/users` },
        run: async (s) => {
          await s.fly('atk:b', 'api:t', { label: 'Bearer (改ざん版)', cls: 'c-red', arc: 60, dur: 1200 });
          s.state('api', 'active');
        },
      },
      {
        title: 'API が署名を再計算する',
        text: 'API は受け取った <code>header.payload</code>（改ざん後）に対して、自分の持つシークレットで HMAC を計算し直します。上段がその実測値、下段がトークンに付いてきた署名です。',
        code: { title: 'API（検証処理の中身）', lang: 'js', src: `
          const [h, p, sig] = token.split('.');
          const expected = base64url(hmacSHA256(process.env.JWT_SECRET, h + '.' + p));
          if (!timingSafeEqual(expected, sig)) throw new InvalidSignature();` },
        run: async (s) => {
          await s.show('cmp', { fx: 'up' });
          s.text('gotv', D.hsSig, { flash: false });
          await s.scramble('expv', D.tSig, { chars: B64CH, dur: 1200 });
        },
      },
      {
        title: '一致しない → 401 invalid_token',
        text: '1 文字でも違えば拒否です。RFC 6750 に従い、<code>WWW-Authenticate</code> ヘッダで <code>invalid_token</code> を返します。',
        code: { title: 'HTTP response', lang: 'http', src: `
          HTTP/1.1 401 Unauthorized
          WWW-Authenticate: Bearer realm="api", error="invalid_token",
                            error_description="The signature is invalid"
          Content-Length: 0` },
        run: async (s) => {
          s.state('cmp', 'bad');
          s.state('api', 'bad');
          s.shake('api');
          await s.stamp('api', 'REJECTED', { cls: 'st-bad' });
          await s.fly('api:t', 'atk:b', { label: '401 invalid_token', cls: 'c-red', arc: -60, dur: 1100 });
        },
      },
      {
        title: 'なぜ署名を作り直せないのか',
        text: '正しい署名を作るには <code>JWT_SECRET</code>（RS256 なら秘密鍵）が必要です。HMAC は 1 ビットの入力変化で出力がまったく別物になるため、既存の署名から「近い値」を探すこともできません。<b>ただしシークレットが短い・推測できる場合は、トークン 1 つからオフラインで総当たりされます</b>。',
        run: async (s) => {
          s.state('cmp', 'bad');
          await s.caption('署名を作れるのは鍵を持つ者だけ ── payload の書き換えは検出される', { cls: 'bad' });
        },
      },
    ],
  });

  /* ------------------------------------------------------------------
   * Scene 5 — verification pipeline
   * ----------------------------------------------------------------*/
  const X = (i) => 90 + i * 130;
  const noneTok = b64(J({ alg: 'none', typ: 'JWT' })) + '.' + b64(J({ sub: '42', role: 'admin' })) + '.';
  const CASES = [
    {
      no: '1', title: '正常なトークン', stop: null,
      hdr: '{"alg":"RS256","typ":"JWT","kid":"2026-09"}\n{"iss":"https://auth.example.com","sub":"42",\n "aud":"api.example.com","exp":1790000900}',
      why: 'HTTP/1.1 200 OK\nINFO  jwt ok sub=42 kid=2026-09 alg=RS256',
      text: 'すべてのチェックを通過したトークンだけが、アプリケーションのコードに届きます。チェックの順番も重要で、<b>alg と鍵を決めてから</b>署名を検証します。',
      code: { title: 'API のログ', lang: 'text', src: 'INFO  jwt ok sub=42 kid=2026-09 alg=RS256 exp=1790000900' },
    },
    {
      no: '2', title: 'alg: none（署名なし）', stop: 1,
      hdr: '{"alg":"none","typ":"JWT"}\n{"sub":"42","role":"admin"}\nsignature: （空）',
      why: 'HTTP/1.1 401 Unauthorized\nWWW-Authenticate: Bearer error="invalid_token"\nWARN  jwt rejected: alg "none" not in [RS256]',
      text: '<code>alg</code> を <code>none</code> にして署名を空にしたトークン。ヘッダの <code>alg</code> で検証方法を決める実装は「署名不要」と解釈してしまいます。許可リストで固定していれば②で止まります。',
      code: { title: 'token（alg=none）', lang: 'text', src: noneTok },
    },
    {
      no: '3', title: 'RS256 → HS256 アルゴリズム混同', stop: 1,
      hdr: '{"alg":"HS256","typ":"JWT","kid":"2026-09"}\n{"sub":"42","role":"admin",...}\nsig = HMAC-SHA256(公開鍵PEMの文字列, input)',
      why: 'HTTP/1.1 401 Unauthorized\nWARN  jwt rejected: alg "HS256" not in [RS256]\n# alg を固定しない実装では、公開鍵 PEM を\n# HMAC の鍵として使い「正しい署名」になってしまう',
      text: '攻撃者は<b>誰でも取得できる公開鍵の PEM 文字列</b>を HMAC の鍵にして HS256 で署名します。<code>verify(token, publicKeyPem)</code> のように鍵だけ渡し、方式をヘッダ任せにする実装はこれを「正しい」と判定します。',
      code: { title: '脆弱なパターン / 安全なパターン', lang: 'js', src: "// ✘ ヘッダの alg 次第で HMAC にも RSA にもなる\nverify(token, publicKeyPem);\n// ✔ 方式を固定する\nverify(token, publicKey, { algorithms: ['RS256'] });" },
    },
    {
      no: '4', title: 'jku / kid の差し替え', stop: 2,
      hdr: '{"alg":"RS256","kid":"evil-1",\n "jku":"https://evil.example/jwks.json"}\n{"sub":"42","role":"admin",...}',
      why: 'HTTP/1.1 401 Unauthorized\nWARN  jwt rejected: kid "evil-1" not in trusted JWKS\n# jku は無視。鍵は設定済みの JWKS_URL からのみ取得',
      text: '攻撃者が自分の鍵で署名し、ヘッダの <code>jku</code> に自分の JWKS の URL を書きます。トークンが指す URL から鍵を取りに行く実装は、攻撃者の公開鍵で「正しく」検証してしまいます。',
      code: { title: 'API の設定', lang: 'ini', src: 'JWKS_URL=https://auth.example.com/.well-known/jwks.json\n; token header の jku / x5u / jwk は使わない' },
    },
    {
      no: '5', title: 'payload の改ざん', stop: 3,
      hdr: '{"alg":"RS256","typ":"JWT","kid":"2026-09"}\n{"iss":"https://auth.example.com","sub":"42",\n "role":"admin", ...}   ← 書き換え',
      why: 'HTTP/1.1 401 Unauthorized\nWWW-Authenticate: Bearer error="invalid_token"\nWARN  jwt rejected: signature verification failed',
      text: '前のシーンと同じ改ざん。alg も鍵も正当なので④までは進みますが、署名が一致せず止まります。',
      code: { title: 'API のログ', lang: 'text', src: 'WARN  jwt rejected: signature verification failed kid=2026-09' },
    },
    {
      no: '6', title: '期限切れ（exp）', stop: 4,
      hdr: '{"alg":"RS256","typ":"JWT","kid":"2026-09"}\n{"iss":"https://auth.example.com","sub":"42",\n "aud":"api.example.com","exp":1790000900}',
      why: 'HTTP/1.1 401 Unauthorized\nWWW-Authenticate: Bearer error="invalid_token",\n  error_description="The access token expired"\n# now=1790004000 > exp=1790000900 (+60s)',
      text: '署名は正しくても、<code>exp</code> を過ぎたトークンは拒否。クライアントはリフレッシュトークンで新しいアクセストークンを取り直します。',
      code: { title: 'check', lang: 'js', src: 'now (1790004000) > exp (1790000900) + clockTolerance (60)  // → expired' },
    },
    {
      no: '7', title: '別の API 向けトークン（aud 不一致）', stop: 6,
      hdr: '{"alg":"RS256","typ":"JWT","kid":"2026-09"}\n{"iss":"https://auth.example.com","sub":"42",\n "aud":"billing.example.com","exp":1790000900}',
      why: 'HTTP/1.1 401 Unauthorized\nWARN  jwt rejected: aud "billing.example.com"\n      != "api.example.com"',
      text: '同じ認可サーバーが <code>billing</code> API 向けに発行した正規のトークン。署名も期限も正しいので、<code>aud</code> を見ない API は受け入れてしまいます。',
      code: { title: 'check', lang: 'js', src: "payload.aud === 'api.example.com'  // → false" },
    },
  ];
  TIM.scene('#sc-pipeline', {
    intro: 'API の中で JWT が通る 7 つのチェックです。攻撃・失敗パターンごとに、<b>どのチェックで止まるべきか</b>を見ていきます。',
    steps: CASES.map((c) => ({
      title: 'CASE ' + c.no + '：' + c.title,
      text: c.text,
      code: [c.code, { title: 'API のレスポンス / ログ', lang: 'http', src: c.why }],
      run: async (s) => {
        s.set('case', '<small>CASE ' + c.no + '</small>' + esc(c.title), { flash: false });
        s.state('c0 c1 c2 c3 c4 c5 c6', null);
        s.cls('why', '', 'c-red c-green');
        s.set('hdrb', TIM.codeLines(c.hdr, 'json'), { flash: false });
        s.set('whyb', TIM.codeLines('…', 'text'), { flash: false });
        s.caption('');
        await s.move('tk', { x: 40, dur: 200 });
        for (let i = 0; i <= 6; i++) {
          await s.move('tk', { x: X(i), dur: 420 });
          if (i === c.stop) {
            s.state('c' + i, 'bad');
            s.shake('c' + i);
            break;
          }
          s.state('c' + i, 'ok');
          await s.wait(90);
        }
        await s.set('whyb', TIM.codeLines(c.why, 'http'));
        s.cls('why', c.stop == null ? 'c-green' : 'c-red');
        await s.caption(c.stop == null ? '200 OK — アプリケーションへ' : '401 invalid_token — チェック ' + '①②③④⑤⑥⑦'[c.stop] + ' で拒否', { cls: c.stop == null ? 'ok' : 'bad' });
      },
    })),
  });

  /* ------------------------------------------------------------------
   * LIVE LAB
   * ----------------------------------------------------------------*/
  (function lab() {
    const $ = (id) => document.getElementById(id);
    const H = $('lab-h'), P = $('lab-p'), S = $('lab-s'), T = $('lab-t');
    const view = $('lab-view'), err = $('lab-err'), verdict = $('lab-verdict'), checks = $('lab-checks');
    if (!H) return;
    const HASH = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' };
    const now = () => Math.floor(Date.now() / 1000);
    let secretBytes;
    try { secretBytes = crypto.getRandomValues(new Uint8Array(32)); } catch (e) { secretBytes = TIM.te.encode(SECRET); }
    H.value = J({ alg: 'HS256', typ: 'JWT' });
    P.value = PJ({ sub: '42', name: 'alice', role: 'user', iat: now(), exp: now() + 900 });
    S.value = b64(secretBytes);

    async function sign(h, p) {
      if (!HASH[h.alg]) throw new Error('このラボは HS256 / HS384 / HS512 のみ対応しています（alg: ' + h.alg + '）');
      const inp = b64(J(h)) + '.' + b64(J(p));
      return inp + '.' + b64(await TIM.hmac(HASH[h.alg], S.value, inp));
    }
    async function verify() {
      const t = T.value.trim();
      const parts = t.split('.');
      const out = [];
      let ok = true, hdr = null, pl = null;
      view.innerHTML = t ? tokHTML(t) : '<span style="color:var(--tx3)">（トークンなし）</span>';
      if (!t) { verdict.innerHTML = ''; checks.innerHTML = ''; return; }
      if (parts.length !== 3) {
        out.push(['bad', '構造：<code>.</code> 区切りの 3 パートではありません（' + parts.length + ' パート）']);
        ok = false;
      } else {
        out.push(['ok', '構造：header . payload . signature の 3 パート']);
        try {
          hdr = JSON.parse(TIM.b64u.decText(parts[0]));
          pl = JSON.parse(TIM.b64u.decText(parts[1]));
          out.push(['ok', 'デコード：header <code>' + esc(J(hdr)) + '</code>']);
        } catch (e) {
          out.push(['bad', 'デコード：base64url または JSON として読めません']);
          ok = false;
        }
      }
      if (hdr) {
        if (!HASH[hdr.alg]) {
          out.push(['bad', 'alg：<code>' + esc(String(hdr.alg)) + '</code> は許可リスト [HS256, HS384, HS512] にないので拒否']);
          ok = false;
        } else {
          out.push(['ok', 'alg：<code>' + hdr.alg + '</code> は許可リスト内']);
          let expSig = '';
          try { expSig = b64(await TIM.hmac(HASH[hdr.alg], S.value, parts[0] + '.' + parts[1])); } catch (e) { /* ignore */ }
          if (expSig && expSig === parts[2]) out.push(['ok', '署名：一致（header.payload に対して HMAC を再計算して比較）']);
          else {
            out.push(['bad', '署名：不一致<br>期待値 <code>' + expSig + '</code><br>実際　 <code>' + esc(parts[2] || '（空）') + '</code>']);
            ok = false;
          }
        }
      }
      if (pl) {
        if (typeof pl.exp === 'number') {
          const r = pl.exp - now();
          if (r > 0) out.push(['ok', 'exp：あと ' + r + ' 秒有効（' + new Date(pl.exp * 1000).toLocaleString() + '）']);
          else { out.push(['bad', 'exp：' + -r + ' 秒前に期限切れ']); ok = false; }
        } else out.push(['skip', 'exp：なし（有効期限のないトークンは避けるべき）']);
        if (typeof pl.nbf === 'number' && pl.nbf > now()) { out.push(['bad', 'nbf：まだ有効期間前']); ok = false; }
        if (pl.role != null) out.push(['skip', 'role：<code>' + esc(String(pl.role)) + '</code>（アプリが使う独自クレーム）']);
      }
      verdict.innerHTML = ok
        ? '<span class="verdict ok">✔ VALID — API はこのトークンを受け付けます</span>'
        : '<span class="verdict bad">✘ INVALID — API は 401 invalid_token を返します</span>';
      checks.innerHTML = out.map((o) => '<li class="' + o[0] + '"><b>' + (o[0] === 'ok' ? '✔' : o[0] === 'bad' ? '✘' : '–') + '</b><span>' + o[1] + '</span></li>').join('');
    }
    async function issue() {
      err.textContent = '';
      try {
        const h = JSON.parse(H.value), p = JSON.parse(P.value);
        T.value = await sign(h, p);
        await verify();
        T.animate([{ boxShadow: '0 0 0 3px rgba(244,114,182,.6)' }, { boxShadow: '0 0 0 0 rgba(244,114,182,0)' }], { duration: 700 });
      } catch (e) { err.textContent = '✘ ' + e.message; }
    }
    $('lab-sign').addEventListener('click', issue);
    $('lab-now').addEventListener('click', () => {
      try { const p = JSON.parse(P.value); p.iat = now(); p.exp = now() + 900; P.value = PJ(p); err.textContent = ''; }
      catch (e) { err.textContent = '✘ payload が JSON として不正です'; }
    });
    document.querySelectorAll('#jwt-lab [data-act]').forEach((b) => b.addEventListener('click', async () => {
      const parts = T.value.trim().split('.');
      if (parts.length < 2) return;
      const act = b.dataset.act;
      try {
        if (act === 'tamper') {
          const p = JSON.parse(TIM.b64u.decText(parts[1]));
          p.role = 'admin';
          T.value = parts[0] + '.' + b64(J(p)) + '.' + (parts[2] || '');
        } else if (act === 'flip') {
          const sig = parts[2] || '';
          if (sig.length > 12) {
            const i = 10, c = sig[i];
            parts[2] = sig.slice(0, i) + (c === 'A' ? 'B' : 'A') + sig.slice(i + 1);
            T.value = parts.join('.');
          }
        } else if (act === 'none') {
          T.value = b64(J({ alg: 'none', typ: 'JWT' })) + '.' + parts[1] + '.';
        } else if (act === 'resign') {
          let h = {};
          try { h = JSON.parse(TIM.b64u.decText(parts[0])); } catch (e) { /* ignore */ }
          if (!HASH[h.alg]) h = { alg: 'HS256', typ: 'JWT' };
          const p = JSON.parse(TIM.b64u.decText(parts[1]));
          H.value = J(h); P.value = PJ(p);
          T.value = await sign(h, p);
        }
        err.textContent = '';
      } catch (e) { err.textContent = '✘ ' + e.message; }
      await verify();
    }));
    let deb;
    const later = () => { clearTimeout(deb); deb = setTimeout(verify, 150); };
    T.addEventListener('input', later);
    S.addEventListener('input', later);
    setInterval(() => { if (document.activeElement !== T && T.value) verify(); }, 1000);
    issue();
  })();
})();
