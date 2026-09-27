/*! Tech in Motion — topic registry (single source of truth for the sitemap, menus and related links) */
window.TIM_CATS = {
  container: { name: 'Container', ja: 'コンテナ', color: '#22d3ee' },
  web: { name: 'Web / HTTP', ja: 'Web・HTTP', color: '#a3e635' },
  pki: { name: 'Crypto / PKI', ja: '暗号・PKI', color: '#a78bfa' },
  auth: { name: 'Auth', ja: '認証・認可', color: '#f472b6' },
  mail: { name: 'Mail', ja: 'メール', color: '#fbbf24' },
  net: { name: 'Network', ja: 'ネットワーク', color: '#60a5fa' },
  dev: { name: 'Dev Tools', ja: '開発基盤', color: '#fb923c' },
};

/*
 * id      : ディレクトリ名 topics/<id>/
 * cat     : TIM_CATS のキー
 * title   : 表示名
 * sub     : 1 行説明
 * cmds    : トップページ・カードに流す代表コマンド（実在するもの）
 * tags    : 登場する実物（ファイル名・ヘッダ名・フィールド名など）
 * related : 関連トピック id
 * status  : 'ready'（公開）| 'soon'（準備中：リンクしない）
 */
window.TIM_TOPICS = [
  {
    id: 'docker', cat: 'container', title: 'Docker',
    sub: 'Dockerfile → イメージ(レイヤー) → コンテナ。overlay2 と namespace の実体',
    cmds: ['docker build -t web:1.0 .', 'docker run -d -p 8080:80 web:1.0', 'docker image inspect web:1.0'],
    tags: ['Dockerfile', 'overlay2', 'manifest.json', 'namespaces', 'cgroups'],
    related: ['docker-compose', 'dns', 'git-internals'], status: 'ready',
  },
  {
    id: 'docker-compose', cat: 'container', title: 'Docker Compose',
    sub: 'compose.yaml が作るネットワーク・ボリューム・コンテナと、サービス名 DNS',
    cmds: ['docker compose up -d', 'docker compose ps', 'docker compose logs -f api'],
    tags: ['compose.yaml', 'depends_on', 'healthcheck', '127.0.0.11', 'volumes'],
    related: ['docker', 'dns', 'webapi'], status: 'ready',
  },
  {
    id: 'http', cat: 'web', title: 'HTTP',
    sub: 'GET / POST / PUT / PATCH / DELETE。リクエストとレスポンスをバイト単位で',
    cmds: ['curl -v https://example.com/', 'curl -X PUT -H "Content-Type: application/json" -d @user.json …', 'curl -I https://example.com/'],
    tags: ['Request line', 'Headers', 'Status code', 'Idempotency', 'Cache-Control'],
    related: ['webapi', 'https-tls', 'cors'], status: 'ready',
  },
  {
    id: 'webapi', cat: 'web', title: 'Web API (REST)',
    sub: 'リソース設計・JSON・ステータスコード・認証ヘッダ。curl で叩いて理解する',
    cmds: ['curl -s https://api.example.com/v1/users?page=2', 'curl -X POST … -d \'{"name":"alice"}\'', 'curl -X DELETE … /users/42'],
    tags: ['/v1/users/{id}', '201 Created', 'Location', 'ETag', 'application/problem+json'],
    related: ['http', 'jwt', 'oauth-oidc', 'cors'], status: 'ready',
  },
  {
    id: 'cors', cat: 'web', title: 'CORS',
    sub: 'Origin・プリフライト(OPTIONS)・Access-Control-* ヘッダはどこで判定されるか',
    cmds: ['curl -i -X OPTIONS -H "Origin: https://app.example" …', 'curl -i -H "Origin: https://evil.example" …'],
    tags: ['Origin', 'Access-Control-Allow-Origin', 'preflight', 'credentials'],
    related: ['http', 'webapi'], status: 'ready',
  },
  {
    id: 'https-tls', cat: 'pki', title: 'HTTPS / TLS 1.3',
    sub: 'ClientHello から Finished まで。鍵共有・証明書検証・暗号化の境界',
    cmds: ['openssl s_client -connect example.com:443 -servername example.com', 'curl -v https://example.com', 'openssl s_client -showcerts …'],
    tags: ['ClientHello', 'key_share', 'SNI', 'CertificateVerify', 'Finished'],
    related: ['x509', 'ca-pki', 'http'], status: 'ready',
  },
  {
    id: 'x509', cat: 'pki', title: 'X.509 証明書',
    sub: 'X.501 識別名(DN)・SAN・拡張・ASN.1/DER/PEM。証明書ファイルの中身を全部読む',
    cmds: ['openssl x509 -in server.crt -noout -text', 'openssl asn1parse -in server.crt', 'openssl x509 -in server.crt -noout -subject -issuer -dates'],
    tags: ['Subject DN', 'subjectAltName', 'keyUsage', 'DER', 'PEM'],
    related: ['ca-pki', 'https-tls', 'ssh'], status: 'soon',
  },
  {
    id: 'ca-pki', cat: 'pki', title: 'CA と証明書チェーン',
    sub: 'CSR を誰が作り、CA がどこで署名し、ブラウザがどこで検証するか',
    cmds: ['openssl req -new -key server.key -out server.csr', 'openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key …', 'openssl verify -CAfile root.crt -untrusted inter.crt server.crt'],
    tags: ['CSR', 'Root CA', 'Intermediate', 'trust store', 'OCSP'],
    related: ['x509', 'https-tls', 'dkim'], status: 'soon',
  },
  {
    id: 'jwt', cat: 'auth', title: 'JWT',
    sub: 'header.payload.signature。どこで署名され、どこで検証され、改ざんはどう検出されるか',
    cmds: ['openssl genpkey -algorithm RSA -out private.pem', 'curl -H "Authorization: Bearer eyJ…" …', 'curl https://auth.example.com/.well-known/jwks.json'],
    tags: ['alg', 'kid', 'exp', 'aud', 'JWKS'],
    related: ['oauth-oidc', 'webapi', 'https-tls'], status: 'ready',
  },
  {
    id: 'oauth-oidc', cat: 'auth', title: 'OAuth 2.0 / OIDC',
    sub: '認可コードフロー + PKCE。リダイレクトとトークン交換をパラメータ単位で',
    cmds: ['GET /authorize?response_type=code&client_id=…&code_challenge=…', 'POST /token grant_type=authorization_code', 'GET /.well-known/openid-configuration'],
    tags: ['code_verifier', 'state', 'redirect_uri', 'id_token', 'scope'],
    related: ['jwt', 'webapi', 'cors'], status: 'ready',
  },
  {
    id: 'dkim', cat: 'mail', title: 'DKIM (+SPF/DMARC)',
    sub: '送信 MTA で署名、受信 MTA が DNS の公開鍵で検証。DKIM-Signature を 1 タグずつ',
    cmds: ['opendkim-genkey -s sel1 -d example.com', 'dig +short TXT sel1._domainkey.example.com', 'opendkim-testkey -d example.com -s sel1 -vvv'],
    tags: ['DKIM-Signature', 'bh=', 'b=', '_domainkey', 'Authentication-Results'],
    related: ['dns', 'ca-pki', 'x509'], status: 'soon',
  },
  {
    id: 'dns', cat: 'net', title: 'DNS 名前解決',
    sub: 'スタブ → フルリゾルバ → ルート → TLD → 権威。dig +trace で全部見る',
    cmds: ['dig +trace www.example.com', 'dig @8.8.8.8 example.com MX', 'dig +short TXT _dmarc.example.com'],
    tags: ['/etc/resolv.conf', 'A / AAAA / CNAME', 'TTL', 'NS', 'zone file'],
    related: ['dkim', 'docker-compose', 'https-tls'], status: 'soon',
  },
  {
    id: 'ssh', cat: 'net', title: 'SSH',
    sub: '鍵交換・ホスト鍵確認・公開鍵認証。known_hosts と authorized_keys の役割',
    cmds: ['ssh-keygen -t ed25519 -C "you@example.com"', 'ssh -v user@host', 'ssh-keyscan -t ed25519 host'],
    tags: ['~/.ssh/id_ed25519', 'known_hosts', 'authorized_keys', 'sshd_config'],
    related: ['x509', 'git-internals'], status: 'soon',
  },
  {
    id: 'git-internals', cat: 'dev', title: 'Git の中身',
    sub: 'blob / tree / commit と .git ディレクトリ。コミットは SHA-1 で繋がったグラフ',
    cmds: ['git cat-file -p HEAD', 'git hash-object -w hello.txt', 'git ls-tree HEAD'],
    tags: ['.git/objects', 'refs/heads/main', 'HEAD', 'index', 'packfile'],
    related: ['ssh', 'docker'], status: 'soon',
  },
];
