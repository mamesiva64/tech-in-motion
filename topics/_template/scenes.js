/* Template scenes — demonstrates every helper of the TIM engine (see AGENT.md §7). */
TIM.scene('#sc-demo', {
  intro: 'エンジンの主要ヘルパーを一通り使うサンプルです。<code>scenes.js</code> を見ながら書き換えてください。',
  steps: [
    {
      title: 'ターミナルでコマンドを打つ',
      text: '<code>s.show()</code> で要素を登場させ、<code>s.term()</code> でコマンドをタイプします。',
      code: { title: 'scenes.js', lang: 'js', src: `
        await s.show('t1');
        await s.term('t1', '$ curl -v https://app.example.com/');` },
      run: async (s) => {
        await s.show('t1');
        await s.term('t1', '$ curl -v https://app.example.com/\n* Connected to app.example.com (203.0.113.10) port 443');
      },
    },
    {
      title: 'パケットを飛ばし、接続線を残す',
      text: '<code>s.fly()</code> は一時的なパケット、<code>s.line()</code> は残る線です。',
      code: { title: 'HTTP request', lang: 'http', src: `
        GET / HTTP/1.1
        Host: ⟪app.example.com⟫
        User-Agent: curl/8.9.1
        Accept: */*` },
      run: async (s) => {
        s.line('client:r', 'server:l', { cls: 'flow', label: 'TLS 1.3 :443' });
        await s.fly('client:r', 'server:l', { label: 'GET /', arc: -40 });
        s.state('server', 'active');
      },
    },
    {
      title: '設定ファイルを出してスキャン',
      text: '<code>s.scan()</code> で「読み込み中」を表現し、<code>s.hl()</code> で下のコードの行を強調します。',
      code: { title: 'app.conf', lang: 'text', src: `
        server {
          listen 443 ssl;
          server_name app.example.com;
        }` },
      run: async (s) => {
        await s.show('f1', { fx: 'right' });
        s.hl([3]);
        await s.scan('f1');
      },
    },
    {
      title: 'ハッシュを計算して判子を押す',
      text: '<code>s.scramble()</code> で値が確定する演出、<code>s.stamp()</code> で結果を示します。',
      run: async (s) => {
        await s.show('hash', { fx: 'pop' });
        await s.scramble('hv', '9f86d081884c7d65…', { dur: 1000 });
        await s.stamp('server', 'VERIFIED', { cls: 'st-ok' });
        s.state('server', 'ok');
      },
    },
    {
      title: '失敗ケース',
      text: '<code>s.state(sel, "bad")</code> と <code>s.shake()</code>、<code>s.caption()</code> で失敗を強調します。',
      run: async (s) => {
        await s.fly('server:l', 'client:r', { label: '401', cls: 'c-red', arc: 40 });
        s.state('client', 'bad');
        s.shake('client');
        await s.caption('署名が一致しないため <code>401 Unauthorized</code>', { cls: 'bad' });
      },
    },
    {
      title: 'カメラでズーム',
      text: '<code>s.camera({ to, scale })</code> で注目箇所に寄ります。引数なしで戻ります。',
      run: async (s) => {
        await s.camera({ to: 'f1', scale: 1.6 });
        await s.wait(800);
        await s.camera();
      },
    },
  ],
});
