/* CA と証明書チェーン — scenes (see AGENT.md §7)
 * 例示値は OpenSSL 3.5.7 で実際に作ったミニ CA（root.crt / inter.crt / server.crt）と、
 * それに対する openssl verify / s_client / ocsp / crl の実出力。
 */
(function () {
  'use strict';

  const clearStates = (s, names) => s.$(names).forEach((e) => e.removeAttribute('data-state'));

  /* =====================================================================
   * SCENE 1 — 全体像
   * ===================================================================*/
  TIM.scene('#sc-overview', {
    intro: 'サーバー・CA・CT ログ・クライアントの 4 か所で、<b>何が生成され、何が送られ、何が送られないか</b>を 1 本で追います。',
    steps: [
      {
        title: '4 つの場所と、そこにある実物',
        text: '秘密鍵があるのはサーバーの <code>privkey.pem</code> と CA の HSM だけです。クライアントは秘密鍵を一切持たず、トラストストアのルート証明書（公開鍵）だけで検証します。',
        code: { title: '各場所にあるもの', lang: 'tree', src: `
          www.example.com/                    # サーバー（運用者）
          └── /etc/letsencrypt/live/example.com/
              ├── privkey.pem                 # 秘密鍵：ここから出ない
              ├── cert.pem                    # リーフ証明書
              ├── chain.pem                   # 中間 CA 証明書
              └── fullchain.pem               # cert.pem + chain.pem
          ca.example.com/                     # CA
          ├── acme/                           # ACME サーバー（RFC 8555）
          └── hsm/                            # 中間 CA「E1」の秘密鍵（装置外に出ない）
          ct-log/                             # CT ログ（RFC 6962）
          client/
          └── /etc/ssl/certs/ca-certificates.crt   # ルート証明書の束` },
        run: async (s) => {
          for (const z of ['z-srv', 'z-ca', 'z-ct', 'z-cl']) await s.pulse(z);
        },
      },
      {
        title: 'サーバーで鍵ペアと CSR を作る',
        text: '運用者（または certbot）がサーバー上で秘密鍵を生成し、その公開鍵と名前を入れた CSR を作ります。CSR は自分の秘密鍵で署名されています。',
        code: { title: 'www.example.com', lang: 'bash', src: `
          $ openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out server.key
          $ openssl req -new -key server.key -subj "/CN=www.example.com" \\
              -addext "subjectAltName=DNS:www.example.com,DNS:example.com" -out server.csr
          # certbot を使う場合は certbot が同じことを内部で行い、
          # 鍵を ⟪/etc/letsencrypt/archive/example.com/privkey1.pem⟫ に保存する` },
        run: async (s) => {
          s.state('srv', 'active');
          await s.show('k1', { fx: 'pop' });
          await s.show('k2', { fx: 'pop' });
        },
      },
      {
        title: 'ドメインを支配していることを CA に示す',
        text: 'CA の検証系（VA）が、ACME で渡したトークンを <code>http://www.example.com/.well-known/acme-challenge/&lt;token&gt;</code> から取得できるかを外部から確認します（HTTP-01）。取れれば「このドメインを操作できる人の申請」とみなします。',
        code: { title: 'CA → サーバー（ポート 80）', lang: 'http', src: `
          GET /.well-known/acme-challenge/IMBhFzCHz9_1hgB1WZukpbVeDywlSykB91vGzLoC-Lw HTTP/1.1
          Host: www.example.com

          HTTP/1.1 200 OK
          Content-Type: application/octet-stream

          ⟪IMBhFzCHz9_1hgB1WZukpbVeDywlSykB91vGzLoC-Lw.w1Hm6Y8q62mzPVCgXWCXQaW3d38wCtDrYxtc3eei23M⟫` },
        run: async (s) => {
          s.state('va', 'active');
          await s.fly('va:l', 'srv:r', { label: 'GET token', arc: -20, dur: 800 });
          await s.fly('srv:r', 'va:l', { label: '200', arc: -20, dur: 800 });
          s.state('va', 'ok');
        },
      },
      {
        title: 'CSR を提出する（秘密鍵は送らない）',
        text: 'certbot は ACME の <code>finalize</code> で CSR を送ります。CA が受け取るのは<b>公開鍵・名前・所持証明の署名</b>だけで、<code>privkey.pem</code> はサーバーから一度も出ません。',
        code: { title: 'ACME finalize（JWS の payload）', lang: 'json', src: `
          POST /acme/order/7Kq3/finalize
          {
            "csr": "⟪MIIBEDCBtgIBADAaMRgwFgYDVQQDDA93d3cuZXhhbXBsZS5jb20wWTATBgcqhkjO⟫…"
          }
          // csr = base64url(DER の server.csr, 276 バイト)` },
        run: async (s) => {
          await s.fly('k2:r', 'acme:l', { label: 'CSR', dur: 900 });
          s.state('acme', 'active');
          s.state('k1', 'ok');
          await s.caption('privkey.pem はサーバーの外に出ない — CA に届くのは CSR だけ');
        },
      },
      {
        title: 'HSM で署名し、CT ログに登録する',
        text: 'CA は TBSCertificate を組み立て、まず「プレ証明書」（CT poison 拡張付き）を複数の CT ログに提出して SCT を受け取り、SCT を埋め込んだ本番の TBS を HSM 内の中間 CA E1 の鍵で署名します。',
        code: { title: 'CT ログへの提出（RFC 6962 §4.1）', lang: 'http', src: `
          POST /ct/v1/add-pre-chain HTTP/1.1
          Content-Type: application/json

          {"chain": ["<precert base64>", "<E1 base64>", "<R1 base64>"]}

          HTTP/1.1 200 OK
          {"sct_version":0,"id":"<log ID base64>","timestamp":1790549952866,
           "extensions":"","signature":"<base64>"}` },
        run: async (s) => {
          s.caption('');
          await s.fly('acme:b', 'hsm:t', { label: 'TBS', dur: 700 });
          await Promise.all([
            s.fly('hsm:r', 'ct1:l', { label: 'precert', dur: 800 }),
            s.fly('hsm:r', 'ct2:l', { label: 'precert', dur: 800, delay: 150 }),
          ]);
          await Promise.all([
            s.fly('ct1:l', 'hsm:r', { label: 'SCT', dur: 700 }),
            s.fly('ct2:l', 'hsm:r', { label: 'SCT', dur: 700, delay: 150 }),
          ]);
          await s.scan('hsm');
          s.state('hsm', 'ok');
          await s.show('crt', { fx: 'pop' });
        },
      },
      {
        title: '証明書とチェーンをサーバーに置く',
        text: 'certbot は発行された証明書と中間 CA 証明書をダウンロードし、<code>cert.pem</code> / <code>chain.pem</code> / <code>fullchain.pem</code> を作ります。nginx の <code>ssl_certificate</code> には <b>fullchain.pem</b> を指定します。',
        code: { title: '/etc/nginx/conf.d/example.conf', lang: 'text', src: `
          server {
              listen 443 ssl;
              server_name www.example.com;
              ssl_certificate     /etc/letsencrypt/live/example.com/⟪fullchain.pem⟫;
              ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
          }` },
        run: async (s) => {
          await s.fly('crt:l', 'k3:r', { label: 'cert + chain', dur: 900 });
          await s.show('k3', { fx: 'pop' });
        },
      },
      {
        title: 'TLS でリーフ + 中間を提示する',
        text: 'ブラウザが <code>ClientHello</code>（SNI: www.example.com）を送ると、サーバーは <code>Certificate</code> メッセージで <b>[0] リーフ、[1] 中間 CA E1</b> を送ります。ルート証明書は送りません。',
        code: { title: 'openssl s_client -showcerts（抜粋）', lang: 'text', src: `
          Certificate chain
           0 s:CN=www.example.com
             i:C=JP, O=Example Trust, CN=Example Issuing CA E1
             a:PKEY: EC, (prime256v1); sigalg: ecdsa-with-SHA384
           1 s:C=JP, O=Example Trust, CN=Example Issuing CA E1
             i:C=JP, O=Example Trust, CN=Example Root CA R1
             a:PKEY: EC, (secp384r1); sigalg: ecdsa-with-SHA384` },
        run: async (s) => {
          await s.fly('br:tr', 'srv:br', { label: 'ClientHello', dur: 800 });
          await s.fly('srv:br', 'br:tr', { label: 'Certificate [leaf, E1]', dur: 900 });
          await s.show('rcv', { fx: 'pop' });
        },
      },
      {
        title: 'クライアントがルートまでつないで検証する',
        text: 'クライアントは受け取った 2 枚を、自分のトラストストアにある <code>Example Root CA R1</code> までつなぎ、各署名・期限・制約・ホスト名・失効を確認します（詳細は「チェーンとクライアント側の検証」）。',
        code: { title: 'クライアント側', lang: 'bash', src: `
          $ openssl s_client -connect www.example.com:443 -servername www.example.com \\
              -verify_hostname www.example.com -CAfile root.crt </dev/null
          depth=2 C=JP, O=Example Trust, CN=Example Root CA R1
          verify return:1
          depth=1 C=JP, O=Example Trust, CN=Example Issuing CA E1
          verify return:1
          depth=0 CN=www.example.com
          verify return:1
          …
          ⟪Verify return code: 0 (ok)⟫` },
        run: async (s) => {
          await s.show('ts', { fx: 'up' });
          s.line('rcv:r', 'ts:l', { cls: 'acc' });
          await s.scan('ts');
          await s.show('vf', { fx: 'right' });
          await s.line('ts:r', 'vf:l', { cls: 'ok' });
          s.state('vf', 'ok');
          await s.stamp('vf', 'TRUSTED', { cls: 'st-ok' });
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 2 — 秘密鍵と CSR
   * ===================================================================*/
  TIM.scene('#sc-csr', {
    intro: 'サーバー上で <code>server.key</code> を作り、そこから <code>server.csr</code> を作るまで。CSR の署名が「秘密鍵の所持証明」になっていること、改ざんすると検証に失敗することを確認します。',
    steps: [
      {
        title: '秘密鍵をサーバー上で生成する',
        text: '<code>openssl genpkey</code> で P-256 の秘密鍵を作り、所有者だけが読めるよう <code>0600</code> にします。ファイルは PKCS #8（<code>-----BEGIN PRIVATE KEY-----</code>）形式です。',
        code: { title: 'root@www:/etc/ssl/example', lang: 'bash', src: `
          $ openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out server.key
          $ chmod 600 server.key
          $ ls -l server.key
          ⟪-rw-------⟫ 1 root root 241 Sep 28 03:54 server.key` },
        run: async (s) => {
          await s.term('tk', '$ openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out server.key\n$ chmod 600 server.key\n$ ls -l server.key\n-rw------- 1 root root 241 Sep 28 03:54 server.key', { clear: true });
          await s.show('key', { fx: 'up' });
          s.state('key', 'active');
        },
      },
      {
        title: '公開鍵は秘密鍵から計算できる',
        text: 'EC の公開鍵 Q は秘密のスカラー d から <code>Q = d·G</code> で計算され、PKCS #8 ファイルにも一緒に入っています。<code>-pubout</code> で取り出したものが、この後 CSR と証明書に入る公開鍵です。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl pkey -in server.key -pubout
          -----BEGIN PUBLIC KEY-----
          MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEFAPiy9IUi/oLvX/wf+fIdip5n2Ab
          U3GlX4CLOFuA41U3ghOHSVUGBpEseoakgqi10/bDfocbY0Eptd+woQB/8Q==
          -----END PUBLIC KEY-----` },
        run: async (s) => {
          await s.term('tk', '$ openssl pkey -in server.key -pubout\n-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEFAPiy9IUi/oLvX/wf+fIdip5n2Ab\nU3GlX4CLOFuA41U3ghOHSVUGBpEseoakgqi10/bDfocbY0Eptd+woQB/8Q==\n-----END PUBLIC KEY-----', { clear: true });
          await s.show('pub', { fx: 'pop' });
          await s.fly('key:b', 'pub:t', { label: 'Q = d·G', dur: 600 });
        },
      },
      {
        title: 'CSR を作る：公開鍵 + 名前 + 要求する拡張',
        text: '<code>openssl req -new</code> が <code>certificationRequestInfo</code>（version / subject / 公開鍵 / attributes）を組み立てます。SAN は <code>-addext</code> で <code>extensionRequest</code> 属性として入ります。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl req -new -key server.key -subj "/CN=www.example.com" \\
              -addext "subjectAltName=DNS:www.example.com,DNS:example.com" \\
              -out server.csr` },
        run: async (s) => {
          await s.term('tk', '$ openssl req -new -key server.key -subj "/CN=www.example.com" -addext "subjectAltName=DNS:www.example.com,DNS:example.com" -out server.csr', { clear: true });
          await s.show('csr', { fx: 'fade' });
          await s.show('cri', { fx: 'fade' });
          await s.show('q-ver q-sub q-spki q-attr', { stagger: 90 });
          await s.fly('pub:r', 'q-spki:l', { label: 'Q', dur: 800 });
          s.state('q-spki', 'active');
        },
      },
      {
        title: '申請者自身の秘密鍵で署名する（所持証明）',
        text: '<code>certificationRequestInfo</code> の DER を SHA-256 でハッシュし、<code>server.key</code> で ECDSA 署名して末尾に付けます。CA はこの署名を CSR 内の公開鍵で検証し、「申請者がこの公開鍵の秘密鍵を持っている」ことを確かめます。',
        code: { title: 'RFC 2986 §4', lang: 'text', src: `
          CertificationRequest ::= SEQUENCE {
               certificationRequestInfo CertificationRequestInfo,
               signatureAlgorithm AlgorithmIdentifier{{ SignatureAlgorithms }},
               ⟪signature          BIT STRING⟫
          }
          CertificationRequestInfo ::= SEQUENCE {
               version       INTEGER { v1(0) } (v1,...),
               subject       Name,
               subjectPKInfo SubjectPublicKeyInfo{{ PKInfoAlgorithms }},
               attributes    [0] Attributes{{ CRIAttributes }}
          }` },
        run: async (s) => {
          clearStates(s, 'q-spki');
          s.state('cri', 'active');
          await s.show('q-alg q-sig', { stagger: 90 });
          await s.fly('cri:l', 'key:t', { label: 'SHA-256(CRI)', dur: 900, arc: 30 });
          await s.fly('key:r', 'q-sig:l', { label: 'sign(d)', dur: 700 });
          s.state('q-sig', 'active');
        },
      },
      {
        title: '中身と自己署名を確認する',
        text: '<code>-verify</code> を付けると、OpenSSL が CSR 内の公開鍵で CSR の署名を検証します（OpenSSL 3.5 の表示は <code>Certificate request self-signature verify OK</code>）。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl req -in server.csr -noout -text -verify
          ⟪Certificate request self-signature verify OK⟫
          Certificate Request:
              Data:
                  Version: 1 (0x0)
                  Subject: CN=www.example.com
                  …
                  Attributes:
                      Requested Extensions:
                          X509v3 Subject Alternative Name:
                              DNS:www.example.com, DNS:example.com
              Signature Algorithm: ecdsa-with-SHA256` },
        run: async (s) => {
          clearStates(s, 'cri q-sig');
          await s.term('tk', '$ openssl req -in server.csr -noout -text -verify | head -5\nCertificate request self-signature verify OK\nCertificate Request:\n    Data:\n        Version: 1 (0x0)\n        Subject: CN=www.example.com', { clear: true });
          await s.scan('csr');
          s.state('csr', 'ok');
          await s.stamp('csr', 'SELF-SIGNATURE OK', { cls: 'st-ok' });
        },
      },
      {
        title: 'DER で見る CSR の構造',
        text: 'offset 4 の SEQUENCE（ヘッダ 3 + 182 = 185 バイト）が署名対象の <code>certificationRequestInfo</code>、offset 189 が署名アルゴリズム、offset 201 が署名値です。証明書の TBSCertificate と同じ「本体 + アルゴリズム + 署名」の形です。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl asn1parse -in server.csr -i
              0:d=0  hl=4 l= 272 cons: SEQUENCE
              ⟪4:d=1  hl=3 l= 182 cons:  SEQUENCE⟫
              7:d=2  hl=2 l=   1 prim:   INTEGER           :00
             10:d=2  hl=2 l=  26 cons:   SEQUENCE
             …
             21:d=5  hl=2 l=  15 prim:      UTF8STRING        :www.example.com
             38:d=2  hl=2 l=  89 cons:   SEQUENCE
             …
            129:d=2  hl=2 l=  58 cons:   cont [ 0 ]
            133:d=4  hl=2 l=   9 prim:     OBJECT            :Extension Request
             …
            ⟪189:d=1  hl=2 l=  10 cons:  SEQUENCE⟫
            191:d=2  hl=2 l=   8 prim:   OBJECT            :ecdsa-with-SHA256
            ⟪201:d=1  hl=2 l=  73 prim:  BIT STRING⟫` },
        run: async (s) => {
          await s.term('tk', '$ openssl asn1parse -in server.csr | head -3\n    0:d=0  hl=4 l= 272 cons: SEQUENCE\n    4:d=1  hl=3 l= 182 cons: SEQUENCE\n    7:d=2  hl=2 l=   1 prim: INTEGER           :00', { clear: true });
          s.state('cri', 'active');
          await s.state('q-alg q-sig', 'active');
        },
      },
      {
        title: '改ざんされた CSR は検証に失敗する',
        text: '途中で誰かが CSR の subject を <code>www.examp1e.com</code> に 1 バイト書き換えると、署名は元の内容に対するものなので一致しません。CA はこの CSR を受け付けません（OpenSSL: <code>self-signature verify failure</code>）。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl req -in server.csr -outform der -out server.csr.der
          $ xxd -p server.csr.der | tr -d '\\n' \\
              | sed 's/7777772e6578616d706c652e636f6d/7777772e6578616d7031652e636f6d/' \\
              | xxd -r -p > evil.csr.der
          $ openssl req -in evil.csr.der -inform der -noout -verify
          Warning: CSR self-signature does not match the contents
          ⟪Certificate request self-signature verify failure⟫` },
        run: async (s) => {
          await s.unstamp('csr');
          clearStates(s, 'cri q-alg q-sig');
          await s.set('q-subv', 'CN=www.examp1e.com');
          s.state('q-sub', 'bad');
          await s.term('tk', '$ openssl req -in evil.csr.der -inform der -noout -verify\nWarning: CSR self-signature does not match the contents\nCertificate request self-signature verify failure', { clear: true });
          s.state('csr', 'bad');
          await s.shake('q-sub');
          await s.stamp('csr', 'VERIFY FAILURE', { cls: 'st-bad' });
        },
      },
      {
        title: 'CA に送るのは CSR だけ',
        text: '正しい <code>server.csr</code>（DER 276 バイト）を CA に提出します。<code>server.key</code> はサーバーに残り、この先も TLS ハンドシェイクの署名（CertificateVerify）でサーバー内だけで使われます。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl req -in server.csr -outform der | wc -c
          276
          # certbot なら finalize で base64url(DER) を送信。手動なら CA の画面に PEM を貼り付ける
          $ cat server.csr
          -----BEGIN CERTIFICATE REQUEST-----
          MIIBEDCBtgIBADAaMRgwFgYDVQQDDA93d3cuZXhhbXBsZS5jb20wWTATBgcqhkjO
          …
          -----END CERTIFICATE REQUEST-----` },
        run: async (s) => {
          await s.unstamp('csr');
          clearStates(s, 'csr q-sub');
          await s.set('q-subv', 'CN=www.example.com', { flash: false });
          await s.show('ca', { fx: 'up' });
          await s.fly('csr:b', 'ca:t', { label: 'server.csr', dur: 800 });
          s.state('ca', 'active');
          s.state('key', 'ok');
          await s.caption('server.key はサーバーから出ない');
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 3 — CA 側
   * ===================================================================*/
  TIM.scene('#sc-ca', {
    intro: 'certbot と CA の ACME サーバーのやり取り（RFC 8555）から、HSM での署名、CT ログ登録、証明書ファイルの保存までを順に見ます。ACME のリクエストはすべてアカウント鍵で署名した JWS です。',
    steps: [
      {
        title: '注文を出す（new-order）',
        text: 'certbot は証明書に入れたい識別子（ドメイン名）を並べて注文します。本文は JWS で、<code>protected</code> ヘッダの <code>kid</code> がアカウント、署名はアカウント鍵（ES256）です。',
        code: { title: 'certbot → CA', lang: 'http', src: `
          POST /acme/new-order HTTP/1.1
          Host: acme.ca.example.com
          Content-Type: application/jose+json

          {"protected": base64url({"alg":"ES256",
             "kid":"https://acme.ca.example.com/acme/acct/1234",
             "nonce":"…","url":"https://acme.ca.example.com/acme/new-order"}),
           "payload": base64url({"identifiers":[
             ⟪{"type":"dns","value":"www.example.com"}⟫,
             {"type":"dns","value":"example.com"}]}),
           "signature": "…"}` },
        run: async (s) => {
          s.state('cb', 'active');
          await s.fly('cb:r', 'acme:l', { label: 'new-order', dur: 700 });
          s.state('acme', 'active');
        },
      },
      {
        title: 'チャレンジとトークンを受け取る',
        text: 'CA は識別子ごとに authorization を作り、選べるチャレンジ（<code>http-01</code> / <code>dns-01</code> など）とランダムな <code>token</code> を返します。',
        code: { title: 'CA → certbot（authorization）', lang: 'json', src: `
          {
            "identifier": {"type": "dns", "value": "www.example.com"},
            "status": "pending",
            "challenges": [
              {"type": "http-01", "status": "pending",
               "url": "https://acme.ca.example.com/acme/chall/7Kq3/Xy1",
               "token": "⟪IMBhFzCHz9_1hgB1WZukpbVeDywlSykB91vGzLoC-Lw⟫"},
              {"type": "dns-01", "status": "pending", "url": "…", "token": "…"}
            ]
          }` },
        run: async (s) => {
          await s.fly('acme:l', 'cb:r', { label: 'token', dur: 700 });
        },
      },
      {
        title: 'トークンを Web サーバーに置く',
        text: 'key authorization は <code>token + "." + base64url(アカウント公開鍵 JWK の SHA-256 thumbprint)</code>（RFC 8555 §8.1、RFC 7638）。certbot の webroot プラグインはこれを <code>/.well-known/acme-challenge/&lt;token&gt;</code> というファイルとして置きます。',
        code: { title: 'www.example.com', lang: 'bash', src: `
          $ cat /var/www/html/.well-known/acme-challenge/IMBhFzCHz9_1hgB1WZukpbVeDywlSykB91vGzLoC-Lw
          IMBhFzCHz9_1hgB1WZukpbVeDywlSykB91vGzLoC-Lw.⟪w1Hm6Y8q62mzPVCgXWCXQaW3d38wCtDrYxtc3eei23M⟫
          # thumbprint = base64url(SHA-256('{"crv":"P-256","kty":"EC","x":"…","y":"…"}'))` },
        run: async (s) => {
          await s.show('web', { fx: 'up' });
          s.state('web', 'active');
        },
      },
      {
        title: 'CA が外から HTTP で確認する（HTTP-01）',
        text: 'CA の検証系が <b>ポート 80</b> の <code>http://www.example.com/.well-known/acme-challenge/&lt;token&gt;</code> を取得し、本文が期待した key authorization と一致すれば、この識別子は <code>valid</code> になります。',
        code: { title: 'CA（VA）→ www.example.com:80', lang: 'http', src: `
          GET /.well-known/acme-challenge/IMBhFzCHz9_1hgB1WZukpbVeDywlSykB91vGzLoC-Lw HTTP/1.1
          Host: www.example.com

          HTTP/1.1 200 OK
          Content-Type: application/octet-stream

          IMBhFzCHz9_1hgB1WZukpbVeDywlSykB91vGzLoC-Lw.w1Hm6Y8q62mzPVCgXWCXQaW3d38wCtDrYxtc3eei23M` },
        run: async (s) => {
          s.state('va', 'active');
          await s.fly('va:l', 'web:r', { label: 'GET :80', dur: 700 });
          await s.fly('web:r', 'va:l', { label: '200', dur: 600 });
          s.state('va web', 'ok');
        },
      },
      {
        title: 'DNS-01 なら TXT レコードで示す',
        text: 'DNS-01 では key authorization の SHA-256 を base64url にした 43 文字を <code>_acme-challenge.www.example.com</code> の TXT に入れます。ワイルドカード（<code>*.example.com</code>）の発行にはこちらが必要です。',
        code: { title: 'shell', lang: 'bash', src: `
          $ printf '%s' 'IMBhFzCHz9_1hgB1WZukpbVeDywlSykB91vGzLoC-Lw.w1Hm6Y8q62mzPVCgXWCXQaW3d38wCtDrYxtc3eei23M' \\
              | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '='
          0OlgIpBSaBRlpSZ2MQCKyZ1wJv2KasTCsmRxazAvvYQ
          $ dig +short TXT _acme-challenge.www.example.com
          ⟪"0OlgIpBSaBRlpSZ2MQCKyZ1wJv2KasTCsmRxazAvvYQ"⟫` },
        run: async (s) => {
          await s.show('dns', { fx: 'up' });
          await s.fly('va:l', 'dns:r', { label: 'TXT?', dur: 700 });
          s.state('dns', 'ok');
        },
      },
      {
        title: 'CSR を提出する（finalize）',
        text: 'すべての識別子が <code>valid</code> になったら、certbot は CSR の DER を base64url にして <code>finalize</code> に送ります。',
        code: { title: 'certbot → CA', lang: 'json', src: `
          POST /acme/order/7Kq3/finalize
          payload: {
            "csr": "⟪MIIBEDCBtgIBADAaMRgwFgYDVQQDDA93d3cuZXhhbXBsZS5jb20wWTATBgcqhkjO⟫…"
          }` },
        run: async (s) => {
          clearStates(s, 'web dns va');
          await s.fly('cb:r', 'acme:l', { label: 'finalize {csr}', dur: 800 });
          s.state('acme', 'active');
        },
      },
      {
        title: 'CA が TBSCertificate を組み立てる',
        text: 'CSR の自己署名を検証したあと、CA は<b>自分のプロファイル</b>で TBS を作ります。公開鍵は CSR からコピーしますが、SAN は検証済みの識別子から、issuer は中間 CA E1 の subject、AKI は E1 の SKI、シリアルは CSPRNG の乱数です。',
        code: { title: 'ミニ CA で同じことをするなら', lang: 'bash', src: `
          $ openssl x509 -req -in server.csr \\
              -CA inter.crt -CAkey inter.key -sha384 -days 90 \\
              -extfile pki.cnf -extensions v3_leaf -out server.crt
          Certificate request self-signature ok
          subject=CN=www.example.com
          # pki.cnf [v3_leaf]:
          #   basicConstraints = critical, CA:FALSE
          #   keyUsage = critical, digitalSignature
          #   extendedKeyUsage = serverAuth
          #   subjectAltName = DNS:www.example.com, DNS:example.com
          #   authorityKeyIdentifier = keyid:always` },
        run: async (s) => {
          await s.show('tbs', { fx: 'up' });
          s.state('tbs', 'active');
        },
      },
      {
        title: 'プレ証明書を CT ログに登録し、SCT を受け取る',
        text: '公開 CA は、TLS では使えない印（CT poison 拡張 1.3.6.1.4.1.11129.2.4.3, critical）を付けた「プレ証明書」を複数の CT ログに提出し、受領証 SCT を集めます。SCT は本番証明書の拡張（…2.4.2）に埋め込まれます。',
        code: { title: 'CA → CT ログ（RFC 6962 §4.1）', lang: 'http', src: `
          POST /ct/v1/add-pre-chain HTTP/1.1
          Content-Type: application/json

          {"chain": ["<precert base64>", "<E1 base64>", "<R1 base64>"]}

          HTTP/1.1 200 OK
          {"sct_version":0,"id":"<log ID base64>",
           "timestamp":1790549952866,"extensions":"","signature":"<base64>"}` },
        run: async (s) => {
          await Promise.all([
            s.fly('tbs:r', 'ct1:l', { label: 'precert', dur: 800 }),
            s.fly('tbs:r', 'ct2:l', { label: 'precert', dur: 800, delay: 150 }),
          ]);
          await Promise.all([
            s.fly('ct1:l', 'tbs:r', { label: 'SCT', dur: 700 }),
            s.fly('ct2:l', 'tbs:r', { label: 'SCT', dur: 700, delay: 150 }),
          ]);
          await s.set('t-ctv', 'SCT リスト ×2（埋め込み）');
          s.state('t-ct', 'active');
        },
      },
      {
        title: 'HSM の中で中間 CA の鍵が署名する',
        text: 'TBS の DER を SHA-384 でハッシュし、HSM 内の中間 CA E1 の秘密鍵（P-384）で ECDSA 署名します。秘密鍵は HSM から出ず、CA のサーバーは「この TBS に署名して」と依頼して署名値だけを受け取ります。',
        code: { title: '発行された server.crt', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -subject -issuer -serial
          subject=CN=www.example.com
          issuer=C=JP, O=Example Trust, CN=Example Issuing CA E1
          serial=0B73FB81F66C9CFEA3E6620091A896E08210F4CF
          $ openssl verify -CAfile root.crt -untrusted inter.crt server.crt
          ⟪server.crt: OK⟫` },
        run: async (s) => {
          clearStates(s, 'tbs t-ct');
          await s.fly('tbs:b', 'hsm:t', { label: 'SHA-384(TBS)', dur: 700 });
          await s.scan('hsm');
          s.state('hsm', 'ok');
          await s.show('out', { fx: 'right' });
          await s.fly('hsm:r', 'out:b', { label: '(r, s)', dur: 700 });
          await s.stamp('out', 'ISSUED', { cls: 'st-ok' });
        },
      },
      {
        title: 'ダウンロードして /etc/letsencrypt に保存',
        text: 'certbot は証明書（と中間 CA 証明書を連結した PEM）をダウンロードし、<code>archive/</code> に実体を、<code>live/</code> にシンボリックリンクを作ります。更新のたびに <code>cert2.pem</code>… と番号が増え、<code>live/</code> のリンク先が切り替わります。',
        code: { title: 'www.example.com', lang: 'bash', src: `
          $ sudo ls -l /etc/letsencrypt/live/example.com/
          cert.pem -> ../../archive/example.com/cert1.pem
          chain.pem -> ../../archive/example.com/chain1.pem
          fullchain.pem -> ../../archive/example.com/fullchain1.pem
          privkey.pem -> ../../archive/example.com/privkey1.pem
          README
          $ grep -c 'BEGIN CERTIFICATE' /etc/letsencrypt/live/example.com/fullchain.pem
          ⟪2⟫` },
        run: async (s) => {
          await s.fly('acme:l', 'cb:r', { label: 'cert', dur: 700 });
          await s.show('live', { fx: 'up' });
          s.state('live', 'ok');
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 4 — チェーン検証
   * ===================================================================*/
  TIM.scene('#sc-verify', {
    intro: 'サーバーから届いた 2 枚と、手元のトラストストアにあるルートを使って、RFC 5280 §6 のパス検証を 1 段ずつ実行します。',
    steps: [
      {
        title: '届いたのは リーフ + 中間 の 2 枚',
        text: 'TLS の <code>Certificate</code> メッセージには <b>[0] server.crt、[1] inter.crt</b> が入っています。ルート <code>root.crt</code> は送られてきません。クライアント自身のトラストストアにあるものだけが信頼の起点です。',
        code: { title: 'openssl s_client -showcerts（抜粋）', lang: 'text', src: `
          Certificate chain
           0 s:CN=www.example.com
             i:C=JP, O=Example Trust, CN=Example Issuing CA E1
           1 s:C=JP, O=Example Trust, CN=Example Issuing CA E1
             i:C=JP, O=Example Trust, CN=Example Root CA R1
          # ルート（s = i = Example Root CA R1）は含まれない` },
        run: async (s) => {
          await s.show('msg', { fx: 'pop' });
          await s.show('cL', { fx: 'right' });
          await s.show('cI', { fx: 'right' });
          await s.show('cR', { fx: 'fade' });
          s.state('cR', 'dim');
        },
      },
      {
        title: '1. パス構築：リーフの issuer / AKI → 中間の subject / SKI',
        text: 'リーフの <code>issuer</code> と一致する <code>subject</code> を持ち、リーフの AKI と一致する SKI を持つ証明書を探します。見つかったのは受信した inter.crt です。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -issuer -ext authorityKeyIdentifier
          issuer=⟪C=JP, O=Example Trust, CN=Example Issuing CA E1⟫
          X509v3 Authority Key Identifier:
              ⟪92:21:CB:1D:8F:9A:BA:15:79:5F:8A:F1:34:85:D4:7F:D2:33:45:F5⟫
          $ openssl x509 -in inter.crt -noout -subject -ext subjectKeyIdentifier
          subject=⟪C=JP, O=Example Trust, CN=Example Issuing CA E1⟫
          X509v3 Subject Key Identifier:
              ⟪92:21:CB:1D:8F:9A:BA:15:79:5F:8A:F1:34:85:D4:7F:D2:33:45:F5⟫` },
        run: async (s) => {
          s.state('L-iss I-sub L-aki I-ski', 'active');
          await s.line('L-iss:r', 'I-sub:r', { cls: 'acc', curve: -36 });
          await s.line('L-aki:r', 'I-ski:r', { cls: 'acc', curve: -26 });
          s.state('ck1', 'active');
        },
      },
      {
        title: '1. パス構築：中間の issuer → トラストストアのルート',
        text: '同じように inter.crt の <code>issuer</code> / AKI をたどると、トラストストア内の <code>Example Root CA R1</code>（subject = issuer の自己署名証明書）に到達します。ここでチェーンの形が決まります。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in inter.crt -noout -issuer -ext authorityKeyIdentifier
          issuer=C=JP, O=Example Trust, CN=Example Root CA R1
          X509v3 Authority Key Identifier:
              ⟪11:67:A9:34:E1:FD:C1:FD:1E:CF:04:4D:0D:40:EA:50:25:5D:EF:3D⟫
          $ openssl x509 -in root.crt -noout -subject -issuer -ext subjectKeyIdentifier
          subject=C=JP, O=Example Trust, CN=Example Root CA R1
          issuer=C=JP, O=Example Trust, CN=Example Root CA R1
          X509v3 Subject Key Identifier:
              ⟪11:67:A9:34:E1:FD:C1:FD:1E:CF:04:4D:0D:40:EA:50:25:5D:EF:3D⟫` },
        run: async (s) => {
          clearStates(s, 'L-iss I-sub L-aki I-ski');
          await s.show('ts', { fx: 'up' });
          s.state('cR', null);
          s.state('I-iss R-sub I-aki R-ski', 'active');
          await s.line('I-iss:r', 'R-sub:r', { cls: 'acc', curve: -36 });
          await s.line('I-aki:r', 'R-ski:r', { cls: 'acc', curve: -26 });
          await s.line('ts:r', 'cR:l', { cls: 'ok' });
          s.state('ck1', 'ok');
        },
      },
      {
        title: '2. リーフの署名を「中間 CA の公開鍵」で検証',
        text: 'server.crt の TBS を SHA-384 でハッシュし、<b>inter.crt に入っている公開鍵 Q_E1</b> で ECDSA 検証します。成功すれば「このリーフは E1 の秘密鍵を持つ者が署名した」ことが確定します。',
        code: { title: '手で同じ計算をする', lang: 'bash', src: `
          $ openssl asn1parse -in server.crt -strparse 4 -noout -out tbs.der
          $ openssl asn1parse -in server.crt | tail -1
            615:d=1  hl=2 l= 105 prim: BIT STRING
          $ openssl asn1parse -in server.crt -strparse 615 -noout -out sig.der
          $ openssl x509 -in inter.crt -noout -pubkey > inter.pub
          $ openssl dgst -sha384 -verify inter.pub -signature sig.der tbs.der
          ⟪Verified OK⟫` },
        run: async (s) => {
          clearStates(s, 'I-iss R-sub I-aki R-ski');
          s.state('I-pub', 'active');
          await s.fly('I-pub:l', 'L-sig:l', { label: 'Q_E1', arc: -60, dur: 900 });
          await s.scan('cL');
          s.state('L-sig', 'ok');
          s.state('ck2', 'ok');
        },
      },
      {
        title: '3. 中間の署名を「ルートの公開鍵」で検証',
        text: '同じく inter.crt の TBS を、<b>root.crt の公開鍵 Q_R1</b> で検証します。各段の署名は必ず「1 つ上の証明書の公開鍵」で検証する、というのがチェーンの意味です。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl verify -CAfile root.crt inter.crt
          ⟪inter.crt: OK⟫` },
        run: async (s) => {
          clearStates(s, 'I-pub');
          s.state('R-pub', 'active');
          await s.fly('R-pub:l', 'I-sig:l', { label: 'Q_R1', arc: -60, dur: 900 });
          await s.scan('cI');
          s.state('I-sig', 'ok');
          s.state('ck3', 'ok');
        },
      },
      {
        title: '4. トラストアンカー：ルートは「ストアにあるから」信頼する',
        text: 'root.crt も自分自身の鍵で署名されていますが（自己署名）、それは信頼の根拠になりません。信頼されるのは、OS・ブラウザのルートプログラムが審査して<b>トラストストアに入れた</b>からです。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in root.crt -noout -subject -issuer
          subject=C=JP, O=Example Trust, CN=Example Root CA R1
          issuer=C=JP, O=Example Trust, CN=Example Root CA R1     # 自己署名
          $ openssl verify -CAfile root.crt root.crt
          root.crt: OK` },
        run: async (s) => {
          clearStates(s, 'R-pub');
          s.state('cR', 'ok');
          await s.stamp('cR', 'TRUST ANCHOR', { cls: 'st-ok' });
          s.state('ck4', 'ok');
        },
      },
      {
        title: '5. 期間・basicConstraints・keyUsage',
        text: '3 枚すべての validity が現在時刻を含むこと、署名した側（E1, R1）が <code>CA:TRUE</code> で <code>keyCertSign</code> を持つこと、E1 の <code>pathlen:0</code> に違反していない（E1 の下に CA が無い）ことを確認します。',
        code: { title: 'shell', lang: 'bash', src: `
          $ for f in server inter root; do openssl x509 -in $f.crt -noout -enddate; done
          notAfter=Dec 26 18:54:14 2026 GMT
          notAfter=Sep 26 18:54:14 2031 GMT
          notAfter=Sep 24 18:54:14 2036 GMT
          $ openssl x509 -in inter.crt -noout -ext basicConstraints,keyUsage
          X509v3 Basic Constraints: critical
              ⟪CA:TRUE, pathlen:0⟫
          X509v3 Key Usage: critical
              Digital Signature, ⟪Certificate Sign⟫, CRL Sign` },
        run: async (s) => {
          s.state('L-bc I-bc R-bc', 'active');
          s.state('ck5', 'ok');
        },
      },
      {
        title: '6. 用途（EKU）とホスト名（SAN）',
        text: 'リーフの EKU に <code>serverAuth</code> があり、接続先ホスト名 <code>www.example.com</code> が SAN の <code>DNS:</code> に含まれることを確認します。CN は見ません。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl verify -CAfile root.crt -untrusted inter.crt \\
              -purpose sslserver -verify_hostname www.example.com server.crt
          ⟪server.crt: OK⟫` },
        run: async (s) => {
          clearStates(s, 'L-bc I-bc R-bc');
          s.state('L-san L-bc', 'active');
          s.state('ck6', 'ok');
        },
      },
      {
        title: '7. 失効確認：OCSP / CRL',
        text: 'AIA の OCSP URL に「発行者名ハッシュ + 発行者鍵ハッシュ + シリアル」を問い合わせ、E1 が署名した応答で <code>good</code> を確認します（CRL なら CRLDP の URL から取得したリストにシリアルが無いこと）。サーバーが応答を TLS で添付する OCSP stapling もあります。',
        code: { title: 'shell（ローカルの OCSP レスポンダで取得）', lang: 'bash', src: `
          $ openssl ocsp -issuer inter.crt -cert server.crt \\
              -url http://ocsp.ca.example.com -CAfile ca-bundle.pem
          Response verify OK
          server.crt: ⟪good⟫
                  This Update: Sep 27 18:58:03 2026 GMT` },
        run: async (s) => {
          clearStates(s, 'L-san L-bc');
          await s.show('ocsp', { fx: 'up' });
          await s.fly('cl:r', 'ocsp:l', { label: 'OCSP req', dur: 900, arc: -40 });
          await s.fly('ocsp:l', 'cl:r', { label: 'good', dur: 800, arc: 40 });
          s.state('ocsp', 'ok');
          s.state('ck7', 'ok');
        },
      },
      {
        title: 'すべて通れば「信頼できる」',
        text: '7 項目すべてが通ったので、クライアントはこの接続の相手が <code>www.example.com</code> の秘密鍵を持つサーバーだと判断できます（その鍵での署名確認は TLS の CertificateVerify で行います → <a href="../https-tls/">HTTPS / TLS 1.3</a>）。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl verify -show_chain -CAfile root.crt -untrusted inter.crt server.crt
          server.crt: OK
          Chain:
          depth=0: CN=www.example.com (untrusted)
          depth=1: C=JP, O=Example Trust, CN=Example Issuing CA E1 (untrusted)
          depth=2: C=JP, O=Example Trust, CN=Example Root CA R1` },
        run: async (s) => {
          await s.show('res', { fx: 'up' });
          s.state('cl', 'ok');
          await s.stamp('cl', 'TRUSTED', { cls: 'st-ok' });
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 5 — 失敗ケース
   * ===================================================================*/
  const PRE = (src) => '<pre data-lang="text">' + TIM.esc(TIM.dedent(src)) + '</pre>';
  const cause = (s, t, b, st) => {
    s.$('cz').forEach((e) => e.removeAttribute('data-state'));
    return Promise.all([s.show('cz', { fx: 'up' }), s.set('cz-t', t), s.set('cz-b', b)]).then(() => s.state('cz', st || null));
  };
  const fix = (s, h, src) => Promise.all([s.show('fx', { fx: 'up' }), s.set('fx-h', h), s.set('fx-b', PRE(src))]);
  const resetCl = async (s) => { await s.unstamp('cl'); clearStates(s, 'cl'); };

  TIM.scene('#sc-fail', {
    intro: '左がサーバー側の設定、右がクライアントでの実際の出力です。よくある設定ミスと攻撃が、<b>検証のどの段階で</b>どのエラーになるかを確認します。',
    steps: [
      {
        title: 'ssl_certificate に cert.pem だけを指定した',
        text: '<code>cert.pem</code> にはリーフ 1 枚しか入っていないので、nginx は <code>Certificate</code> メッセージでリーフだけを送ります。',
        code: { title: 'shell', lang: 'bash', src: `
          $ grep -c 'BEGIN CERTIFICATE' /etc/letsencrypt/live/example.com/cert.pem
          ⟪1⟫
          $ grep -c 'BEGIN CERTIFICATE' /etc/letsencrypt/live/example.com/fullchain.pem
          2` },
        run: async (s) => {
          s.state('conf', 'warn');
          await s.line('srv:r', 'cl:l', { cls: 'flow' });
          await s.show('msg', { fx: 'pop' });
        },
      },
      {
        title: 'クライアント：中間 CA が見つからない',
        text: 'クライアントのストアにはルートしか無く、リーフの issuer（E1）が手に入らないため、パス構築の最初の段で失敗します。',
        code: { title: 'openssl s_client -CAfile root.crt（実出力）', lang: 'bash', src: `
          $ openssl s_client -connect www.example.com:443 -servername www.example.com \\
              -verify_hostname www.example.com -CAfile root.crt </dev/null
          depth=0 CN=www.example.com
          ⟪verify error:num=20:unable to get local issuer certificate⟫
          verify return:1
          depth=0 CN=www.example.com
          verify error:num=21:unable to verify the first certificate
          verify return:1
          …
          Verify return code: 21 (unable to verify the first certificate)
          # curl（OpenSSL バックエンド）:
          # curl: (60) SSL certificate problem: unable to get local issuer certificate` },
        run: async (s) => {
          await s.term('t', '$ openssl s_client -connect www.example.com:443 -servername www.example.com -verify_hostname www.example.com -CAfile root.crt </dev/null\ndepth=0 CN=www.example.com\nverify error:num=20:unable to get local issuer certificate\nverify return:1\ndepth=0 CN=www.example.com\nverify error:num=21:unable to verify the first certificate\nverify return:1\n…\nVerify return code: 21 (unable to verify the first certificate)', { clear: true });
          s.state('cl', 'bad');
          await s.stamp('cl', 'UNTRUSTED', { cls: 'st-bad' });
          await cause(s, '原因：中間証明書の送り忘れ', 'リーフの issuer「Example Issuing CA E1」の証明書がサーバーから送られず、クライアントのストアにも無いため、ルートまでつながりません（error 20）。', 'bad');
        },
      },
      {
        title: 'ブラウザでは通ってしまうことがある',
        text: 'ブラウザは AIA の <code>CA Issuers</code> URL から中間証明書を取得したり（AIA fetching）、以前に見た・事前配布された中間証明書で補ったりするため、同じサーバーでも表示できることがあります。<b>ブラウザで確認しただけでは設定ミスに気付けません。</b>',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in cert.pem -noout -ext authorityInfoAccess
          Authority Information Access:
              OCSP - URI:http://ocsp.ca.example.com
              ⟪CA Issuers - URI:http://ca.example.com/e1.crt⟫
          # サーバーが実際に送っている枚数を数える
          $ openssl s_client -connect www.example.com:443 -servername www.example.com \\
              -showcerts </dev/null 2>/dev/null | grep -c 'BEGIN CERTIFICATE'
          ⟪1⟫` },
        run: async (s) => {
          await s.term('t', '$ openssl s_client -connect www.example.com:443 -servername www.example.com -showcerts </dev/null 2>/dev/null | grep -c \'BEGIN CERTIFICATE\'\n1', { clear: true });
          await cause(s, 'ブラウザ vs それ以外', 'ブラウザ：AIA fetching や中間証明書のキャッシュで補完 → 表示できる場合がある。curl / Java / Python / 多くのアプリ：補完しない → error 20。', 'warn');
        },
      },
      {
        title: '修正：fullchain.pem を指定する',
        text: '<code>ssl_certificate</code> を <code>fullchain.pem</code>（リーフ + 中間）に変えて reload すると、2 枚が送られ、クライアントはルートまでつなげます。',
        code: { title: 'shell', lang: 'bash', src: `
          $ sudo nginx -t && sudo systemctl reload nginx
          nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
          nginx: configuration file /etc/nginx/nginx.conf test is successful
          $ openssl s_client -connect www.example.com:443 -servername www.example.com \\
              -verify_hostname www.example.com -CAfile root.crt </dev/null
          depth=2 C=JP, O=Example Trust, CN=Example Root CA R1
          verify return:1
          depth=1 C=JP, O=Example Trust, CN=Example Issuing CA E1
          verify return:1
          depth=0 CN=www.example.com
          verify return:1
          …
          ⟪Verify return code: 0 (ok)⟫` },
        run: async (s) => {
          await resetCl(s);
          s.state('conf', null);
          await s.set('conf-b', PRE(`
            server {
                listen 443 ssl;
                server_name www.example.com;
                ssl_certificate     /etc/letsencrypt/live/example.com/⟪fullchain.pem⟫;
                ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
            }`));
          s.state('conf', 'ok');
          await s.set('msg', 'Certificate: [0] leaf, [1] E1');
          await s.term('t', '$ openssl s_client -connect www.example.com:443 -servername www.example.com -verify_hostname www.example.com -CAfile root.crt </dev/null\ndepth=2 C=JP, O=Example Trust, CN=Example Root CA R1\nverify return:1\ndepth=1 C=JP, O=Example Trust, CN=Example Issuing CA E1\nverify return:1\ndepth=0 CN=www.example.com\nverify return:1\n…\nVerify return code: 0 (ok)', { clear: true });
          s.state('cl', 'ok');
          await cause(s, '解決', 'fullchain.pem = cert.pem + chain.pem。先頭がリーフ、その後に中間の順です。', 'ok');
          await fix(s, 'nginx の反映', `
            $ sudo nginx -t && sudo systemctl reload nginx
            nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
            nginx: configuration file /etc/nginx/nginx.conf test is successful`);
        },
      },
      {
        title: '社内 CA のルートをクライアントが信頼していない',
        text: '社内 CA で発行した証明書は、そのルートがクライアントのストアに無い限り検証できません。サーバーがルートまで送ってきても、自己署名のルートは信頼の根拠にならず <code>error 19</code> になります。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl verify -untrusted bundle.pem server.crt     # bundle = inter + root
          C=JP, O=Example Trust, CN=Example Root CA R1
          ⟪error 19 at 2 depth lookup: self-signed certificate in certificate chain⟫
          error server.crt: verification failed
          # 対処（Debian / Ubuntu）
          $ sudo cp root.crt /usr/local/share/ca-certificates/example-root.crt
          $ sudo update-ca-certificates
          Updating certificates in /etc/ssl/certs...
          1 added, 0 removed; done.` },
        run: async (s) => {
          await resetCl(s);
          await s.term('t', '$ openssl verify -untrusted bundle.pem server.crt\nC=JP, O=Example Trust, CN=Example Root CA R1\nerror 19 at 2 depth lookup: self-signed certificate in certificate chain\nerror server.crt: verification failed', { clear: true });
          s.state('cl', 'bad');
          await s.stamp('cl', 'UNKNOWN ROOT', { cls: 'st-bad' });
          await cause(s, '原因：ルートがトラストストアに無い', '社内 CA / 検証用 CA のルートは OS・ブラウザに入っていません。curl -k や verify=False で検証を切るのではなく、ルートをストアに追加します。', 'bad');
          await fix(s, '対処：ルートをトラストストアに追加（Debian / Ubuntu）', `
            $ sudo cp root.crt /usr/local/share/ca-certificates/example-root.crt
            $ sudo update-ca-certificates
            Updating certificates in /etc/ssl/certs...
            1 added, 0 removed; done.`);
        },
      },
      {
        title: '証明書を書き換えた：署名が合わない',
        text: '攻撃者がリーフの TBS を 1 バイトでも変えると、E1 の公開鍵での署名検証が通りません。E1 の秘密鍵は CA の HSM の中なので、署名を作り直すこともできません。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl verify -CAfile root.crt -untrusted inter.crt evil.crt
          CN=www.examp1e.com
          ⟪error 7 at 0 depth lookup: certificate signature failure⟫
          error evil.crt: verification failed` },
        run: async (s) => {
          await resetCl(s);
          await s.term('t', '$ openssl verify -CAfile root.crt -untrusted inter.crt evil.crt\nCN=www.examp1e.com\nerror 7 at 0 depth lookup: certificate signature failure\nerror evil.crt: verification failed', { clear: true });
          s.state('cl', 'bad');
          await s.stamp('cl', 'TAMPERED', { cls: 'st-bad' });
          await cause(s, '原因：TBS の改ざん', 'subject を www.examp1e.com に書き換えた evil.crt。TBS の SHA-384 が変わり、E1 の公開鍵での ECDSA 検証が失敗します（error 7）。', 'bad');
        },
      },
      {
        title: 'CA ではない鍵で「子証明書」を作った',
        text: '正規のリーフ（<code>CA:FALSE</code>）の秘密鍵を盗んで <code>bank.example.com</code> の証明書に署名しても、署名者側が CA:TRUE / keyCertSign を持たないため、basicConstraints と keyUsage の確認で弾かれます。',
        code: { title: 'shell（OpenSSL 3.5 の実出力）', lang: 'bash', src: `
          $ openssl x509 -req -in evilsub.csr -CA server.crt -CAkey server.key \\
              -days 30 -extfile evilsub.ext -out evilsub.crt
          $ openssl verify -CAfile root.crt -untrusted unt.pem evilsub.crt   # unt = inter + server
          CN=www.example.com
          ⟪error 79 at 1 depth lookup: invalid CA certificate⟫
          C=JP, O=Example Trust, CN=Example Issuing CA E1
          error 25 at 2 depth lookup: path length constraint exceeded
          CN=www.example.com
          error 32 at 1 depth lookup: key usage does not include certificate signing
          error evilsub.crt: verification failed` },
        run: async (s) => {
          await resetCl(s);
          await s.term('t', '$ openssl verify -CAfile root.crt -untrusted unt.pem evilsub.crt\nCN=www.example.com\nerror 79 at 1 depth lookup: invalid CA certificate\nC=JP, O=Example Trust, CN=Example Issuing CA E1\nerror 25 at 2 depth lookup: path length constraint exceeded\nCN=www.example.com\nerror 32 at 1 depth lookup: key usage does not include certificate signing\nerror evilsub.crt: verification failed', { clear: true });
          s.state('cl', 'bad');
          await s.stamp('cl', 'NOT A CA', { cls: 'st-bad' });
          await cause(s, '原因：署名者が CA ではない', 'depth 1 の www.example.com は CA:FALSE（error 79）で keyCertSign も無い（error 32）。さらに E1 の pathlen:0 にも違反（error 25）。', 'bad');
        },
      },
      {
        title: '失効した証明書：OCSP / CRL',
        text: '鍵漏洩などで CA が失効させると、署名も期限も正しいままの証明書が OCSP で <code>revoked</code>、CRL では <code>error 23</code> になります。',
        code: { title: 'shell（ローカルの OCSP レスポンダと CRL で確認）', lang: 'bash', src: `
          $ openssl ocsp -issuer inter.crt -cert server.crt -url http://ocsp.ca.example.com -CAfile ca-bundle.pem
          Response verify OK
          server.crt: ⟪revoked⟫
                  This Update: Sep 27 19:02:14 2026 GMT
                  Reason: keyCompromise
                  Revocation Time: Sep 27 19:00:00 2026 GMT
          $ openssl verify -crl_check -CAfile root.crt -untrusted inter.crt -CRLfile e1.crl server.crt
          CN=www.example.com
          ⟪error 23 at 0 depth lookup: certificate revoked⟫
          error server.crt: verification failed` },
        run: async (s) => {
          await resetCl(s);
          await s.term('t', '$ openssl ocsp -issuer inter.crt -cert server.crt -url http://ocsp.ca.example.com -CAfile ca-bundle.pem\nResponse verify OK\nserver.crt: revoked\n\tThis Update: Sep 27 19:02:14 2026 GMT\n\tReason: keyCompromise\n\tRevocation Time: Sep 27 19:00:00 2026 GMT\n$ openssl verify -crl_check -CAfile root.crt -untrusted inter.crt -CRLfile e1.crl server.crt\nCN=www.example.com\nerror 23 at 0 depth lookup: certificate revoked\nerror server.crt: verification failed', { clear: true });
          s.state('cl', 'bad');
          await s.stamp('cl', 'REVOKED', { cls: 'st-bad' });
          await cause(s, '原因：CA が失効させた', 'CRL / OCSP 応答はどちらも E1 が署名しています。対処は鍵を作り直して再発行することで、同じ鍵での再発行は避けます。', 'bad');
          await fix(s, '対処：失効させて、新しい鍵で再発行', `
            $ sudo certbot revoke --cert-name example.com --reason keycompromise
            $ sudo certbot certonly --webroot -w /var/www/html \\
                -d example.com -d www.example.com
            # --reuse-key を付けなければ新しい秘密鍵が生成される`);
        },
      },
    ],
  });
})();
