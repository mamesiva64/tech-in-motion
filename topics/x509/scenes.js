/* X.509 証明書 — scenes (see AGENT.md §7)
 * 例示値はすべて OpenSSL 3.5.7 で実際に生成した server.crt / inter.crt / root.crt の出力。
 */
(function () {
  'use strict';

  /* ---- 共通ヘルパー（ステージ状態だけに依存する＝冪等） ---- */
  const clearFocus = (s) => {
    s.$('[data-el="map"]').forEach((e) => e.remove());
    s.$('[data-state]').forEach((e) => e.removeAttribute('data-state'));
  };
  const map = (s, a, b, o) => s.line(a + ':r', b + ':l', Object.assign({ id: 'map', cls: 'acc', elbow: 'h', dur: 450 }, o || {}));
  const focus = async (s, left, right, o) => {
    clearFocus(s);
    const ls = [].concat(left), rs = [].concat(right);
    s.state(ls.concat(rs).join(' '), 'active');
    await Promise.all(ls.map((l, k) => map(s, l, rs[Math.min(k, rs.length - 1)], o)));
  };
  const stamps = (s) => s.$('.stamp').forEach((e) => e.remove());

  /* =====================================================================
   * SCENE 1 — openssl -text と ASN.1 の対応
   * ===================================================================*/
  TIM.scene('#sc-structure', {
    intro: '<code>openssl x509 -text</code> の出力（左）と RFC 5280 の <code>Certificate</code> / <code>TBSCertificate</code>（右）を 1 フィールドずつ対応づけます。右の各行の末尾は、そのフィールドの DER 先頭バイトです。',
    steps: [
      {
        title: 'server.crt を -text で開く',
        text: '<code>openssl x509 -text</code> は DER をパースして人間向けに並べ直した表示です。構造は 3 要素の SEQUENCE：署名される本体 <code>tbsCertificate</code>、署名アルゴリズム <code>signatureAlgorithm</code>、署名値 <code>signatureValue</code>。',
        code: [
          { title: 'shell', lang: 'bash', src: `
            $ openssl x509 -in server.crt -noout -text | head -3
            Certificate:
                Data:
                    Version: 3 (0x2)` },
          { title: 'RFC 5280 §4.1', lang: 'text', src: `
            Certificate  ::=  SEQUENCE  {
                 ⟪tbsCertificate       TBSCertificate⟫,
                 signatureAlgorithm   AlgorithmIdentifier,
                 signatureValue       BIT STRING  }` },
        ],
        run: async (s) => {
          await s.show('out', { fx: 'left' });
          await s.show('cert', { fx: 'fade' });
          await s.show('tbs', { fx: 'fade' });
          await s.show('f-ver f-ser f-sig f-iss f-val f-sub f-spki f-ext', { stagger: 70 });
          await s.show('f-salg f-sval', { stagger: 90 });
        },
      },
      {
        title: 'version：v3 は「値 2」',
        text: '<code>Version: 3 (0x2)</code> の括弧内が DER に入っている実際の値です（v1=0, v2=1, v3=2）。<code>[0] EXPLICIT</code> の文脈タグ <code>a0</code> で包まれ、v1 のときはフィールドごと省略されます。拡張を持つ証明書は v3 でなければなりません。',
        code: { title: 'DER（offset 8）', lang: 'text', src: `
          a0 03          [0] EXPLICIT, 長さ 3
             02 01 02    INTEGER 2  → ⟪Version: 3 (0x2)⟫

          Version  ::=  INTEGER  {  v1(0), v2(1), v3(2)  }` },
        run: async (s) => { await focus(s, 'o-ver', 'f-ver'); },
      },
      {
        title: 'serialNumber：CA 内で一意な 20 バイト',
        text: 'シリアルは発行 CA の中で一意な正の整数で、最大 20 オクテット（RFC 5280 §4.1.2.2）。公開 CA は CSPRNG の出力を 64 ビット以上含める決まりです（CA/B Forum BR §7.1）。CRL / OCSP で「どの証明書が失効したか」を指すのはこの番号です。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -serial
          serial=⟪2A4CD0F3DCA72B02844E3598254F9DDE33F066BA⟫
          # DER: 02 14 2a 4c d0 f3 … 66 ba  (INTEGER, 0x14 = 20 バイト)` },
        run: async (s) => { await focus(s, 'o-ser', 'f-ser'); },
      },
      {
        title: 'signature：TBS の中にも署名アルゴリズム',
        text: 'TBS 内の <code>signature</code> と外側の <code>signatureAlgorithm</code> は同じ値でなければなりません（RFC 5280 §4.1.1.2）。外側は署名の対象外なので、TBS 側に同じ値を入れて「アルゴリズムのすり替え」を署名で守っています。',
        code: { title: 'DER', lang: 'text', src: `
          30 0a                          SEQUENCE (AlgorithmIdentifier)
             06 08 2a 86 48 ce 3d 04 03 03  OID 1.2.840.10045.4.3.3
                                         = ⟪ecdsa-with-SHA384⟫
          # offset 35（TBS 内）と offset 681（外側）に同じバイト列` },
        run: async (s) => { await focus(s, ['o-sig', 'o-salg'], ['f-sig', 'f-salg']); },
      },
      {
        title: 'issuer と subject：どちらも X.501 の Name',
        text: '<code>issuer</code> は署名した CA（中間 CA「Example Issuing CA E1」）の名前、<code>subject</code> は公開鍵の持ち主の名前です。どちらも X.501 の識別名（DN）で、issuer は上位 CA 証明書の subject と一致します。中身は次のシーンでバイト単位に分解します。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -issuer -subject
          issuer=⟪C=JP, O=Example Trust, CN=Example Issuing CA E1⟫
          subject=C=JP, ST=Tokyo, L=Chiyoda-ku, O=Example Inc, CN=www.example.com` },
        run: async (s) => { await focus(s, ['o-iss', 'o-sub'], ['f-iss', 'f-sub']); },
      },
      {
        title: 'validity：notBefore / notAfter',
        text: '有効期間は <code>UTCTime</code>（<code>YYMMDDHHMMSSZ</code>）で、2050 年以降の日付は <code>GeneralizedTime</code>（4 桁年）で表します。公開 TLS 証明書の最大有効期間は 2026-03-15 以降の発行分で 200 日（CA/B Forum SC-081v3）。この証明書は 90 日です。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -dates
          notBefore=Sep 27 18:54:21 2026 GMT
          notAfter=⟪Dec 26 18:54:21 2026 GMT⟫
          # DER: 17 0d "260927185421Z"  17 0d "261226185421Z"` },
        run: async (s) => { await focus(s, 'o-val', 'f-val'); },
      },
      {
        title: 'subjectPublicKeyInfo：証明書が「証明」する公開鍵',
        text: 'アルゴリズム（<code>id-ecPublicKey</code> + 曲線 <code>prime256v1</code>）と公開鍵本体（BIT STRING）です。EC の公開鍵は <code>04‖X‖Y</code> の 65 バイト。対応する秘密鍵はサーバーの <code>server.key</code> にだけあり、証明書には入りません。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -pubkey
          -----BEGIN PUBLIC KEY-----
          MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEQAVexdgH2bukTb6UUijCMBwNixaN
          HLCaf0ZkxSqHXVXHD5Kz8u8NMFs/HLhhTyeU9PX8sMgDWQGOqGN5vpNLHw==
          -----END PUBLIC KEY-----
          # DER: 30 59 30 13 06 07 2a86…(ecPublicKey) 06 08 2a86…(P-256) ⟪03 42 00 04⟫ 40 05 5e …` },
        run: async (s) => { await focus(s, 'o-spki', 'f-spki'); },
      },
      {
        title: 'extensions：[3] に入った 9 個の拡張',
        text: '用途・CA かどうか・有効なホスト名・失効情報の在りかは、すべて <code>[3] EXPLICIT</code>（DER の <code>a3</code>）の中の拡張に書かれます。<code>critical</code> が付いた拡張を理解できない検証者は証明書を拒否しなければなりません。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -ext basicConstraints,keyUsage,extendedKeyUsage
          X509v3 Basic Constraints: ⟪critical⟫
              CA:FALSE
          X509v3 Key Usage: ⟪critical⟫
              Digital Signature
          X509v3 Extended Key Usage:
              TLS Web Server Authentication` },
        run: async (s) => { await focus(s, 'o-ext', 'f-ext'); },
      },
      {
        title: 'signatureValue：TBS の DER に CA が署名した値',
        text: '発行 CA は <b>tbsCertificate の DER バイト列（offset 4 から 677 バイト）</b>を SHA-384 でハッシュし、自分の秘密鍵（中間 CA E1 の P-384 鍵）で ECDSA 署名します。結果の <code>(r, s)</code> を DER の SEQUENCE にして BIT STRING に入れたものが <code>Signature Value</code> です。',
        code: { title: 'shell — 署名対象と署名値を切り出して手で検証', lang: 'bash', src: `
          $ openssl asn1parse -in server.crt -strparse 4 -noout -out tbs.der
          $ openssl asn1parse -in server.crt -strparse 693 -noout -out sig.der
          $ ls -l tbs.der sig.der
          -rw-r--r-- 1 user user ⟪677⟫ Sep 28 04:08 tbs.der
          -rw-r--r-- 1 user user 103 Sep 28 04:08 sig.der
          $ openssl x509 -in inter.crt -noout -pubkey > inter.pub
          $ openssl dgst -sha384 -verify inter.pub -signature sig.der tbs.der
          ⟪Verified OK⟫` },
        run: async (s) => {
          clearFocus(s);
          s.state('tbs', 'active');
          await s.show('sig1', { fx: 'pop' });
          await s.fly('tbs:l', 'sig1:t', { label: '677 bytes', arc: -30 });
          await s.show('sig2', { fx: 'pop' });
          await s.fly('sig2:r', 'f-sval:l', { label: '(r, s)' });
          s.state('f-sval o-sval', 'active');
          await s.scramble('sv', '30:65:02:31:00:a5:64:a6:62:b6:94:90:…', { dur: 1100 });
        },
      },
      {
        title: 'フィンガープリントは「DER 全体」のハッシュ',
        text: '証明書ビューアに出る SHA-256 フィンガープリントは、署名まで含む <b>DER 全体（799 バイト）</b>のハッシュで、署名対象（TBS 677 バイト）のハッシュとは別物です。証明書を一意に指す ID として、ピン留めや照合に使います。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -fingerprint -sha256
          sha256 Fingerprint=⟪62:31:42:77⟫:FF:8F:BF:ED:34:04:97:8B:AE:8E:6C:58:5C:59:39:5C:88:AC:8C:25:5D:29:DC:B6:37:7A:5C:11
          $ openssl x509 -in server.crt -outform der | sha256sum
          ⟪62314277⟫ff8fbfed3404978bae8e6c585c59395c88ac8c255d29dcb6377a5c11  -` },
        run: async (s) => {
          clearFocus(s);
          s.state('cert', 'active');
          await s.hide('sig1 sig2', { dur: 200 });
          await s.caption('fingerprint = SHA-256(DER 全体 799 B)', { x: 242, y: 466 });
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 2 — X.501 Name
   * ===================================================================*/
  const RDN = [1, 2, 3, 4, 5];
  TIM.scene('#sc-dn', {
    intro: 'Subject の 1 行が、DER の中では <code>SEQUENCE OF SET OF SEQUENCE { OID, 文字列 }</code> という 3 重の入れ子になっていることを、実際のバイトで確かめます。',
    steps: [
      {
        title: 'Subject を 1 行で表示する',
        text: 'OpenSSL 3.2 以降の既定表示は <code>C=JP, ST=Tokyo, …, CN=www.example.com</code>。DER に格納されている順（上位 → 下位）のまま、<code>, </code> 区切りで並べたものです。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -subject
          subject=⟪C=JP, ST=Tokyo, L=Chiyoda-ku, O=Example Inc, CN=www.example.com⟫` },
        run: async (s) => {
          await s.show('l-disp', { fx: 'fade' });
          await s.show('disp', { fx: 'left' });
        },
      },
      {
        title: 'Name = RDNSequence（RDN の SEQUENCE）',
        text: 'X.501 の <code>Name</code> は、現状 <code>rdnSequence</code> の 1 択です。<code>RDNSequence</code> は <code>RelativeDistinguishedName</code>（RDN）の SEQUENCE で、DER では <code>30 62</code>（98 バイト）から始まります。',
        code: { title: 'RFC 5280 §4.1.2.4', lang: 'text', src: `
          Name ::= CHOICE { -- only one possibility for now --
            rdnSequence  RDNSequence }

          ⟪RDNSequence ::= SEQUENCE OF RelativeDistinguishedName⟫

          RelativeDistinguishedName ::=
            SET SIZE (1..MAX) OF AttributeTypeAndValue

          AttributeTypeAndValue ::= SEQUENCE {
            type     AttributeType,        -- OBJECT IDENTIFIER
            value    AttributeValue }      -- ANY DEFINED BY type` },
        run: async (s) => { await s.show('rdnseq', { fx: 'fade' }); },
      },
      {
        title: 'RDN = SET、中身は AttributeTypeAndValue',
        text: '各 RDN は <code>SET</code>（<code>31</code>）で、中に <code>SEQUENCE { type, value }</code>（<code>30</code>）が入ります。SET に複数の属性を入れた「複数値 RDN」も定義上は可能ですが、TLS 証明書ではほぼ常に 1 RDN = 1 属性です。',
        code: { title: 'openssl asn1parse（offset 150〜）', lang: 'text', src: `
            150:d=2  hl=2 l=  98 cons: SEQUENCE
            152:d=3  hl=2 l=  11 cons: ⟪SET⟫
            154:d=4  hl=2 l=   9 cons: ⟪SEQUENCE⟫
            156:d=5  hl=2 l=   3 prim: OBJECT            :countryName
            161:d=5  hl=2 l=   2 prim: PRINTABLESTRING   :JP
            165:d=3  hl=2 l=  14 cons: SET
            167:d=4  hl=2 l=  12 cons: SEQUENCE
            169:d=5  hl=2 l=   3 prim: OBJECT            :stateOrProvinceName
            174:d=5  hl=2 l=   5 prim: UTF8STRING        :Tokyo
            …
            224:d=3  hl=2 l=  24 cons: SET
            226:d=4  hl=2 l=  22 cons: SEQUENCE
            228:d=5  hl=2 l=   3 prim: OBJECT            :commonName
            233:d=5  hl=2 l=  15 prim: UTF8STRING        :www.example.com` },
        run: async (s) => {
          await s.show('rdn1 rdn2 rdn3 rdn4 rdn5', { stagger: 80 });
          await Promise.all(RDN.map((i) => s.fly('s' + i + ':b', 'rdn' + i + ':t', { delay: i * 70, dur: 700 })));
        },
      },
      {
        title: 'type は OID：2.5.4.x',
        text: '属性の種類は OID で表されます。X.500 の属性型はすべて <code>2.5.4.x</code>（joint-iso-itu-t / ds / attributeType）。DER では先頭 2 要素を <code>40×2+5 = 85 = 0x55</code> の 1 バイトにまとめるので、<code>06 03 55 04 03</code> が <code>2.5.4.3</code>（commonName）です。',
        code: { title: 'OID の符号化', lang: 'text', src: `
          06 03 55 04 06   → 2.5.4.6   countryName          C
          06 03 55 04 08   → 2.5.4.8   stateOrProvinceName  ST
          06 03 55 04 07   → 2.5.4.7   localityName         L
          06 03 55 04 0a   → 2.5.4.10  organizationName     O
          06 03 55 04 0b   → 2.5.4.11  organizationalUnitName OU
          06 03 55 04 03   → ⟪2.5.4.3   commonName           CN⟫
          # 0x55 = 85 = 40*2 + 5  →  "2.5"` },
        run: async (s) => {
          s.$('[data-state]').forEach((e) => e.removeAttribute('data-state'));
          await s.state(RDN.map((i) => 'ob' + i + ' oid' + i).join(' '), 'active');
        },
      },
      {
        title: 'value の文字列型：PrintableString と UTF8String',
        text: '値は属性ごとに決まった文字列型で入ります。<code>C</code> は 2 文字の <code>PrintableString</code>（タグ <code>13</code>）、それ以外は <code>DirectoryString</code> の中から、OpenSSL の既定（<code>string_mask = utf8only</code>）では <code>UTF8String</code>（タグ <code>0c</code>）が選ばれています。RFC 5280 は新規発行で PrintableString か UTF8String を使うよう求めています。',
        code: { title: 'DER', lang: 'text', src: `
          ⟪13 02⟫ 4a 50                       PrintableString "JP"
          ⟪0c 05⟫ 54 6f 6b 79 6f              UTF8String "Tokyo"
          0c 0f 77 77 77 2e 65 78 61 6d …    UTF8String "www.example.com"` },
        run: async (s) => {
          s.$('[data-state]').forEach((e) => e.removeAttribute('data-state'));
          s.state('vb1 ty1', 'warn');
          await s.state('vb2 ty2 vb3 ty3 vb4 ty4 vb5 ty5', 'active');
        },
      },
      {
        title: 'RFC 4514 の文字列表現は「逆順」',
        text: 'LDAP 由来の RFC 4514 文字列は、<b>SEQUENCE の最後の RDN から先頭へ</b>向かって書きます（§2.1）。DER の格納順（C → CN）は同じでも、文字列にすると <code>CN=…,O=…,C=JP</code> になります。<code>-nameopt RFC2253</code> がこの形式です（Java の <code>X500Principal.getName()</code> も同じ並び）。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -subject -nameopt RFC2253
          subject=⟪CN=www.example.com,O=Example Inc,L=Chiyoda-ku,ST=Tokyo,C=JP⟫` },
        run: async (s) => {
          s.$('[data-state]').forEach((e) => e.removeAttribute('data-state'));
          await s.show('l-rfc', { fx: 'fade' });
          await s.show('rfc', { fx: 'fade', dur: 250 });
          for (const i of [5, 4, 3, 2, 1]) {
            await s.fly('s' + i + ':b', 'r' + i + ':t', { dur: 520, hit: false });
            await s.show('r' + i, { fx: 'pop', dur: 260 });
          }
        },
      },
      {
        title: '同じ DN でも OpenSSL のバージョンで表示が変わる',
        text: 'OpenSSL 1.1.1 / 3.0 / 3.1 の既定は <code>-nameopt oneline</code> で、<code>=</code> の前後に空白が入ります（<code>C = JP</code>）。3.2 で既定が変わり <code>C=JP</code> になりました。出力を grep するスクリプトはバージョンアップで壊れるので、<code>-nameopt</code> を明示します。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -subject -nameopt oneline
          subject=⟪C = JP, ST = Tokyo, L = Chiyoda-ku, O = Example Inc, CN = www.example.com⟫
          $ openssl x509 -in server.crt -noout -subject -nameopt multiline
          subject=
              countryName               = JP
              stateOrProvinceName       = Tokyo
              localityName              = Chiyoda-ku
              organizationName          = Example Inc
              commonName                = www.example.com` },
        run: async (s) => {
          await s.show('alt', { fx: 'up' });
          await s.state('alt', 'warn');
        },
      },
      {
        title: '略号ではなく OID のまま見る',
        text: '<code>-nameopt oid</code> を足すと略号の代わりに OID が出ます。OpenSSL が名前を知らない属性（独自 OID）も、この形なら DER に入っている事実どおりに確認できます。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -subject -nameopt RFC2253,oid
          subject=⟪2.5.4.3⟫=www.example.com,⟪2.5.4.10⟫=Example Inc,2.5.4.7=Chiyoda-ku,2.5.4.8=Tokyo,2.5.4.6=JP` },
        run: async (s) => {
          s.$('[data-state]').forEach((e) => e.removeAttribute('data-state'));
          await s.set('alt', 'subject=2.5.4.3=www.example.com,2.5.4.10=Example Inc,2.5.4.7=Chiyoda-ku,2.5.4.8=Tokyo,2.5.4.6=JP');
          await s.state('alt', 'active');
        },
      },
      {
        title: 'issuer は上位 CA の subject とバイト一致',
        text: 'リーフの <code>issuer</code> と、中間 CA 証明書 <code>inter.crt</code> の <code>subject</code> は同じ 71 バイトです。検証側はこの一致（RFC 5280 §7.1 の比較規則）と AKI/SKI を手がかりに発行者を探してチェーンをつなぎます。OpenSSL の CApath はこの名前のハッシュをファイル名（<code>dd145d05.0</code>）に使います。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -issuer_hash -issuer
          ⟪dd145d05⟫
          issuer=C=JP, O=Example Trust, CN=Example Issuing CA E1
          $ openssl x509 -in inter.crt -noout -subject_hash -subject
          ⟪dd145d05⟫
          subject=C=JP, O=Example Trust, CN=Example Issuing CA E1` },
        run: async (s) => {
          s.$('[data-state]').forEach((e) => e.removeAttribute('data-state'));
          await s.hide('rdn1 rdn2 rdn3 rdn4 rdn5 rdnseq alt', { dur: 250 });
          await s.show('cmp1', { fx: 'left' });
          await s.show('cmp2', { fx: 'right' });
          s.line('cmp1:r', 'cmp2:l', { cls: 'ok', label: '＝', both: true });
          await s.show('cmpok', { fx: 'pop' });
          s.state('cmp2', 'ok');
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 3 — PEM / DER / TLV
   * ===================================================================*/
  const tlv = (s, t, l, v, x) => Promise.all([s.set('tv-t', t), s.set('tv-l', l), s.set('tv-v', v), s.set('tlvx', x)]);
  const hexOn = (s, names, st) => {
    s.$('[data-state]').forEach((e) => e.removeAttribute('data-state'));
    return s.state(names, st || 'active');
  };
  TIM.scene('#sc-der', {
    intro: 'PEM を base64 デコードすると DER（799 バイト）になり、DER は先頭から <b>Tag・Length・Value</b> の繰り返しとして読めます。16 進の各塊が何を意味するかを順に確認します。',
    steps: [
      {
        title: 'PEM：base64 + BEGIN/END 行',
        text: 'PEM（RFC 7468）は DER を base64 にして 64 文字ごとに改行し、<code>-----BEGIN CERTIFICATE-----</code> / <code>-----END CERTIFICATE-----</code> で挟んだテキストです。ラベル（<code>CERTIFICATE</code>）が中身の種類を表します。',
        code: { title: 'server.crt', lang: 'pem', src: `
          ⟪-----BEGIN CERTIFICATE-----⟫
          MIIDGzCCAqGgAwIBAgIUKkzQ89ynKwKETjWYJU+d3jPwZrowCgYIKoZIzj0EAwMw
          RTELMAkGA1UEBhMCSlAxFjAUBgNVBAoMDUV4YW1wbGUgVHJ1c3QxHjAcBgNVBAMM
          FUV4YW1wbGUgSXNzdWluZyBDQSBFMTAeFw0yNjA5MjcxODU0MjFaFw0yNjEyMjYx
          …
          dgOX7Griwzai8WCsMgjrFmCaGql/4t6CnwaDdw+EDg==
          ⟪-----END CERTIFICATE-----⟫` },
        run: async (s) => { await s.show('pem', { fx: 'left' }); },
      },
      {
        title: 'base64 を外すと DER（799 バイト）',
        text: '<code>-outform der</code> は PEM の base64 部分をデコードしてバイナリで書き出すだけです。先頭の <code>MIID</code> は <code>30 82 03</code> の base64。証明書の PEM がほぼ必ず <code>MII</code> で始まるのは、長形式 2 バイト長の SEQUENCE（<code>30 82</code>）だからです。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -outform der -out server.der
          $ ls -l server.der
          -rw-r--r-- 1 user user ⟪799⟫ Sep 28 03:54 server.der
          $ grep -v -- ----- server.crt | base64 -d | cmp - server.der && echo same
          same` },
        run: async (s) => {
          await s.show('t3', { fx: 'right' });
          await s.term('t3', '$ openssl x509 -in server.crt -outform der -out server.der\n$ ls -l server.der\n-rw-r--r-- 1 user user 799 Sep 28 03:54 server.der');
          await s.fly('pem:b', 'hexf:t', { label: 'base64 -d', dur: 700 });
          await s.show('hexf', { fx: 'up' });
        },
      },
      {
        title: 'xxd で先頭バイトを見る',
        text: '<code>xxd</code> の 1 行目がそのまま下の 16 進ダンプの 1 行目です。ここから先は、塊ごとに「タグ 1 バイト・長さ・値」と区切って読んでいきます。',
        code: { title: 'shell', lang: 'bash', src: `
          $ xxd server.der | head -3
          00000000: ⟪3082 031b⟫ 3082 02a1 a003 0201 0202 142a  0...0..........*
          00000010: 4cd0 f3dc a72b 0284 4e35 9825 4f9d de33  L....+..N5.%O..3
          00000020: f066 ba30 0a06 082a 8648 ce3d 0403 0330  .f.0...*.H.=...0` },
        run: async (s) => {
          await s.term('t3', '$ xxd server.der | head -3\n00000000: 3082 031b 3082 02a1 a003 0201 0202 142a  0...0..........*\n00000010: 4cd0 f3dc a72b 0284 4e35 9825 4f9d de33  L....+..N5.%O..3\n00000020: f066 ba30 0a06 082a 8648 ce3d 0403 0330  .f.0...*.H.=...0');
          await s.scan('hexf');
        },
      },
      {
        title: '最初の TLV：Certificate SEQUENCE',
        text: 'Tag <code>30</code> は SEQUENCE（構造型）。Length の先頭 <code>82</code> は「上位ビット 1 = 長形式、続く 2 バイトが長さ」を意味し、<code>03 1b</code> = 795。ヘッダ 4 バイト + 値 795 バイト = <b>799 バイト = ファイルサイズ</b>です。',
        code: { title: 'DER', lang: 'text', src: `
          30          Tag    : SEQUENCE (0x30 = universal, constructed, 16)
          82 03 1b    Length : 0x82 → 後ろ 2 バイトが長さ → 0x031b = ⟪795⟫
          …           Value  : 795 バイト（tbsCertificate, signatureAlgorithm, signatureValue）` },
        run: async (s) => {
          await s.show('tlv tlvx tags', { stagger: 80 });
          hexOn(s, 'h-cert');
          await tlv(s, '30 SEQUENCE', '82 03 1b = 795', '795 バイト（3 要素）', '0x30 = SEQUENCE（構造型）。Length の 0x82 は「続く 2 バイトが長さ」の長形式。4 + 795 = 799 バイトでファイル全体です。');
        },
      },
      {
        title: 'TBSCertificate と version [0]',
        text: '次の <code>30 82 02 a1</code> が tbsCertificate（673 バイト）。その先頭 <code>a0</code> は「文脈特定クラス・構造型・番号 0」＝ <code>[0] EXPLICIT</code> で、中に INTEGER <code>02 01 02</code>（値 2 = v3）が入っています。',
        code: { title: 'DER', lang: 'text', src: `
          30 82 02 a1          SEQUENCE, 673 バイト（tbsCertificate）
          ⟪a0⟫ 03                [0] EXPLICIT（0xa0 = 10 1 00000: context, constructed, 0）
             02 01 02          INTEGER 2 → v3` },
        run: async (s) => {
          hexOn(s, 'h-tbs h-ver');
          await tlv(s, 'a0 [0]', '03', '02 01 02 → v3', '0xa0 は文脈タグ [0] の構造型。EXPLICIT なので中に INTEGER のタグ（02）がそのまま入ります。');
        },
      },
      {
        title: 'INTEGER と OBJECT IDENTIFIER',
        text: 'シリアルは <code>02 14</code>（INTEGER, 20 バイト）。署名アルゴリズムは <code>06 08</code> の OID で、<code>2a</code> = 40×1+2 → <code>1.2</code>、<code>86 48</code> = 840、<code>ce 3d</code> = 10045 と 7 ビットずつ連結し、<code>1.2.840.10045.4.3.3</code>（ecdsa-with-SHA384）になります。',
        code: { title: 'OID のデコード', lang: 'text', src: `
          06 08 2a 86 48 ce 3d 04 03 03
                2a       → 1.2          (42 = 40*1 + 2)
                86 48    → 840          (0x06<<7 | 0x48)
                ce 3d    → 10045        (0x4e<<7 | 0x3d)
                04 03 03 → 4.3.3
          = ⟪1.2.840.10045.4.3.3⟫  ecdsa-with-SHA384` },
        run: async (s) => {
          hexOn(s, 'h-ser h-alg');
          await tlv(s, '06 OID', '08', '1.2.840.10045.4.3.3', '0x02 = INTEGER（シリアル 20 バイト）、0x06 = OID。OID は 7 ビットずつの可変長で、最上位ビット 1 は「次のバイトに続く」。');
        },
      },
      {
        title: '文字列：PrintableString と UTF8String',
        text: 'issuer の中の <code>13 02 4a 50</code> は PrintableString "JP"、<code>0c 0d 45 78 61 …</code> は UTF8String "Example Trust"。値のバイトは文字コードそのものです。',
        code: { title: 'DER', lang: 'text', src: `
          30 45                    issuer Name（69 バイト）
            31 0b 30 09            SET { SEQUENCE {
              06 03 55 04 06         OID 2.5.4.6 (countryName)
              ⟪13 02 4a 50⟫            PrintableString "JP" } }
            31 16 30 14
              06 03 55 04 0a         OID 2.5.4.10 (organizationName)
              ⟪0c 0d⟫ 45 78 61 6d 70 6c 65 20 54 72 75 73 74   UTF8String "Example Trust"` },
        run: async (s) => {
          hexOn(s, 'h-iss h-iss2');
          await tlv(s, '13 / 0c', '02 / 0d', '"JP" / "Example Trust"', '0x13 = PrintableString、0x0c = UTF8String。0x31 = SET（RDN）、0x30 = SEQUENCE（type と value の組）。');
        },
      },
      {
        title: '時刻：UTCTime と GeneralizedTime',
        text: '<code>17 0d</code> は UTCTime・13 バイトで、中身は ASCII の <code>"260927185421Z"</code>（2026-09-27 18:54:21 UTC）。年が 2 桁なので、RFC 5280 は 2049 年まで UTCTime、2050 年以降は <code>18 0f "20500101000000Z"</code> のような GeneralizedTime を使うと決めています。',
        code: { title: 'DER', lang: 'text', src: `
          30 1e
             ⟪17 0d⟫ 32 36 30 39 32 37 31 38 35 34 32 31 5a   "260927185421Z"  notBefore
             17 0d 32 36 31 32 32 36 31 38 35 34 32 31 5a   "261226185421Z"  notAfter
          # 2050 年以降なら: 18 0f "20500101000000Z"（GeneralizedTime）` },
        run: async (s) => {
          hexOn(s, 'h-val h-nb h-na');
          await tlv(s, '17 UTCTime', '0d = 13', '"260927185421Z"', '値は ASCII 文字列そのもの（0x32 = "2", 0x5a = "Z"）。YYMMDDHHMMSSZ の固定形式で、秒と Z は DER では省略不可です。');
        },
      },
      {
        title: 'BIT STRING：公開鍵と署名値',
        text: 'BIT STRING（<code>03</code>）は値の先頭 1 バイトが「未使用ビット数」です。公開鍵は <code>03 42 00 04 …</code>（未使用 0、<code>04</code> = 非圧縮点）。末尾の署名値 <code>03 68 00 30 65 02 31 00 a5 …</code> は、BIT STRING の中にさらに <code>SEQUENCE { INTEGER r, INTEGER s }</code> の DER が入っています。',
        code: { title: 'DER', lang: 'text', src: `
          03 42 ⟪00⟫ 04 40 05 5e c5 …     subjectPublicKey: 未使用ビット 0, 04‖X‖Y (65 バイト)
          03 68 ⟪00⟫                      signatureValue:   未使用ビット 0
             30 65                       ECDSA-Sig-Value ::= SEQUENCE {
                02 31 00 a5 64 a6 62 …     r INTEGER (49 バイト: 先頭 00 は符号用)
                02 30 13 be 92 09 …        s INTEGER (48 バイト) }` },
        run: async (s) => {
          hexOn(s, 'h-spki h-bit h-salg h-sig');
          await tlv(s, '03 BIT STRING', '42 / 68', '00 + 鍵 / 00 + (r, s)', 'BIT STRING の値の先頭は未使用ビット数（ここでは 00）。署名値の中身はさらに DER の SEQUENCE{r, s} です。');
        },
      },
      {
        title: '[3] extensions と OCTET STRING の入れ子',
        text: '<code>a3 82 01 50</code> が <code>[3] EXPLICIT</code>、その中が Extension の SEQUENCE です。各 Extension の値 <code>extnValue</code> は OCTET STRING（<code>04</code>）で、その中身がさらに DER：basicConstraints なら <code>04 02 30 00</code>＝「空の SEQUENCE（CA:FALSE は DEFAULT なので省略）」です。',
        code: { title: 'DER', lang: 'text', src: `
          a3 82 01 50                [3] EXPLICIT（336 バイト）
            30 82 01 4c              SEQUENCE OF Extension
              30 0c                  Extension {
                06 03 55 1d 13         extnID    2.5.29.19 basicConstraints
                ⟪01 01 ff⟫               critical  TRUE
                04 02 ⟪30 00⟫            extnValue OCTET STRING { SEQUENCE {} } }` },
        run: async (s) => {
          hexOn(s, 'h-ext h-bc');
          await tlv(s, '04 OCTET STRING', '02', '30 00（DER の入れ子）', '0x01 = BOOLEAN（ff = TRUE）。extnValue は OCTET STRING で、その中に拡張ごとの DER が入ります。');
        },
      },
      {
        title: 'asn1parse で全体の TLV を確認',
        text: '<code>openssl asn1parse</code> は各 TLV を「オフセット : d=深さ hl=ヘッダ長 l=値の長さ cons/prim 型」で列挙します。オフセット 4 の <code>hl=4 l=673</code> から、署名対象（TBS）は offset 4〜680 の 677 バイトだとわかります。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl asn1parse -in server.crt | head -8
              0:d=0  hl=4 l= 795 cons: SEQUENCE
              ⟪4:d=1  hl=4 l= 673 cons: SEQUENCE⟫
              8:d=2  hl=2 l=   3 cons: cont [ 0 ]
             10:d=3  hl=2 l=   1 prim: INTEGER           :02
             13:d=2  hl=2 l=  20 prim: INTEGER           :2A4CD0F3DCA72B02844E3598254F9DDE33F066BA
             35:d=2  hl=2 l=  10 cons: SEQUENCE
             37:d=3  hl=2 l=   8 prim: OBJECT            :ecdsa-with-SHA384
             47:d=2  hl=2 l=  69 cons: SEQUENCE` },
        run: async (s) => {
          hexOn(s, 'h-tbs');
          await s.term('t3', '$ openssl asn1parse -in server.crt | head -5\n    0:d=0  hl=4 l= 795 cons: SEQUENCE\n    4:d=1  hl=4 l= 673 cons: SEQUENCE\n    8:d=2  hl=2 l=   3 cons: cont [ 0 ]\n   10:d=3  hl=2 l=   1 prim: INTEGER           :02\n   13:d=2  hl=2 l=  20 prim: INTEGER           :2A4CD0F3DCA72B02844E3598254F9DDE33F066BA', { clear: true });
          await tlv(s, 'offset 4', 'hl=4 l=673', 'TBS = 677 バイト', 'hl（ヘッダ長）+ l（値の長さ）= その TLV 全体の長さ。署名対象の範囲はこの数字で切り出せます（-strparse 4）。');
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 4 — 拡張
   * ===================================================================*/
  const E = (s, row, o) => {
    s.$('[data-state]').forEach((e) => e.removeAttribute('data-state'));
    s.state(row, o.st || 'active');
    return Promise.all([
      s.set('det-h', o.h),
      s.set('det-b', '<pre data-lang="cert">' + TIM.esc(TIM.dedent(o.t)) + '</pre>'),
      s.set('der-b', o.der),
      s.set('who-t', o.wt),
      s.set('who-b', o.w),
    ]);
  };
  const EXT_ROWS = 'e-bc e-ku e-eku e-ski e-aki e-san e-aia e-crl e-cp e-sct';
  TIM.scene('#sc-ext', {
    intro: 'server.crt に入っている拡張を 1 つずつ開き、<code>openssl -text</code> の表示・DER のバイト・<b>検証のどこで誰が使うか</b>をセットで見ます。',
    steps: [
      {
        title: 'Extension の共通構造：OID + critical + OCTET STRING',
        text: 'どの拡張も <code>SEQUENCE { extnID, critical, extnValue }</code> です。<code>critical</code> は省略時 FALSE。extnValue は OCTET STRING で、その中に拡張ごとの DER が入ります。',
        code: { title: 'RFC 5280 §4.1', lang: 'text', src: `
          Extensions  ::=  SEQUENCE SIZE (1..MAX) OF Extension

          Extension  ::=  SEQUENCE  {
               extnID      OBJECT IDENTIFIER,
               ⟪critical    BOOLEAN DEFAULT FALSE⟫,
               extnValue   OCTET STRING
                           -- contains the DER encoding of an ASN.1 value
                           -- corresponding to the extension type identified
                           -- by extnID
               }` },
        run: async (s) => {
          await s.show(EXT_ROWS, { stagger: 60 });
          await s.show('det der who', { stagger: 100 });
          await E(s, 'e-bc', {
            h: 'RFC 5280 §4.1 — Extension',
            t: `
                Extension ::= SEQUENCE {
                  extnID     OBJECT IDENTIFIER,
                  critical   BOOLEAN DEFAULT FALSE,
                  extnValue  OCTET STRING }

                -- basicConstraints の例（offset 349）
                30 0c
                   06 03 55 1d 13     extnID 2.5.29.19
                   01 01 ff           critical TRUE
                   04 02 30 00        extnValue`,
            der: '<b>30 0c 06 03 55 1d 13 01 01 ff 04 02 30 00</b>',
            wt: 'critical の意味（RFC 5280 §4.2）',
            w: '検証者は、理解できない拡張に critical=TRUE が付いていたら証明書を拒否しなければなりません。FALSE なら無視して構いません。',
          });
        },
      },
      {
        title: 'basicConstraints：CA かどうか',
        text: 'リーフは <code>CA:FALSE</code>、中間 CA は <code>CA:TRUE, pathlen:0</code>（この下に CA を置けない）。パス検証では「署名者側の証明書が CA:TRUE か」をここで判定します。CA 証明書では critical 必須です。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -ext basicConstraints
          X509v3 Basic Constraints: critical
              ⟪CA:FALSE⟫
          $ openssl x509 -in inter.crt -noout -ext basicConstraints
          X509v3 Basic Constraints: critical
              ⟪CA:TRUE, pathlen:0⟫` },
        run: async (s) => {
          await E(s, 'e-bc', {
            h: 'X509v3 Basic Constraints: critical',
            t: `
                server.crt:  CA:FALSE
                inter.crt:   CA:TRUE, pathlen:0
                root.crt:    CA:TRUE

                BasicConstraints ::= SEQUENCE {
                     cA                 BOOLEAN DEFAULT FALSE,
                     pathLenConstraint  INTEGER (0..MAX) OPTIONAL }`,
            der: 'leaf : <b>04 02 30 00</b>            （cA は DEFAULT FALSE なので空）<br>inter: <b>04 08 30 06 01 01 ff 02 01 00</b>（cA TRUE, pathLen 0）',
            wt: 'パス検証（クライアント）',
            w: '中間・ルートが CA:TRUE でなければ、その鍵で署名された証明書は受け入れません。リーフ（CA:FALSE）の鍵で作った「偽の子証明書」はここで弾かれます。',
          });
        },
      },
      {
        title: 'keyUsage：鍵の暗号的な用途',
        text: 'BIT STRING のビットで用途を表します。bit0 <code>digitalSignature</code>（TLS の署名）、bit5 <code>keyCertSign</code>（証明書への署名＝CA 用）、bit6 <code>cRLSign</code>。CA 証明書は keyCertSign 必須です。',
        code: { title: 'DER', lang: 'text', src: `
          leaf : 03 02 07 80   未使用 7 ビット, 1000 0000 → ⟪digitalSignature⟫
          root : 03 02 01 06   未使用 1 ビット, 0000 0110 → keyCertSign, cRLSign
          inter: 03 02 01 86   未使用 1 ビット, 1000 0110 → digitalSignature, keyCertSign, cRLSign` },
        run: async (s) => {
          await E(s, 'e-ku', {
            h: 'X509v3 Key Usage: critical',
            t: `
                server.crt:  Digital Signature
                inter.crt:   Digital Signature, Certificate Sign, CRL Sign
                root.crt:    Certificate Sign, CRL Sign

                bit 0 digitalSignature    bit 5 keyCertSign
                bit 2 keyEncipherment     bit 6 cRLSign
                bit 4 keyAgreement`,
            der: '<b>30 0e 06 03 55 1d 0f 01 01 ff 04 04 03 02 07 80</b>',
            wt: 'パス検証 / TLS ハンドシェイク',
            w: '署名者の証明書に keyCertSign が無ければチェーン検証で失敗（OpenSSL: key usage does not include certificate signing）。TLS 1.3 の CertificateVerify には digitalSignature が必要です。',
          });
        },
      },
      {
        title: 'extendedKeyUsage：アプリケーション上の用途',
        text: '<code>serverAuth</code>（1.3.6.1.5.5.7.3.1）は「TLS サーバー証明書として使ってよい」、<code>clientAuth</code>（…3.2）はクライアント証明書用。ブラウザや OpenSSL の <code>-purpose sslserver</code> はここを見ます。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -purpose | head -4
          Certificate purposes:
          SSL client : No
          SSL client CA : No
          ⟪SSL server : Yes⟫` },
        run: async (s) => {
          await E(s, 'e-eku', {
            h: 'X509v3 Extended Key Usage',
            t: `
                TLS Web Server Authentication

                1.3.6.1.5.5.7.3.1  serverAuth
                1.3.6.1.5.5.7.3.2  clientAuth
                1.3.6.1.5.5.7.3.3  codeSigning
                1.3.6.1.5.5.7.3.4  emailProtection`,
            der: '<b>30 13 06 03 55 1d 25 04 0c 30 0a 06 08 2b 06 01 05 05 07 03 01</b>',
            wt: 'TLS クライアント / サーバー',
            w: 'サーバー証明書として提示された証明書に serverAuth が無ければ拒否されます。openssl verify -purpose sslclient で試すと error 26 unsuitable certificate purpose。',
          });
        },
      },
      {
        title: 'subjectKeyIdentifier / authorityKeyIdentifier',
        text: 'SKI は自分の公開鍵の ID（通常は公開鍵の SHA-1）、AKI は発行者の SKI のコピーです。リーフの AKI <code>92:21:CB:…</code> は中間 CA の SKI と一致し、同じ名前の CA が鍵を更新していても正しい発行者を選べます。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -ext authorityKeyIdentifier
          X509v3 Authority Key Identifier:
              ⟪92:21:CB:1D:8F:9A:BA:15:79:5F:8A:F1:34:85:D4:7F:D2:33:45:F5⟫
          $ openssl x509 -in inter.crt -noout -ext subjectKeyIdentifier
          X509v3 Subject Key Identifier:
              ⟪92:21:CB:1D:8F:9A:BA:15:79:5F:8A:F1:34:85:D4:7F:D2:33:45:F5⟫` },
        run: async (s) => {
          await E(s, 'e-ski e-aki', {
            h: 'Subject / Authority Key Identifier',
            t: `
                server.crt SKI: 79:40:79:F3:0E:A3:15:77:8F:45:…:A1:52
                server.crt AKI: 92:21:CB:1D:8F:9A:BA:15:79:5F:…:45:F5
                inter.crt  SKI: 92:21:CB:1D:8F:9A:BA:15:79:5F:…:45:F5  ← 一致
                inter.crt  AKI: 11:67:A9:34:E1:FD:C1:FD:1E:CF:…:EF:3D
                root.crt   SKI: 11:67:A9:34:E1:FD:C1:FD:1E:CF:…:EF:3D  ← 一致`,
            der: 'AKI: <b>30 1f 06 03 55 1d 23 04 18 30 16 80 14</b> 92 21 cb 1d 8f 9a ba 15 79 5f 8a f1 34 85 d4 7f d2 33 45 f5',
            wt: 'パス構築（クライアント）',
            w: 'issuer 名の一致に加えて AKI = 発行者の SKI で候補を絞ります。鍵更新（同名で別鍵の中間 CA）があるときに取り違えを防ぎます。',
          });
        },
      },
      {
        title: 'subjectAltName：ホスト名照合に使う唯一の場所',
        text: 'SAN は <code>GeneralName</code> の列で、<code>82</code> = dNSName、<code>87</code> = iPAddress。TLS クライアントは接続先のホスト名／IP をここと照合し、<b>subject の CN は使いません</b>（RFC 9525、Chrome 58 以降）。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -ext subjectAltName
          X509v3 Subject Alternative Name:
              ⟪DNS:www.example.com, DNS:example.com, IP Address:192.0.2.10⟫` },
        run: async (s) => {
          await E(s, 'e-san', {
            h: 'X509v3 Subject Alternative Name',
            t: `
                DNS:www.example.com, DNS:example.com, IP Address:192.0.2.10

                GeneralName ::= CHOICE {
                   rfc822Name                [1] IA5String,    -- 81 email:
                   dNSName                   [2] IA5String,    -- 82 DNS:
                   uniformResourceIdentifier [6] IA5String,    -- 86 URI:
                   iPAddress                 [7] OCTET STRING, -- 87 IP:
                   ... }`,
            der: '04 26 30 24 <b>82 0f</b> 77 77 77 2e 65 78 61 6d 70 6c 65 2e 63 6f 6d <b>82 0b</b> 65 78 61 6d 70 6c 65 2e 63 6f 6d <b>87 04</b> c0 00 02 0a',
            wt: 'TLS クライアントのホスト名検証',
            w: 'https://www.example.com/ → dNSName "www.example.com" と一致すれば OK。https://shop.example.com/ は SAN に無いので hostname mismatch。IP で接続するなら iPAddress（c0 00 02 0a = 192.0.2.10）が必要です。',
          });
        },
      },
      {
        title: 'authorityInfoAccess と cRLDistributionPoints',
        text: 'AIA には OCSP レスポンダの URL（<code>OCSP - URI:</code>）と、発行者（中間 CA）証明書の取得先（<code>CA Issuers - URI:</code>）、CRLDP には失効リストの URL が入ります。どれも平文 HTTP で、署名付きのデータ自体が改ざんを防ぎます。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -ext authorityInfoAccess,crlDistributionPoints
          Authority Information Access:
              ⟪OCSP - URI:http://ocsp.ca.example.com⟫
              CA Issuers - URI:http://ca.example.com/e1.crt
          X509v3 CRL Distribution Points:
              Full Name:
                ⟪URI:http://crl.ca.example.com/e1.crl⟫
          $ openssl x509 -in server.crt -noout -ocsp_uri
          http://ocsp.ca.example.com` },
        run: async (s) => {
          await E(s, 'e-aia e-crl', {
            h: 'Authority Information Access / CRL Distribution Points',
            t: `
                Authority Information Access:
                    OCSP - URI:http://ocsp.ca.example.com
                    CA Issuers - URI:http://ca.example.com/e1.crt
                X509v3 CRL Distribution Points:
                    Full Name:
                      URI:http://crl.ca.example.com/e1.crl

                id-ad-ocsp      1.3.6.1.5.5.7.48.1
                id-ad-caIssuers 1.3.6.1.5.5.7.48.2`,
            der: '30 52 30 26 06 08 <b>2b 06 01 05 05 07 30 01</b> 86 1a "http://ocsp.ca.example.com" 30 28 06 08 <b>2b 06 01 05 05 07 30 02</b> 86 1c "http://ca.example.com/e1.crt"',
            wt: '失効確認・中間証明書の補完',
            w: 'クライアント（またはサーバーの OCSP stapling）が OCSP / CRL を取得して失効を確認します。CA Issuers は中間証明書が送られてこなかったときの取得先（AIA fetching）として一部クライアントが使います。',
          });
        },
      },
      {
        title: 'certificatePolicies：どの審査で発行されたか',
        text: 'CA/B Forum が定めたポリシー OID で検証レベルがわかります。<code>2.23.140.1.2.1</code> = DV（ドメイン認証）、<code>2.23.140.1.2.2</code> = OV（組織認証）、<code>2.23.140.1.1</code> = EV。この server.crt は O / L / ST を含む OV 相当です。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in server.crt -noout -ext certificatePolicies
          X509v3 Certificate Policies:
              Policy: ⟪2.23.140.1.2.2⟫` },
        run: async (s) => {
          await E(s, 'e-cp', {
            h: 'X509v3 Certificate Policies',
            t: `
                Policy: 2.23.140.1.2.2

                2.23.140.1.2.1   domain-validated          (DV)
                2.23.140.1.2.2   organization-validated    (OV)
                2.23.140.1.2.3   individual-validated      (IV)
                2.23.140.1.1     extended-validation       (EV)`,
            der: '<b>30 13 06 03 55 1d 20 04 0c 30 0a 30 08 06 06 67 81 0c 01 02 02</b>',
            wt: '監査・ブラウザ',
            w: 'OID 2.23.140 は CA/Browser Forum。67 81 0c = 2.23.140（0x67 = 103 = 40*2+23）。ブラウザ UI での EV 表示や、証明書の分類・監査に使われます。',
          });
        },
      },
      {
        title: 'CT の SCT リスト（公開 CA の証明書）',
        text: '公開 CA は発行前に「プレ証明書」を CT ログへ提出し、受領証 SCT（Signed Certificate Timestamp）を証明書の拡張に埋め込みます。自前の CA で作った server.crt には無いので、実在の <code>example.com</code> の証明書から抜粋します。',
        code: { title: 'example.com の証明書（2026-09 取得・抜粋）', lang: 'cert', src: `
          CT Precertificate SCTs:
              Signed Certificate Timestamp:
                  Version   : v1 (0x0)
                  Log ID    : 94:4E:43:87:FA:EC:C1:EF:81:F3:19:24:26:A8:18:65:
                              01:C7:D3:5F:38:02:01:3F:72:67:7D:55:37:2E:19:D8
                  ⟪Timestamp : Sep 26 22:59:12.866 2026 GMT⟫
                  Extensions: none
                  Signature : ecdsa-with-SHA256
                              30:45:02:21:00:AE:09:46:A1:45:AC:F0:39:CA:A3:DC:…` },
        run: async (s) => {
          await E(s, 'e-sct', {
            h: 'CT Precertificate SCTs（example.com の実物）',
            t: `
                CT Precertificate SCTs:
                    Signed Certificate Timestamp:
                        Version   : v1 (0x0)
                        Log ID    : 94:4E:43:87:FA:EC:C1:EF:81:F3:19:…
                        Timestamp : Sep 26 22:59:12.866 2026 GMT
                        Signature : ecdsa-with-SHA256
                    Signed Certificate Timestamp:
                        Log ID    : CB:38:F7:15:89:7C:84:A1:44:5F:5B:…
                        Timestamp : Sep 26 22:59:12.894 2026 GMT`,
            der: 'extnID <b>06 0a 2b 06 01 04 01 d6 79 02 04 02</b> = 1.3.6.1.4.1.11129.2.4.2<br>extnValue = OCTET STRING { OCTET STRING { SCT リスト } }',
            wt: 'ブラウザ（CT ポリシー）',
            w: 'Chrome や Safari は SCT が所定数そろっていない公開証明書を拒否します。Log ID は CT ログの公開鍵の SHA-256。誰でも crt.sh 等で発行履歴を監視できます。',
          });
        },
      },
      {
        title: 'critical な未知の拡張 → 拒否（失敗ケース）',
        text: '知らない OID の拡張に critical=TRUE を付けて署名した証明書を検証すると、OpenSSL は <code>error 34 … unhandled critical extension</code> で拒否します。non-critical なら同じ拡張があっても無視されます。',
        code: { title: 'shell', lang: 'bash', src: `
          $ cat crit.ext
          basicConstraints=critical,CA:FALSE
          subjectAltName=DNS:www.example.com
          ⟪1.3.6.1.4.1.55555.1=critical,DER:05:00⟫
          $ openssl x509 -req -in server.csr -CA inter.crt -CAkey inter.key -days 30 -extfile crit.ext -out crit.crt
          $ openssl verify -CAfile root.crt -untrusted inter.crt crit.crt
          CN=www.example.com
          ⟪error 34 at 0 depth lookup: unhandled critical extension⟫
          error crit.crt: verification failed` },
        run: async (s) => {
          await E(s, 'det', {
            st: 'bad',
            h: 'crit.crt — 1.3.6.1.4.1.55555.1: critical',
            t: `
                X509v3 extensions:
                    X509v3 Basic Constraints: critical
                        CA:FALSE
                    X509v3 Subject Alternative Name:
                        DNS:www.example.com
                    1.3.6.1.4.1.55555.1: critical
                        ..`,
            der: '30 12 06 09 2b 06 01 04 01 83 b2 03 01 <b>01 01 ff</b> 04 02 05 00',
            wt: 'openssl verify の結果',
            w: 'error 34 at 0 depth lookup: unhandled critical extension — 署名は正しくても、理解できない critical 拡張があるだけで検証は失敗します。',
          });
          s.state('det', 'bad');
          await s.shake('det');
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 5 — 失敗・改ざん
   * ===================================================================*/
  const reset5 = (s) => {
    stamps(s);
    s.caption('');
    ['c-sub', 'c-san', 'c-nb', 'c-na', 'c-sig', 'crt', 'cli'].forEach((n) => s.$(n).forEach((e) => e.removeAttribute('data-state')));
  };
  const V = '$ openssl verify -CAfile root.crt -untrusted inter.crt';
  TIM.scene('#sc-fail', {
    intro: '同じ server.crt に対して「ホスト名違い」「CN だけ」「期限切れ」「1 バイト改ざん」を順に試し、<b>検証のどの段階で</b>何のエラーになるかを実際の出力で確認します。',
    steps: [
      {
        title: '正常：チェーン・期限・ホスト名・署名すべて OK',
        text: '<code>-verify_hostname</code> を付けると、OpenSSL も SAN との照合を行います。署名は中間 CA E1 の公開鍵（inter.crt の SPKI）で検証されます。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl verify -CAfile root.crt -untrusted inter.crt \\
              -verify_hostname www.example.com server.crt
          ⟪server.crt: OK⟫` },
        run: async (s) => {
          reset5(s);
          await s.term('t5', V + ' -verify_hostname www.example.com server.crt\nserver.crt: OK', { clear: true });
          await s.show('hc', { fx: 'up' });
          await s.fly('ca:b', 'hc:t', { label: 'Q (P-384)', dur: 700 });
          s.state('ver', 'ok');
          s.state('crt', 'ok');
          await s.stamp('crt', 'VALID', { cls: 'st-ok' });
        },
      },
      {
        title: 'SAN にないホスト名：hostname mismatch',
        text: '<code>shop.example.com</code> で接続すると、SAN の <code>DNS:www.example.com</code> / <code>DNS:example.com</code> のどれとも一致しません。署名や期限が正しくても、名前の段階で失敗します。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl verify -CAfile root.crt -untrusted inter.crt \\
              -verify_hostname shop.example.com server.crt
          C=JP, ST=Tokyo, L=Chiyoda-ku, O=Example Inc, CN=www.example.com
          ⟪error 62 at 0 depth lookup: hostname mismatch⟫
          error server.crt: verification failed
          # curl（OpenSSL バックエンド）:
          # curl: (60) SSL: no alternative certificate subject name matches target host name 'shop.example.com'
          # Chrome: NET::ERR_CERT_COMMON_NAME_INVALID` },
        run: async (s) => {
          reset5(s);
          await s.term('t5', V + ' -verify_hostname shop.example.com server.crt\nC=JP, ST=Tokyo, L=Chiyoda-ku, O=Example Inc, CN=www.example.com\nerror 62 at 0 depth lookup: hostname mismatch\nerror server.crt: verification failed', { clear: true });
          s.state('c-san', 'bad');
          s.state('cli', 'bad');
          await s.shake('crt');
          await s.stamp('crt', 'HOSTNAME MISMATCH', { cls: 'st-bad' });
        },
      },
      {
        title: 'CN だけの証明書：ツールで結果が割れる',
        text: 'SAN を付けずに CN=www.example.com だけで発行した <code>nosan.crt</code> は、OpenSSL の <code>-verify_hostname</code> では OK になります（SAN に DNS 名が無いと CN にフォールバック）。しかしブラウザは CN を見ないため <code>NET::ERR_CERT_COMMON_NAME_INVALID</code> です。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in nosan.crt -noout -subject -ext subjectAltName
          subject=CN=www.example.com
          No extensions in certificate
          $ openssl verify -CAfile root.crt -untrusted inter.crt \\
              -verify_hostname www.example.com nosan.crt
          ⟪nosan.crt: OK⟫          # ← OpenSSL は CN にフォールバック
          # Chrome 58+ / RFC 9525: CN は照合に使わない → NET::ERR_CERT_COMMON_NAME_INVALID` },
        run: async (s) => {
          reset5(s);
          await s.term('t5', '$ openssl x509 -in nosan.crt -noout -subject -ext subjectAltName\nsubject=CN=www.example.com\nNo extensions in certificate\n' + V + ' -verify_hostname www.example.com nosan.crt\nnosan.crt: OK', { clear: true });
          s.state('c-sub c-san', 'warn');
          await s.caption('openssl は OK ／ ブラウザは <code>ERR_CERT_COMMON_NAME_INVALID</code>', { x: 712, y: 330 });
        },
      },
      {
        title: '期限切れ：certificate has expired',
        text: '<code>-attime</code> で検証時刻を 2027-01-01（UNIX 時刻 1798761600）にすると、notAfter（2026-12-26）を過ぎているので失敗します。クライアントの時計が狂っている場合も同じエラーになります。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl verify -CAfile root.crt -untrusted inter.crt -attime 1798761600 server.crt
          C=JP, ST=Tokyo, L=Chiyoda-ku, O=Example Inc, CN=www.example.com
          ⟪error 10 at 0 depth lookup: certificate has expired⟫
          error server.crt: verification failed
          # curl: (60) SSL certificate problem: certificate has expired
          # Chrome: NET::ERR_CERT_DATE_INVALID` },
        run: async (s) => {
          reset5(s);
          await s.term('t5', V + ' -attime 1798761600 server.crt\nC=JP, ST=Tokyo, L=Chiyoda-ku, O=Example Inc, CN=www.example.com\nerror 10 at 0 depth lookup: certificate has expired\nerror server.crt: verification failed', { clear: true });
          s.state('c-na', 'bad');
          await s.stamp('crt', 'EXPIRED', { cls: 'st-bad' });
        },
      },
      {
        title: '攻撃者が notAfter を 1 バイト書き換える',
        text: 'DER の offset 0x89（notAfter の年の 1 文字目）を <code>0x32</code>（"2"）→ <code>0x33</code>（"3"）に変えると、有効期限が 2026 年から <b>2036 年</b>になります。長さは変わらないので DER としては完全に正しい形のままです。',
        code: { title: 'shell', lang: 'bash', src: `
          $ xxd -p server.der | tr -d '\\n' \\
              | sed 's/170d323631323236/170d333631323236/' | xxd -r -p > evil.der
          $ cmp -l server.der evil.der
          ⟪138  62  63⟫            # 138 バイト目（0x89）: 8 進 62 ('2') → 63 ('3')
          $ openssl x509 -in evil.der -inform der -out evil.crt` },
        run: async (s) => {
          reset5(s);
          await s.show('diff', { fx: 'up' });
          await s.set('na-v', '<i>36</i>1226185421Z');
          s.state('c-na', 'warn');
          await s.pulse('c-na');
        },
      },
      {
        title: 'パースは成功する（表示だけでは気付けない）',
        text: '<code>openssl x509 -text</code> やブラウザの証明書ビューアは改ざん後の証明書も普通に表示します。<b>パースと検証は別の処理</b>で、改ざんを検出できるのは署名の検証だけです。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl x509 -in evil.crt -noout -dates
          notBefore=Sep 27 18:54:21 2026 GMT
          notAfter=⟪Dec 26 18:54:21 2036 GMT⟫` },
        run: async (s) => {
          reset5(s);
          s.state('c-na', 'warn');
          await s.term('t5', '$ openssl x509 -in evil.crt -noout -dates\nnotBefore=Sep 27 18:54:21 2026 GMT\nnotAfter=Dec 26 18:54:21 2036 GMT', { clear: true });
          await s.caption('パース OK ≠ 正しい証明書', { x: 712, y: 458 });
        },
      },
      {
        title: '署名検証で検出：certificate signature failure',
        text: '検証側は改ざん後の TBS から SHA-384 を計算し直します（<code>cc95ab38…</code>、元は <code>1879dd12…</code>）。署名値 <code>(r, s)</code> は元の TBS に対するものなので、E1 の公開鍵での ECDSA 検証が成立しません。攻撃者は E1 の秘密鍵（CA の HSM 内）を持たないので署名を作り直せません。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl verify -CAfile root.crt -untrusted inter.crt evil.crt
          C=JP, ST=Tokyo, L=Chiyoda-ku, O=Example Inc, CN=www.example.com
          ⟪error 7 at 0 depth lookup: certificate signature failure⟫
          error evil.crt: verification failed
          …:error:030000EA:digital envelope routines:EVP_DigestVerifyFinal:provider signature failure:…` },
        run: async (s) => {
          reset5(s);
          s.state('c-na', 'bad');
          await s.term('t5', V + ' evil.crt\nC=JP, ST=Tokyo, L=Chiyoda-ku, O=Example Inc, CN=www.example.com\nerror 7 at 0 depth lookup: certificate signature failure\nerror evil.crt: verification failed', { clear: true });
          await s.scan('hc');
          await s.scramble('hvv', 'cc95ab38b173d36fd19df79421f45dcb97eadd14…', { dur: 1000 });
          await s.fly('ca:b', 'ver:r', { label: 'Q (P-384)', dur: 700 });
          await s.set('vres', 'NG');
          s.state('ver', 'bad');
          s.state('crt', 'bad');
          await s.shake('crt');
          await s.stamp('crt', 'SIGNATURE FAILURE', { cls: 'st-bad' });
        },
      },
      {
        title: '手で確かめる：dgst -verify',
        text: 'TBS を切り出して <code>openssl dgst -verify</code> で検証すると、元の TBS は <code>Verified OK</code>、改ざん後の TBS は <code>Verification failure</code>。<code>openssl verify</code> の error 7 はこれと同じ計算の結果です。',
        code: { title: 'shell', lang: 'bash', src: `
          $ openssl dgst -sha384 tbs.der evil-tbs.der
          SHA2-384(tbs.der)= 1879dd12dc69e0759875e7fc0c0507f35259e65858d4e93e6084f744589a1077d8f5bef7a48a9aad9fce5efce65e589d
          SHA2-384(evil-tbs.der)= cc95ab38b173d36fd19df79421f45dcb97eadd14005d067b749ec49b7b5d8775d1e1a2fe0f1a4d210ca9ce3623fb5e82
          $ openssl dgst -sha384 -verify inter.pub -signature sig.der tbs.der
          ⟪Verified OK⟫
          $ openssl dgst -sha384 -verify inter.pub -signature sig.der evil-tbs.der
          ⟪Verification failure⟫` },
        run: async (s) => {
          reset5(s);
          s.state('ver', 'bad');
          await s.term('t5', '$ openssl asn1parse -in evil.crt -strparse 4 -noout -out evil-tbs.der\n$ openssl dgst -sha384 -verify inter.pub -signature sig.der tbs.der\nVerified OK\n$ openssl dgst -sha384 -verify inter.pub -signature sig.der evil-tbs.der\nVerification failure', { clear: true });
          await s.caption('TBS のどこを 1 ビット変えても署名検証で検出', { cls: 'bad', x: 712, y: 458 });
        },
      },
    ],
  });
})();
