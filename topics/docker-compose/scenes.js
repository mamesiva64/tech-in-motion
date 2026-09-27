/* Docker Compose — scenes (see AGENT.md §7) */
(function () {
  'use strict';
  const esc = TIM.esc;
  /** file card inner HTML (header + highlighted pre) */
  const F = (title, lang, src) => '<div class="file-h">' + title + '</div><pre data-lang="' + lang + '">' + esc(TIM.dedent(src)) + '</pre>';
  /** append one colored output line to a .term-b that has data-el */
  const out = (s, sel, line, cls) => s.append(sel, '<div class="tl out ' + (cls || '') + '">' + (esc(line) || '&nbsp;') + '</div>', { fx: 'fade' });

  /* =====================================================================
   * SCENE 1 : docker compose up -d で作られるもの
   * ===================================================================*/
  TIM.scene('#sc-up', {
    intro: '<code>~/myapp</code> で <code>docker compose up -d</code> を実行したとき、Compose が「どのファイルを読み」「プロジェクト名を何にし」「Engine に何をどんな名前で作らせるか」を順に追います。右側の枠が Docker Engine（dockerd）の中に実際にできるリソースです。',
    steps: [
      {
        title: '<code>docker compose up -d</code> を実行する',
        text: '<code>-f</code> を付けないと、Compose はカレントディレクトリ（無ければ親ディレクトリ）から <code>compose.yaml</code> を探し、同じ場所の <code>compose.override.yaml</code> を自動でマージし、<code>.env</code> を変数展開用に読みます。この時点ではまだ Engine に何も作られていません。',
        code: { title: 'shell', lang: 'bash', src: `
          $ cd ~/myapp
          $ docker compose up -d
          # -f 省略時: compose.yaml（または docker-compose.yaml）を
          #   カレント → 親ディレクトリの順に探す
          # 同じディレクトリの ⟪compose.override.yaml⟫ は自動でマージ
          # 同じディレクトリの ⟪.env⟫ は \${...} の展開に使う

          # 明示する場合（このとき override は自動では読まれない）
          $ docker compose -f compose.yaml -f compose.override.yaml up -d` },
        run: async (s) => {
          s.state('tree', 'active');
          await s.term('t', '$ docker compose up -d');
          await s.scan('tree');
        },
      },
      {
        title: 'プロジェクト名を決める',
        text: '優先順位は <code>-p</code> ＞ 環境変数 <code>COMPOSE_PROJECT_NAME</code> ＞ トップレベルの <code>name:</code> ＞ compose.yaml のあるディレクトリ名。今回は <code>-p</code> も環境変数も無いので <code>name: myapp</code> が採用されます。この名前が、これから作るすべてのリソース名の接頭辞になります。',
        code: { title: 'プロジェクト名の決まり方', lang: 'bash', src: `
          $ docker compose -p staging up -d                    # 1. -p（最優先）
          $ COMPOSE_PROJECT_NAME=staging docker compose up -d  # 2. 環境変数
          # 3. compose.yaml のトップレベル   ⟪name: myapp⟫
          # 4. compose.yaml のあるディレクトリ名 → myapp
          # 使える文字: 英小文字・数字・- ・_（先頭は英小文字か数字）` },
        run: async (s) => {
          s.state('tree', null);
          s.state('pname', 'active');
          await s.scan('pname');
          s.state('k1 v1 k2 v2', 'dim');
          await s.cls('k3 v3', 'on');
          s.state('k4 v4', 'dim');
          await s.show('pres', { fx: 'pop' });
        },
      },
      {
        title: 'ネットワーク <code>myapp_default</code> を作る',
        text: 'サービスに <code>networks:</code> を書いていなければ、全サービス共用の bridge ネットワーク <code>&lt;project&gt;_default</code> が作られます。サブネットは Engine のアドレスプールから自動で割り当てられ（ここでは <code>172.18.0.0/16</code>）、ラベル <code>com.docker.compose.network=default</code> と <code>com.docker.compose.project=myapp</code> が付きます。',
        code: { title: 'docker network inspect myapp_default（抜粋）', lang: 'json', src: `
          [
            {
              "Name": "⟪myapp_default⟫",
              "Driver": "bridge",
              "IPAM": {
                "Config": [ { "Subnet": "172.18.0.0/16", "Gateway": "172.18.0.1" } ]
              },
              "Labels": {
                "com.docker.compose.config-hash": "…",
                "com.docker.compose.network": "default",
                "com.docker.compose.project": "myapp",
                "com.docker.compose.version": "5.5.1"
              }
            }
          ]` },
        run: async (s) => {
          s.state('pname', null);
          await s.append('tb', '<div class="tl out" data-el="uphdr">[+] up 1/5</div>', { fx: 'fade' });
          await s.term('t', '✔ Network myapp_default   Created   0.1s');
          await s.show('net', { fx: 'zoom' });
          s.pulse('net');
        },
      },
      {
        title: 'ボリューム <code>myapp_dbdata</code> を作る',
        text: 'トップレベル <code>volumes:</code> の <code>dbdata</code> は <code>&lt;project&gt;_dbdata</code> という名前で作られます。同名のボリュームが既にあれば作らずに再利用するので、2 回目以降の <code>up</code> でもデータは残ります（ラベルの project が違えば警告が出ます）。',
        code: { title: 'docker volume inspect myapp_dbdata（抜粋）', lang: 'json', src: `
          [
            {
              "CreatedAt": "2026-09-28T01:15:02Z",
              "Driver": "local",
              "Labels": {
                "com.docker.compose.config-hash": "…",
                "com.docker.compose.project": "myapp",
                "com.docker.compose.version": "5.5.1",
                "com.docker.compose.volume": "dbdata"
              },
              "Mountpoint": "⟪/var/lib/docker/volumes/myapp_dbdata/_data⟫",
              "Name": "myapp_dbdata",
              "Scope": "local"
            }
          ]` },
        run: async (s) => {
          s.text('uphdr', '[+] up 2/5', { flash: false });
          await s.term('t', '✔ Volume myapp_dbdata     Created   0.0s');
          await s.show('vol', { fx: 'pop' });
        },
      },
      {
        title: 'イメージを用意する（pull / build）',
        text: '<code>image:</code> だけのサービス（web, db）はローカルに無ければ pull、<code>build:</code> のある api はビルドします（初回の <code>up</code> ではこれらの進捗が先に表示されます）。<code>image:</code> を書いていない api のイメージ名は <code>&lt;project&gt;-&lt;service&gt;</code>、つまり <code>myapp-api</code> です。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker compose config --images      # 出力順は不定
          ⟪myapp-api⟫
          nginx:1.27-alpine
          postgres:16-alpine

          $ docker compose pull                 # image: のあるサービスだけ取得
          $ docker compose build api            # 毎回ビルドし直すなら up --build` },
        run: async (s) => {
          await s.show('imgl', { fx: 'fade' });
          await s.show('i1 i2 i3', { fx: 'left', stagger: 160 });
          s.pulse('i3');
        },
      },
      {
        title: 'db コンテナ <code>myapp-db-1</code> を作って起動する',
        text: 'コンテナ名は <code>&lt;project&gt;-&lt;service&gt;-&lt;番号&gt;</code>。Compose は全コンテナを作成したうえで依存関係の順（db → api → web）に起動します。api が <code>condition: service_healthy</code> を要求しているので、db の healthcheck が通るまで待ち、db の行は最終的に <code>Healthy</code> になります。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker ps --filter name=myapp-db --format '{{.Names}}  {{.Status}}'
          ⟪myapp-db-1⟫  Up 6 seconds (healthy)

          # 名前の規則: <project>-<service>-<container-number>
          #   v1 (docker-compose) は myapp_db_1 だった` },
        run: async (s) => {
          s.text('uphdr', '[+] up 3/5', { flash: false });
          await s.show('cdb');
          s.line('vol:t', 'cdb:b', { cls: 'acc', label: 'mount', id: 'lmount' });
          await s.term('t', '✔ Container myapp-db-1    Healthy   6.3s');
          s.state('cdb', 'ok');
        },
      },
      {
        title: 'api → web の順に起動する',
        text: 'db が healthy になった時点で api（<code>myapp-api-1</code>）を起動し、api が running になったら web を起動します（web は短縮形 <code>depends_on: [api]</code> なので「起動した」ことしか待ちません）。<code>ports</code> を持つのは web だけで、ホストの <code>0.0.0.0:8080</code> が web の 80 番に転送されます。',
        code: { title: 'docker compose up -d の最終出力（v5 系）', lang: 'text', src: `
          [+] up 5/5
           ✔ Network myapp_default   Created   0.1s
           ✔ Volume myapp_dbdata     Created   0.0s
           ✔ Container myapp-db-1    Healthy   6.3s
           ✔ Container myapp-api-1   ⟪Started⟫   6.5s
           ✔ Container myapp-web-1   ⟪Started⟫   6.7s` },
        run: async (s) => {
          s.text('uphdr', '[+] up 4/5', { flash: false });
          await s.show('capi');
          await s.term('t', '✔ Container myapp-api-1   Started   6.5s');
          s.state('capi', 'ok');
          s.text('uphdr', '[+] up 5/5', { flash: false });
          await s.show('cweb');
          await s.term('t', '✔ Container myapp-web-1   Started   6.7s');
          s.state('cweb', 'ok');
        },
      },
      {
        title: '作ったものすべてにラベルが貼られる',
        text: 'コンテナには <code>com.docker.compose.project</code>（プロジェクト）、<code>service</code>、<code>container-number</code>、<code>oneoff</code>（<code>run</code> で作った一時コンテナなら <code>True</code>）、<code>config-hash</code>（設定のハッシュ。変わると <code>up</code> が作り直す）などのラベルが付きます。api の <code>depends_on</code> ラベルは <code>db:service_healthy:false</code> です。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker inspect myapp-db-1 --format '{{json .Config.Labels}}' | jq
          {
            "com.docker.compose.config-hash": "8d0c5e2f…",
            "com.docker.compose.container-number": "1",
            "com.docker.compose.depends_on": "",
            "com.docker.compose.image": "sha256:…",
            "com.docker.compose.oneoff": "False",
            "com.docker.compose.project": "⟪myapp⟫",
            "com.docker.compose.project.config_files": "/home/alice/myapp/compose.yaml,/home/alice/myapp/compose.override.yaml",
            "com.docker.compose.project.working_dir": "/home/alice/myapp",
            "com.docker.compose.service": "⟪db⟫",
            "com.docker.compose.version": "5.5.1"
          }

          $ docker inspect myapp-api-1 \\
              --format '{{index .Config.Labels "com.docker.compose.depends_on"}}'
          db:service_healthy:false` },
        run: async (s) => {
          s.state('cdb capi cweb', null);
          await s.hide('tree pname pres', { dur: 250 });
          await s.show('lbl', { fx: 'up' });
          s.state('cdb', 'active');
          await s.scan('lbl');
        },
      },
      {
        title: 'Compose は状態ファイルを持たない — ラベルで探す',
        text: 'Compose は「自分が何を作ったか」をどこにも保存しません。<code>ps</code> / <code>down</code> / 2 回目の <code>up</code> のたびに、Engine に <b><code>label=com.docker.compose.project=myapp</code></b> で問い合わせて自分のリソースを見つけます。だからプロジェクト名が変わると、既存のコンテナやボリュームは「別プロジェクトのもの」になります。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker ps --filter ⟪label=com.docker.compose.project=myapp⟫ --format '{{.Names}}'
          myapp-web-1
          myapp-api-1
          myapp-db-1

          $ docker compose ls
          NAME      STATUS       CONFIG FILES
          myapp     running(3)   /home/alice/myapp/compose.yaml,/home/alice/myapp/compose.override.yaml` },
        run: async (s) => {
          s.state('cdb', null);
          await s.term('t', `
            $ docker compose ps --format 'table {{.Name}}\\t{{.Service}}\\t{{.Status}}'
            NAME          SERVICE   STATUS
            myapp-api-1   api       Up 12 seconds
            myapp-db-1    db        Up 18 seconds (healthy)
            myapp-web-1   web       Up 11 seconds`, { clear: true });
          await s.pulse('cweb capi cdb vol net');
          s.state('cweb capi cdb', 'ok');
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 2 : サービス名での名前解決
   * ===================================================================*/
  TIM.scene('#sc-dns', {
    intro: 'api コンテナが <code>db</code> という名前をどうやって IP アドレスに変えているのかを、コンテナ内の <code>/etc/resolv.conf</code> から追います。後半は、ホスト（ブラウザ）から入る経路＝<code>ports</code> と、コンテナ同士の経路の違いを見ます。',
    steps: [
      {
        title: 'api コンテナの <code>/etc/resolv.conf</code>',
        text: 'ユーザー定義ネットワーク（Compose の <code>myapp_default</code> もそう）に参加したコンテナでは、Docker Engine が <code>/etc/resolv.conf</code> を生成し <code>nameserver 127.0.0.11</code> を書き込みます。127.0.0.11 はコンテナ自身の loopback 上のアドレスで、そこへの DNS クエリを dockerd の組み込み DNS が受けて答えます。',
        code: { title: 'docker compose exec api cat /etc/resolv.conf', lang: 'text', src: `
          # Generated by Docker Engine.
          # This file can be edited; Docker Engine will not make further changes once it
          # has been modified.

          ⟪nameserver 127.0.0.11⟫
          options ndots:0

          # Based on host file: '/etc/resolv.conf' (internal resolver)
          # ExtServers: [192.168.1.1]
          # Overrides: []
          # Option ndots from: internal` },
        run: async (s) => {
          s.state('api', 'active');
          await s.show('resolv', { fx: 'left' });
          await s.term('t', `
            $ docker compose exec api grep nameserver /etc/resolv.conf
            nameserver 127.0.0.11`);
        },
      },
      {
        title: '<code>db</code> を問い合わせる',
        text: 'api が <code>db</code> を名前解決すると、クエリは <code>127.0.0.11:53</code> に送られます。組み込み DNS は同じネットワーク <code>myapp_default</code> 上のサービス名 <code>db</code> を知っているので、db コンテナの IP <code>172.18.0.2</code> を A レコードで返します。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker compose exec api getent hosts db
          ⟪172.18.0.2⟫      db

          # 別ネットワークのコンテナや、存在しない名前は引けない
          $ docker compose exec api getent hosts nosuchservice; echo "exit=$?"
          exit=2` },
        run: async (s) => {
          s.state('api', 'active');
          await s.fly('api:t', 'dns:l', { label: 'A? db', arc: 30 });
          s.state('dns', 'active');
          await s.scan('dns');
          await s.fly('dns:b', 'api:r', { label: '172.18.0.2', arc: 30 });
          await s.show('ans', { fx: 'right' });
          await s.term('t', `
            $ docker compose exec api getent hosts db
            172.18.0.2      db`);
        },
      },
      {
        title: '引ける名前は 3 種類',
        text: '組み込み DNS には、サービス名 <code>db</code>、コンテナ名 <code>myapp-db-1</code>、コンテナ ID の先頭 12 桁が登録されます（Engine 25 以降は <code>DNSNames</code> で確認できます。並び順はバージョンで異なります）。<code>--scale</code> で同じサービスのコンテナが複数あると、<code>db</code> は全コンテナ分の A レコードを返します。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker inspect myapp-db-1 \\
              --format '{{json .NetworkSettings.Networks}}' | jq '.myapp_default | {IPAddress, DNSNames}'
          {
            "IPAddress": "172.18.0.2",
            "DNSNames": [
              "myapp-db-1",
              "⟪db⟫",
              "3f2a9c1b7d4e"
            ]
          }` },
        run: async (s) => {
          s.state('dns', null);
          s.state('api', null);
          await s.show('names', { fx: 'right' });
          s.state('db', 'active');
          await s.term('t', `
            $ docker compose exec api getent hosts myapp-db-1
            172.18.0.2      myapp-db-1`);
        },
      },
      {
        title: 'api → <code>db:5432</code> に TCP 接続',
        text: '名前が IP になれば、あとは普通の TCP 接続です。宛先は <b>コンテナ側のポート 5432</b>。db の compose.yaml 本体には <code>ports:</code> がありませんが、同じネットワーク内の通信にポート公開は必要ありません。',
        code: [
          { title: 'compose.yaml（api）', lang: 'yaml', src: `
            environment:
              DATABASE_URL: postgres://app:\${POSTGRES_PASSWORD}@⟪db:5432⟫/app` },
          { title: 'docker compose logs api', lang: 'text', src: `
            api-1  | db reachable at db:5432
            api-1  | api listening on :3000` },
        ],
        run: async (s) => {
          s.state('db', null);
          s.state('api', 'active');
          s.line('api:r', 'db:l', { cls: 'acc', label: 'TCP 5432', ly: -16, id: 'ladb' });
          await s.fly('api:r', 'db:l', { label: 'SYN', dur: 800 });
          s.state('db', 'ok');
          await s.term('t', `
            $ docker compose logs api
            api-1  | db reachable at db:5432
            api-1  | api listening on :3000`);
        },
      },
      {
        title: 'ブラウザ → ホスト <code>:8080</code> → web <code>:80</code>',
        text: 'ホストの外から入れるのは <code>ports</code> で公開したポートだけです。<code>"8080:80"</code> により、dockerd がホストの <code>0.0.0.0:8080</code> 宛ての通信を web コンテナの <code>172.18.0.4:80</code> へ転送します（iptables の DNAT ルールと docker-proxy）。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker compose port web 80
          0.0.0.0:8080

          $ curl -sI http://localhost:8080/
          HTTP/1.1 200 OK
          Server: nginx
          Content-Type: text/html` },
        run: async (s) => {
          s.state('api db', null);
          await s.fly('browser:b', 'hostport:t', { label: 'GET / :8080', dur: 700 });
          s.state('hostport', 'active');
          s.line('hostport:r', 'web:l', { cls: 'acc', id: 'lweb' });
          await s.fly('hostport:r', 'web:l', { label: ':80', dur: 800 });
          s.state('web', 'ok');
          await s.term('t', `
            $ curl -sI http://localhost:8080/ | head -1
            HTTP/1.1 200 OK`);
        },
      },
      {
        title: 'web（nginx）→ <code>api:3000</code>',
        text: 'nginx の <code>proxy_pass http://api:3000/</code> も同じ組み込み DNS で <code>api</code> を解決します。nginx は起動時（設定読み込み時）に名前を解決して IP を保持するため、api コンテナを作り直して IP が変わると 502 になることがあります（→ ハマりどころ）。',
        code: [
          { title: 'web/nginx.conf', lang: 'text', src: `
            location /api/ {
                proxy_pass http://⟪api:3000⟫/;
            }` },
          { title: 'shell', lang: 'bash', src: `
            $ curl -s http://localhost:8080/api/health
            {"status":"ok","db":"up","env":"development"}` },
        ],
        run: async (s) => {
          s.state('hostport', null);
          s.state('web', 'active');
          s.line('web:b', 'api:t', { cls: 'acc', label: 'proxy_pass api:3000', id: 'lapi' });
          await s.fly('web:b', 'api:t', { label: '/health', dur: 800 });
          s.state('api', 'ok');
          await s.term('t', `
            $ curl -s http://localhost:8080/api/health
            {"status":"ok","db":"up","env":"development"}`);
        },
      },
      {
        title: '知らない名前はホストの DNS へ転送',
        text: 'サービス名でもコンテナ名でもない名前（例: <code>repo.example.com</code>）は、組み込み DNS がホストの <code>/etc/resolv.conf</code> 由来の上流サーバー（resolv.conf のコメント <code>ExtServers</code> に出ているもの）へ転送し、その答えをコンテナに返します。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker compose exec api getent hosts repo.example.com
          203.0.113.10    repo.example.com

          $ docker compose exec api grep ExtServers /etc/resolv.conf
          # ExtServers: [⟪192.168.1.1⟫]` },
        run: async (s) => {
          s.state('web api', null);
          s.text('qn', 'repo.example.com', { flash: false });
          s.text('qa', '203.0.113.10', { flash: false });
          await s.show('hostdns', { fx: 'right' });
          await s.fly('api:t', 'dns:l', { label: 'A? repo.example.com', arc: 30 });
          s.state('dns', 'active');
          await s.fly('dns:r', 'hostdns:t', { label: 'forward', arc: -20, dur: 800 });
          s.state('hostdns', 'ok');
          await s.fly('hostdns:t', 'dns:r', { label: '203.0.113.10', arc: -20, dur: 800 });
          await s.pulse('ans');
          await s.term('t', `
            $ docker compose exec api getent hosts repo.example.com
            203.0.113.10    repo.example.com`);
        },
      },
      {
        title: 'db はホストからは見えない（override の分だけ例外）',
        text: 'PORTS 列の <code>0.0.0.0:8080-&gt;80/tcp</code> のように <code>-&gt;</code> があるものだけがホストに公開されています。api の <code>3000/tcp</code> は「コンテナが待ち受けるポート」の表示にすぎません。db の <code>127.0.0.1:5432-&gt;5432/tcp</code> は開発用の compose.override.yaml が足したもので、ホスト自身からしか届きません。api → db の通信はこの公開とは無関係です。',
        code: { title: 'docker compose ps（PORTS 列）', lang: 'text', src: `
          NAME          IMAGE                SERVICE   STATUS                   PORTS
          myapp-api-1   myapp-api            api       Up 2 minutes             3000/tcp
          myapp-db-1    postgres:16-alpine   db        Up 2 minutes (healthy)   ⟪127.0.0.1:5432->5432/tcp⟫
          myapp-web-1   nginx:1.27-alpine    web       Up 2 minutes             ⟪0.0.0.0:8080->80/tcp⟫, [::]:8080->80/tcp` },
        run: async (s) => {
          s.state('dns hostdns', null);
          s.state('api db web', null);
          await s.term('t', `
            $ docker compose ps --format 'table {{.Name}}\\t{{.Ports}}'
            NAME          PORTS
            myapp-api-1   3000/tcp
            myapp-db-1    127.0.0.1:5432->5432/tcp
            myapp-web-1   0.0.0.0:8080->80/tcp, [::]:8080->80/tcp`);
          s.stamp('db', '127.0.0.1 ONLY', { cls: 'st-warn', pos: 'br' });
          await s.stamp('web', '0.0.0.0:8080', { cls: 'st-ok', pos: 'br' });
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 3 : depends_on + healthcheck
   * ===================================================================*/
  const HJ = (src) => F('docker inspect myapp-db-1 → .State.Health', 'json', src);
  const PS = '$ docker compose ps -a --format \'table {{.Name}}\\t{{.Status}}\'';
  TIM.scene('#sc-order', {
    intro: 'api は <code>depends_on: { db: { condition: service_healthy } }</code>、web は <code>depends_on: [api]</code>。db の healthcheck は <code>pg_isready -h 127.0.0.1</code> を 5 秒ごとに実行します。初回起動（ボリュームが空）のとき、各コンテナがいつ起動するかを追います。',
    steps: [
      {
        title: '全コンテナを作成し、依存グラフを決める',
        text: 'Compose はまず 3 つのコンテナをすべて <b>作成</b>（Created）し、<code>depends_on</code> から起動順 db → api → web を決めます。矢印は「依存元 → 依存先」、ラベルは待つ条件です。',
        code: { title: 'compose.yaml（depends_on）', lang: 'yaml', src: `
          services:
            web:
              depends_on:
                - api                     # = condition: service_started
            api:
              depends_on:
                db:
                  condition: ⟪service_healthy⟫` },
        run: async (s) => {
          s.line('api:t', 'db:b', { cls: 'warn', label: 'service_healthy', id: 'd1' });
          await s.line('web:t', 'api:b', { label: 'service_started', id: 'd2' });
          s.text('sdb', 'Created', { flash: false });
          s.text('sapi', 'Created', { flash: false });
          s.text('sweb', 'Created', { flash: false });
          await s.show('sdb sapi sweb', { fx: 'left' });
          await s.term('ps', `
            ${PS}
            NAME          STATUS
            myapp-api-1   Created
            myapp-db-1    Created
            myapp-web-1   Created`);
        },
      },
      {
        title: 'db だけを起動する（health: starting）',
        text: '依存先を持たない db が最初に起動します。healthcheck を持つコンテナは起動直後 <code>starting</code> 状態で、<code>docker compose ps</code> の STATUS には <code>(health: starting)</code> と出ます。api と web は Created のまま待機します。',
        code: { title: 'compose.yaml（db の healthcheck）', lang: 'yaml', src: `
          healthcheck:
            test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U $\${POSTGRES_USER} -d $\${POSTGRES_DB}"]
            interval: 5s        # 5 秒ごとに実行
            timeout: 3s
            retries: 5          # 5 回連続失敗で unhealthy
            start_period: 10s   # 起動後 10 秒間の失敗は数えない` },
        run: async (s) => {
          s.state('db', 'active');
          s.text('sdb', 'running · health: starting');
          s.state('sdb', 'warn');
          await s.show('health', { fx: 'right' });
          await s.term('ps', `
            ${PS}
            NAME          STATUS
            myapp-api-1   Created
            myapp-db-1    Up 1 second (health: starting)
            myapp-web-1   Created`, { clear: true });
        },
      },
      {
        title: 'initdb と「Unix ソケットだけの」一時サーバー',
        text: 'ボリュームが空なので、公式イメージの <code>docker-entrypoint.sh</code> が <code>initdb</code> を実行し、ユーザーと DB <code>app</code> を作るために <b>Unix ソケットだけで待ち受ける一時サーバー</b>を起動します。この間、TCP の 5432 番はまだ誰も待ち受けていません。',
        code: { title: 'docker compose logs db', lang: 'text', src: `
          db-1  | The files belonging to this database system will be owned by user "postgres".
          db-1  | …
          db-1  | Success. You can now start the database server using:
          db-1  | …
          db-1  | waiting for server to start.... done
          db-1  | server started
          db-1  | CREATE DATABASE
          db-1  | /usr/local/bin/docker-entrypoint.sh: ignoring /docker-entrypoint-initdb.d/*
          db-1  | waiting for server to shut down.... done
          db-1  | server stopped` },
        run: async (s) => {
          s.state('db', 'active');
          await s.term('dblog', `
            The files belonging to this database system will be owned by user "postgres".
            …
            Success. You can now start the database server using:
            waiting for server to start.... done
            server started
            CREATE DATABASE`);
          s.cls('dblog', 'c-amber');
          await s.scan('db');
        },
      },
      {
        title: '1 回目の healthcheck は失敗（start_period 中なので数えない）',
        text: '起動から 5 秒後、Engine がコンテナ内で <code>pg_isready -h 127.0.0.1</code> を実行します。TCP で待ち受けている相手がいないので <code>no response</code>（終了コード 2）。ただし <code>start_period</code>（10 秒）の間の失敗は <code>FailingStreak</code> に数えられず、状態は <code>starting</code> のままです。Compose はこの間 <code>Waiting</code> を表示して 500 ms ごとに状態を確認しています。',
        code: [
          { title: 'docker inspect --format \'{{json .State.Health}}\' myapp-db-1 | jq', lang: 'json', src: `
            {
              "Status": "starting",
              "FailingStreak": 0,
              "Log": [
                {
                  "Start": "2026-09-28T01:15:07.102Z",
                  "End": "2026-09-28T01:15:07.141Z",
                  "ExitCode": ⟪2⟫,
                  "Output": "127.0.0.1:5432 - ⟪no response⟫\\n"
                }
              ]
            }` },
          { title: 'docker compose up の表示', lang: 'text', src: `
            ⠧ Container myapp-db-1    Waiting` },
        ],
        run: async (s) => {
          await s.scan('db', { cls: 'c-amber' });
          await s.set('health', HJ(`
            {
              "Status": "starting",
              "FailingStreak": 0,
              "Log": [{
                "ExitCode": 2,
                "Output": "127.0.0.1:5432 - no response\\n"
              }]
            }`));
          s.state('health', 'warn');
          s.text('sapi', 'Created · Waiting for db');
        },
      },
      {
        title: '初期化が終わり、本番のサーバーが TCP で待ち受ける',
        text: '一時サーバーを止めたあと <code>PostgreSQL init process complete; ready for start up.</code> を出し、今度は <code>listen_addresses=\'*\'</code> で本番のサーバーを起動します。<code>database system is ready to accept connections</code> が出た時点で、他のコンテナから <code>db:5432</code> に接続できます。',
        code: { title: 'docker compose logs db（続き）', lang: 'text', src: `
          db-1  | waiting for server to shut down.... done
          db-1  | server stopped
          db-1  | ⟪PostgreSQL init process complete; ready for start up.⟫
          db-1  | … [1] LOG:  starting PostgreSQL 16.x on x86_64-pc-linux-musl, …
          db-1  | … [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432
          db-1  | … [1] LOG:  listening on IPv6 address "::", port 5432
          db-1  | … [1] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"
          db-1  | … [1] LOG:  ⟪database system is ready to accept connections⟫` },
        run: async (s) => {
          s.state('health', null);
          await s.term('dblog', `
            waiting for server to shut down.... done
            server stopped
            PostgreSQL init process complete; ready for start up.
            … LOG:  listening on IPv4 address "0.0.0.0", port 5432
            … LOG:  database system is ready to accept connections`);
          s.cls('dblog', 'c-green', 'c-amber');
          await s.pulse('dblog');
        },
      },
      {
        title: '次の healthcheck が成功 → <code>healthy</code>',
        text: '次のチェックで <code>127.0.0.1:5432 - accepting connections</code>（終了コード 0）。<code>Status</code> が <code>healthy</code> になり、Compose の表示も <code>Waiting</code> から <code>Healthy</code> に変わります。',
        code: [
          { title: 'docker inspect --format \'{{json .State.Health}}\' myapp-db-1 | jq', lang: 'json', src: `
            {
              "Status": "⟪healthy⟫",
              "FailingStreak": 0,
              "Log": [
                { "ExitCode": 2, "Output": "127.0.0.1:5432 - no response\\n", … },
                { "ExitCode": 0, "Output": "127.0.0.1:5432 - accepting connections\\n", … }
              ]
            }` },
          { title: 'docker compose up の表示', lang: 'text', src: `
            ✔ Container myapp-db-1    ⟪Healthy⟫` },
        ],
        run: async (s) => {
          await s.scan('db');
          await s.set('health', HJ(`
            {
              "Status": "healthy",
              "FailingStreak": 0,
              "Log": [{
                "ExitCode": 0,
                "Output": "127.0.0.1:5432 - accepting connections\\n"
              }]
            }`));
          s.state('health', 'ok');
          s.state('db', 'ok');
          s.text('sdb', 'running · healthy');
          s.state('sdb', 'ok');
          await s.term('ps', `
            ${PS}
            NAME          STATUS
            myapp-api-1   Created
            myapp-db-1    Up 11 seconds (healthy)
            myapp-web-1   Created`, { clear: true });
        },
      },
      {
        title: 'ここで初めて api を起動',
        text: '<code>service_healthy</code> を満たしたので api を起動します。api は起動直後に <code>db:5432</code> へ接続し、今度は成功します。',
        code: { title: 'docker compose logs api', lang: 'text', src: `
          api-1  | db reachable at db:5432
          api-1  | api listening on :3000` },
        run: async (s) => {
          s.state('health', null);
          s.text('sapi', 'running');
          s.state('sapi', 'ok');
          s.state('api', 'ok');
          await s.fly('api:t', 'db:b', { label: 'db:5432', dur: 700 });
          await s.term('ps', `
            ${PS}
            NAME          STATUS
            myapp-api-1   Up 1 second
            myapp-db-1    Up 12 seconds (healthy)
            myapp-web-1   Created`, { clear: true });
        },
      },
      {
        title: 'web は api が「起動した」だけで起動',
        text: 'web の依存は短縮形（<code>service_started</code>）なので、api が running になった時点で起動します。api の準備完了（3000 番で待ち受け）までは待っていない点に注意してください。',
        code: { title: 'docker compose up -d の最終出力', lang: 'text', src: `
          [+] up 5/5
           ✔ Network myapp_default   Created   0.1s
           ✔ Volume myapp_dbdata     Created   0.0s
           ✔ Container myapp-db-1    Healthy  11.2s
           ✔ Container myapp-api-1   Started  11.4s
           ✔ Container myapp-web-1   Started  11.6s` },
        run: async (s) => {
          s.text('sweb', 'running');
          s.state('sweb', 'ok');
          s.state('web', 'ok');
          await s.term('ps', `
            ${PS}
            NAME          STATUS
            myapp-api-1   Up 2 seconds
            myapp-db-1    Up 13 seconds (healthy)
            myapp-web-1   Up 1 second`, { clear: true });
        },
      },
      {
        title: '<code>--wait</code> で「全部そろうまで」待つ',
        text: '<code>up -d</code> は起動を命じた時点で戻りますが、<code>up --wait</code>（<code>-d</code> を含む）は全サービスが running（healthcheck があれば healthy）になるまで戻りません。CI でテストを流す前などに使います。<code>--wait-timeout</code> で上限秒数を指定でき、失敗すると終了コードが 0 以外になります。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker compose up --wait --wait-timeout 60
          [+] up 5/5
           ✔ Network myapp_default   Created
           ✔ Volume myapp_dbdata     Created
           ✔ Container myapp-db-1    Healthy
           ✔ Container myapp-api-1   Healthy   # healthcheck が無いサービスは running で OK
           ✔ Container myapp-web-1   Healthy
          $ echo $?
          0` },
        run: async (s) => {
          s.stamp('db', 'HEALTHY', { cls: 'st-ok' });
          s.stamp('api', 'RUNNING', { cls: 'st-ok' });
          await s.stamp('web', 'RUNNING', { cls: 'st-ok' });
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 4 : 設定の解決
   * ===================================================================*/
  const OUT = (src) => F('docker compose config（抜粋）', 'yaml', src);
  TIM.scene('#sc-config', {
    intro: '左の 4 つのファイルが、Compose の中で <b>interpolate（変数展開）→ merge（override の統合）→ normalize（env_file の取り込みや長い書式への展開）</b> を経て、右の「最終形」になるまでを追います。',
    steps: [
      {
        title: '読み込むファイルを集める',
        text: '<code>compose.yaml</code> と、同じディレクトリの <code>compose.override.yaml</code> を読み込みます。<code>.env</code> は<b>プロジェクトディレクトリ</b>（通常は compose.yaml の場所）から読まれ、YAML 内の <code>${...}</code> の展開にだけ使われます。<code>api/api.env</code> は <code>env_file:</code> で参照されているので、後でコンテナの環境変数になります。',
        code: { title: '展開に使う変数の優先順位', lang: 'bash', src: `
          # 1. シェルの環境変数          （最優先）
          $ POSTGRES_PASSWORD=override docker compose config
          # 2. --env-file で指定したファイル
          $ docker compose --env-file ./prod.env config
          # 3. プロジェクトディレクトリの .env
          $ cat .env
          POSTGRES_PASSWORD=devpass
          APP_PORT=8080` },
        run: async (s) => {
          s.state('proc', 'active');
          s.scan('base ovr', { dur: 700 });
          await s.scan('env apienv', { dur: 700 });
          await s.show('out', { fx: 'fade' });
        },
      },
      {
        title: '<code>${POSTGRES_PASSWORD}</code> を展開する',
        text: 'interpolate の段階で、YAML の<b>値の中</b>にある <code>${POSTGRES_PASSWORD}</code> が <code>.env</code> の <code>devpass</code> に置き換わります。コンテナが起動する前に、Compose が文字列として埋め込む点に注意してください。',
        code: { title: 'compose.yaml → 展開後', lang: 'diff', src: `
          -      DATABASE_URL: postgres://app:\${POSTGRES_PASSWORD}@db:5432/app
          +      DATABASE_URL: postgres://app:devpass@db:5432/app` },
        run: async (s) => {
          await s.cls('p1', 'on');
          await s.fly('env:b', 'base:t', { label: 'POSTGRES_PASSWORD=devpass', dur: 800 });
          await s.set('out', OUT(`
            name: myapp
            services:
              api:
                environment:
                  DATABASE_URL: postgres://app:⟪devpass⟫@db:5432/app
                  NODE_ENV: production`));
        },
      },
      {
        title: '<code>${APP_PORT:-8080}</code> — 既定値付きの展開',
        text: '<code>:-</code> は「未定義または空なら既定値」。<code>.env</code> に <code>APP_PORT=8080</code> があるのでその値が使われます。短い書式 <code>"8080:80"</code> は、正規化で <code>target</code> / <code>published</code> / <code>protocol</code> に分解された長い書式になります。',
        code: { title: '展開の書式', lang: 'yaml', src: `
          ports: ["\${APP_PORT:-8080}:80"]     # 未定義/空なら 8080
          # \${VAR-default}      未定義のときだけ default
          # \${VAR:?message}     未定義/空ならエラーで停止
          # \${VAR:+replacement} 定義済みで空でなければ replacement
          # $$                  リテラルの $（コンテナ側のシェルに渡す）` },
        run: async (s) => {
          await s.fly('env:b', 'base:t', { label: 'APP_PORT=8080', dur: 700 });
          await s.set('out', OUT(`
            name: myapp
            services:
              api:
                environment:
                  DATABASE_URL: postgres://app:devpass@db:5432/app
                  NODE_ENV: production
              web:
                ports:
                  - mode: ingress
                    target: 80
                    published: "⟪8080⟫"
                    protocol: tcp`));
          s.cls('p1', 'done', 'on');
        },
      },
      {
        title: 'compose.override.yaml をマージする',
        text: 'merge の規則はキーごとに違います。<code>environment</code> は<b>変数名単位で後勝ち</b>（<code>NODE_ENV</code> だけ <code>development</code> に、<code>DATABASE_URL</code> は残る）、<code>command</code> は<b>置き換え</b>、<code>volumes</code> は<b>コンテナ側パス単位で統合</b>、<code>ports</code> は<b>連結</b>（db に <code>127.0.0.1:5432:5432</code> が追加）です。',
        code: { title: 'マージ規則', lang: 'text', src: `
          置き換え : image, command, mem_limit などの単一値
          連結     : ports, expose, external_links, dns, dns_search, tmpfs
          キー統合 : environment, labels      … 変数名/ラベル名で後勝ち
                     volumes, devices         … コンテナ側のパスで後勝ち` },
        run: async (s) => {
          await s.cls('p2', 'on');
          s.state('ovr', 'active');
          await s.fly('ovr:r', 'out:l', { label: 'merge', dur: 800 });
          await s.set('out', OUT(`
            name: myapp
            services:
              api:
                command:
                  - node
                  - --watch
                  - src/server.js
                environment:
                  DATABASE_URL: postgres://app:devpass@db:5432/app
                  NODE_ENV: ⟪development⟫
                volumes:
                  - type: bind
                    source: /home/alice/myapp/api/src
                    target: /app/src`));
          s.state('ovr', null);
        },
      },
      {
        title: '<code>env_file</code> を取り込む',
        text: 'normalize の段階で、<code>env_file</code> の <code>LOG_LEVEL</code> / <code>PORT</code> がサービスの <code>environment</code> に取り込まれます（<code>environment</code> に同じキーがあればそちらが優先）。<code>api.env</code> の値は compose.yaml の <code>${...}</code> 展開には<b>使われません</b>。',
        code: { title: 'api/api.env', lang: 'ini', src: `
          LOG_LEVEL=info
          PORT=3000
          # ↑ コンテナの環境変数になる。compose.yaml の \${PORT} には使われない` },
        run: async (s) => {
          s.cls('p2', 'done', 'on');
          await s.cls('p3', 'on');
          await s.fly('apienv:r', 'out:t', { label: 'env_file', dur: 800, arc: -30 });
          await s.set('out', OUT(`
            name: myapp
            services:
              api:
                command:
                  - node
                  - --watch
                  - src/server.js
                environment:
                  DATABASE_URL: postgres://app:devpass@db:5432/app
                  ⟪LOG_LEVEL: info⟫
                  NODE_ENV: development
                  ⟪PORT: "3000"⟫
                …`));
        },
      },
      {
        title: '<code>docker compose config</code> で最終形を見る',
        text: '<code>docker compose config</code> は、これらをすべて済ませた最終形を表示します。トップレベルには実際の名前 <code>myapp_default</code> / <code>myapp_dbdata</code> も現れます。<code>-q</code> なら検証だけ、<code>--no-interpolate</code> なら展開前、<code>--no-env-resolution</code> なら env_file を取り込む前の形です。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker compose config -q && echo valid
          valid
          $ docker compose config --services
          api
          db
          web
          $ docker compose config --no-interpolate | grep DATABASE_URL
                DATABASE_URL: postgres://app:\${POSTGRES_PASSWORD}@db:5432/app` },
        run: async (s) => {
          s.cls('p3', 'done', 'on');
          s.state('proc', 'ok');
          await s.set('out', OUT(`
            name: ⟪myapp⟫
            services:
              api:
                …
                environment:
                  DATABASE_URL: postgres://app:devpass@db:5432/app
                  LOG_LEVEL: info
                  NODE_ENV: development
                  PORT: "3000"
            networks:
              default:
                name: ⟪myapp_default⟫
            volumes:
              dbdata:
                name: ⟪myapp_dbdata⟫`));
          await s.term('t', '$ docker compose config -q && echo valid\nvalid');
        },
      },
      {
        title: 'コンテナの中の環境変数を確かめる',
        text: '最終形の <code>environment</code> がそのままコンテナの環境変数になります。<code>.env</code> の <code>APP_PORT</code> は展開に使われただけなので、コンテナの中には存在しません。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker compose exec api printenv NODE_ENV LOG_LEVEL
          development
          info
          $ docker compose exec api printenv APP_PORT; echo "exit=$?"
          exit=1` },
        run: async (s) => {
          s.state('proc', null);
          await s.term('t', `
            $ docker compose exec api printenv NODE_ENV LOG_LEVEL
            development
            info`);
        },
      },
      {
        title: '失敗：必須の変数が <code>.env</code> で空だったら',
        text: 'db の <code>POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}</code> は「未定義または空ならエラー」の書式です。<code>.env</code> の値が空になっていると、コンテナを 1 つも作る前に interpolate の段階で停止します。<code>:?</code> を使わない <code>${VAR}</code> だと、変数が未定義でも警告だけ出して<b>空文字のまま</b>進んでしまいます。',
        code: { title: 'shell', lang: 'bash', src: `
          $ sed -i 's/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=/' .env     # 値を空にする
          $ docker compose config
          error while interpolating services.db.environment.POSTGRES_PASSWORD: ⟪required variable POSTGRES_PASSWORD is missing a value⟫: set POSTGRES_PASSWORD in .env

          # 参考: 未定義の変数を :? なしの \${VAR} で参照したときは警告だけ
          WARN[0000] The "POSTGRES_PASSWORD" variable is not set. Defaulting to a blank string.` },
        run: async (s) => {
          await s.set('env', F('.env（展開用）', 'ini', `
            ⟪POSTGRES_PASSWORD⟫=
            APP_PORT=8080`));
          s.state('env', 'bad');
          s.cls('p1', 'bad', 'done');
          s.cls('p2 p3', null, 'done');
          s.state('proc', 'bad');
          s.state('out', 'dim');
          await s.term('t', '$ docker compose config', { clear: true });
          await out(s, 'ctb', 'error while interpolating services.db.environment.POSTGRES_PASSWORD: required variable POSTGRES_PASSWORD is missing a value: set POSTGRES_PASSWORD in .env', 'bad');
          s.shake('proc');
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 5 : ボリューム
   * ===================================================================*/
  TIM.scene('#sc-vol', {
    intro: '名前付きボリューム <code>myapp_dbdata</code>（db のデータ）と、バインドマウント <code>./web/nginx.conf</code>（web の設定）が、ホストのどこにあり、<code>down</code> と <code>down -v</code> で何が起きるかを追います。パスは Linux ホストの場合です。',
    steps: [
      {
        title: '名前付きボリュームの実体',
        text: '<code>myapp_dbdata</code> の実体は、ホストの <code>/var/lib/docker/volumes/myapp_dbdata/_data</code> というただのディレクトリです（<code>local</code> ドライバ）。中身は PostgreSQL のデータディレクトリそのものです。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker volume inspect myapp_dbdata --format '{{ .Mountpoint }}'
          /var/lib/docker/volumes/myapp_dbdata/_data

          $ sudo ls /var/lib/docker/volumes/myapp_dbdata/_data
          PG_VERSION    pg_dynshmem    pg_multixact  pg_snapshots  pg_tblspc    postgresql.auto.conf
          base          pg_hba.conf    pg_notify     pg_stat       pg_twophase  postgresql.conf
          global        pg_ident.conf  pg_replslot   pg_stat_tmp   pg_wal       postmaster.opts
          pg_commit_ts  pg_logical     pg_serial     pg_subtrans   pg_xact      postmaster.pid` },
        run: async (s) => {
          s.state('volnode', 'active');
          await s.scan('vtree');
          await s.term('t', `
            $ docker volume inspect myapp_dbdata --format '{{ .Mountpoint }}'
            /var/lib/docker/volumes/myapp_dbdata/_data`);
        },
      },
      {
        title: 'db コンテナにマウントされる',
        text: 'db コンテナの <code>/var/lib/postgresql/data</code> に、このディレクトリがマウントされます。<code>docker inspect</code> の <code>Mounts</code> では <code>"Type": "volume"</code>、<code>Name</code> がボリューム名です。',
        code: { title: 'docker inspect myapp-db-1 --format \'{{json .Mounts}}\' | jq（抜粋）', lang: 'json', src: `
          [
            {
              "Type": "⟪volume⟫",
              "Name": "myapp_dbdata",
              "Source": "/var/lib/docker/volumes/myapp_dbdata/_data",
              "Destination": "⟪/var/lib/postgresql/data⟫",
              "Driver": "local",
              "RW": true
            }
          ]` },
        run: async (s) => {
          s.state('volnode', null);
          await s.line('volnode:r', 'cdb:l', { cls: 'acc', label: 'volume', id: 'lv' });
          s.state('cdb', 'active');
          await s.term('t', `
            $ docker inspect myapp-db-1 --format '{{range .Mounts}}{{.Type}} {{.Source}} -> {{.Destination}}{{end}}'
            volume /var/lib/docker/volumes/myapp_dbdata/_data -> /var/lib/postgresql/data`);
        },
      },
      {
        title: 'バインドマウントはホストのファイルそのもの',
        text: '<code>./web/nginx.conf</code> のようにパスで書くとバインドマウントです。相対パスは compose.yaml のあるディレクトリ基準で絶対パスに解決されます。ホスト側でファイルを編集すると即座にコンテナから見えます（nginx に読み直させるには <code>nginx -s reload</code>）。<code>:ro</code> なのでコンテナからは書けません。',
        code: [
          { title: 'compose.yaml（短い書式 → 長い書式）', lang: 'yaml', src: `
            volumes:
              - ./web/nginx.conf:/etc/nginx/conf.d/default.conf:ro
            # ↓ docker compose config ではこう正規化される
            volumes:
              - type: ⟪bind⟫
                source: /home/alice/myapp/web/nginx.conf
                target: /etc/nginx/conf.d/default.conf
                read_only: true
                bind:
                  create_host_path: true` },
          { title: 'shell', lang: 'bash', src: `
            $ docker compose exec web nginx -s reload     # 設定を読み直す` },
        ],
        run: async (s) => {
          s.state('cdb', null);
          await s.line('bindsrc:r', 'cweb:l', { cls: 'acc', label: 'bind :ro', id: 'lb' });
          s.state('cweb', 'active');
          await s.term('t', `
            $ docker inspect myapp-web-1 --format '{{range .Mounts}}{{.Type}} {{.Source}} -> {{.Destination}} rw={{.RW}}{{"\\n"}}{{end}}'
            bind /home/alice/myapp/web/nginx.conf -> /etc/nginx/conf.d/default.conf rw=false
            bind /home/alice/myapp/web/public -> /usr/share/nginx/html rw=false`);
        },
      },
      {
        title: 'db にデータを書き込む',
        text: 'psql でテーブルを作って 3 行入れます。書き込まれたデータはコンテナのレイヤーではなく、ボリュームの <code>base/</code> 配下のファイルに書かれます。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker compose exec db psql -U app -c "CREATE TABLE orders(id int); INSERT INTO orders VALUES (1),(2),(3);"
          CREATE TABLE
          INSERT 0 3` },
        run: async (s) => {
          s.state('cweb', null);
          await s.term('t', `
            $ docker compose exec db psql -U app -c "CREATE TABLE orders(id int); INSERT INTO orders VALUES (1),(2),(3);"
            CREATE TABLE
            INSERT 0 3`);
          await s.fly('cdb:l', 'volnode:r', { label: 'write', arc: -20, dur: 800 });
          await s.show('rows', { fx: 'pop' });
        },
      },
      {
        title: '<code>docker compose down</code>：コンテナとネットワークだけ消える',
        text: '<code>down</code> が削除するのはコンテナと、Compose が作ったネットワーク（<code>myapp_default</code>）です。<b>名前付きボリュームは残ります</b>。バインドマウントの元ファイルはもちろんホストに残ります。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker compose down
          [+] down 4/4
           ✔ Container myapp-web-1   Removed
           ✔ Container myapp-api-1   Removed
           ✔ Container myapp-db-1    Removed
           ✔ Network myapp_default   Removed
          $ docker volume ls --filter label=com.docker.compose.project=myapp
          DRIVER    VOLUME NAME
          local     ⟪myapp_dbdata⟫` },
        run: async (s) => {
          await s.hide('rows lv lb', { dur: 250 });
          await s.hide('cdb cweb', { dur: 300 });
          await s.term('t', `
            $ docker compose down
            ✔ Container myapp-web-1   Removed
            ✔ Container myapp-api-1   Removed
            ✔ Container myapp-db-1    Removed
            ✔ Network myapp_default   Removed`, { clear: true });
          s.state('volnode bindsrc', 'ok');
          await s.stamp('volnode', 'KEPT', { cls: 'st-ok' });
        },
      },
      {
        title: 'もう一度 <code>up</code> → データは残っている',
        text: '同じプロジェクト名で <code>up</code> すると、既存の <code>myapp_dbdata</code> がそのまま再利用されます。postgres の entrypoint はデータディレクトリが空でないことを見て初期化を飛ばし、テーブルも 3 行もそのままです。',
        code: [
          { title: 'docker compose logs db', lang: 'text', src: `
            db-1  | ⟪PostgreSQL Database directory appears to contain a database; Skipping initialization⟫
            db-1  | … LOG:  database system is ready to accept connections` },
          { title: 'shell', lang: 'bash', src: `
            $ docker compose up -d --wait
            $ docker compose exec db psql -U app -tAc "SELECT count(*) FROM orders"
            3` },
        ],
        run: async (s) => {
          s.state('volnode bindsrc', null);
          await s.show('cdb cweb');
          s.line('volnode:r', 'cdb:l', { cls: 'acc', label: 'volume', id: 'lv2' });
          s.line('bindsrc:r', 'cweb:l', { cls: 'acc', label: 'bind :ro', id: 'lb2' });
          await s.term('t', `
            $ docker compose exec db psql -U app -tAc "SELECT count(*) FROM orders"
            3`, { clear: true });
          await s.show('rows', { fx: 'pop' });
          s.state('rows', 'ok');
        },
      },
      {
        title: '<code>docker compose down -v</code>：ボリュームも消える',
        text: '<code>-v</code>（<code>--volumes</code>）を付けると、トップレベル <code>volumes:</code> で定義した名前付きボリュームと匿名ボリュームも削除されます。<code>/var/lib/docker/volumes/myapp_dbdata</code> ごと消え、DB のデータは戻りません（<code>external: true</code> のボリュームは対象外）。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker compose down -v
          [+] down 5/5
           ✔ Container myapp-web-1   Removed
           ✔ Container myapp-api-1   Removed
           ✔ Container myapp-db-1    Removed
           ⟪✔ Volume myapp_dbdata     Removed⟫
           ✔ Network myapp_default   Removed` },
        run: async (s) => {
          await s.hide('rows lv2 lb2', { dur: 250 });
          await s.hide('cdb cweb', { dur: 300 });
          await s.term('t', `
            $ docker compose down -v
            ✔ Container myapp-db-1    Removed
            ✔ Volume myapp_dbdata     Removed
            ✔ Network myapp_default   Removed`, { clear: true });
          s.state('volnode', 'bad');
          await s.hide('vtree', { dur: 300 });
          s.shake('volnode');
          await s.stamp('volnode', 'REMOVED', { cls: 'st-bad' });
        },
      },
      {
        title: '次の <code>up</code> は空のボリュームから — データ消失',
        text: '同じ名前のボリュームが新しく（空で）作られ、entrypoint が <code>initdb</code> からやり直します。テーブルは存在しません。「開発環境を掃除するつもりで <code>down -v</code>」が最も多いデータ消失の原因です。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker compose up -d --wait
          $ docker compose exec db psql -U app -tAc "SELECT count(*) FROM orders"
          ⟪ERROR:  relation "orders" does not exist⟫
          LINE 1: SELECT count(*) FROM orders
                                       ^` },
        run: async (s) => {
          s.state('volnode', null);
          s.$('[data-el="volnode"] .stamp').forEach((e) => e.remove());
          await s.show('vtree cdb cweb');
          s.line('volnode:r', 'cdb:l', { cls: 'acc', label: 'volume', id: 'lv3' });
          s.line('bindsrc:r', 'cweb:l', { cls: 'acc', label: 'bind :ro', id: 'lb3' });
          await s.term('t', '$ docker compose exec db psql -U app -tAc "SELECT count(*) FROM orders"', { clear: true });
          await out(s, 'vtb', 'ERROR:  relation "orders" does not exist', 'bad');
          s.text('rows', 'orders: does not exist', { flash: false });
          await s.show('rows', { fx: 'pop' });
          s.state('rows', 'bad');
          s.shake('cdb');
        },
      },
      {
        title: 'プロジェクト名が変わると別のボリューム',
        text: '<code>-p staging</code> で起動すると、ボリュームは <code>staging_dbdata</code>、コンテナは <code>staging-db-1</code> として<b>別に</b>作られます。ディレクトリ名を変えた・別の場所に clone した、でも同じことが起きるため、「データが消えた」ように見えます（実際は元のボリュームが残っています）。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker compose -p staging up -d
          $ docker volume ls --format '{{.Name}}'
          myapp_dbdata
          ⟪staging_dbdata⟫

          # 消したくないボリュームは外部ボリュームにする
          volumes:
            dbdata:
              external: true
              name: shared_dbdata     # docker volume create shared_dbdata で事前に作成` },
        run: async (s) => {
          s.state('rows cdb', null);
          await s.show('staging', { fx: 'left' });
          s.state('staging', 'warn');
          await s.term('t', `
            $ docker volume ls --format '{{.Name}}'
            myapp_dbdata
            staging_dbdata`);
        },
      },
    ],
  });

  /* =====================================================================
   * SCENE 6 : 失敗ケース
   * ===================================================================*/
  const FIX = (src, lang) => F('compose.yaml（api / db）', lang || 'yaml', src);
  TIM.scene('#sc-fail', {
    intro: '前半は「api から <code>localhost:5432</code> に繋ごうとして失敗する」ケース、後半は「<code>depends_on</code> の短縮形で、初期化中の DB に繋いで落ちる」ケースと「healthcheck の書き間違いで <code>up</code> が止まる」ケースです。ログは本ページの最小サンプル <code>server.js</code> の出力です。',
    steps: [
      {
        title: '設定ミス：api の接続先が <code>localhost</code>',
        text: 'ホスト上で開発していたときの <code>DATABASE_URL=…@localhost:5432/app</code> をそのまま compose.yaml に書いてしまったケースです。上の 2 つの枠は、api と db それぞれの <b>network namespace</b>。どちらにも独立した <code>lo</code>（127.0.0.1）と <code>eth0</code> があります。',
        code: { title: 'compose.yaml（誤り）', lang: 'yaml', src: `
          api:
            environment:
              DATABASE_URL: postgres://app:\${POSTGRES_PASSWORD}@⟪localhost⟫:5432/app` },
        run: async (s) => {
          s.state('papi', 'warn');
          s.line('ethapi:r', 'ethdb:l', { cls: 'dash', label: 'bridge', arrow: false, id: 'br' });
          await s.pulse('papi');
        },
      },
      {
        title: 'api は自分自身の <code>127.0.0.1:5432</code> に接続 → 拒否',
        text: 'api コンテナ内で <code>localhost</code> は <code>/etc/hosts</code> により 127.0.0.1（環境によっては ::1 も）に解決され、<b>api 自身の</b> <code>lo</code> に SYN が送られます。そこでは誰も 5432 番を待ち受けていないので、カーネルが RST を返して <code>ECONNREFUSED</code>。プロセスは終了コード 1 で落ちます。',
        code: { title: 'docker compose logs api', lang: 'text', src: `
          api-1  | db connect failed (⟪ECONNREFUSED⟫) localhost:5432
          api-1 exited with code 1 (restarting)

          # 実アプリの DB ドライバでも原因は同じ
          #   Node.js: ECONNREFUSED（connect ECONNREFUSED 127.0.0.1:5432 など）
          #   libpq  : … port 5432 failed: Connection refused` },
        run: async (s) => {
          await s.fly('papi:b', 'loapi', { label: 'SYN :5432', dur: 800 });
          s.state('loapi', 'bad');
          await s.fly('loapi', 'papi:b', { label: 'RST', cls: 'c-red', dur: 600 });
          s.state('papi', 'bad');
          s.shake('papi');
          await s.term('t', 'api-1  | db connect failed (ECONNREFUSED) localhost:5432');
          await out(s, 'ftb', 'api-1 exited with code 1 (restarting)', 'bad');
        },
      },
      {
        title: 'db の中の <code>localhost</code> なら届く',
        text: '同じ <code>localhost:5432</code> でも、<b>db コンテナの中</b>で実行すれば db 自身の <code>lo</code> で postgres が待ち受けているので成功します。「ホストや db コンテナ内では繋がるのに api からは繋がらない」の正体はこれです。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker compose exec db pg_isready -h localhost
          localhost:5432 - ⟪accepting connections⟫

          $ docker compose exec api grep -w localhost /etc/hosts
          127.0.0.1	localhost          # api 自身の lo（IPv6 が有効なら ::1 の行も）` },
        run: async (s) => {
          s.state('loapi', null);
          s.state('papi', 'warn');
          await s.fly('pdb:b', 'lodb', { label: 'SYN :5432', dur: 700 });
          s.state('lodb', 'ok');
          s.state('lsdb', 'ok');
          await s.term('t', `
            $ docker compose exec db pg_isready -h localhost
            localhost:5432 - accepting connections`);
        },
      },
      {
        title: '修正：接続先をサービス名 <code>db</code> にする',
        text: '<code>db</code> は組み込み DNS で <code>172.18.0.2</code>（db の <code>eth0</code>）に解決され、パケットは bridge <code>myapp_default</code> を通って db に届きます。',
        code: { title: 'compose.yaml の差分', lang: 'diff', src: `
          -      DATABASE_URL: postgres://app:\${POSTGRES_PASSWORD}@localhost:5432/app
          +      DATABASE_URL: postgres://app:\${POSTGRES_PASSWORD}@⟪db⟫:5432/app` },
        run: async (s) => {
          s.state('lodb lsdb', null);
          await s.set('fix', FIX(`
            -DATABASE_URL: postgres://app:…@localhost:5432/app
            +DATABASE_URL: postgres://app:…@db:5432/app`, 'diff'));
          await s.text('papis', 'DATABASE_URL=postgres://app:…@db:5432/app');
          await s.fly('papi:b', 'ethapi', { label: 'db → 172.18.0.2', dur: 700 });
          await s.fly('ethapi:r', 'ethdb:l', { label: 'SYN :5432', dur: 900 });
          s.state('ethdb', 'ok');
          s.state('papi', 'ok');
          await s.term('t', `
            api-1  | db reachable at db:5432
            api-1  | api listening on :3000`);
        },
      },
      {
        title: '別の失敗：<code>depends_on</code> が短縮形のまま',
        text: '次は初回起動（空のボリューム）のケースです。api の <code>depends_on</code> が <code>- db</code>（= <code>service_started</code>）だと、Compose は db コンテナが running になった瞬間に api を起動します。PostgreSQL が接続を受け付けられるかどうかは確認しません。',
        code: { title: 'compose.yaml（healthcheck なし）', lang: 'yaml', src: `
          api:
            depends_on:
              - db            # ⟪condition: service_started と同じ⟫
          db:
            image: postgres:16-alpine
            # healthcheck: なし` },
        run: async (s) => {
          s.state('ethdb papi', null);
          await s.set('fix', FIX(`
            api:
              depends_on:
                - db    # = service_started
            db:
              # healthcheck なし`));
          s.state('fix', 'warn');
          await s.term('t', `
            $ docker compose down -v && docker compose up -d`, { clear: true });
        },
      },
      {
        title: 'db は初期化中（一時サーバーは Unix ソケットのみ）',
        text: 'db コンテナは running ですが、中では <code>initdb</code> と一時サーバーが動いています。一時サーバーは <code>listen_addresses=\'\'</code> で起動するため、待ち受けているのは Unix ソケット <code>/var/run/postgresql/.s.PGSQL.5432</code> だけで、TCP の 5432 番は閉じています。',
        code: { title: 'docker compose logs db', lang: 'text', src: `
          db-1  | The files belonging to this database system will be owned by user "postgres".
          db-1  | …
          db-1  | waiting for server to start.... done
          db-1  | ⟪server started⟫            ← 一時サーバー（TCP では待ち受けない）
          db-1  | CREATE DATABASE` },
        run: async (s) => {
          s.state('fix', null);
          await s.text('pdbs', "initdb 中 · listen_addresses=''");
          await s.text('lsdb', 'listen /var/run/postgresql/.s.PGSQL.5432');
          s.state('lsdb pdb', 'warn');
          await s.scan('pdb', { cls: 'c-amber' });
        },
      },
      {
        title: 'api が <code>db:5432</code> に接続 → <code>ECONNREFUSED</code>',
        text: '名前解決は成功し（<code>172.18.0.2</code>）、SYN も db に届きますが、TCP 5432 番に待ち受けがないため RST が返ります。localhost のときと同じ <code>ECONNREFUSED</code> でも、宛先が db の IP である点が違います。<code>restart: unless-stopped</code> なので dockerd が api を再起動します。',
        code: { title: 'docker compose logs -f', lang: 'text', src: `
          db-1   | waiting for server to start.... done
          api-1  | db connect failed (⟪ECONNREFUSED⟫) db:5432
          api-1 exited with code 1 (restarting)
          db-1   | server started
          db-1   | CREATE DATABASE` },
        run: async (s) => {
          await s.fly('papi:b', 'ethapi', { label: 'db → 172.18.0.2', dur: 600 });
          await s.fly('ethapi:r', 'ethdb:l', { label: 'SYN :5432', dur: 800 });
          s.state('ethdb', 'bad');
          await s.fly('ethdb:l', 'ethapi:r', { label: 'RST', cls: 'c-red', dur: 700 });
          s.state('papi', 'bad');
          s.shake('papi');
          await s.term('t', 'api-1  | db connect failed (ECONNREFUSED) db:5432');
          await out(s, 'ftb', 'api-1 exited with code 1 (restarting)', 'bad');
        },
      },
      {
        title: '再起動ループで「たまたま」回復する',
        text: 'dockerd は再起動の間隔を延ばしながら api を起動し直し、DB の準備ができた後の試行で成功します。<code>restart</code> が無ければ api は Exited のまま、web は 502 を返し続けます。どちらにせよ起動が不安定なので、<code>condition: service_healthy</code> ＋ <code>healthcheck</code>（前のシーン）で解決します。',
        code: { title: 'shell', lang: 'bash', src: `
          $ docker compose ps -a --format 'table {{.Name}}\\t{{.Status}}'
          NAME          STATUS
          myapp-api-1   ⟪Restarting (1) 2 seconds ago⟫
          myapp-db-1    Up 4 seconds
          myapp-web-1   Up 3 seconds

          # restart ポリシーが無い場合
          myapp-api-1   Exited (1) 10 seconds ago` },
        run: async (s) => {
          s.state('ethdb', null);
          await s.term('t', `
            $ docker compose ps -a --format 'table {{.Name}}\\t{{.Status}}'
            NAME          STATUS
            myapp-api-1   Restarting (1) 2 seconds ago
            myapp-db-1    Up 4 seconds`);
          await s.text('pdbs', "listen_addresses='*' · port 5432");
          await s.text('lsdb', 'listen 0.0.0.0:5432');
          s.state('lsdb pdb', 'ok');
          await s.fly('ethapi:r', 'ethdb:l', { label: 'retry', dur: 700 });
          s.state('papi', 'warn');
          await s.term('t', 'api-1  | db reachable at db:5432');
        },
      },
      {
        title: '失敗：healthcheck を書き間違えると <code>up</code> が止まる',
        text: '今度は <code>service_healthy</code> にしたものの、healthcheck のポートを <code>5433</code> と誤記したケースです。<code>pg_isready</code> は毎回 <code>no response</code>、<code>start_period</code> 後に <code>retries</code>（5 回）連続で失敗して <code>unhealthy</code> になり、Compose は api を起動せずにエラーで終了します。原因は <code>.State.Health.Log[].Output</code> に残っています。',
        code: [
          { title: 'shell', lang: 'bash', src: `
            $ docker compose up -d
             ✘ Container myapp-db-1    Error
            ⟪dependency failed to start: container myapp-db-1 is unhealthy⟫

            $ docker inspect --format '{{json .State.Health}}' myapp-db-1 | jq '{Status, FailingStreak, last: .Log[-1].Output}'
            {
              "Status": "unhealthy",
              "FailingStreak": 5,
              "last": "127.0.0.1:5433 - no response\\n"
            }` },
        ],
        run: async (s) => {
          s.state('lsdb pdb papi', null);
          await s.set('fix', FIX(`
            db:
              healthcheck:
                test:
                  - CMD-SHELL
                  - pg_isready -h 127.0.0.1 -p ⟪5433⟫`));
          s.state('fix', 'bad');
          await s.term('t', '$ docker compose up -d', { clear: true });
          await out(s, 'ftb', '✘ Container myapp-db-1    Error', 'bad');
          await out(s, 'ftb', 'dependency failed to start: container myapp-db-1 is unhealthy', 'bad');
          s.state('pdb', 'bad');
          await s.stamp('pdb', 'UNHEALTHY', { cls: 'st-bad' });
        },
      },
    ],
  });
})();
