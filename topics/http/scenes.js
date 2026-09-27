/* topics/http/scenes.js — HTTP のシーン定義（AGENT.md §7） */
(function () {
  'use strict';
  const esc = TIM.esc;
  /** ステージ内に置くコードブロック（pre[data-lang]）を作る */
  const pre = (lang, src) => '<pre data-lang="' + lang + '">' + esc(src) + '</pre>';
  const L = (...lines) => lines.join('\n');

  /* =====================================================================
   * SCENE 1 : curl -v の 1 往復
   * ===================================================================*/
  const A = { x: 250, y: 50 }, B = { x: 710, y: 50 };

  TIM.scene('#sc-msg', {
    intro: '<code>curl -sv -o index.html http://www.example.com/index.html</code> を実行したとき、TCP 接続の上を流れるバイト列を 1 行ずつ再生します。右側の <code>\\r\\n</code> が CRLF（<code>0d 0a</code>）です。',
    steps: [
      {
        title: 'TCP 接続を張る',
        text: '<code>-v</code> を付けると curl は stderr に接続の様子を出します。<code>*</code> で始まる行は curl 自身の情報で、まだ HTTP のバイトは 1 つも流れていません。名前解決 → TCP 3-way handshake（<code>203.0.113.10:80</code>）まで完了した状態です。',
        code: { title: 'shell', lang: 'bash', src: `
          # -s: 進捗を消す / -v: ヘッダと接続情報を stderr へ / -o: 本文はファイルへ
          $ curl -sv -o index.html http://www.example.com/index.html
          * Host www.example.com:80 was resolved.
          * IPv6: (none)
          * IPv4: 203.0.113.10
          *   Trying 203.0.113.10:80...
          * Established connection to www.example.com (203.0.113.10 port 80) from 192.168.1.10 port 53712
          * using HTTP/1.x` },
        run: async (s) => {
          s.line(A, B, { cls: 'flow', label: 'TCP 192.168.1.10:53712 → 203.0.113.10:80' });
          await s.term('t', L(
            '$ curl -sv -o index.html http://www.example.com/index.html',
            '* Host www.example.com:80 was resolved.',
            '* IPv6: (none)',
            '* IPv4: 203.0.113.10',
            '*   Trying 203.0.113.10:80...',
            '* Established connection to www.example.com (203.0.113.10 port 80) from 192.168.1.10 port 53712',
            '* using HTTP/1.x'));
        },
      },
      {
        title: 'リクエストライン：GET /index.html HTTP/1.1',
        text: '最初の行は <b>method SP request-target SP HTTP-version</b>。区切りは半角スペース 1 個で、行末は <code>\\r\\n</code> です。<code>request-target</code> は通常パス＋クエリだけで、ホスト名は含みません。',
        code: [
          { title: 'RFC 9112 §3（ABNF）', lang: 'text', src: `
            request-line = method SP request-target SP HTTP-version` },
          { title: 'wire', lang: 'http', src: `
            ⟪GET /index.html HTTP/1.1⟫\\r\\n` },
        ],
        run: async (s) => {
          await s.show('req', { fx: 'right' });
          await s.show('rq1', { fx: 'left' });
          s.show('rlseg', { fx: 'up' });
          await s.term('t', '> GET /index.html HTTP/1.1');
        },
      },
      {
        title: 'ヘッダフィールド：Host は必須',
        text: '<code>名前: 値\\r\\n</code> の行が続きます。HTTP/1.1 では <code>Host</code> が必須（RFC 9112 §3.2）。同じ IP <code>203.0.113.10</code> で複数のサイトを配信している nginx は、この値で <code>server_name</code> を選びます。',
        code: { title: 'request header section', lang: 'http', src: `
          GET /index.html HTTP/1.1
          ⟪Host: www.example.com⟫
          User-Agent: curl/8.21.0
          Accept: */*` },
        run: async (s) => {
          await s.show('rq2', { fx: 'left', stagger: 160 });
          s.show('hosttip');
          await s.term('t', L('> Host: www.example.com', '> User-Agent: curl/8.21.0', '> Accept: */*'));
        },
      },
      {
        title: '空行（CRLF だけの行）でヘッダ終了',
        text: '<code>Accept: */*</code> の行末 <code>0d 0a</code> に続けてもう一度 <code>0d 0a</code>。これが「ヘッダはここまで」の合図です。GET なのでボディはなく、リクエストは合計 <b>89 バイト</b>。<code>--trace -</code> で実際のバイトを 16 進で確認できます。',
        code: { title: 'curl -s --trace - …（末尾）', lang: 'text', src: `
          => Send header, 89 bytes (0x59)
          0000: 47 45 54 20 2f 69 6e 64 65 78 2e 68 74 6d 6c 20 GET /index.html
          0010: 48 54 54 50 2f 31 2e 31 0d 0a 48 6f 73 74 3a 20 HTTP/1.1..Host:
          0020: 77 77 77 2e 65 78 61 6d 70 6c 65 2e 63 6f 6d 0d www.example.com.
          0030: 0a 55 73 65 72 2d 41 67 65 6e 74 3a 20 63 75 72 .User-Agent: cur
          0040: 6c 2f 38 2e 32 31 2e 30 0d 0a 41 63 63 65 70 74 l/8.21.0..Accept
          0050: 3a 20 2a 2f 2a ⟪0d 0a 0d 0a⟫                      : */*....`, hl: [7] },
        run: async (s) => {
          s.hide('rlseg hosttip', { dur: 200 });
          await s.show('rq3', { fx: 'left' });
          await s.show('hex', { fx: 'zoom' });
          await s.term('t', '> ');
        },
      },
      {
        title: '89 バイトがサーバーへ届く',
        text: 'curl は書き込みを終えると <code>* Request completely sent off</code> を出します。nginx は空行を受け取った時点でリクエストを処理し、アクセスログにはリクエストラインがそのまま記録されます。',
        code: { title: '/var/log/nginx/access.log（combined 形式）', lang: 'text', src: `
          192.168.1.10 - - [28/Sep/2026:03:00:00 +0000] "⟪GET /index.html HTTP/1.1⟫" 200 1256 "-" "curl/8.21.0"` },
        run: async (s) => {
          await s.fly(A, B, { label: 'GET /index.html · 89 B', arc: -26 });
          s.state('srv', 'active');
          await s.term('t', '* Request completely sent off');
        },
      },
      {
        title: 'ステータスライン：HTTP/1.1 200 OK',
        text: 'レスポンスの 1 行目は <b>HTTP-version SP status-code SP reason-phrase</b>。クライアントが見るのは 3 桁の <code>200</code> だけで、<code>OK</code> は飾りです（無視してよい、と RFC 9112 §4 に明記）。',
        code: { title: 'RFC 9112 §4（ABNF）', lang: 'text', src: `
          status-line = HTTP-version SP status-code SP [ reason-phrase ]

          HTTP/1.1 ⟪200⟫ OK\\r\\n` },
        run: async (s) => {
          s.hide('req hex', { dur: 250 });
          await s.show('res', { fx: 'right' });
          await s.fly(B, A, { label: 'HTTP/1.1 200 OK', cls: 'c-green', arc: -26 });
          await s.show('rs1', { fx: 'left' });
          s.show('slseg');
          await s.term('t', '< HTTP/1.1 200 OK');
        },
      },
      {
        title: 'レスポンスヘッダ',
        text: 'ボディの形式（<code>Content-Type</code>）、長さ（<code>Content-Length</code>）、キャッシュ検証用の <code>Last-Modified</code> と <code>ETag</code>。nginx の静的配信の ETag は <b>「更新時刻（Unix 秒）の 16 進 - サイズの 16 進」</b>で、<code>6ab63f18</code> = 1790328600 秒 = 2026-09-25 09:30:00 UTC、<code>4e8</code> = 1256 バイトです。',
        code: { title: 'response header section', lang: 'http', src: `
          HTTP/1.1 200 OK
          Server: nginx/1.27.2
          Date: Mon, 28 Sep 2026 03:00:00 GMT
          Content-Type: text/html
          ⟪Content-Length: 1256⟫
          Last-Modified: Fri, 25 Sep 2026 09:30:00 GMT
          ⟪ETag: "6ab63f18-4e8"⟫` },
        run: async (s) => {
          await s.show('rs2', { fx: 'left', stagger: 120 });
          await s.term('t', L(
            '< Server: nginx/1.27.2',
            '< Date: Mon, 28 Sep 2026 03:00:00 GMT',
            '< Content-Type: text/html',
            '< Content-Length: 1256',
            '< Last-Modified: Fri, 25 Sep 2026 09:30:00 GMT',
            '< ETag: "6ab63f18-4e8"'));
        },
      },
      {
        title: '空行のあとにボディ 1256 バイト',
        text: '空行の直後からがボディです。curl は <code>Content-Length</code> ぶん読んだ時点で「このレスポンスは終わり」と判断し、接続を閉じずに残します（<code>left intact</code>＝keep-alive で再利用可能）。',
        code: { title: 'shell', lang: 'bash', src: `
          <
          { [1256 bytes data]
          * Connection #0 to host www.example.com:80 left intact
          $ wc -c index.html
          1256 index.html` },
        run: async (s) => {
          await s.show('rs3', { fx: 'left' });
          await s.show('rs4', { fx: 'left' });
          s.show('bodytip');
          await s.term('t', L('< ', '{ [1256 bytes data]', '* Connection #0 to host www.example.com:80 left intact'));
          s.state('srv', null);
          s.state('cli', 'ok');
        },
      },
      {
        title: '行頭の * > < { } を読む',
        text: '<code>*</code> curl の情報／<code>&gt;</code> 送ったヘッダ／<code>&lt;</code> 受け取ったヘッダ／<code>{</code> 受信ボディ・<code>}</code> 送信ボディのバイト数。<code>&gt;</code> と <code>&lt;</code> の中身はワイヤ上のバイト列そのもの（CRLF を除く）です。ボディ自体を見たいときは <code>--trace-ascii -</code> を使います。',
        code: { title: 'curl -sv の出力（stderr）', lang: 'bash', src: `
          ⟪*⟫ Established connection to www.example.com (203.0.113.10 port 80) …
          ⟪>⟫ GET /index.html HTTP/1.1
          ⟪>⟫ Host: www.example.com
          ⟪>⟫
          ⟪<⟫ HTTP/1.1 200 OK
          ⟪<⟫ Content-Length: 1256
          ⟪<⟫
          ⟪{⟫ [1256 bytes data]
          ⟪*⟫ Connection #0 to host www.example.com:80 left intact` },
        run: async (s) => {
          s.pulse('t');
          await s.caption('<code>*</code> 情報　<code>&gt;</code> 送信ヘッダ　<code>&lt;</code> 受信ヘッダ　<code>{</code> <code>}</code> ボディのバイト数');
        },
      },
      {
        title: '失敗：Host を付け忘れると 400 Bad Request',
        text: '<code>nc</code> で <code>Host</code> なしの HTTP/1.1 リクエストを手で送ると、nginx はアプリにも静的ファイルにも到達させずに <code>400</code> を返して接続を閉じます。error.log には <b>info レベル</b>で理由が出ます（既定の <code>error</code> レベルでは出ません）。',
        code: [
          { title: 'shell', lang: 'bash', src: `
            $ printf 'GET /index.html HTTP/1.1\\r\\n\\r\\n' | nc 203.0.113.10 80
            HTTP/1.1 400 Bad Request
            Server: nginx/1.27.2
            Content-Type: text/html
            Connection: close` },
          { title: '/var/log/nginx/error.log（error_log … info;）', lang: 'text', src: `
            [info] 29#29: *7 ⟪client sent HTTP/1.1 request without "Host" header⟫ while reading client request headers, client: 192.168.1.10, server: www.example.com, request: "GET /index.html HTTP/1.1"` },
        ],
        run: async (s) => {
          s.state('cli', null);
          s.hide('res slseg bodytip', { dur: 250 });
          await s.show('bad', { fx: 'right' });
          await s.term('t', L('$ printf \'GET /index.html HTTP/1.1\\r\\n\\r\\n\' | nc 203.0.113.10 80'), { clear: true });
          await s.fly(A, B, { label: 'GET（Host なし）', cls: 'c-red', arc: -26 });
          s.stamp('srv', '400', { cls: 'st-bad' });
          await s.fly(B, A, { label: '400 Bad Request', cls: 'c-red', arc: -26 });
          await s.show('bd1', { fx: 'left', stagger: 100 });
          s.state('cli', 'bad');
          s.shake('cli');
          await s.term('t', L('HTTP/1.1 400 Bad Request', 'Server: nginx/1.27.2', 'Content-Type: text/html', 'Connection: close'));
          await s.caption('Host のない HTTP/1.1 リクエストは <code>400 Bad Request</code>（RFC 9112 §3.2）', { cls: 'bad' });
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 2 : メソッドと冪等性
   * ===================================================================*/
  const C = { x: 210, y: 51 }, D = { x: 330, y: 51 };
  const rowsHtml = (rows) => rows.map((r) => '<div class="wl">' + esc(r) + '</div>').join('');
  const R42 = '42 {"name":"alice","email":"alice@example.com"}';
  const R42b = '42 {"name":"alice","email":"alice@example.net"}';
  const R43 = '43 {"name":"bob"}', R44 = '44 {"name":"bob"}';
  const R42c = '42 {"name":"Alice","tags":[]}';
  const req = (s, src) => s.set('reqbox', pre('http', src), { flash: false });
  const props = (s, safe, idem) => { s.set('p-safe', safe, { flash: false }); s.set('p-idem', idem, { flash: false }); };
  const YES = '<span style="color:var(--green)">✓ yes</span>', NO = '<span style="color:var(--red)">✗ no</span>';

  TIM.scene('#sc-methods', {
    intro: '同じリクエストを 2 回送ったとき、サーバーの状態（右上の users テーブル）がどう変わるかで safe / idempotent を確かめます（RFC 9110 §9.2）。',
    steps: [
      {
        title: 'GET：何回送っても状態は変わらない（safe）',
        text: 'GET は <b>safe</b>＝サーバーの状態を変えない前提のメソッドです。2 回送っても users テーブルは同じ。safe なものは当然 idempotent でもあります。',
        code: { title: 'shell', lang: 'bash', src: `
          $ curl -s https://api.example.com/users/42
          {"id":42,"name":"alice","email":"alice@example.com"}
          $ curl -s -o /dev/null -w '%{http_code}\\n' https://api.example.com/users/42
          200` },
        run: async (s) => {
          s.line(C, D, { cls: 'flow' });
          s.set('rows', rowsHtml([R42]), { flash: false });
          await s.show('reqf props');
          req(s, L('GET /users/42 HTTP/1.1', 'Host: api.example.com', 'Accept: application/json'));
          props(s, YES, YES);
          await s.fly(C, D, { label: 'GET', arc: -20, dur: 700 });
          await s.term('t', L('$ curl -s https://api.example.com/users/42', '{"id":42,"name":"alice","email":"alice@example.com"}'), { clear: true });
          await s.fly(C, D, { label: 'GET', arc: -20, dur: 700 });
          await s.term('t', L('$ curl -s -o /dev/null -w \'%{http_code}\\n\' https://api.example.com/users/42', '200'));
          await s.stamp('dbst', 'UNCHANGED', { cls: 'st-ok' });
        },
      },
      {
        title: 'HEAD：GET と同じヘッダだけ',
        text: '<code>curl -I</code> は HEAD を送ります。レスポンスは GET と同じヘッダ（<code>Content-Length: 52</code> まで同じ）ですが、ボディは送られません。ファイルサイズや <code>ETag</code> だけ確認したいときに使います。',
        code: { title: 'shell', lang: 'bash', src: `
          $ curl -I https://api.example.com/users/42
          HTTP/1.1 200 OK
          Content-Type: application/json
          ⟪Content-Length: 52⟫
          ETag: "v1"` },
        run: async (s) => {
          s.$('.stamp').forEach((e) => e.remove());
          req(s, L('HEAD /users/42 HTTP/1.1', 'Host: api.example.com'));
          props(s, YES, YES);
          await s.fly(C, D, { label: 'HEAD', arc: -20, dur: 700 });
          await s.term('t', L('$ curl -I https://api.example.com/users/42', 'HTTP/1.1 200 OK', 'Content-Type: application/json', 'Content-Length: 52', 'ETag: "v1"', '', '（ボディなし）'), { clear: true });
        },
      },
      {
        title: 'PUT：丸ごと置き換え。2 回送っても同じ状態（idempotent）',
        text: 'PUT は「この URI の状態を、送った表現に<b>置き換える</b>」。1 回目で email が <code>alice@example.net</code> になり、2 回目は同じ内容で上書きするだけなので状態は変わりません。だから通信が切れたら安全に再送できます。',
        code: { title: 'shell', lang: 'bash', src: `
          $ curl -i -X PUT https://api.example.com/users/42 \\
              --json '{"name":"alice","email":"alice@example.net"}'
          HTTP/1.1 200 OK
          # 2 回目も 200 OK。テーブルの内容は 1 回目の直後と同じ` },
        run: async (s) => {
          req(s, L('PUT /users/42 HTTP/1.1', 'Host: api.example.com', 'Content-Type: application/json', '', '{"name":"alice","email":"alice@example.net"}'));
          props(s, NO, YES);
          await s.term('t', '$ curl -i -X PUT https://api.example.com/users/42 --json \'{"name":"alice","email":"alice@example.net"}\'', { clear: true });
          await s.fly(C, D, { label: 'PUT #1', arc: -20, dur: 700 });
          await s.set('rows', rowsHtml([R42b]));
          await s.term('t', 'HTTP/1.1 200 OK');
          await s.fly(C, D, { label: 'PUT #2', arc: -20, dur: 700 });
          s.pulse('rows');
          await s.term('t', 'HTTP/1.1 200 OK   # 2 回目：状態は同じ');
          await s.stamp('dbst', 'SAME STATE', { cls: 'st-ok' });
        },
      },
      {
        title: 'POST：2 回送ると 2 件できる（非冪等）',
        text: 'コレクション <code>/users</code> への POST は「新しいメンバーを作れ」。2 回送れば 43 と 44 の 2 件ができ、それぞれ <code>201 Created</code> と作成先の <code>Location</code> が返ります。<b>タイムアウト後に POST を自動リトライすると二重登録</b>になるのはこのためです（RFC 9110 は、プロキシが非冪等リクエストを自動リトライすることを禁じています）。',
        code: { title: 'shell', lang: 'bash', src: `
          $ curl -i https://api.example.com/users --json '{"name":"bob"}'
          HTTP/1.1 201 Created
          ⟪Location: /users/43⟫
          $ curl -i https://api.example.com/users --json '{"name":"bob"}'
          HTTP/1.1 201 Created
          ⟪Location: /users/44⟫` },
        run: async (s) => {
          s.$('.stamp').forEach((e) => e.remove());
          s.set('rows', rowsHtml([R42b]), { flash: false });
          req(s, L('POST /users HTTP/1.1', 'Host: api.example.com', 'Content-Type: application/json', '', '{"name":"bob"}'));
          props(s, NO, NO);
          await s.term('t', '$ curl -i https://api.example.com/users --json \'{"name":"bob"}\'', { clear: true });
          await s.fly(C, D, { label: 'POST #1', arc: -20, dur: 700 });
          await s.set('rows', rowsHtml([R42b, R43]));
          await s.term('t', L('HTTP/1.1 201 Created', 'Location: /users/43'));
          await s.fly(C, D, { label: 'POST #2', arc: -20, dur: 700 });
          await s.set('rows', rowsHtml([R42b, R43, R44]));
          await s.term('t', L('HTTP/1.1 201 Created', 'Location: /users/44   # 2 件目！'));
          s.state('db', 'warn');
          await s.stamp('dbst', 'DUPLICATED', { cls: 'st-warn' });
        },
      },
      {
        title: 'PATCH その 1：JSON Merge Patch（RFC 7396）',
        text: 'PATCH は部分更新。差分の書式は <code>Content-Type</code> で決まります。<code>application/merge-patch+json</code> では「送ったメンバーだけ上書き、<code>null</code> はメンバー削除、配列は丸ごと置換」。この例は 2 回送っても結果が同じですが、PATCH というメソッド自体は冪等と保証されていません。',
        code: { title: 'shell', lang: 'bash', src: `
          $ curl -i -X PATCH https://api.example.com/users/42 \\
              -H 'Content-Type: application/merge-patch+json' \\
              -d '{"name":"Alice","email":null,"tags":[]}'
          HTTP/1.1 200 OK

          {"id":42,"name":"Alice","tags":[]}` },
        run: async (s) => {
          s.$('.stamp').forEach((e) => e.remove());
          s.state('db', null);
          s.set('rows', rowsHtml([R42b, R43, R44]), { flash: false });
          req(s, L('PATCH /users/42 HTTP/1.1', 'Host: api.example.com', 'Content-Type: application/merge-patch+json', '', '{"name":"Alice","email":null,"tags":[]}'));
          props(s, NO, '<span style="color:var(--amber)">△ 保証なし（パッチ次第）</span>');
          await s.term('t', '$ curl -i -X PATCH https://api.example.com/users/42 -H \'Content-Type: application/merge-patch+json\' -d \'{"name":"Alice","email":null,"tags":[]}\'', { clear: true });
          await s.fly(C, D, { label: 'PATCH', arc: -20, dur: 700 });
          await s.set('rows', rowsHtml([R42c, R43, R44]));
          await s.term('t', L('HTTP/1.1 200 OK', '', '{"id":42,"name":"Alice","tags":[]}'));
        },
      },
      {
        title: 'PATCH その 2：JSON Patch の add は 2 回で 2 つ増える',
        text: '<code>application/json-patch+json</code>（RFC 6902）は操作の配列です。<code>"path":"/tags/-"</code> の <code>-</code> は「配列の末尾」。2 回送ると <code>"vip"</code> が 2 つ入ります。<b>PATCH の再送は POST と同じく危険</b>になりうる、という実例です。',
        code: { title: 'shell', lang: 'bash', src: `
          $ curl -i -X PATCH https://api.example.com/users/42 \\
              -H 'Content-Type: application/json-patch+json' \\
              -d '[{"op":"add","path":"/tags/-","value":"vip"}]'
          HTTP/1.1 200 OK
          # 1 回目: "tags":["vip"]
          # 2 回目: "tags":["vip","vip"]` },
        run: async (s) => {
          s.set('rows', rowsHtml([R42c, R43, R44]), { flash: false });
          req(s, L('PATCH /users/42 HTTP/1.1', 'Host: api.example.com', 'Content-Type: application/json-patch+json', '', '[{"op":"add","path":"/tags/-","value":"vip"}]'));
          props(s, NO, NO + '（この操作は）');
          await s.term('t', '$ curl -i -X PATCH https://api.example.com/users/42 -H \'Content-Type: application/json-patch+json\' -d \'[{"op":"add","path":"/tags/-","value":"vip"}]\'', { clear: true });
          await s.fly(C, D, { label: 'PATCH #1', arc: -20, dur: 700 });
          await s.set('rows', rowsHtml(['42 {"name":"Alice","tags":["vip"]}', R43, R44]));
          await s.term('t', 'HTTP/1.1 200 OK');
          await s.fly(C, D, { label: 'PATCH #2', arc: -20, dur: 700 });
          await s.set('rows', rowsHtml(['42 {"name":"Alice","tags":["vip","vip"]}', R43, R44]));
          await s.term('t', 'HTTP/1.1 200 OK   # tags が 2 つに');
          s.state('db', 'warn');
          await s.stamp('dbst', 'CHANGED AGAIN', { cls: 'st-warn' });
        },
      },
      {
        title: 'DELETE：204 No Content。2 回目は 404 でも冪等',
        text: '重複した <code>/users/44</code> を消します。1 回目は <code>204 No Content</code>（ボディなし）、2 回目は既にないので <code>404</code>。レスポンスは違っても<b>サーバーの状態は 1 回目のあとと同じ</b>なので、DELETE は idempotent です。',
        code: { title: 'shell', lang: 'bash', src: `
          $ curl -i -X DELETE https://api.example.com/users/44
          HTTP/1.1 ⟪204 No Content⟫
          $ curl -i -X DELETE https://api.example.com/users/44
          HTTP/1.1 404 Not Found` },
        run: async (s) => {
          s.$('.stamp').forEach((e) => e.remove());
          s.state('db', null);
          const R42d = '42 {"name":"Alice","tags":["vip","vip"]}';
          s.set('rows', rowsHtml([R42d, R43, R44]), { flash: false });
          req(s, L('DELETE /users/44 HTTP/1.1', 'Host: api.example.com'));
          props(s, NO, YES);
          await s.term('t', '$ curl -i -X DELETE https://api.example.com/users/44', { clear: true });
          await s.fly(C, D, { label: 'DELETE #1', arc: -20, dur: 700 });
          await s.set('rows', rowsHtml([R42d, R43]));
          await s.term('t', L('HTTP/1.1 204 No Content', '$ curl -i -X DELETE https://api.example.com/users/44'));
          await s.fly(C, D, { label: 'DELETE #2', arc: -20, dur: 700 });
          s.pulse('rows');
          await s.term('t', 'HTTP/1.1 404 Not Found   # 状態は同じ');
          await s.stamp('dbst', 'SAME STATE', { cls: 'st-ok' });
        },
      },
      {
        title: 'OPTIONS：使えるメソッドを聞く',
        text: 'OPTIONS は対象リソースで使えるメソッドを <code>Allow</code> で返します。ブラウザの CORS プリフライトもこのメソッドです（<a href="../cors/">CORS</a>）。',
        code: { title: 'shell', lang: 'bash', src: `
          $ curl -i -X OPTIONS https://api.example.com/users
          HTTP/1.1 204 No Content
          ⟪Allow: GET, HEAD, POST, OPTIONS⟫` },
        run: async (s) => {
          s.$('.stamp').forEach((e) => e.remove());
          req(s, L('OPTIONS /users HTTP/1.1', 'Host: api.example.com'));
          props(s, YES, YES);
          await s.term('t', '$ curl -i -X OPTIONS https://api.example.com/users', { clear: true });
          await s.fly(C, D, { label: 'OPTIONS', arc: -20, dur: 700 });
          await s.term('t', L('HTTP/1.1 204 No Content', 'Allow: GET, HEAD, POST, OPTIONS'));
        },
      },
      {
        title: 'まとめ：再送してよいのはどれか',
        text: 'safe（GET / HEAD / OPTIONS / TRACE）と、PUT / DELETE は idempotent。POST と PATCH は保証がないため、自動リトライするなら <a href="../webapi/">Web API</a> ページの <code>Idempotency-Key</code> のような仕組みが要ります。',
        code: { title: 'RFC 9110 §9.2.2', lang: 'text', src: `
          A request method is considered "idempotent" if the intended effect on
          the server of multiple identical requests with that method is the
          same as the effect for a single such request.` },
        run: async (s) => {
          s.hide('reqf props', { dur: 250 });
          await s.term('t', L(
            'method   safe  idempotent  典型的な成功',
            'GET       ✓       ✓        200',
            'HEAD      ✓       ✓        200（ボディなし）',
            'OPTIONS   ✓       ✓        204 + Allow',
            'PUT       ✗       ✓        200 / 204 / 201',
            'DELETE    ✗       ✓        204',
            'POST      ✗       ✗        201 + Location',
            'PATCH     ✗       △        200 / 204'), { clear: true, lineDelay: 120 });
          await s.caption('自動リトライしてよいのは idempotent なメソッドだけ');
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 3 : キャッシュと条件付きリクエスト
   * ===================================================================*/
  const BR = { x: 250, y: 54 }, SV = { x: 700, y: 54 };
  const msg = (s, title, lang, src) => { s.text('msgh', title, { flash: false }); return s.set('msgbox', pre(lang, src)); };
  const clk = (s, a, b) => s.count('clkv', a, b, { fmt: (v) => 't = ' + Math.round(v) + ' s', dur: 900 });
  const RES200 = L(
    'HTTP/1.1 200 OK',
    'Date: Mon, 28 Sep 2026 03:00:00 GMT',
    'Content-Type: text/css',
    'Content-Length: 1256',
    '⟪Cache-Control: max-age=60⟫',
    '⟪ETag: "6ab63f18-4e8"⟫',
    'Last-Modified: Fri, 25 Sep 2026 09:30:00 GMT');

  TIM.scene('#sc-cache', {
    intro: 'ブラウザが <code>/app.css</code> を取得 → 30 秒後（fresh）→ 90 秒後（stale → 条件付き GET → <code>304</code>）→ ファイル更新後（<code>200</code>）の順に、キャッシュの中身とヘッダを追います。',
    steps: [
      {
        title: '初回：200 OK と一緒にキャッシュ指示が届く',
        text: 'nginx は本文と一緒に <code>Cache-Control: max-age=60</code>、<code>ETag</code>、<code>Last-Modified</code> を返します。ブラウザはボディとこれらのヘッダをセットで HTTP キャッシュに保存します。',
        code: { title: 'response', lang: 'http', src: RES200.replace(/[⟪⟫]/g, '') , hl: [5, 6, 7] },
        run: async (s) => {
          s.line(BR, SV, { cls: 'dash', arrow: false });
          await s.show('msg');
          msg(s, 'GET /app.css → 200 OK', 'http', RES200);
          await s.fly(BR, SV, { label: 'GET /app.css', arc: -30 });
          await s.fly(SV, BR, { label: '200 OK · 1256 B', cls: 'c-green', arc: -30 });
          await s.show('cache', { fx: 'zoom' });
          s.state('cache', 'ok');
          s.show('dev');
          s.set('devrow', esc('app.css    200    本文 1256 B    (network)'), { flash: false });
          s.show('why');
          await s.set('why', '<code>max-age=60</code> → 保存から 60 秒間は <b>fresh</b>');
        },
      },
      {
        title: '30 秒後：fresh なのでネットワークに出ない',
        text: '<code>age</code>（30 秒）＜ <code>max-age</code>（60 秒）なので fresh。ブラウザはサーバーに問い合わせず、キャッシュから即座に返します。DevTools の Size 列には <code>(disk cache)</code> や <code>(memory cache)</code> と表示されます。',
        code: { title: 'RFC 9111 §4.2', lang: 'text', src: `
          response_is_fresh = (freshness_lifetime > current_age)

          freshness_lifetime = max-age = 60
          current_age        = 30
          → fresh：リクエストは送られない` },
        run: async (s) => {
          await clk(s, 0, 30);
          s.text('c-age', '30 s');
          s.state('srv', 'dim');
          msg(s, 'RFC 9111 §4.2', 'text', L('response_is_fresh = (freshness_lifetime > current_age)', '', '60 > 30  →  fresh（ネットワークに出ない）'));
          s.set('devrow', esc('app.css    200    (disk cache)    0 ms'));
          s.set('why', '<code>age 30</code> &lt; <code>max-age 60</code> → キャッシュから返す');
          await s.pulse('cache');
        },
      },
      {
        title: '90 秒後：stale → 条件付き GET を送る',
        text: '<code>age</code> 90 秒で期限切れ（stale）。ボディは手元にあるので、全部を取り直す代わりに「この版から変わった？」と聞きます。保存しておいた <code>ETag</code> を <code>If-None-Match</code> に、<code>Last-Modified</code> を <code>If-Modified-Since</code> に入れて送ります。',
        code: { title: 'request', lang: 'http', src: `
          GET /app.css HTTP/1.1
          Host: www.example.com
          ⟪If-None-Match: "6ab63f18-4e8"⟫
          If-Modified-Since: Fri, 25 Sep 2026 09:30:00 GMT` },
        run: async (s) => {
          await clk(s, 30, 90);
          s.text('c-age', '90 s');
          s.text('c-state', 'stale');
          s.state('cache', 'warn');
          s.state('srv', null);
          s.set('why', '<code>age 90</code> &gt; <code>max-age 60</code> → <b>stale</b>。再検証が必要');
          msg(s, 'conditional GET', 'http', L('GET /app.css HTTP/1.1', 'Host: www.example.com', '⟪If-None-Match: "6ab63f18-4e8"⟫', 'If-Modified-Since: Fri, 25 Sep 2026 09:30:00 GMT'));
          s.set('devrow', esc('app.css    ...    (pending)'), { flash: false });
          await s.fly(BR, SV, { label: 'If-None-Match: "6ab63f18-4e8"', arc: -30, dur: 1200 });
          s.state('srv', 'active');
        },
      },
      {
        title: 'ETag が一致 → 304 Not Modified（ボディ 0 バイト）',
        text: 'nginx は現在のファイルの ETag（mtime とサイズから計算）と <code>If-None-Match</code> を比べ、一致したので <code>304</code> を返します。ボディは送られず、ブラウザは手元の 1256 バイトを使い、鮮度情報（age）を更新します。',
        code: { title: 'response', lang: 'http', src: `
          HTTP/1.1 ⟪304 Not Modified⟫
          Date: Mon, 28 Sep 2026 03:01:30 GMT
          Cache-Control: max-age=60
          ETag: "6ab63f18-4e8"
          Last-Modified: Fri, 25 Sep 2026 09:30:00 GMT` },
        run: async (s) => {
          await s.show('cmp', { fx: 'pop' });
          s.text('cmpv', '"6ab63f18-4e8" = 現在の ETag ✓', { flash: false });
          await s.scan('srv');
          s.state('cmp', 'ok');
          await s.fly(SV, BR, { label: '304 Not Modified', cls: 'c-green', arc: -30 });
          s.state('srv', null);
          msg(s, '304 response（ボディなし）', 'http', L('HTTP/1.1 ⟪304 Not Modified⟫', 'Date: Mon, 28 Sep 2026 03:01:30 GMT', 'Cache-Control: max-age=60', 'ETag: "6ab63f18-4e8"', 'Last-Modified: Fri, 25 Sep 2026 09:30:00 GMT'));
          s.text('c-age', '0 s');
          s.text('c-state', 'fresh（再検証済み）');
          s.state('cache', 'ok');
          s.set('devrow', esc('app.css    304    ヘッダのみ（body 0 B）'));
          await s.set('why', 'ボディは転送されず、キャッシュの 1256 B を再利用');
        },
      },
      {
        title: 'ファイルを更新すると ETag が変わる → 200 で取り直し',
        text: '03:02:00 に <code>app.css</code> がデプロイされ 1298 バイトに。次の再検証（t = 180 s）で送った古い ETag は一致しないので、nginx は <code>200</code> と新しい本文・新しい <code>ETag: "6ab9d8a8-512"</code> を返し、キャッシュは丸ごと置き換わります。',
        code: { title: 'response', lang: 'http', src: `
          HTTP/1.1 200 OK
          Date: Mon, 28 Sep 2026 03:03:00 GMT
          Content-Length: 1298
          Cache-Control: max-age=60
          ⟪ETag: "6ab9d8a8-512"⟫
          Last-Modified: Mon, 28 Sep 2026 03:02:00 GMT` },
        run: async (s) => {
          s.state('cmp', null);
          await clk(s, 90, 180);
          s.text('c-age', '90 s');
          s.text('c-state', 'stale');
          s.state('cache', 'warn');
          await s.fly(BR, SV, { label: 'If-None-Match: "6ab63f18-4e8"', arc: -30, dur: 1100 });
          s.text('cmpv', '"6ab63f18-4e8" ≠ "6ab9d8a8-512"');
          s.state('cmp', 'bad');
          await s.fly(SV, BR, { label: '200 OK · 1298 B', cls: 'c-green', arc: -30 });
          msg(s, 'GET /app.css → 200 OK（更新あり）', 'http', L('HTTP/1.1 200 OK', 'Date: Mon, 28 Sep 2026 03:03:00 GMT', 'Content-Length: 1298', 'Cache-Control: max-age=60', '⟪ETag: "6ab9d8a8-512"⟫', 'Last-Modified: Mon, 28 Sep 2026 03:02:00 GMT'));
          s.text('c-etag', '"6ab9d8a8-512"');
          s.text('c-lm', 'Mon, 28 Sep 2026 03:02:00 GMT');
          s.text('c-body', '1298 B');
          s.text('c-age', '0 s');
          s.text('c-state', 'fresh（新しい版）');
          s.state('cache', 'ok');
          s.set('devrow', esc('app.css    200    本文 1298 B    (network)'));
          await s.set('why', 'ETag 不一致 → 本文ごと取り直してキャッシュを置き換え');
        },
      },
      {
        title: 'ETag がないとき：Last-Modified / If-Modified-Since',
        text: 'nginx で <code>etag off;</code> にすると <code>Last-Modified</code> だけで再検証します（秒単位の精度）。両方送られてきた場合、サーバーは <b><code>If-None-Match</code> を優先し <code>If-Modified-Since</code> を無視</b>しなければなりません（RFC 9110 §13.1.3）。',
        code: [
          { title: 'request → response', lang: 'http', src: `
            GET /app.css HTTP/1.1
            Host: www.example.com
            ⟪If-Modified-Since: Mon, 28 Sep 2026 03:02:00 GMT⟫

            HTTP/1.1 304 Not Modified
            Last-Modified: Mon, 28 Sep 2026 03:02:00 GMT` },
          { title: '/etc/nginx/conf.d/static.conf', lang: 'text', src: `
            location /static/ {
                etag off;          # ETag を付けない（Last-Modified のみ）
                expires 1m;        # Cache-Control: max-age=60 を付与
            }` },
        ],
        run: async (s) => {
          s.state('cmp', null);
          s.hide('cmp', { dur: 200 });
          await clk(s, 180, 270);
          s.text('c-etag', '（なし：etag off）');
          s.text('c-age', '90 s');
          s.text('c-state', 'stale');
          s.state('cache', 'warn');
          msg(s, 'Last-Modified で再検証', 'http', L('GET /app.css HTTP/1.1', 'Host: www.example.com', '⟪If-Modified-Since: Mon, 28 Sep 2026 03:02:00 GMT⟫', '', 'HTTP/1.1 304 Not Modified', 'Last-Modified: Mon, 28 Sep 2026 03:02:00 GMT'));
          await s.fly(BR, SV, { label: 'If-Modified-Since: …03:02:00 GMT', arc: -30, dur: 1100 });
          await s.fly(SV, BR, { label: '304 Not Modified', cls: 'c-green', arc: -30 });
          s.text('c-age', '0 s');
          s.text('c-state', 'fresh（再検証済み）');
          s.state('cache', 'ok');
          s.set('devrow', esc('app.css    304    ヘッダのみ'));
          await s.set('why', '更新時刻が同じ → 304。秒未満の更新は検出できない');
        },
      },
      {
        title: 'no-cache と no-store の違い',
        text: '<code>no-cache</code> は「保存してよいが、使う前に<b>毎回</b>再検証せよ」＝毎回 304 往復が発生するが本文は再利用できる。<code>no-store</code> は「保存するな」＝毎回 200 で全部取り直し。名前に反して、キャッシュさせたくないときに使うのは <code>no-store</code> です。',
        code: { title: 'response header', lang: 'http', src: `
          Cache-Control: no-cache    # 保存 OK・毎回 If-None-Match で確認
          Cache-Control: ⟪no-store⟫    # 保存しない（個人情報を含む API 応答など）` },
        run: async (s) => {
          msg(s, 'Cache-Control の 2 つの「なし」', 'text', L('Cache-Control: no-cache', '  → 保存する。使う前に毎回 条件付き GET（304 なら本文再利用）', '', 'Cache-Control: no-store', '  → 保存しない。毎回 200 でフル転送'));
          await s.fly(BR, SV, { label: 'GET /me', arc: -30 });
          await s.fly(SV, BR, { label: '200 · Cache-Control: no-store', cls: 'c-amber', arc: -30 });
          s.text('c-state', 'no-store → 保存されない');
          s.state('cache', 'bad');
          s.set('devrow', esc('me         200    (network・保存されない)'));
          await s.set('why', '<code>no-store</code> の応答はキャッシュに入らない');
        },
      },
      {
        title: 'curl で 304 を再現する',
        text: 'curl はキャッシュを持たないので、条件付きヘッダを自分で付けて試します。<code>-H \'If-None-Match: "…"\'</code> の値はダブルクォートまで含めた ETag そのものです（クォートを落とすと一致しません）。',
        code: { title: 'shell', lang: 'bash', src: `
          $ curl -sI https://www.example.com/app.css | grep -i '^etag'
          etag: "6ab9d8a8-512"        # HTTP/2 で受けると名前は小文字
          $ curl -s -o /dev/null -w '%{http_code}\\n' \\
              -H 'If-None-Match: "6ab9d8a8-512"' https://www.example.com/app.css
          ⟪304⟫
          $ curl -s -o /dev/null -w '%{http_code}\\n' \\
              -H 'If-None-Match: 6ab9d8a8-512' https://www.example.com/app.css
          200                          # クォートなしは別の値として扱われる` },
        run: async (s) => {
          s.state('cache', null);
          s.text('c-state', 'fresh');
          msg(s, 'shell', 'bash', L(
            '$ curl -s -o /dev/null -w \'%{http_code}\\n\' \\',
            '    -H \'If-None-Match: "6ab9d8a8-512"\' \\',
            '    https://www.example.com/app.css',
            '⟪304⟫'));
          await s.fly(BR, SV, { label: 'If-None-Match: "6ab9d8a8-512"', arc: -30, dur: 1100 });
          await s.fly(SV, BR, { label: '304', cls: 'c-green', arc: -30 });
          s.set('devrow', esc('curl       304    body 0 B'));
          await s.set('why', 'ETag はダブルクォート込みで比較される');
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 4 : ステータスコードの発生源
   * ===================================================================*/
  const P = {
    cli: { x: 196, y: 105 }, ngxL: { x: 242, y: 105 }, ngxR: { x: 442, y: 105 },
    appL: { x: 486, y: 105 }, appR: { x: 686, y: 105 }, dbL: { x: 730, y: 105 },
  };
  const clean = (s) => {
    s.$('.stamp').forEach((e) => e.remove());
    s.state('cli ngx app db', null);
    s.caption('');
  };
  // ステータス行は http ハイライタの配色に任せる（⟪⟫ を外す）
  const unmarkStatus = (src) => src.replace(/^(HTTP\/[\d.]+ )⟪([^⟫]*)⟫/gm, '$1$2');
  const res = (s, title, lang, src) => { s.text('resh', title, { flash: false }); return s.set('resbox', pre(lang, unmarkStatus(src))); };
  const log = (s, title, text) => { s.text('logh', title, { flash: false }); return s.term('log', text, { clear: true, lineDelay: 30 }); };
  const toApp = async (s, label, cls) => {
    await s.fly(P.cli, P.ngxL, { label, cls, arc: -34, dur: 800 });
    await s.fly(P.ngxR, P.appL, { label, cls, arc: -34, dur: 700 });
  };
  const fromApp = async (s, label, cls) => {
    await s.fly(P.appL, P.ngxR, { label, cls, arc: -34, dur: 700 });
    await s.fly(P.ngxL, P.cli, { label, cls, arc: -34, dur: 800 });
  };
  const ACC = (req, st, bytes) => '192.168.1.10 - - [28/Sep/2026:03:00:00 +0000] "' + req + '" ' + st + ' ' + bytes + ' "-" "curl/8.21.0"';

  TIM.scene('#sc-status', {
    intro: 'curl → nginx（リバースプロキシ）→ Node.js アプリ → PostgreSQL の構成で、各ステータスコードを<b>どのコンポーネントが作って返したか</b>を、レスポンスとログの実物で追います。',
    steps: [
      {
        title: '301：nginx が http → https に転送',
        text: '<code>http://</code> へのリクエストは nginx の <code>return 301</code> で即座に返され、アプリには届きません。<code>Location</code> に転送先が入ります。本文 162 バイトは nginx 組み込みのエラーページ（<code>server_tokens off;</code> の場合）です。',
        code: { title: '/etc/nginx/conf.d/api.conf', lang: 'text', src: `
          server {
              listen 80;
              server_name api.example.com;
              ⟪return 301 https://$host$request_uri;⟫
          }` },
        run: async (s) => {
          s.line(P.cli, P.ngxL, {});
          s.line(P.ngxR, P.appL, {});
          s.line(P.appR, P.dbL, {});
          clean(s);
          await s.fly(P.cli, P.ngxL, { label: 'GET http://…/v1/users', arc: -34, dur: 800 });
          s.stamp('ngx', '301', { cls: 'st-warn' });
          await s.fly(P.ngxL, P.cli, { label: '301', cls: 'c-amber', arc: -34, dur: 800 });
          res(s, 'レスポンス（nginx が生成）', 'http', L('HTTP/1.1 ⟪301 Moved Permanently⟫', 'Server: nginx', 'Content-Type: text/html', 'Content-Length: 162', '⟪Location: https://api.example.com/v1/users⟫'));
          await log(s, '/var/log/nginx/access.log', ACC('GET /v1/users HTTP/1.1', 301, 162));
          await s.caption('返したのは <b>nginx</b>（<code>return 301</code>）。アプリには届いていない');
        },
      },
      {
        title: '失敗：POST を 301 で転送すると GET に化ける → 308 を使う',
        text: 'RFC 9110 は 301/302 で POST を GET に変えることを歴史的理由で許しており、curl もブラウザも実際に GET に変えます。アプリには <b>ボディのない GET /v1/users</b> が届き、ユーザーは作成されません。メソッドとボディを保つには <code>308</code>（一時なら <code>307</code>）を使います。',
        code: [
          { title: 'curl -L の実測（httpbin.org）', lang: 'bash', src: `
            $ for c in 301 302 303 307 308; do printf "$c -> "; \\
                curl -sL -d 'a=1' "https://httpbin.org/redirect-to?url=/anything&status_code=$c" \\
                | grep '"method"'; done
            301 ->   "method": ⟪"GET"⟫,
            302 ->   "method": ⟪"GET"⟫,
            303 ->   "method": "GET",
            307 ->   "method": "POST",
            308 ->   "method": "POST",` },
          { title: '修正：/etc/nginx/conf.d/api.conf', lang: 'text', src: `
            return ⟪308⟫ https://$host$request_uri;` },
        ],
        run: async (s) => {
          clean(s);
          await s.fly(P.cli, P.ngxL, { label: 'POST http://…/v1/users', arc: -34, dur: 800 });
          s.stamp('ngx', '301', { cls: 'st-warn' });
          await s.fly(P.ngxL, P.cli, { label: '301', cls: 'c-amber', arc: -34, dur: 700 });
          await toApp(s, 'GET https://…/v1/users', 'c-red');
          s.state('app', 'warn');
          await fromApp(s, '200（一覧が返るだけ）', 'c-amber');
          s.state('cli', 'bad');
          s.shake('cli');
          res(s, '修正後のレスポンス', 'http', L('HTTP/1.1 ⟪308 Permanent Redirect⟫', 'Server: nginx', 'Location: https://api.example.com/v1/users'));
          await log(s, 'curl -sL -d \'a=1\' …/redirect-to?status_code=N', L('301 ->   "method": "GET",', '302 ->   "method": "GET",', '303 ->   "method": "GET",', '307 ->   "method": "POST",', '308 ->   "method": "POST",'));
          await s.caption('POST が 301 で GET に変わり、作成されないまま 200 が返る', { cls: 'bad' });
        },
      },
      {
        title: '404：ルートがない（アプリが返す）',
        text: 'nginx は <code>location /v1/</code> に一致したのでアプリへ転送し、Express のルーターに一致するルートがなかったため、Express の既定ハンドラ（finalhandler）が HTML の <code>404</code> を返します。<code>X-Powered-By: Express</code> が「アプリが返した」手がかりです。',
        code: { title: 'レスポンス（Express 既定の 404）', lang: 'http', src: `
          HTTP/1.1 404 Not Found
          ⟪X-Powered-By: Express⟫
          Content-Security-Policy: default-src 'none'
          X-Content-Type-Options: nosniff
          Content-Type: text/html; charset=utf-8

          <pre>⟪Cannot GET /v1/userz⟫</pre>` },
        run: async (s) => {
          clean(s);
          await toApp(s, 'GET /v1/userz');
          s.stamp('app', '404', { cls: 'st-warn' });
          await fromApp(s, '404', 'c-amber');
          res(s, 'レスポンス（アプリが生成）', 'http', L('HTTP/1.1 ⟪404 Not Found⟫', '⟪X-Powered-By: Express⟫', 'Content-Type: text/html; charset=utf-8', '', '<pre>Cannot GET /v1/userz</pre>'));
          await log(s, '/var/log/nginx/access.log', ACC('GET /v1/userz HTTP/1.1', 404, 147));
          await s.caption('返したのは <b>アプリ</b>。nginx はそのまま中継しただけ');
        },
      },
      {
        title: '405 + Allow：そのメソッドは使えない',
        text: '<code>DELETE /v1/users</code>（コレクション全削除）は受け付けない設計。405 には <code>Allow</code> ヘッダが<b>必須</b>です（RFC 9110 §15.5.6）。Express は自動で 405 を返さないので、ルートの最後に明示的に書きます。',
        code: { title: 'src/routes/users.js', lang: 'js', src: `
          router.get('/v1/users', listUsers);
          router.post('/v1/users', createUser);
          // それ以外のメソッドは 405
          router.all('/v1/users', (req, res) => {
            res.set(⟪'Allow', 'GET, POST'⟫).sendStatus(405);
          });` },
        run: async (s) => {
          clean(s);
          await toApp(s, 'DELETE /v1/users');
          s.stamp('app', '405', { cls: 'st-warn' });
          await fromApp(s, '405', 'c-amber');
          res(s, 'レスポンス（アプリが生成）', 'http', L('HTTP/1.1 ⟪405 Method Not Allowed⟫', '⟪Allow: GET, POST⟫', 'Content-Type: text/plain; charset=utf-8', '', 'Method Not Allowed'));
          await log(s, '/var/log/nginx/access.log', ACC('DELETE /v1/users HTTP/1.1', 405, 18));
          await s.caption('405 には <code>Allow</code> が必須');
        },
      },
      {
        title: '401 と 403：認証がない／権限がない',
        text: '<code>Authorization</code> なしなら <code>401</code>（誰だか分からない）で、<code>WWW-Authenticate</code> が必須。トークンは有効だがスコープが足りないなら <code>403</code>（誰かは分かったが許可しない）。Bearer トークンでは RFC 6750 §3 の <code>error="insufficient_scope"</code> を使います。',
        code: { title: 'レスポンス 2 種', lang: 'http', src: `
          HTTP/1.1 ⟪401 Unauthorized⟫
          ⟪WWW-Authenticate: Bearer realm="api"⟫

          HTTP/1.1 ⟪403 Forbidden⟫
          WWW-Authenticate: Bearer error="insufficient_scope", scope="admin"` },
        run: async (s) => {
          clean(s);
          await toApp(s, 'GET /v1/admin/stats');
          s.stamp('app', '401', { cls: 'st-bad' });
          await fromApp(s, '401', 'c-red');
          await toApp(s, 'Bearer eyJ…（scope=users:read）');
          s.$('.stamp').forEach((e) => e.remove());
          s.stamp('app', '403', { cls: 'st-bad' });
          await fromApp(s, '403', 'c-red');
          res(s, 'レスポンス（アプリが生成）', 'http', L('HTTP/1.1 ⟪401 Unauthorized⟫', 'WWW-Authenticate: Bearer realm="api"', '', 'HTTP/1.1 ⟪403 Forbidden⟫', 'WWW-Authenticate: Bearer error="insufficient_scope",', '                  scope="admin"'));
          await log(s, '/var/log/nginx/access.log', L(ACC('GET /v1/admin/stats HTTP/1.1', 401, 0), ACC('GET /v1/admin/stats HTTP/1.1', 403, 0)));
          await s.caption('401 = 誰？（認証）　403 = あなたには不可（認可）');
        },
      },
      {
        title: '失敗：curl -d で JSON を送って 415',
        text: '<code>curl -d</code> は <code>Content-Type: application/x-www-form-urlencoded</code> を付けます（<code>-v</code> の <code>&gt;</code> 行で見える）。JSON しか受けないアプリは <code>415 Unsupported Media Type</code> を返します。<code>--json</code> を使えば <code>Content-Type: application/json</code> と <code>Accept: application/json</code> が付きます。',
        code: [
          { title: 'curl -v（送信ヘッダ）', lang: 'bash', src: `
            $ curl -v https://api.example.com/v1/users -d '{"name":"alice"}'
            > POST /v1/users HTTP/1.1
            > Host: api.example.com
            > Content-Length: 16
            > ⟪Content-Type: application/x-www-form-urlencoded⟫` },
          { title: '修正', lang: 'bash', src: `
            $ curl https://api.example.com/v1/users ⟪--json⟫ '{"name":"alice"}'` },
        ],
        run: async (s) => {
          clean(s);
          await toApp(s, 'POST form-urlencoded', 'c-amber');
          s.stamp('app', '415', { cls: 'st-bad' });
          await fromApp(s, '415', 'c-red');
          res(s, 'レスポンス（アプリが生成）', 'http', L('HTTP/1.1 ⟪415 Unsupported Media Type⟫', 'Content-Type: application/problem+json', '', '{"type":"about:blank","title":"Unsupported Media Type",', ' "status":415,', ' "detail":"Content-Type must be application/json"}'));
          await log(s, 'curl -v の送信ヘッダ', L('> POST /v1/users HTTP/1.1', '> Host: api.example.com', '> User-Agent: curl/8.21.0', '> Accept: */*', '> Content-Length: 16', '> Content-Type: application/x-www-form-urlencoded'));
          s.state('cli', 'bad');
          await s.caption('原因はクライアント：<code>-d</code> の既定 Content-Type', { cls: 'bad' });
        },
      },
      {
        title: '失敗：JSON が壊れていて 400',
        text: '末尾カンマ入りの JSON は構文エラー。<code>express.json()</code>（body-parser）は <code>err.type === \'entity.parse.failed\'</code>、<code>err.status === 400</code> のエラーを投げるので、エラーハンドラで problem+json にして返します。値が不正なだけ（email の形式など）なら <code>422</code> を使い分けます。',
        code: { title: 'src/app.js（エラーハンドラ）', lang: 'js', src: `
          app.use(express.json());
          // ...routes...
          app.use((err, req, res, next) => {
            if (err.type === ⟪'entity.parse.failed'⟫) {
              return res.status(400).type('application/problem+json').json({
                type: 'about:blank', title: 'Bad Request', status: 400,
                detail: 'Request body is not valid JSON',
              });
            }
            next(err);
          });` },
        run: async (s) => {
          clean(s);
          await toApp(s, '{"name":"alice",}', 'c-amber');
          s.stamp('app', '400', { cls: 'st-bad' });
          await fromApp(s, '400', 'c-red');
          res(s, 'レスポンス（アプリが生成）', 'http', L('HTTP/1.1 ⟪400 Bad Request⟫', 'Content-Type: application/problem+json', '', '{"type":"about:blank","title":"Bad Request",', ' "status":400,', ' "detail":"Request body is not valid JSON"}'));
          await log(s, 'shell', L('$ curl -s https://api.example.com/v1/users --json \'{"name":"alice",}\' -w \'\\n%{http_code}\\n\'', '{"type":"about:blank","title":"Bad Request","status":400,"detail":"Request body is not valid JSON"}', '400'));
          s.state('cli', 'bad');
          await s.caption('構文エラー = 400 ／ 構文は正しいが値が不正 = 422', { cls: 'bad' });
        },
      },
      {
        title: '429：nginx の limit_req が弾く',
        text: '<code>limit_req</code> を超えたリクエストは nginx がその場で拒否し、アプリには届きません。既定の拒否ステータスは <b>503</b> なので <code>limit_req_status 429;</code> を明示します。nginx は <code>Retry-After</code> を自動では付けないため、必要なら <code>add_header … always;</code> で付けます。',
        code: { title: '/etc/nginx/conf.d/api.conf', lang: 'text', src: `
          limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
          server {
              location /v1/ {
                  limit_req zone=api burst=20 nodelay;
                  ⟪limit_req_status 429;⟫
                  add_header Retry-After 1 always;
                  proxy_pass http://127.0.0.1:3000;
              }
          }` },
        run: async (s) => {
          clean(s);
          s.fly(P.cli, P.ngxL, { label: 'GET ×30', arc: -34, dur: 700 });
          await s.fly(P.cli, P.ngxL, { label: 'GET ×30', arc: 30, dur: 800, delay: 150 });
          s.state('ngx', 'warn');
          s.stamp('ngx', '429', { cls: 'st-warn' });
          await s.fly(P.ngxL, P.cli, { label: '429', cls: 'c-amber', arc: -34, dur: 700 });
          res(s, 'レスポンス（nginx が生成）', 'http', L('HTTP/1.1 ⟪429 Too Many Requests⟫', 'Server: nginx', 'Content-Type: text/html', '⟪Retry-After: 1⟫'));
          await log(s, '/var/log/nginx/error.log', '2026/09/28 03:00:08 [error] 1234#1234: *88 limiting requests, excess: 20.520 by zone "api", client: 192.168.1.10, server: api.example.com, request: "GET /v1/users HTTP/1.1", host: "api.example.com"');
          await s.caption('返したのは <b>nginx</b>。アプリのログには何も出ない');
        },
      },
      {
        title: '失敗：アプリが落ちていて 502 Bad Gateway',
        text: 'Node.js プロセスが停止していると、nginx の <code>connect()</code> が <code>ECONNREFUSED</code>（111）で失敗し、nginx 自身が <code>502</code> を作って返します。アプリは動いていないのでアプリのログは空。見るべきは nginx の error.log です。',
        code: { title: '/var/log/nginx/error.log', lang: 'text', src: `
          2026/09/28 03:00:10 [error] 1234#1234: *57 ⟪connect() failed (111: Connection refused)⟫ while connecting to upstream, client: 192.168.1.10, server: api.example.com, request: "GET /v1/users HTTP/1.1", upstream: "http://127.0.0.1:3000/v1/users", host: "api.example.com"` },
        run: async (s) => {
          clean(s);
          s.state('app', 'bad');
          await s.fly(P.cli, P.ngxL, { label: 'GET /v1/users', arc: -34, dur: 800 });
          await s.fly(P.ngxR, { x: 474, y: 105 }, { label: 'connect()', cls: 'c-red', arc: -34, dur: 500 });
          s.shake('app');
          s.stamp('ngx', '502', { cls: 'st-bad' });
          await s.fly(P.ngxL, P.cli, { label: '502', cls: 'c-red', arc: -34, dur: 800 });
          res(s, 'レスポンス（nginx が生成）', 'http', L('HTTP/1.1 ⟪502 Bad Gateway⟫', 'Server: nginx', 'Content-Type: text/html', '', '<center><h1>502 Bad Gateway</h1></center>'));
          await log(s, '/var/log/nginx/error.log', '2026/09/28 03:00:10 [error] 1234#1234: *57 connect() failed (111: Connection refused) while connecting to upstream, client: 192.168.1.10, server: api.example.com, request: "GET /v1/users HTTP/1.1", upstream: "http://127.0.0.1:3000/v1/users", host: "api.example.com"');
          await s.caption('502 は <b>nginx</b> が作る。原因は上流（アプリ）への接続失敗', { cls: 'bad' });
        },
      },
      {
        title: '失敗：アプリが遅くて 504 Gateway Time-out',
        text: 'アプリは生きているが、DB の重いクエリで応答ヘッダを返せない。nginx は <code>proxy_read_timeout</code>（既定 60 秒）で待つのをやめ、<code>504</code> を返します。<b>アプリ側のクエリはその後も走り続ける</b>ので、DB の負荷は下がりません。',
        code: [
          { title: '/var/log/nginx/error.log', lang: 'text', src: `
            2026/09/28 03:01:10 [error] 1234#1234: *61 ⟪upstream timed out (110: Connection timed out) while reading response header from upstream⟫, client: 192.168.1.10, server: api.example.com, request: "GET /v1/reports/monthly HTTP/1.1", upstream: "http://127.0.0.1:3000/v1/reports/monthly", host: "api.example.com"` },
          { title: 'PostgreSQL で実行中のクエリを見る', lang: 'bash', src: `
            $ psql -c "SELECT pid, now() - query_start AS elapsed, left(query, 40)
                       FROM pg_stat_activity WHERE state = 'active';"` },
        ],
        run: async (s) => {
          clean(s);
          await toApp(s, 'GET /v1/reports/monthly');
          await s.fly(P.appR, P.dbL, { label: 'SELECT … (重い)', arc: -34, dur: 700 });
          s.state('db', 'warn');
          await s.show('timer', { fx: 'pop' });
          await s.count('timerv', 0, 60, { fmt: (v) => Math.round(v) + ' s', dur: 1500 });
          s.state('ngx', 'bad');
          s.stamp('ngx', '504', { cls: 'st-bad' });
          await s.fly(P.ngxL, P.cli, { label: '504', cls: 'c-red', arc: -34, dur: 800 });
          res(s, 'レスポンス（nginx が生成）', 'http', L('HTTP/1.1 ⟪504 Gateway Time-out⟫', 'Server: nginx', 'Content-Type: text/html', '', '<center><h1>504 Gateway Time-out</h1></center>'));
          await log(s, '/var/log/nginx/error.log', '2026/09/28 03:01:10 [error] 1234#1234: *61 upstream timed out (110: Connection timed out) while reading response header from upstream, client: 192.168.1.10, server: api.example.com, request: "GET /v1/reports/monthly HTTP/1.1", upstream: "http://127.0.0.1:3000/v1/reports/monthly", host: "api.example.com"');
          await s.caption('504 も <b>nginx</b> が作る。DB ではクエリがまだ実行中', { cls: 'bad' });
        },
      },
      {
        title: '500 / 503：アプリ自身が返すサーバーエラー',
        text: '未処理の例外は Express のエラーハンドラで <code>500</code> になります。スタックトレースはログに書き、レスポンスには出しません。計画メンテナンスなどで一時的に受けられないときは、アプリが <code>503</code> と <code>Retry-After</code> を返します。',
        code: [
          { title: 'app の stderr（journalctl -u app）', lang: 'text', src: `
            ⟪TypeError: Cannot read properties of undefined (reading 'id')⟫
                at getUser (/srv/app/src/routes/users.js:27:31)` },
          { title: 'レスポンス', lang: 'http', src: `
            HTTP/1.1 500 Internal Server Error
            Content-Type: application/problem+json

            {"type":"about:blank","title":"Internal Server Error","status":500}

            HTTP/1.1 503 Service Unavailable
            Retry-After: 120` },
        ],
        run: async (s) => {
          clean(s);
          s.hide('timer', { dur: 150 });
          await toApp(s, 'GET /v1/users/42');
          s.state('app', 'bad');
          s.shake('app');
          s.stamp('app', '500', { cls: 'st-bad' });
          await fromApp(s, '500', 'c-red');
          res(s, 'レスポンス（アプリが生成）', 'http', L('HTTP/1.1 ⟪500 Internal Server Error⟫', 'Content-Type: application/problem+json', '', '{"type":"about:blank",', ' "title":"Internal Server Error","status":500}'));
          await log(s, 'journalctl -u app', L('TypeError: Cannot read properties of undefined (reading \'id\')', '    at getUser (/srv/app/src/routes/users.js:27:31)'));
          await s.caption('500 / 503 は <b>アプリ</b>が返す。詳細はアプリのログへ');
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 5 : 接続（HTTP/1.1 → HTTP/2 → HTTP/3）
   * ===================================================================*/
  const det = (s, title, html) => { s.text('deth', title, { flash: false }); return s.set('detbox', html); };
  const H2HDR = '<div class="seg" style="margin:10px 10px 8px">' +
    '<span class="c-amber" style="flex:0 0 96px"><small>Length</small>00 00 11</span>' +
    '<span class="c-cyan" style="flex:0 0 76px"><small>Type</small>01</span>' +
    '<span class="c-violet" style="flex:0 0 76px"><small>Flags</small>05</span>' +
    '<span class="c-lime" style="flex:0 0 118px"><small>Stream ID</small>00 00 00 01</span>' +
    '<span class="c-gray" style="flex:1 1 auto"><small>Header block</small>17 bytes</span></div>';

  TIM.scene('#sc-conn', {
    intro: '同じ 3 つのファイル（<code>/index.html</code> <code>/app.css</code> <code>/app.js</code>）を取りに行くとき、HTTP/1.1・HTTP/2・HTTP/3 で接続の上に何が流れるかを比べます。',
    steps: [
      {
        title: 'HTTP/1.1：1 本の TCP 接続を使い回す（keep-alive）',
        text: 'HTTP/1.1 は持続的接続がデフォルト。curl に URL を 2 つ渡すと、2 本目は同じ TCP 接続で送られます（<code>Reusing existing … connection</code>）。ただし 1 本の接続上では<b>要求→応答→要求→応答</b>と順番にしか進みません。',
        code: { title: 'shell（curl 8.21.0）', lang: 'bash', src: `
          $ curl -sv -o /dev/null -o /dev/null \\
              http://www.example.com/index.html http://www.example.com/app.css 2>&1 \\
              | grep -E '^\\* (Established|Reusing)|^> GET'
          * Established connection to www.example.com (203.0.113.10 port 80) from 192.168.1.10 port 53712
          > GET /index.html HTTP/1.1
          ⟪* Reusing existing http: connection with host www.example.com⟫
          > GET /app.css HTTP/1.1` },
        run: async (s) => {
          await s.show('l1 z1');
          await s.show('a1 a2 a3 a4 a5 a6', { fx: 'left', stagger: 220 });
          det(s, 'wire（同じ TCP 接続に順番に書かれる）', pre('http', L('GET /index.html HTTP/1.1', 'Host: www.example.com', '', 'HTTP/1.1 200 OK … (Content-Length: 1256)', 'GET /app.css HTTP/1.1', 'Host: www.example.com', '', 'HTTP/1.1 200 OK … (Content-Length: 1298)')));
          await s.term('t', L('$ curl -sv -o /dev/null -o /dev/null URL1 URL2', '* Established connection to www.example.com …', '> GET /index.html HTTP/1.1', '* Reusing existing http: connection with host www.example.com', '> GET /app.css HTTP/1.1'), { clear: true });
        },
      },
      {
        title: 'HTTP/1.1 の弱点：前の応答が終わるまで次を返せない',
        text: '1 本の接続では応答の境界（<code>Content-Length</code> / chunked）で区切って順に返すしかなく、大きい応答や遅い応答が後ろを詰まらせます（head-of-line blocking）。そのためブラウザは同一ホストに複数（Chrome は 6 本）の TCP 接続を並行して張ります。',
        code: { title: 'chunked のワイヤ形式（長さ不明のボディ）', lang: 'http', src: `
          HTTP/1.1 200 OK
          Content-Type: application/json
          ⟪Transfer-Encoding: chunked⟫

          18\\r\\n
          {"id":42,"name":"alice"}\\r\\n
          ⟪0\\r\\n⟫
          ⟪\\r\\n⟫` },
        run: async (s) => {
          s.state('a2', 'warn');
          await s.show('a7', { fx: 'right' });
          s.state('a3 a4 a5 a6', 'dim');
          det(s, 'chunked：16 進の長さ + CRLF + データ + CRLF … 0 で終了', pre('http', L('HTTP/1.1 200 OK', 'Transfer-Encoding: chunked', '', '18\\r\\n                       ← 0x18 = 24 バイト', '{"id":42,"name":"alice"}\\r\\n', '0\\r\\n                        ← 終端チャンク', '\\r\\n')));
          await s.caption('HTTP/1.1：1 接続につき同時に 1 往復だけ');
        },
      },
      {
        title: 'HTTP/2：TLS の ALPN で h2 を合意し、接続プリフェイスを送る',
        text: 'https では TLS ハンドシェイク中の ALPN で <code>h2</code> を選びます。その直後にクライアントは 24 バイトの接続プリフェイス <code>PRI * HTTP/2.0\\r\\n\\r\\nSM\\r\\n\\r\\n</code> と <code>SETTINGS</code> フレームを送り、以後はすべてバイナリのフレームです。',
        code: { title: 'shell（HTTP2 対応ビルドの curl）', lang: 'bash', src: `
          $ curl -sv --http2 -o /dev/null https://www.example.com/ 2>&1 | grep -E 'ALPN|^> GET|^< HTTP'
          * ALPN: curl offers ⟪h2⟫,http/1.1
          * ALPN: server accepted ⟪h2⟫
          > GET / HTTP/2
          < HTTP/2 200` },
        run: async (s) => {
          s.state('a2 a3 a4 a5 a6', null);
          s.caption('');
          s.hide('a7', { dur: 150 });
          await s.show('l2 z2');
          await s.show('b0 b1', { fx: 'left', stagger: 250 });
          det(s, 'connection preface（RFC 9113 §3.4）', '<div class="bytes" style="padding:10px 12px">50 52 49 20 2a 20 48 54 54 50 2f 32 2e 30 0d 0a\n0d 0a 53 4d 0d 0a 0d 0a\n<b>P  R  I  ␠  *  ␠  H  T  T  P  /  2  .  0  \\r \\n</b>\n<b>\\r \\n S  M  \\r \\n \\r \\n</b>   → 続けて SETTINGS フレーム</div>');
          await s.term('t', L('$ curl -sv --http2 -o /dev/null https://www.example.com/', '* ALPN: curl offers h2,http/1.1', '* ALPN: server accepted h2', '> GET / HTTP/2', '< HTTP/2 200'), { clear: true });
        },
      },
      {
        title: 'HEADERS フレーム：9 バイトのヘッダ + HPACK',
        text: 'すべてのフレームは <b>Length(24bit) Type(8) Flags(8) R+Stream ID(32)</b> の 9 バイトで始まります。<code>GET /</code> は Type=<code>0x01</code>（HEADERS）、Flags=<code>0x05</code>（END_STREAM|END_HEADERS）、Stream ID=1。ヘッダは HPACK で 17 バイトに圧縮されます。',
        code: { title: 'HEADERS frame（HPACK は RFC 7541 付録 C.4.1 の例の :scheme を https にしたもの）', lang: 'text', src: `
          00 00 11 01 05 00 00 00 01                     ← frame header (9 bytes)
          82                      :method: GET        (static index 2)
          87                      :scheme: https      (static index 7)
          84                      :path: /            (static index 4)
          41 8c f1 e3 c2 e5 f2 3a 6b a0 ab 90 f4 ff
                                  :authority: www.example.com
                                  (name = index 1, value = Huffman 12 bytes)` },
        run: async (s) => {
          await s.show('b2', { fx: 'pop' });
          det(s, 'HEADERS frame（stream 1）', H2HDR + '<div class="bytes" style="padding:0 12px 10px">82 87 84 41 8c f1 e3 c2 e5 f2 3a 6b a0 ab 90 f4 ff\n<b>82</b> :method GET  <b>87</b> :scheme https  <b>84</b> :path /\n<b>41 8c …</b> :authority www.example.com（Huffman）</div>');
          await s.term('t', L('# 疑似ヘッダ（HTTP/2 のリクエストライン相当）', ':method: GET', ':scheme: https', ':authority: www.example.com', ':path: /'), { clear: true });
        },
      },
      {
        title: '多重化：3 つのストリームのフレームが交互に流れる',
        text: 'クライアントは奇数のストリーム ID（1, 3, 5）で 3 つの要求を<b>待たずに</b>送り、サーバーは準備できた順に DATA フレームを返します。1 本の TCP 接続の上で、応答が混ざって流れても Stream ID で組み立て直せます。',
        code: { title: 'RFC 9113 §6 のフレーム型', lang: 'text', src: `
          DATA=0x00  ⟪HEADERS=0x01⟫  PRIORITY=0x02  RST_STREAM=0x03
          ⟪SETTINGS=0x04⟫  PUSH_PROMISE=0x05  PING=0x06  GOAWAY=0x07
          WINDOW_UPDATE=0x08  CONTINUATION=0x09

          stream 1: /index.html   stream 3: /app.css   stream 5: /app.js` },
        run: async (s) => {
          await s.show('b3 b4', { fx: 'pop', stagger: 200 });
          await s.show('b5 b6 b7 b8', { fx: 'left', stagger: 220 });
          det(s, '1 本の TCP 上のフレーム列', pre('text', L('→ HEADERS  stream=1  :path /index.html', '→ HEADERS  stream=3  :path /app.css', '→ HEADERS  stream=5  :path /app.js', '← DATA     stream=3  (app.css の一部)', '← DATA     stream=1  (index.html)', '← DATA     stream=5  (app.js の一部)', '← DATA     stream=3  END_STREAM')));
          await s.caption('HTTP/2：1 接続で同時に何本でも（SETTINGS_MAX_CONCURRENT_STREAMS まで）');
        },
      },
      {
        title: 'HPACK の動的テーブル：2 回目の :authority は 1 バイト',
        text: 'HPACK は接続ごとに<b>動的テーブル</b>を持ち、一度送ったヘッダを番号で参照します。2 つ目の要求では <code>:authority: www.example.com</code>（14 バイト）が <code>be</code>（index 62）の 1 バイトになります。<code>Cookie</code> や <code>Authorization</code> のような長いヘッダほど効きます。',
        code: { title: 'RFC 7541 付録 C.4.2（:scheme を https に変更）', lang: 'text', src: `
          82 87 84 ⟪be⟫ 58 86 a8 eb 10 64 9c bf
          82  :method: GET
          87  :scheme: https
          84  :path: /
          ⟪be⟫  :authority: www.example.com   (dynamic table index 62)
          58 86 a8 eb 10 64 9c bf   cache-control: no-cache` },
        run: async (s) => {
          s.caption('');
          det(s, '2 つ目の HEADERS の HPACK ブロック', '<div class="bytes" style="padding:10px 12px">1 回目: 82 87 84 <b>41 8c f1 e3 c2 e5 f2 3a 6b a0 ab 90 f4 ff</b>\n2 回目: 82 87 84 <b>be</b> 58 86 a8 eb 10 64 9c bf\n\n<b>be</b> = 1011 1110 → 先頭ビット 1（Indexed）, index 62\n    = 動的テーブルの先頭＝前回送った :authority</div>');
          await s.pulse('b3');
        },
      },
      {
        title: 'HTTP/2 の弱点：TCP の 1 セグメント欠落で全ストリームが止まる',
        text: 'HTTP/2 の多重化は TCP の上にあるので、TCP セグメントが 1 つ失われると、再送が届くまでカーネルは<b>後続のバイトをアプリに渡しません</b>。stream 1 と 5 のデータが届いていても、失われたのが stream 3 の分なら全員が待たされます（TCP レベルの head-of-line blocking）。',
        code: { title: '状況', lang: 'text', src: `
          TCP seq:  [ …DATA 3… ]⟪[ lost ]⟫[ DATA 1 ][ DATA 5 ]
                                    ↑ 再送が届くまで、後ろの DATA 1 / DATA 5 も
                                      受信バッファに留まりアプリへ渡らない` },
        run: async (s) => {
          s.state('b5', 'bad');
          await s.show('bx', { fx: 'pop' });
          s.state('b6 b7 b8', 'dim');
          s.shake('b5');
          det(s, 'TCP レベルの HOL blocking', pre('text', L('TCP は「順番どおり」にしかアプリへ渡さない', '', '[DATA 3][ ✕ lost ][DATA 1][DATA 5]', '           ↑', '  ここが再送されるまで DATA 1 / DATA 5 も待ち')));
          await s.caption('HTTP/2 の多重化でも、TCP のパケットロスは全ストリームに効く', { cls: 'bad' });
        },
      },
      {
        title: 'HTTP/3 の発見：Alt-Svc ヘッダで「UDP 443 でも話せる」',
        text: 'ブラウザは最初 HTTP/2（TCP）で接続し、レスポンスの <code>Alt-Svc: h3=":443"</code> を見て、次回から QUIC（UDP 443）で接続します（DNS の HTTPS レコードで最初から知る方法もあります）。curl では <code>--http3</code> で試せますが、<b>HTTP/3 対応でビルドされた curl が必要</b>です。',
        code: { title: 'shell（実測）', lang: 'bash', src: `
          $ curl -sI https://www.cloudflare.com/ | grep -i '^alt-svc'
          ⟪alt-svc: h3=":443"; ma=86400⟫
          $ curl -sI --http3 https://www.cloudflare.com/ | head -1
          HTTP/3 200
          # 非対応ビルドの場合:
          curl: option --http3: the installed libcurl version does not support this` },
        run: async (s) => {
          s.caption('');
          await s.show('l3 z3');
          await s.show('d0', { fx: 'left' });
          det(s, 'Alt-Svc（RFC 7838）', pre('http', L('HTTP/2 200', 'content-type: text/html', '⟪alt-svc: h3=":443"; ma=86400⟫', '', '# h3 = HTTP/3, ":443" = 同じホストの UDP 443,', '# ma = この情報の有効秒数')));
          await s.term('t', L('$ curl -sI https://www.cloudflare.com/ | grep -i \'^alt-svc\'', 'alt-svc: h3=":443"; ma=86400', '$ curl -sI --http3 https://www.cloudflare.com/ | head -1', 'HTTP/3 200'), { clear: true });
        },
      },
      {
        title: 'HTTP/3：失われたストリームだけが待つ',
        text: 'QUIC はストリームごとに順序を管理するので、stream 4 のパケットが失われても stream 0 と 8 はそのまま処理が進みます。クライアント発の双方向ストリーム ID は 0, 4, 8, …（下位 2 ビットが 00）。ヘッダ圧縮は順序に依存しない QPACK（RFC 9204）に置き換わっています。',
        code: { title: 'HTTP/1.1 / HTTP/2 / HTTP/3 の比較', lang: 'text', src: `
          HTTP/1.1  TCP        テキスト        多重化なし        ヘッダ圧縮なし
          HTTP/2    TCP+TLS    バイナリフレーム ストリーム(1,3,5) HPACK
          HTTP/3    QUIC/UDP   バイナリフレーム ストリーム(0,4,8) QPACK
                    ⟪ロスは失ったストリームだけに影響⟫` },
        run: async (s) => {
          await s.show('d1 d2 d3', { fx: 'left', stagger: 200 });
          await s.show('d4', { fx: 'pop' });
          s.shake('d4');
          await s.show('d5 d6', { fx: 'left', stagger: 200 });
          await s.show('d7', { fx: 'up' });
          det(s, 'QUIC のストリーム ID（RFC 9000 §2.1）', pre('text', L('ID 下位 2 bit: 0x0 = client 発・双方向  → 0, 4, 8, …', '              0x1 = server 発・双方向', '              0x2 = client 発・単方向（QPACK エンコーダ等）', '              0x3 = server 発・単方向', '', 'stream 4 のロス → stream 4 だけ再送待ち')));
          await s.caption('HTTP/3：同じ意味論を QUIC に載せ、ロスの影響をストリーム単位に閉じ込める', { cls: 'ok' });
        },
      },
    ],
  });
})();
