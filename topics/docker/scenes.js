/* Docker — scenes (see AGENT.md §7). All IDs / PIDs are example values; image digests are real SHA-256 of the JSON below. */
(function () {
  'use strict';

  /* ---------------------------------------------------------------
   * 例示値
   * ------------------------------------------------------------- */
  const CID = 'e80ea0e0d3914ba6dcad1c20223f2243dea46c8078c4051c588b39ee684db481'; // container "web"
  const C12 = CID.slice(0, 12);
  const RW = 'da2ecc9f0374269a36e708f23a0f5762b572ffb53eb0cccb9b11660b3a87c495'; // overlay2 dir of the RW layer
  const L8DIR = '4c2b32ee995995be481c7f8bc2c6c7c2b8221c8638cd17978e954c4dbbe1a15f';
  const L7DIR = '46ad20a87021634dc2351dfd296f7301f50c27b460a8f30268ad6e63ca0ceeae';
  const NODE_IDX = '17d179248dd524110afa6372abbc766543b88ca93e4502915a3497997104bc9a';
  const WEB11 = '78c558a10ba2699454ecb6b0b785b844f46216e0436a7bb8744333cb44927b49';
  const L8NEW = 'ba8b4e2491f0855dde2d5fae01b18078215fa71f23e262746d4c8d966836695e';
  const GZ8 = '7d29b75528f088ad381b839d994a175dbed29eed4aee5b4bb26d24409b7a3080';
  const COMMIT = '873081fd98a91006fceef148e623094367c041d21a8fd4668386e18018f74da8';
  const HOG = '62364083b1bc2435d4f3f5f568e5ee2cd0a1cb476b94785fcb3765887f34c5c5';
  const EP = 'a29b2feec448820ccf562550a8797bf8389234a881ab07c32d7824cd1f20d7f3';
  const WEB2 = '798f8b125afab51f37a4b2f2a41f61013ece40c8492d052140c5799b16243f61';
  const API = '38747a4107dd1b90efe3233c4336d6f289126124be33f330e742b695216fbcb2';

  // diff_ids (= layer digests in docker save) L1..L8
  const D = [
    '9165f60dd944377e90b553d6e000a55c83f86128d4e020fdc1529fe7965c00dd', // ADD alpine-minirootfs
    '9ae139e3b3994e42af83c4bd44c816a1b4d9c8e5a31e8e867bbb69a8f4606e80', // RUN (node)
    '5963ebd6e20b7bf15e1f594c1764ae8cf70ba8ab17705f8186f3c9c757445efc', // RUN (yarn)
    'fb89f63c9e99f1a6992d13fc39e08dbe374da728ae490b66cf382e38981ebadb', // COPY docker-entrypoint.sh
    'b2116af9f217a44b3666e6ec511a1cb9c753afcadcd1342192fb65c6a64d17e0', // WORKDIR /app
    'b020450f9e3a738a32e2a9c9b515ede980e75659de565ef2ad71e2ccd26f281e', // COPY package*.json
    '7a2b52b3eaed0f8c183471fbfbbe8f674f725eef98244f9a7f66ca74039da308', // RUN npm ci
    '4a19c8aa9c6df420f8e373430d3a6e16203d7ccfa77d513eb4b89df5a5fe9bc7', // COPY . .
  ];
  const SIZES = [8121856, 137011200, 5448192, 3584, 1536, 34816, 2134016, 45056];

  // image config (compact JSON, exactly as stored in blobs/sha256/<digest>)
  const HB = (t, by) => '{"created":"' + t + '","created_by":"' + by + '","comment":"buildkit.dockerfile.v0"}';
  const HE = (t, by) => '{"created":"' + t + '","created_by":"' + by + '","comment":"buildkit.dockerfile.v0","empty_layer":true}';
  const TB = '2024-12-05T22:01:54Z', TN = '2024-12-06T03:38:12Z', TX = '2026-09-28T01:12:09.402115872Z';
  const HIST = [
    HB(TB, 'ADD alpine-minirootfs-3.21.0-x86_64.tar.gz / # buildkit'),
    HE(TB, 'CMD [\\"/bin/sh\\"]'),
    HE(TN, 'ENV NODE_VERSION=22.12.0'),
    HB(TN, 'RUN /bin/sh -c addgroup -g 1000 node … # buildkit'),
    HE(TN, 'ENV YARN_VERSION=1.22.22'),
    HB(TN, 'RUN /bin/sh -c apk add --no-cache --virtual .build-deps-yarn curl gnupg tar … # buildkit'),
    HB(TN, 'COPY docker-entrypoint.sh /usr/local/bin/ # buildkit'),
    HE(TN, 'ENTRYPOINT [\\"docker-entrypoint.sh\\"]'),
    HE(TN, 'CMD [\\"node\\"]'),
    HB('2026-09-28T01:11:58.103928741Z', 'WORKDIR /app'),
    HB('2026-09-28T01:11:58.227405113Z', 'COPY package.json package-lock.json ./ # buildkit'),
    HB('2026-09-28T01:12:08.931750280Z', 'RUN /bin/sh -c npm ci --omit=dev # buildkit'),
    HB(TX, 'COPY . . # buildkit'),
    HE(TX, 'EXPOSE map[3000/tcp:{}]'),
    HE(TX, 'CMD [\\"node\\" \\"server.js\\"]'),
  ];
  const cfgJson = (cmd) =>
    '{"architecture":"amd64","config":{"ExposedPorts":{"3000/tcp":{}},"Env":["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin","NODE_VERSION=22.12.0","YARN_VERSION=1.22.22"],"Entrypoint":["docker-entrypoint.sh"],"Cmd":' +
    cmd + ',"WorkingDir":"/app"},"created":"' + TX + '","history":[' + HIST.join(',') +
    '],"os":"linux","rootfs":{"type":"layers","diff_ids":[' + D.map((x) => '"sha256:' + x + '"').join(',') + ']}}';
  const CFG_JSON = cfgJson('["node","server.js"]');
  const CFG_TAMP = cfgJson('["node","miner.js"]');
  const CFG_DIGEST = 'a21f6cb024a63a37e7bd03ca87c01068755a32f0c3df0056012e2fcfc8d76497';
  const TAMP_DIGEST = 'be2e617ec24c9b89ce215bebb169be8860c688936b045d0608549286e912bc5c';
  const MAN_JSON =
    '{"schemaVersion":2,"mediaType":"application/vnd.oci.image.manifest.v1+json","config":{"mediaType":"application/vnd.oci.image.config.v1+json","digest":"sha256:' +
    CFG_DIGEST + '","size":2994},"layers":[' +
    D.map((x, i) => '{"mediaType":"application/vnd.oci.image.layer.v1.tar","digest":"sha256:' + x + '","size":' + SIZES[i] + '}').join(',') + ']}';
  const MAN_DIGEST = '5e812f9a81df5112ac4404c717ffdb9e747eda8f226aa7804e0516d18a16564c';

  const bytes = (s) => (TIM.te ? TIM.te.encode(s).length : s.length);
  async function sha(s, fallback) {
    try { return TIM.hex(await TIM.sha256(s)); } catch (e) { return fallback; }
  }
  // BuildKit の進捗 1 行（時間を右端にそろえる）
  const bk = (label, t) => (' => ' + label).padEnd(70) + (t || '');
  // Dockerfile の行ハイライト
  const dfl = (s, ...n) => {
    s.cls('[data-el="dfp"] .ln', null, 'hl');
    n.forEach((k) => s.cls('[data-el="dfp"] .ln:nth-child(' + k + ')', 'hl'));
  };
  const noTransition = (s, name) => { if (s.instant) s.el(name).style.transition = 'none'; };

  /* ===============================================================
   * SCENE 1 — docker run の実体
   * ============================================================= */
  TIM.scene('#sc-run', {
    intro: '<code>docker run -d --name web -p 8080:3000 --memory 256m --cpus 1.5 web:1.0</code> を 1 回打ったときに、どのプロセスがどのソケットで何を送り合い、最終的に誰が <code>node server.js</code> を起動するのかを追います。',
    steps: [
      {
        title: 'docker CLI は HTTP クライアントにすぎない',
        text: 'CLI は接続先（<code>DOCKER_HOST</code> / <code>docker context</code>。既定は <code>unix:///var/run/docker.sock</code>）へ HTTP リクエストを送るだけです。ソケットの所有グループは <code>docker</code>。ここに書き込める＝ dockerd（root）に何でも頼める、という意味です。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker context inspect -f '{{.Endpoints.docker.Host}}'
          unix:///var/run/docker.sock
          $ ls -l /var/run/docker.sock
          srw-rw---- 1 root docker 0 Sep 28 09:58 /var/run/docker.sock
          $ ⟪docker run -d --name web -p 8080:3000 --memory 256m --cpus 1.5 web:1.0⟫` },
        run: async (s) => {
          s.state('t', 'active');
          await s.term('t', '$ docker run -d --name web -p 8080:3000 --memory 256m --cpus 1.5 web:1.0');
          await s.line('t:r', 'sock:l', { cls: 'dash', id: 'w1' });
        },
      },
      {
        title: 'HEAD /_ping で API バージョンを合わせる',
        text: 'CLI は最初に <code>HEAD /_ping</code> を送り、応答ヘッダ <code>Api-Version</code> を見て使うバージョンを決めます（API バージョンネゴシエーション）。以降のパスには <code>/v1.51/</code> が付きます。<code>Host: api.moby.localhost</code> は UNIX ソケット接続用のダミーのホスト名です。',
        code: { title: 'HTTP over /var/run/docker.sock', lang: 'http', src: `
          HEAD /_ping HTTP/1.1
          Host: api.moby.localhost
          User-Agent: Docker-Client/28.5.0 (linux)

          HTTP/1.1 200 OK
          Api-Version: ⟪1.51⟫
          Builder-Version: 2
          Docker-Experimental: false
          Ostype: linux
          Server: Docker/28.5.0 (linux)
          Swarm: inactive` },
        run: async (s) => {
          await s.fly('t:r', 'sock:l', { label: 'HEAD /_ping', dur: 700 });
          s.line('sock:r', 'dockerd:l', { cls: 'dash', id: 'w2' });
          await s.fly('sock:r', 'dockerd:l', { label: 'HEAD /_ping', dur: 600 });
          await s.fly('dockerd:b', 't:r', { label: '200 · Api-Version: 1.51', cls: 'ghost', arc: -40 });
        },
      },
      {
        title: 'POST /containers/create：フラグはすべて JSON になる',
        text: '<code>-p</code> は <code>HostConfig.PortBindings</code>、<code>--memory 256m</code> は <code>HostConfig.Memory</code> = 256×1024×1024 = 268435456、<code>--cpus 1.5</code> は <code>NanoCpus</code> = 1.5×10⁹ です。dockerd は <code>/var/lib/docker/containers/&lt;id&gt;/config.v2.json</code> と overlay2 の書き込み層を作り、<code>201 Created</code> で ID を返します。<b>この時点ではまだプロセスは存在しません。</b>',
        code: { title: 'HTTP', lang: 'http', src: `
          POST /v1.51/containers/create?⟪name=web⟫ HTTP/1.1
          Host: api.moby.localhost
          Content-Type: application/json

          {"Image": "web:1.0",
           "ExposedPorts": {"3000/tcp": {}},
           "HostConfig": {
             "Memory": ⟪268435456⟫,
             "NanoCpus": ⟪1500000000⟫,
             "PortBindings": {"3000/tcp": [{"HostIp": "", "HostPort": "⟪8080⟫"}]}
           }, …}

          HTTP/1.1 201 Created
          Api-Version: 1.51
          Content-Type: application/json

          {"Id":"${CID}","Warnings":[]}` },
        run: async (s) => {
          await s.fly('t:r', 'sock:l', { label: 'POST /v1.51/containers/create', dur: 800 });
          await s.fly('sock:r', 'dockerd:l', { label: '{"Image":"web:1.0",…}', dur: 700 });
          s.state('dockerd', 'active');
          await s.fly('dockerd:b', 't:r', { label: '201 {"Id":"e80ea0e0d391…"}', cls: 'ghost', arc: -40 });
        },
      },
      {
        title: 'POST …/start：dockerd が rootfs と OCI バンドルを用意',
        text: 'start を受けた dockerd は、overlay2 で rootfs をマウント（<code>…/overlay2/&lt;id&gt;/merged</code>）し、net namespace と veth を準備し、OCI Runtime Spec の <code>config.json</code> を生成します。実行するコマンド・namespaces の種類・cgroup のパス・メモリ上限は<b>すべてこのファイルに書かれ</b>、以降の containerd / runc はこれに従うだけです。',
        code: [
          { title: 'HTTP', lang: 'http', src: `
            POST /v1.51/containers/${CID}/start HTTP/1.1
            Host: api.moby.localhost` },
          { title: 'config.json（OCI Runtime Spec・抜粋）', lang: 'json', src: `
            {
              "process": {
                "args": ["docker-entrypoint.sh", "node", "server.js"],
                "env": ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                        "HOSTNAME=${C12}", "NODE_VERSION=22.12.0", "YARN_VERSION=1.22.22"],
                "cwd": "/app"
              },
              "root": { "path": "/var/lib/docker/overlay2/${RW}/merged" },
              "hostname": "${C12}",
              "mounts": [
                { "destination": "/proc", "type": "proc", "source": "proc" },
                { "destination": "/etc/hosts", "type": "bind",
                  "source": "/var/lib/docker/containers/${CID}/hosts" },
                …
              ],
              "linux": {
                "namespaces": [{"type": "mount"}, {"type": "network"}, {"type": "uts"},
                               {"type": "pid"}, {"type": "ipc"}, {"type": "cgroup"}],
                "cgroupsPath": "⟪system.slice:docker:${CID}⟫",
                "resources": {
                  "memory": { "limit": ⟪268435456⟫ },
                  "cpu": { "quota": 150000, "period": 100000 }
                }
              }
            }` },
        ],
        run: async (s) => {
          await s.fly('t:r', 'sock:l', { label: 'POST …/e80e…/start', dur: 700 });
          await s.fly('sock:r', 'dockerd:l', { label: 'start', dur: 600 });
          s.state('dockerd', 'active');
          await s.show('spec', { fx: 'up' });
          s.show('rootfs', { fx: 'pop' });
          await s.scan('spec', { dur: 800 });
        },
      },
      {
        title: 'dockerd → containerd：gRPC で「タスク」を作らせる',
        text: 'dockerd 自身はプロセスを起動しません。<code>/run/containerd/containerd.sock</code> の gRPC で containerd にコンテナとタスクの作成を依頼します。Docker のものは containerd の namespace <code>moby</code> に入るので、<code>ctr -n moby</code> で見えます（Kubernetes なら <code>k8s.io</code>）。',
        code: [
          { title: 'dockerd → containerd（gRPC メソッド）', lang: 'text', src: `
            containerd.services.containers.v1.Containers/Create   (namespace: moby)
            containerd.services.tasks.v1.Tasks/Create
            containerd.services.tasks.v1.Tasks/Start` },
          { title: 'bash', lang: 'bash', src: `
            $ sudo ctr namespaces ls
            NAME LABELS
            moby
            $ sudo ctr -n moby containers ls -q
            ${CID}` },
        ],
        run: async (s) => {
          s.line('dockerd:r', 'ctrd:l', { cls: 'flow', id: 'w3' });
          await s.fly('dockerd:r', 'ctrd:l', { label: 'Tasks/Create', dur: 800 });
          s.state('dockerd', null);
          s.state('ctrd', 'active');
        },
      },
      {
        title: 'containerd が containerd-shim-runc-v2 を起動',
        text: 'containerd はコンテナごとに <code>containerd-shim-runc-v2</code> を起動します。shim は自分をデーモン化して親を PID 1（systemd）に付け替え、ttrpc で containerd と話します。コンテナのプロセスの親は<b>この shim</b> になるので、dockerd や containerd を再起動してもコンテナは止まりません。',
        code: { title: 'bash', lang: 'bash', src: `
          $ ps -o pid,ppid,args -C containerd-shim   # comm は 15 文字で切れる
              PID    PPID COMMAND
             4298       1 /usr/bin/containerd-shim-runc-v2 -namespace moby -id ${CID} -address /run/containerd/containerd.sock` },
        run: async (s) => {
          s.line('ctrd:b', 'shim:t', { cls: 'flow', id: 'w4', label: 'fork/exec' });
          await s.fly('ctrd:b', 'shim:t', { label: 'start shim', dur: 700 });
          s.state('ctrd', null);
          s.state('shim', 'active');
        },
      },
      {
        title: 'shim が runc create：namespaces・cgroup・rootfs を設定',
        text: 'shim はバンドル <code>/run/containerd/io.containerd.runtime.v2.task/moby/&lt;id&gt;/</code>（<code>config.json</code> を含む）を指定して <code>runc create</code> を実行します。runc は <code>linux.namespaces</code> に従って namespace を作り（<code>clone(2)</code> / <code>unshare(2)</code>、path 指定があれば <code>setns(2)</code>）、cgroup を作って <code>memory.max</code> などを書き込み、rootfs に <code>pivot_root(2)</code> します。この時点ではまだアプリは実行されず、<code>runc init</code> が待機しています。',
        code: { title: 'shim が実行するコマンド', lang: 'bash', src: `
          runc --root /var/run/docker/runtime-runc/moby \\
            --log /run/containerd/io.containerd.runtime.v2.task/moby/${CID}/log.json --log-format json \\
            ⟪create⟫ --bundle /run/containerd/io.containerd.runtime.v2.task/moby/${CID} \\
            --pid-file /run/containerd/io.containerd.runtime.v2.task/moby/${CID}/init.pid \\
            ${CID}` },
        run: async (s) => {
          s.line('shim:l', 'runc:r', { cls: 'flow', id: 'w5' });
          await s.fly('shim:l', 'runc:r', { label: 'runc create', dur: 700 });
          s.state('runc', 'active');
          s.line('runc:l', 'box:r', { cls: 'acc', id: 'w6' });
          await s.show('ns', { fx: 'pop' });
          await s.show('cg', { fx: 'pop' });
          s.state('box', 'active');
        },
      },
      {
        title: 'runc start → execve：アプリが PID 1 になり、runc は終了',
        text: '<code>runc start</code> で待機していた <code>runc init</code> が <code>execve("docker-entrypoint.sh", …)</code> し、スクリプトが <code>exec node server.js</code> するので、最終的に <code>node</code> がコンテナ内の PID 1 になります。runc はここで終了し、プロセスの親は shim です。ホストから見ればただの PID 4321 です。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker inspect -f '{{.State.Pid}}' web
          ⟪4321⟫
          $ ps -o pid,ppid,user,args -p 4298,4321
              PID    PPID USER     COMMAND
             4298       1 root     /usr/bin/containerd-shim-runc-v2 -namespace moby -id ${CID} -address /run/containerd/containerd.sock
             ⟪4321    4298⟫ root     node server.js
          $ sudo runc --root /run/docker/runtime-runc/moby list -q
          ${CID}` },
        run: async (s) => {
          await s.fly('runc:l', 'box:r', { label: 'execve', dur: 700 });
          await s.show('proc', { fx: 'zoom' });
          s.state('box', null);
          s.state('runc', 'dim');
          await s.set('[data-el="proc"] .node-s', 'PID 1（コンテナ内）<br>host PID 4321 · 親 4298');
          s.pulse('shim');
        },
      },
      {
        title: '204 No Content：CLI は ID を表示して終了',
        text: 'start が成功すると dockerd は <code>204 No Content</code> を返し、<code>-d</code> 付きの CLI は ID を表示して終わります。CLI が終了しても、コンテナは shim の子として動き続けます。<code>docker ps</code> の <code>Ports</code> には IPv4 / IPv6 両方の待ち受けが表示されます。',
        code: [
          { title: 'HTTP', lang: 'http', src: `
            HTTP/1.1 ⟪204 No Content⟫
            Api-Version: 1.51
            Server: Docker/28.5.0 (linux)` },
          { title: 'bash', lang: 'bash', src: `
            $ docker run -d --name web -p 8080:3000 --memory 256m --cpus 1.5 web:1.0
            ${CID}
            $ docker ps --format '{{.Names}}  {{.Status}}  {{.Ports}}'
            web  Up 3 seconds  0.0.0.0:8080->3000/tcp, [::]:8080->3000/tcp` },
        ],
        run: async (s) => {
          await s.fly('dockerd:b', 't:r', { label: '204 No Content', cls: 'ghost', arc: -40 });
          await s.term('t', CID);
          s.state('t', null);
          s.state('shim', null);
          s.state('proc', 'ok');
        },
      },
      {
        title: '同じ API を curl で直接叩く',
        text: 'CLI を使わなくても、同じ API を <code>curl --unix-socket</code> で呼べます。<code>docker ps</code> は <code>GET /containers/json</code>、<code>docker inspect</code> は <code>GET /containers/{id}/json</code> の結果を整形しているだけです。バージョンを省いた <code>/containers/json</code> は daemon の最新 API として扱われます。<code>ImageID</code> の値は次の章で出てくる config の sha256 です。',
        code: [
          { title: 'bash', lang: 'bash', src: `
            $ curl -s --unix-socket /var/run/docker.sock http://localhost/v1.51/containers/json | jq '.[0]'` },
          { title: 'GET /v1.51/containers/json（抜粋）', lang: 'json', src: `
            {
              "Id": "${CID}",
              "Names": ["/web"],
              "Image": "web:1.0",
              "ImageID": "sha256:${CFG_DIGEST}",
              "Command": "docker-entrypoint.sh node server.js",
              "State": "running",
              "Status": "Up 2 minutes",
              "Ports": [
                {"IP": "0.0.0.0", "PrivatePort": 3000, "PublicPort": 8080, "Type": "tcp"},
                {"IP": "::", "PrivatePort": 3000, "PublicPort": 8080, "Type": "tcp"}
              ],
              …
            }` },
        ],
        run: async (s) => {
          s.state('t', 'active');
          await s.term('t', `$ curl -s --unix-socket /var/run/docker.sock http://localhost/containers/json | jq -r '.[].Names[0]'`, { clear: true });
          await s.fly('t:r', 'dockerd:l', { label: 'GET /containers/json', dur: 900, arc: -30 });
          await s.fly('dockerd:b', 't:r', { label: '200 [ {"Id":…} ]', cls: 'ghost', arc: -40 });
          await s.term('t', '/web');
          s.caption('<code>docker</code> CLI ＝ Engine API の HTTP クライアント。実行するのは containerd と runc', { cls: 'ok' });
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 2 — docker build
   * ============================================================= */
  const DF_BAD = `FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["node", "server.js"]`;

  TIM.scene('#sc-build', {
    intro: '<code>~/web</code> の Node.js アプリを <code>docker build -t web:1.0 .</code> でイメージにします。context の送信、<code>.dockerignore</code>、命令ごとのレイヤー、<code>CACHED</code> の条件、そして命令順を間違えたときの失敗までを追います。',
    steps: [
      {
        title: 'build context：最後の引数 "." のディレクトリ',
        text: '<code>docker build -t web:1.0 .</code> の <code>.</code> が <b>build context</b> です。<code>COPY</code> で参照できるのはこのディレクトリの中だけで、Dockerfile は既定で <code>./Dockerfile</code>（<code>-f</code> で変更）。Engine 23.0 以降 <code>docker build</code> は <code>docker buildx build</code> の別名で、実際のビルドは dockerd 内蔵の BuildKit が行います。',
        code: { title: 'bash', lang: 'bash', src: `
          $ cd ~/web
          $ du -sh node_modules .git
          48M	node_modules
          12M	.git
          $ docker build -t web:1.0 ⟪.⟫` },
        run: async (s) => {
          s.state('ctx', 'active');
          await s.term('t', '$ docker build -t web:1.0 .');
        },
      },
      {
        title: '.dockerignore：送らないファイルを先に決める',
        text: 'CLI は context を送る前に <code>.dockerignore</code> のパターンで除外します。<code>node_modules</code>（48MB）や <code>.git</code>、秘密情報の入った <code>.env</code> を除外しないと、転送が遅くなるだけでなく <code>COPY . .</code> で<b>イメージの中に入ってしまいます</b>。',
        code: [
          { title: '.dockerignore', lang: 'text', src: `
            node_modules
            .git
            *.log
            .env` },
          { title: 'BuildKit の進捗', lang: 'text', src: [
            bk('[internal] load build definition from Dockerfile', '0.0s'),
            bk('=> transferring dockerfile: 141B', '0.0s'),
            bk('[internal] load metadata for docker.io/library/node:22-alpine', '1.1s'),
            bk('[internal] load .dockerignore', '0.0s'),
            bk('=> transferring context: 29B', '0.0s'),
          ].join('\n') },
        ],
        run: async (s) => {
          s.cls('r-ign', 'on');
          await s.term('t', [
            bk('[internal] load build definition from Dockerfile', '0.0s'),
            bk('=> transferring dockerfile: 141B', '0.0s'),
            bk('[internal] load metadata for docker.io/library/node:22-alpine', '1.1s'),
            bk('[internal] load .dockerignore', '0.0s'),
            bk('=> transferring context: 29B', '0.0s'),
          ].join('\n'));
          s.cls('r-nm r-git r-env', 'ex');
          await s.shake('r-nm r-git r-env');
        },
      },
      {
        title: 'context を BuildKit へ転送',
        text: '除外後のファイルだけが dockerd 側の BuildKit に送られます（<code>transferring context: 36.8kB</code>）。<code>.dockerignore</code> が無ければ 60MB 超を毎回送ることになります。BuildKit は受け取ったファイルを <code>COPY</code> の入力として使います。',
        code: { title: 'BuildKit の進捗', lang: 'text', src: [
          bk('[internal] load build context', '0.1s'),
          bk('=> transferring context: ⟪36.8kB⟫', '0.0s'),
        ].join('\n') },
        run: async (s) => {
          s.cls('r-ign', null, 'on');
          s.cls('r-df r-ign r-pkg r-lock r-srv r-readme r-src', 'on');
          s.line('ctx:r', 'bk:l', { cls: 'flow', id: 'wc' });
          await s.fly('ctx:r', 'bk:l', { label: 'context 36.8kB', dur: 900 });
          s.state('ctx', null);
          s.state('bk', 'active');
          await s.term('t', [bk('[internal] load build context', '0.1s'), bk('=> transferring context: 36.8kB', '0.0s')].join('\n'));
        },
      },
      {
        title: 'FROM：タグを digest に解決し、ベースの層をそのまま使う',
        text: '<code>node:22-alpine</code> はタグ（付け替え可能な名前）なので、BuildKit はレジストリで digest（<code>@sha256:…</code>、マルチアーキテクチャの index）に解決し、そこから <code>linux/amd64</code> 用の manifest を選びます。ベースイメージのレイヤー（node:22-alpine は 4 層）がそのまま新しいイメージの下の層になります。',
        code: [
          { title: 'BuildKit の進捗', lang: 'text', src: bk('[1/5] FROM docker.io/library/node:22-alpine@sha256:' + NODE_IDX.slice(0, 12) + '…', '0.0s') },
          { title: 'bash', lang: 'bash', src: `
            $ docker image inspect node:22-alpine -f '{{len .RootFS.Layers}}'
            4
            $ docker image inspect node:22-alpine -f '{{index .RepoDigests 0}}'
            node@sha256:${NODE_IDX}` },
        ],
        run: async (s) => {
          s.cls('r-df r-ign r-pkg r-lock r-srv r-readme r-src', null, 'on');
          dfl(s, 1);
          await s.term('t', bk('[1/5] FROM docker.io/library/node:22-alpine@sha256:' + NODE_IDX.slice(0, 12) + '…', '0.0s'));
          await s.show('lb', { fx: 'up' });
        },
      },
      {
        title: 'WORKDIR と COPY package*.json：自前の最初の層',
        text: 'BuildKit は命令ごとに「親レイヤー + 命令」からキャッシュキーを作り、ヒットしなければ実行してファイルシステムの差分をレイヤーにします。<code>WORKDIR /app</code> は <code>/app</code> を作るだけの 0B の層。<code>COPY</code> のキーには <code>package.json</code> と <code>package-lock.json</code> の<b>内容のチェックサム</b>が含まれます（更新時刻は含まれません）。',
        code: { title: 'BuildKit の進捗', lang: 'text', src: [
          bk('[2/5] WORKDIR /app', '0.1s'),
          bk('[3/5] COPY package.json package-lock.json ./', '0.0s'),
        ].join('\n') },
        run: async (s) => {
          dfl(s, 2, 3);
          await s.term('t', [bk('[2/5] WORKDIR /app', '0.1s'), bk('[3/5] COPY package.json package-lock.json ./', '0.0s')].join('\n'));
          await s.fly('bk:r', 'l5:l', { label: 'mkdir /app', dur: 600 });
          await s.show('l5', { fx: 'up' });
          await s.fly('bk:r', 'l6:l', { label: 'package*.json', dur: 600 });
          await s.show('l6', { fx: 'up' });
        },
      },
      {
        title: 'RUN npm ci：一時コンテナで実行し、増えたファイルを層にする',
        text: '<code>RUN</code> は直前の層の上で一時的なコンテナを動かし（shell 形式なので <code>/bin/sh -c "npm ci --omit=dev"</code>）、終了後に<b>増えた・変わったファイル</b>（ここでは <code>/app/node_modules</code>）を tar にしてレイヤーにします。<code>--progress=plain</code> を付けるとコマンドの出力がそのまま読めます。',
        code: { title: 'docker build --progress=plain（抜粋）', lang: 'text', src: `
          #8 [4/5] RUN npm ci --omit=dev
          #8 9.412 added 64 packages, and audited 65 packages in 9s
          #8 9.413
          #8 9.413 found 0 vulnerabilities
          #8 DONE 9.8s` },
        run: async (s) => {
          dfl(s, 4);
          await s.term('t', bk('[4/5] RUN npm ci --omit=dev', '9.8s'));
          await s.fly('bk:r', 'l7:l', { label: 'node_modules/', dur: 600 });
          await s.show('l7', { fx: 'up' });
          await s.scan('l7', { dur: 700 });
        },
      },
      {
        title: 'COPY . . と、レイヤーを作らない EXPOSE / CMD',
        text: 'アプリ本体をコピーして最後のレイヤーができます。<code>EXPOSE</code> と <code>CMD</code> はファイルを変えないので、image config の <code>ExposedPorts</code> / <code>Cmd</code> に書かれるだけです。<code>docker history</code> では 0B、IMAGE 列は最上段以外 <code>&lt;missing&gt;</code>（中間イメージを持たない BuildKit の仕様）と表示されます。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker history web:1.0
          IMAGE          CREATED          CREATED BY                                      SIZE      COMMENT
          a21f6cb024a6   10 seconds ago   CMD ["node" "server.js"]                        0B        buildkit.dockerfile.v0
          <missing>      10 seconds ago   EXPOSE map[3000/tcp:{}]                         0B        buildkit.dockerfile.v0
          <missing>      10 seconds ago   ⟪COPY . . # buildkit⟫                             36.8kB    buildkit.dockerfile.v0
          <missing>      10 seconds ago   ⟪RUN /bin/sh -c npm ci --omit=dev # buildkit⟫     2.1MB     buildkit.dockerfile.v0
          <missing>      21 seconds ago   ⟪COPY package.json package-lock.json ./ # bui…⟫   31.9kB    buildkit.dockerfile.v0
          <missing>      21 seconds ago   WORKDIR /app                                    0B        buildkit.dockerfile.v0
          <missing>      21 months ago    CMD ["node"]                                    0B        buildkit.dockerfile.v0
          <missing>      21 months ago    ENTRYPOINT ["docker-entrypoint.sh"]             0B        buildkit.dockerfile.v0
          …` },
        run: async (s) => {
          dfl(s, 5, 6, 7);
          await s.term('t', bk('[5/5] COPY . .', '0.1s'));
          await s.fly('bk:r', 'l8:l', { label: 'app files', dur: 600 });
          await s.show('l8', { fx: 'up' });
          await s.show('lc', { fx: 'fade' });
        },
      },
      {
        title: 'exporting to image：Image ID は config の sha256',
        text: '最後に BuildKit は image config（JSON）を書き出します。classic store ではその<b>ファイルの sha256 が Image ID</b> です。タグ <code>web:1.0</code> はこの ID を指す名前にすぎず、同じ ID に何個でも付けられます。',
        code: [
          { title: 'BuildKit の進捗', lang: 'text', src: [
            bk('exporting to image', '0.1s'),
            bk('=> exporting layers', '0.1s'),
            bk('=> writing image sha256:' + CFG_DIGEST, ''),
            bk('=> naming to docker.io/library/web:1.0', ''),
          ].join('\n') },
          { title: 'bash', lang: 'bash', src: `
            $ docker images web
            REPOSITORY   TAG       IMAGE ID       CREATED          SIZE
            web          1.0       ⟪a21f6cb024a6⟫   30 seconds ago   153MB` },
        ],
        run: async (s) => {
          dfl(s);
          await s.term('t', [bk('exporting to image', '0.1s'), ' => => writing image sha256:' + CFG_DIGEST, ' => => naming to docker.io/library/web:1.0'].join('\n'));
          s.state('bk', null);
          await s.show('iid', { fx: 'pop' });
          await s.show('tag', { fx: 'pop' });
          s.state('img', 'ok');
        },
      },
      {
        title: '再ビルド：変わっていない命令は CACHED',
        text: '<code>server.js</code> を 1 行変えて再ビルドすると、<code>[2/5]</code>〜<code>[4/5]</code> はキャッシュキーが一致して <b>CACHED</b>、<code>COPY . .</code> だけが再実行されます。npm ci の 9.8 秒が 0 秒になり、新しいイメージ <code>web:1.1</code> も下の 7 層は同じ blob を共有します（ディスクも push 量も増えません）。',
        code: { title: 'bash', lang: 'bash', src: [
          '$ echo \'// v1.1\' >> server.js',
          '$ docker build -t web:1.1 .',
          bk('⟪CACHED⟫ [2/5] WORKDIR /app', '0.0s'),
          bk('⟪CACHED⟫ [3/5] COPY package.json package-lock.json ./', '0.0s'),
          bk('⟪CACHED⟫ [4/5] RUN npm ci --omit=dev', '0.0s'),
          bk('[5/5] COPY . .', '0.1s'),
          bk('=> writing image sha256:' + WEB11.slice(0, 12) + '…', ''),
        ].join('\n') },
        run: async (s) => {
          s.state('img', null);
          s.cls('r-srv', 'mod');
          s.text('r-srv-s', '1.9kB ✎');
          await s.term('t', '$ docker build -t web:1.1 .', { clear: true });
          await s.term('t', [
            bk('CACHED [2/5] WORKDIR /app', '0.0s'),
            bk('CACHED [3/5] COPY package.json package-lock.json ./', '0.0s'),
            bk('CACHED [4/5] RUN npm ci --omit=dev', '0.0s'),
            bk('[5/5] COPY . .', '0.1s'),
          ].join('\n'));
          s.state('l5 l6 l7', 'ok');
          s.set('[data-el="l5"] .node-s', 'sha256:b2116af9f217… <span class="okt">CACHED</span>');
          s.set('[data-el="l6"] .node-s', 'sha256:b020450f9e3a… <span class="okt">CACHED</span>');
          await s.set('[data-el="l7"] .node-s', 'sha256:7a2b52b3eaed… <span class="okt">CACHED</span>');
          await s.text('l8s', 'sha256:' + L8NEW.slice(0, 12) + '… 36.8kB');
          s.state('l8', 'active');
          s.text('iid', 'IMAGE ID ' + WEB11.slice(0, 12));
          s.text('tag', 'docker.io/library/web:1.1');
          s.caption('変わったのは最後の 1 層だけ。npm ci は <code>CACHED</code>（0.0s）', { cls: 'ok' });
        },
      },
      {
        title: '失敗：COPY . . を先に書くと、毎回 npm ci が走る',
        text: '依存のインストールより前に <code>COPY . .</code> を置くと、どのファイルを 1 行変えても COPY 層のチェックサムが変わり、<b>それ以降の命令はすべてキャッシュミス</b>します。npm ci が毎回実行され（9.6 秒）、node_modules の層も毎回別の blob になって push / pull の量も増えます。',
        code: [
          { title: 'Dockerfile（悪い例）', lang: 'dockerfile', src: `
            FROM node:22-alpine
            WORKDIR /app
            ⟪COPY . .⟫
            ⟪RUN npm ci --omit=dev⟫
            EXPOSE 3000
            CMD ["node", "server.js"]` },
          { title: 'bash', lang: 'bash', src: [
            '$ echo \'// v1.2\' >> server.js && docker build -t web:1.2 .',
            bk('CACHED [2/4] WORKDIR /app', '0.0s'),
            bk('[3/4] COPY . .', '0.1s'),
            bk('⟪[4/4] RUN npm ci --omit=dev⟫', '⟪9.6s⟫'),
          ].join('\n') },
        ],
        run: async (s) => {
          s.caption('');
          s.state('l6 l7 l8', null);
          s.hide('iid');
          s.text('tag', 'docker.io/library/web:1.2', { flash: false });
          await s.set('dfp', '<code>' + TIM.codeLines(DF_BAD, 'dockerfile', [3, 4]) + '</code>');
          s.state('df', 'bad');
          await s.term('t', '$ docker build -t web:1.2 .   # server.js を 1 行変えただけ', { clear: true });
          await s.term('t', [bk('CACHED [2/4] WORKDIR /app', '0.0s'), bk('[3/4] COPY . .', '0.1s'), bk('[4/4] RUN npm ci --omit=dev', '9.6s')].join('\n'));
          s.state('l6', 'dim');
          s.set('[data-el="l6"] .node-s', '（この順序では独立した層にならない）');
          s.state('l7', 'bad');
          s.shake('l7');
          await s.set('[data-el="l7"] .node-s', 'sha256: 毎回別の値 <span class="badt">RE-RUN 9.6s</span>');
          s.caption('変更の多いファイルほど後ろへ。依存定義 → install → アプリ本体の順に', { cls: 'bad' });
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 3 — イメージの正体
   * ============================================================= */
  const LTAG = { '9165': 'L1', '9ae1': 'L2', '5963': 'L3', 'fb89': 'L4', 'b211': 'L5', 'b020': 'L6', '7a2b': 'L7', '4a19': 'L8' };
  const ALLBLOBS = [D[7], D[2], MAN_DIGEST, D[6], D[0], D[1], CFG_DIGEST, D[5], D[4], D[3]];

  TIM.scene('#sc-image', {
    intro: '<code>web:1.0</code> を <code>docker save</code> で tar にして、index → manifest → config → layers の digest の鎖をたどります。ステージの SHA-256 は、下のコードパネルに示した JSON の実バイト列を <b>このページ上で WebCrypto により計算</b>した値です。',
    steps: [
      {
        title: 'docker save：イメージを 1 つの tar に書き出す',
        text: 'Docker Engine 25 以降の <code>docker save</code> は <b>OCI Image Layout</b> 形式です。<code>blobs/sha256/</code> の下に、manifest・config・レイヤーが<b>自分の sha256 をファイル名にして</b>並びます。<code>manifest.json</code> と <code>repositories</code> は旧形式を読むツール向けの互換ファイルです。',
        code: { title: 'bash', lang: 'bash', src: [
          '$ docker save web:1.0 -o web.tar',
          '$ du -h web.tar',
          '146M\tweb.tar',
          '$ tar -tf web.tar',
          'blobs/',
          'blobs/sha256/',
          ...ALLBLOBS.map((x) => 'blobs/sha256/' + x),
          'index.json',
          'manifest.json',
          'oci-layout',
          'repositories',
        ].join('\n') },
        run: async (s) => {
          await s.show('tar', { fx: 'up' });
          await s.term('t', '$ docker save web:1.0 -o web.tar\n$ tar -tf web.tar | cut -c1-25');
          await s.scan('tar', { dur: 900 });
        },
      },
      {
        title: 'oci-layout と index.json：ここが入口',
        text: '入口は <code>oci-layout</code>（形式のバージョン）と <code>index.json</code> です。index は「どの manifest を見ればよいか」を <b>digest で</b>指します。タグ名は annotation <code>org.opencontainers.image.ref.name</code> に入っているだけです。',
        code: [
          { title: 'bash', lang: 'bash', src: `
            $ cat oci-layout
            {"imageLayoutVersion": "1.0.0"}
            $ jq . index.json` },
          { title: 'index.json', lang: 'json', src: `
            {
              "schemaVersion": 2,
              "mediaType": "application/vnd.oci.image.index.v1+json",
              "manifests": [
                {
                  "mediaType": "application/vnd.oci.image.manifest.v1+json",
                  "digest": "⟪sha256:${MAN_DIGEST}⟫",
                  "size": 1464,
                  "annotations": {
                    "io.containerd.image.name": "docker.io/library/web:1.0",
                    "org.opencontainers.image.ref.name": "1.0"
                  }
                }
              ]
            }` },
        ],
        run: async (s) => {
          s.cls('b-idx b-lay', 'on');
          await s.term('t', '$ jq . index.json');
          await s.show('idx', { fx: 'right' });
          s.line('b-idx:r', 'idx:l', { cls: 'acc', id: 'wi', elbow: 'h' });
        },
      },
      {
        title: 'manifest：config 1 個と layers 8 個を digest で指す',
        text: 'index が指す <code>blobs/sha256/5e812f9a81df…</code> が manifest です。<b>manifest の JSON（1,464 バイト）をこのページ上で SHA-256 すると</b>、ファイル名・index の <code>digest</code> と同じ値になります。manifest は config と各レイヤーの <code>mediaType</code> / <code>digest</code> / <code>size</code> を持ちます。',
        code: { title: 'blobs/sha256/5e812f9a81df…（ハッシュ対象の実バイト列。実ファイルは改行なし・表示用に改行を挿入）', lang: 'json', src: MAN_JSON.replace(/,(?="(?:config|layers)")/g, ',\n ').replace(/\},\{/g, '},\n  {') },
        run: async (s) => {
          s.cls('b-idx b-lay', null, 'on');
          s.cls('b-5e81', 'on');
          s.text('k-5e81', 'manifest');
          await s.fly('idx:b', 'man:t', { label: 'sha256:5e812f9a81df…', dur: 700 });
          await s.show('man', { fx: 'up' });
          await s.show('calc', { fx: 'up' });
          s.text('cin', 'blobs/sha256/5e812f9a81df…（manifest, ' + bytes(MAN_JSON) + ' bytes）');
          s.text('cexp', MAN_DIGEST);
          const h = await sha(MAN_JSON, MAN_DIGEST);
          await s.scramble('cout', h, { dur: 1100 });
          s.state('calc', h === MAN_DIGEST ? 'ok' : 'bad');
        },
      },
      {
        title: 'config：実行設定と diff_ids',
        text: 'manifest の <code>config.digest</code> が指す blob が image config です。<code>docker run</code> の既定値（<code>Entrypoint</code> / <code>Cmd</code> / <code>Env</code> / <code>WorkingDir</code> / <code>ExposedPorts</code>）、各レイヤーを<b>展開した状態</b>の sha256 である <code>rootfs.diff_ids</code>、各命令の <code>history</code> が入っています。',
        code: [
          { title: 'bash', lang: 'bash', src: `$ jq '{config, rootfs}' blobs/sha256/${CFG_DIGEST}` },
          { title: 'config（jq で抜粋・整形）', lang: 'json', src: `
            {
              "config": {
                "ExposedPorts": { "3000/tcp": {} },
                "Env": [
                  "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                  "NODE_VERSION=22.12.0",
                  "YARN_VERSION=1.22.22"
                ],
                "Entrypoint": [ "docker-entrypoint.sh" ],
                "Cmd": [ ⟪"node", "server.js"⟫ ],
                "WorkingDir": "/app"
              },
              "rootfs": {
                "type": "layers",
                "diff_ids": [
                  ${D.map((x) => '"sha256:' + x + '"').join(',\n                  ')}
                ]
              }
            }` },
        ],
        run: async (s) => {
          s.cls('b-5e81', null, 'on');
          s.cls('b-a21f', 'on');
          s.text('k-a21f', 'config');
          s.state('calc', null);
          s.line('man:r', 'cfg:l', { cls: 'acc', id: 'wm', elbow: 'h' });
          await s.fly('man:r', 'cfg:l', { label: 'config.digest', dur: 700 });
          await s.show('cfg', { fx: 'right' });
        },
      },
      {
        title: 'Image ID ＝ config の sha256（ページ上で計算）',
        text: 'config の JSON（2,994 バイト）をこのページ上で SHA-256 すると <code>a21f6cb0…</code> になり、ファイル名・manifest の <code>config.digest</code>・<code>docker images</code> の IMAGE ID（classic store）のすべてと一致します。名前がそのまま中身の指紋になっている（content-addressable）のがイメージの本質です。',
        code: [
          { title: 'bash', lang: 'bash', src: `
            $ sha256sum blobs/sha256/a21f6cb024a6*
            ${CFG_DIGEST}  blobs/sha256/${CFG_DIGEST}
            $ docker image inspect -f '{{.Id}}' web:1.0
            sha256:${CFG_DIGEST}` },
          { title: 'ハッシュ対象の実バイト列（config。実ファイルは改行なし・表示用に改行を挿入）', lang: 'json', src: CFG_JSON.replace(/,(?="(?:config|created|history|os|rootfs)")/g, ',\n').replace(/\},\{"created"/g, '},\n{"created"') },
        ],
        run: async (s) => {
          await s.term('t', '$ sha256sum blobs/sha256/a21f*');
          s.text('cin', 'blobs/sha256/a21f6cb024a6…（config, ' + bytes(CFG_JSON) + ' bytes）');
          s.text('cexp', CFG_DIGEST);
          const h = await sha(CFG_JSON, CFG_DIGEST);
          await s.scramble('cout', h, { dur: 1100 });
          s.state('calc', h === CFG_DIGEST ? 'ok' : 'bad');
          await s.stamp('calc', 'IMAGE ID', { cls: 'st-ok' });
        },
      },
      {
        title: 'layers：中身はただの tar',
        text: 'レイヤー blob は<b>ファイルシステム差分の tar</b> です。<code>COPY . .</code> の層（L8）を開くと <code>app/</code> 以下のファイルがそのまま入っています（<code>.dockerignore</code> で除外しなかった <code>Dockerfile</code> も入っている点に注意）。下の層のファイルを消した場合は <code>.wh.&lt;name&gt;</code> という whiteout ファイルが入ります。',
        code: { title: 'bash', lang: 'bash', src: `
          $ tar -tvf blobs/sha256/${D[7]}
          drwxr-xr-x 0/0               0 2026-09-28 10:12 app/
          -rw-r--r-- 0/0              29 2026-09-28 10:02 app/.dockerignore
          -rw-r--r-- 0/0             141 2026-09-28 10:02 app/Dockerfile
          -rw-r--r-- 0/0             214 2026-09-28 09:40 app/README.md
          -rw-r--r-- 0/0           31448 2026-09-28 09:52 app/package-lock.json
          -rw-r--r-- 0/0             412 2026-09-28 09:52 app/package.json
          -rw-r--r-- 0/0            1873 2026-09-28 10:11 ⟪app/server.js⟫
          drwxr-xr-x 0/0               0 2026-09-28 10:05 app/src/
          -rw-r--r-- 0/0            1062 2026-09-28 10:05 app/src/db.js
          -rw-r--r-- 0/0            1540 2026-09-28 10:05 app/src/routes.js` },
        run: async (s) => {
          s.cls('b-a21f', null, 'on');
          s.$('.stamp').forEach((e) => e.remove());
          s.state('calc', 'dim');
          Object.keys(LTAG).forEach((k) => { s.text('k-' + k, LTAG[k], { flash: false }); s.cls('b-' + k, 'on'); });
          await s.show('lz', { fx: 'fade' });
          await s.show('c1 c2 c3 c4 c5 c6 c7 c8', { fx: 'pop', stagger: 70 });
          s.state('c8', 'active');
          await s.term('t', '$ tar -tvf blobs/sha256/4a19c8aa…');
        },
      },
      {
        title: 'RootFS.Layers ＝ diff_ids ＝ 非圧縮 tar の sha256',
        text: '<code>docker image inspect</code> の <code>RootFS.Layers</code> は config の <code>diff_ids</code> そのものです。<code>docker save</code> の tar ではレイヤーが非圧縮（<code>application/vnd.oci.image.layer.v1.tar</code>）なので、blob のファイル名とも一致します。コンテナを作るとき Docker はこの順にレイヤーを overlay の lowerdir として積み上げます。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker image inspect -f '{{len .RootFS.Layers}}' web:1.0
          8
          $ docker image inspect -f '{{json .RootFS.Layers}}' web:1.0 | jq .
          [
            ${D.map((x) => '"sha256:' + x + '"').join(',\n            ')}
          ]` },
        run: async (s) => {
          s.state('c8', null);
          s.line('cfg:b', 'lz:t', { cls: 'ok', id: 'wd', label: 'diff_ids ＝ blob 名', lx: 84 });
          await s.term('t', "$ docker image inspect -f '{{len .RootFS.Layers}}' web:1.0\n8");
          s.state('lz', 'ok');
        },
      },
      {
        title: 'push 後：レジストリ上の layer digest は圧縮後の値',
        text: 'push するとレイヤーは gzip 圧縮され、manifest の <code>layers[].digest</code> は<b>圧縮後の sha256</b> になります（config の <code>diff_ids</code> は非圧縮のまま）。pull 側は受け取った blob の sha256 を manifest の値と照合し、展開後のレイヤーを diff_ids と照合します。classic store からの push では Docker v2 の mediaType が使われます。',
        code: [
          { title: 'bash', lang: 'bash', src: `
            $ docker tag web:1.0 registry.example.com/web:1.0
            $ docker push registry.example.com/web:1.0
            $ docker buildx imagetools inspect --raw registry.example.com/web:1.0 | jq '{mediaType, config, layers: .layers[-1:]}'` },
          { title: 'レジストリ上の manifest（抜粋）', lang: 'json', src: `
            {
              "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
              "config": {
                "mediaType": "application/vnd.docker.container.image.v1+json",
                "size": 2994,
                "digest": "sha256:${CFG_DIGEST}"
              },
              "layers": [
                {
                  "mediaType": "⟪application/vnd.docker.image.rootfs.diff.tar.gzip⟫",
                  "size": 13824,
                  "digest": "⟪sha256:${GZ8}⟫"
                }
              ]
            }` },
        ],
        run: async (s) => {
          s.state('lz', null);
          await s.term('t', '$ docker push registry.example.com/web:1.0');
          await s.show('reg', { fx: 'up' });
          await s.fly('c8', 'reg:t', { label: 'gzip → sha256:7d29b75528f0…', dur: 900 });
          s.state('reg', 'warn');
        },
      },
      {
        title: '改ざん：Cmd を 1 か所変えると digest がまったく別物になる',
        text: 'config の <code>"Cmd":["node","server.js"]</code> を <code>["node","miner.js"]</code> に書き換えた JSON をこのページ上で SHA-256 すると、まったく違う値になります。manifest に記録された <code>config.digest</code> と一致しないので、pull では検証で弾かれ、黙って中身を差し替えることはできません。タグは付け替えられますが、<code>@sha256:</code> で固定した参照は中身の同一性を保証します。',
        code: [
          { title: 'diff（config）', lang: 'diff', src: `
            -…"Entrypoint":["docker-entrypoint.sh"],"Cmd":["node","server.js"],"WorkingDir":"/app"}…
            +…"Entrypoint":["docker-entrypoint.sh"],"Cmd":["node","miner.js"],"WorkingDir":"/app"}…` },
          { title: '結果', lang: 'text', src: `
            expected  sha256:${CFG_DIGEST}   ← manifest.config.digest
            actual    sha256:⟪${TAMP_DIGEST}⟫` },
        ],
        run: async (s) => {
          s.state('reg', 'dim');
          s.state('calc', null);
          s.text('cin', 'config の Cmd を ["node","miner.js"] に改ざん（' + bytes(CFG_TAMP) + ' bytes）');
          s.text('cexp', CFG_DIGEST);
          const h = await sha(CFG_TAMP, TAMP_DIGEST);
          await s.scramble('cout', h, { dur: 1100 });
          s.state('calc', h === CFG_DIGEST ? 'ok' : 'bad');
          s.shake('calc');
          await s.stamp('calc', 'MISMATCH', { cls: 'st-bad' });
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 4 — overlay2
   * ============================================================= */
  const OV = '/var/lib/docker/overlay2/';
  TIM.scene('#sc-overlay', {
    intro: '実行中のコンテナ <code>web</code>（<code>web:1.0</code>）の中でファイルを読み・書き・作り・消したとき、<code>/var/lib/docker/overlay2/</code> の下で実際に何が起きるかを見ます。',
    steps: [
      {
        title: 'GraphDriver.Data：overlay を構成する 4 つのパス',
        text: '<code>docker inspect</code> の <code>GraphDriver.Data</code> に、このコンテナの overlay 構成がそのまま出ています。<code>LowerDir</code> は <code>:</code> 区切りで<b>上の層から順に</b>並び、先頭が Docker の <code>-init</code> 層、その下がイメージの 8 層です。<code>UpperDir</code> がコンテナ専用の書き込み層、<code>MergedDir</code> がコンテナの <code>/</code> です。',
        code: [
          { title: 'bash', lang: 'bash', src: `$ docker inspect -f '{{json .GraphDriver.Data}}' web | jq` },
          { title: 'GraphDriver.Data', lang: 'json', src: `
            {
              "LowerDir": "${OV}${RW}-init/diff:${OV}${L8DIR}/diff:${OV}${L7DIR}/diff:…",
              "MergedDir": "⟪${OV}${RW}/merged⟫",
              "UpperDir": "⟪${OV}${RW}/diff⟫",
              "WorkDir": "${OV}${RW}/work"
            }` },
        ],
        run: async (s) => {
          await s.term('t', "$ docker inspect -f '{{json .GraphDriver.Data}}' web | jq");
          s.state('rm', 'active');
          s.state('ru', 'active');
          await s.pulse('ri r8 r7 rb');
          s.state('rm', null);
          s.state('ru', null);
        },
      },
      {
        title: 'カーネルから見ると、ただ 1 つの overlay マウント',
        text: 'dockerd はコンテナ起動時に overlay をマウントします。マウントオプションの長さ制限（1 ページ）を避けるため、lowerdir は <code>/var/lib/docker/overlay2/l/</code> の<b>短縮名シンボリックリンク</b>で指定されます。各層のディレクトリにある <code>lower</code> ファイルが、その下にある層の短縮名の一覧です。',
        code: { title: 'bash', lang: 'bash', src: `
          $ mount -t overlay
          overlay on ${OV}${RW}/merged type overlay (rw,relatime,lowerdir=${OV}l/57AUS6HMHE7HBQ77MZXCGAKJAQ:${OV}l/GMHI7TY3JBV6J5UKXWC4INPRMJ:${OV}l/KF3D2XUKYLRGGEQ2O5SW3XSOA4:…,upperdir=${OV}${RW}/diff,workdir=${OV}${RW}/work)
          $ sudo ls ${OV}${RW}
          diff  link  lower  merged  work
          $ sudo cat ${OV}${RW}/lower
          l/57AUS6HMHE7HBQ77MZXCGAKJAQ:l/GMHI7TY3JBV6J5UKXWC4INPRMJ:l/KF3D2XUKYLRGGEQ2O5SW3XSOA4:…
          $ ls -l ${OV}l/GMHI7TY3JBV6J5UKXWC4INPRMJ
          lrwxrwxrwx 1 root root 72 Sep 28 10:12 ${OV}l/GMHI7TY3JBV6J5UKXWC4INPRMJ -> ../${L8DIR}/diff` },
        run: async (s) => {
          await s.term('t', '$ mount -t overlay');
          await s.show('mnt', { fx: 'up' });
          s.state('work', 'active');
        },
      },
      {
        title: '-init 層：Docker が差し込む薄い層',
        text: 'イメージ層とコンテナ層の間に、Docker は <code>&lt;id&gt;-init</code> 層を挟みます。中身は <code>/.dockerenv</code> や空の <code>/etc/hosts</code>・<code>/etc/resolv.conf</code>・<code>/etc/hostname</code> などのマウントポイント。これらの実体は <code>/var/lib/docker/containers/&lt;id&gt;/hosts</code> などで、起動時に bind mount されます（だからコンテナ内で編集しても <code>docker diff</code> には出ません）。',
        code: { title: 'bash', lang: 'bash', src: `
          $ sudo find ${OV}${RW}-init/diff -mindepth 1 | sed 's|.*-init/diff||' | LC_ALL=C sort
          /.dockerenv
          /dev
          /dev/console
          /dev/pts
          /dev/shm
          /etc
          /etc/hostname
          /etc/hosts
          /etc/mtab
          /etc/resolv.conf
          /proc
          /sys
          $ docker exec web grep /etc/hosts /proc/mounts
          /dev/sda1 /etc/hosts ext4 rw,relatime 0 0` },
        run: async (s) => {
          s.state('work', null);
          s.state('ri', 'active');
          await s.term('t', '$ sudo find …/da2ecc9f0374…-init/diff');
          await s.pulse('i1');
        },
      },
      {
        title: '読み取り：上の層から順に探し、最初に見つかったものを返す',
        text: 'コンテナが <code>/app/server.js</code> を読むと、overlayfs は upperdir → <code>-init</code> → <code>COPY . .</code> の層…と上から順に探し、最初に見つかった <code>COPY . .</code> 層の実ファイルをそのまま返します。<b>読むだけならコピーは発生しません。</b>',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker exec web head -n 2 /app/server.js
          const http = require('http');
          const { router } = require('./src/routes');` },
        run: async (s) => {
          s.state('ri', null);
          await s.term('t', '$ docker exec web head -n 2 /app/server.js');
          await s.scan('ru', { dur: 350 });
          await s.scan('ri', { dur: 350 });
          await s.scan('r8', { dur: 350 });
          s.state('l8a', 'active');
          await s.line('l8a:t', 'm1:b', { cls: 'dash', id: 'rd' });
        },
      },
      {
        title: '書き込み：copy_up でファイルを丸ごと upperdir へ',
        text: '<code>/app/server.js</code> に 1 行追記すると、overlayfs はまず<b>ファイル全体</b>を <code>COPY . .</code> 層から upperdir にコピー（copy_up。<code>work/</code> で作ってから rename で配置）し、そのコピーを書き換えます。下の層の <code>server.js</code>（1,873 バイト）は変わらず、merged からは upperdir 側（1,884 バイト）が見えます。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker exec web sh -c 'echo "// patched" >> /app/server.js'
          $ sudo ls -l ${OV}${RW}/diff/app/
          total 4
          -rw-r--r-- 1 root root ⟪1884⟫ Sep 28 10:31 server.js
          $ sudo ls -l ${OV}${L8DIR}/diff/app/server.js
          -rw-r--r-- 1 root root ⟪1873⟫ Sep 28 10:11 ${OV}${L8DIR}/diff/app/server.js` },
        run: async (s) => {
          s.state('l8a', null);
          s.hide('rd');
          await s.term('t', `$ docker exec web sh -c 'echo "// patched" >> /app/server.js'`);
          s.state('work', 'active');
          await s.fly('l8a', 'u1', { label: 'copy_up', dur: 900 });
          await s.show('u1', { fx: 'pop' });
          s.state('work', null);
          await s.line('u1:t', 'm1:b', { cls: 'acc', id: 'wr' });
          s.state('m1', 'active');
        },
      },
      {
        title: '新規作成：upperdir にだけ現れる',
        text: '<code>touch /tmp/cache.db</code> のように新しく作ったファイルは upperdir にだけ作られ、merged に現れます。親ディレクトリ <code>/tmp</code> も upperdir 側にディレクトリとして作られます（ディレクトリの copy_up）。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker exec web touch /tmp/cache.db
          $ sudo ls -la ${OV}${RW}/diff/tmp/
          total 8
          drwxrwxrwt 2 root root 4096 Sep 28 10:32 .
          drwxr-xr-x 4 root root 4096 Sep 28 10:32 ..
          -rw-r--r-- 1 root root    0 Sep 28 10:32 ⟪cache.db⟫` },
        run: async (s) => {
          s.state('m1', null);
          await s.term('t', '$ docker exec web touch /tmp/cache.db');
          await s.show('u4', { fx: 'pop' });
          await s.line('u4:t', 'm4:b', { cls: 'ok', id: 'wn' });
          await s.show('m4', { fx: 'pop' });
        },
      },
      {
        title: '削除：whiteout（0/0 のキャラクタデバイス）で隠す',
        text: '下の層のファイルは消せないので、overlayfs は upperdir に<b>同名の whiteout</b>（デバイス番号 0/0 のキャラクタデバイス）を作り、merged から見えなくします。<code>COPY . .</code> 層の <code>README.md</code> はそのまま残ります。イメージの tar では、同じことを <code>.wh.README.md</code> というファイルで表します。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker exec web rm /app/README.md
          $ sudo stat -c '%F %t,%T' ${OV}${RW}/diff/app/README.md
          ⟪character special file 0,0⟫
          $ docker exec web ls /app
          Dockerfile
          node_modules
          package-lock.json
          package.json
          server.js
          src` },
        run: async (s) => {
          await s.term('t', '$ docker exec web rm /app/README.md');
          await s.show('u2', { fx: 'pop' });
          s.line('u2:t', 'm2:b', { cls: 'bad', id: 'wx', arrow: false });
          s.state('m2', 'bad');
          await s.hide('m2', { dur: 500 });
          await s.pulse('l8b');
        },
      },
      {
        title: 'docker diff ＝ upperdir の一覧',
        text: '<code>docker diff</code> は upperdir を走査した結果です。<code>A</code> = 追加、<code>C</code> = 変更（中身が変わったディレクトリも C）、<code>D</code> = 削除（whiteout）。<code>-init</code> 層や bind mount（<code>/etc/hosts</code> など）への変更は出ません。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker diff web
          C /app
          D /app/README.md
          C /app/server.js
          C /tmp
          A /tmp/cache.db` },
        run: async (s) => {
          await s.term('t', '$ docker diff web\nC /app\nD /app/README.md\nC /app/server.js\nC /tmp\nA /tmp/cache.db', { clear: true });
          await s.scan('ru', { dur: 800 });
          s.state('ru', 'active');
        },
      },
      {
        title: 'commit すると upperdir が新しい層に、rm すると消える',
        text: '<code>docker commit</code> は upperdir の差分を tar にして、9 層目として積んだ新しいイメージを作ります（<code>-init</code> 層は含まれません）。逆に <code>docker rm</code> すると <code>overlay2/&lt;id&gt;</code> ごと削除され、書き込んだ内容は消えます。残したいデータは volume（<code>/var/lib/docker/volumes/&lt;name&gt;/_data</code>）か bind mount に置きます。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker commit web web:patched
          sha256:${COMMIT}
          $ docker image inspect -f '{{len .RootFS.Layers}}' web:patched
          ⟪9⟫
          $ docker volume create pgdata
          pgdata
          $ docker volume inspect -f '{{.Mountpoint}}' pgdata
          /var/lib/docker/volumes/pgdata/_data` },
        run: async (s) => {
          await s.term('t', '$ docker commit web web:patched\nsha256:' + COMMIT.slice(0, 12) + '…');
          await s.stamp('ru', 'commit → 9 層目', { cls: 'st-ok' });
          s.caption('upperdir はコンテナと一緒に消える。永続データは volume へ', { y: 478 });
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 5 — namespaces と cgroup
   * ============================================================= */
  const CG = '/sys/fs/cgroup/system.slice/docker-' + CID + '.scope';
  TIM.scene('#sc-ns', {
    intro: '同じ <code>node server.js</code> が、ホストからは PID 4321、コンテナの中からは PID 1 に見えます。その差を作っている namespaces（<code>/proc/&lt;pid&gt;/ns</code>）と、メモリ・CPU の上限を作っている cgroup v2 のファイルを直接見ます。',
    steps: [
      {
        title: 'ホストから見ると、コンテナはただのプロセス',
        text: 'ホストの <code>ps</code> で見ると、<code>node server.js</code> は PID 4321、親は <code>containerd-shim-runc-v2</code>（PID 4298）です。<code>docker top</code> もホスト側の PID で表示します。「コンテナ」というカーネルオブジェクトは存在せず、あるのは<b>namespace と cgroup を付けられたプロセス</b>だけです。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker inspect -f '{{.State.Pid}}' web
          4321
          $ ps -o pid,ppid,user,args --ppid 4298
              PID    PPID USER     COMMAND
             ⟪4321⟫    4298 root     node server.js
          $ docker top web
          UID      PID      PPID     C    STIME    TTY    TIME        CMD
          root     4321     4298     0    10:02    ?      00:00:00    node server.js` },
        run: async (s) => {
          await s.pulse('h1 h2 h3 h4');
          s.state('h4', 'active');
        },
      },
      {
        title: 'コンテナの中では PID 1',
        text: '同じプロセスを <code>docker exec</code> で中から見ると PID 1 です。<code>/proc/&lt;pid&gt;/status</code> の <code>NSpid</code> 行には、入れ子になった PID namespace ごとの番号（ホスト 4321、コンテナ 1）が並びます。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker exec web ps
          PID   USER     TIME  COMMAND
              ⟪1⟫ root      0:00 node server.js
             13 root      0:00 ps
          $ grep NSpid /proc/4321/status
          NSpid:	⟪4321	1⟫` },
        run: async (s) => {
          await s.show('cz', { fx: 'fade' });
          await s.show('c1', { fx: 'right' });
          await s.line('h4:r', 'c1:l', { cls: 'acc', id: 'm1', label: 'NSpid: 4321 1', both: true });
        },
      },
      {
        title: 'docker exec は、同じ namespaces に入る別のプロセス',
        text: '<code>docker exec</code> は新しいコンテナを作るのではなく、<code>runc exec</code>（<code>setns(2)</code>）で<b>既存の namespaces と cgroup に新しいプロセスを追加</b>します。ホストでは PID 4388（親は同じ shim）、中では PID 13 です。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker exec web sleep 300 &
          $ ps -o pid,ppid,args --ppid 4298
              PID    PPID COMMAND
             4321    4298 node server.js
             ⟪4388⟫    4298 sleep 300
          $ grep NSpid /proc/4388/status
          NSpid:	4388	⟪13⟫` },
        run: async (s) => {
          await s.show('h5', { fx: 'up' });
          await s.show('c13', { fx: 'up' });
          await s.line('h5:r', 'c13:l', { cls: 'dash', id: 'm2', label: 'NSpid: 4388 13', both: true });
        },
      },
      {
        title: '/proc/&lt;pid&gt;/ns：namespace はファイルとして見える',
        text: '<code>/proc/4321/ns/</code> の各シンボリックリンクの <code>[数字]</code> は namespace の inode 番号です。ホストの PID 1（<code>/proc/1/ns</code>）と比べると、cgroup・ipc・mnt・net・pid・uts が別物で、<b>user と time は同じ</b>（Docker は既定で user namespace を使わない）ことが分かります。',
        code: { title: 'bash', lang: 'bash', src: `
          $ sudo ls -l /proc/4321/ns
          lrwxrwxrwx 1 root root 0 Sep 28 10:05 cgroup -> 'cgroup:[4026532384]'
          lrwxrwxrwx 1 root root 0 Sep 28 10:05 ipc -> 'ipc:[4026532320]'
          lrwxrwxrwx 1 root root 0 Sep 28 10:05 mnt -> 'mnt:[4026532318]'
          lrwxrwxrwx 1 root root 0 Sep 28 10:05 net -> 'net:[4026532323]'
          lrwxrwxrwx 1 root root 0 Sep 28 10:05 pid -> 'pid:[4026532321]'
          lrwxrwxrwx 1 root root 0 Sep 28 10:05 pid_for_children -> 'pid:[4026532321]'
          lrwxrwxrwx 1 root root 0 Sep 28 10:05 time -> 'time:[4026531834]'
          lrwxrwxrwx 1 root root 0 Sep 28 10:05 time_for_children -> 'time:[4026531834]'
          lrwxrwxrwx 1 root root 0 Sep 28 10:05 ⟪user -> 'user:[4026531837]'⟫
          lrwxrwxrwx 1 root root 0 Sep 28 10:05 uts -> 'uts:[4026532319]'
          $ sudo readlink /proc/1/ns/pid /proc/1/ns/user
          pid:[4026531836]
          user:[4026531837]` },
        run: async (s) => {
          await s.show('nsf', { fx: 'up' });
          await s.scan('nsf', { dur: 900 });
        },
      },
      {
        title: 'lsns：どの namespace に何個のプロセスがいるか',
        text: '<code>lsns -p 4321</code> は、そのプロセスが属する namespace の一覧です。mnt〜cgroup は <code>NPROCS 2</code>（node と exec した sleep）、user と time はホスト全体（PID 1 の <code>/sbin/init</code> が代表）と共有です。<b>コンテナ内の root は、ホストの uid 0 そのもの</b>です。',
        code: { title: 'bash', lang: 'bash', src: `
          $ sudo lsns -p 4321
                  NS TYPE   NPROCS   PID USER COMMAND
          4026531834 time      187     1 root /sbin/init
          ⟪4026531837 user      187     1 root /sbin/init⟫
          4026532318 mnt         2  4321 root node server.js
          4026532319 uts         2  4321 root node server.js
          4026532320 ipc         2  4321 root node server.js
          4026532321 pid         2  4321 root node server.js
          4026532323 net         2  4321 root node server.js
          4026532384 cgroup      2  4321 root node server.js
          $ docker exec web id
          uid=0(root) gid=0(root) groups=0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)` },
        run: async (s) => {
          await s.pulse('nsf');
          s.state('nsf', 'warn');
        },
      },
      {
        title: 'nsenter：外から namespace に入って見る',
        text: '<code>nsenter -t 4321 -u</code> は uts namespace だけに入って <code>hostname</code> を実行します（コンテナ ID の先頭 12 桁）。<code>-n</code> なら net namespace に入り、<b>ホストの <code>ip</code> コマンドで</b>コンテナの <code>eth0</code> を見られます（中に ip コマンドが無いイメージのデバッグに便利）。',
        code: { title: 'bash', lang: 'bash', src: `
          $ sudo nsenter -t 4321 -u hostname
          ⟪${C12}⟫
          $ sudo nsenter -t 4321 -n ip -4 -br addr
          lo               UNKNOWN        127.0.0.1/8
          eth0@if7         UP             ⟪172.17.0.2/16⟫` },
        run: async (s) => {
          s.state('nsf', null);
          await s.show('xh', { fx: 'pop' });
          await s.show('xn', { fx: 'pop' });
        },
      },
      {
        title: 'cgroup v2：制限は /sys/fs/cgroup のファイル',
        text: 'systemd cgroup driver では、コンテナの cgroup は <code>/sys/fs/cgroup/system.slice/docker-&lt;id&gt;.scope/</code> です。<code>--memory 256m</code> は <code>memory.max</code> = 268435456、<code>--cpus 1.5</code> は <code>cpu.max</code> = <code>150000 100000</code>（100ms 周期に 150ms）として runc が書き込んだものです。',
        code: { title: 'bash', lang: 'bash', src: `
          $ cat /proc/4321/cgroup
          0::/system.slice/docker-${CID}.scope
          $ cd ${CG}
          $ cat memory.max cpu.max
          ⟪268435456⟫
          ⟪150000 100000⟫
          $ cat cgroup.procs
          4321
          4388` },
        run: async (s) => {
          await s.show('cg', { fx: 'up' });
          s.state('k-mem', 'active');
          await s.pulse('k-mem k-cpu');
        },
      },
      {
        title: 'docker update：実行中に cgroup ファイルを書き換える',
        text: '<code>docker update --memory 512m</code> は、コンテナを止めずに <code>memory.max</code> を書き換えるだけです（ここでは swap 上限も同時に変更）。<code>docker stats</code> の LIMIT もこのファイルの値です。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker update --memory 512m --memory-swap 1g web
          web
          $ cat ${CG}/memory.max
          ⟪536870912⟫
          $ docker stats --no-stream web
          CONTAINER ID   NAME   CPU %   MEM USAGE / LIMIT   MEM %   NET I/O        BLOCK I/O   PIDS
          ${C12}   web    0.01%   22.7MiB / ⟪512MiB⟫    4.43%   1.2kB / 862B   0B / 0B     8` },
        run: async (s) => {
          s.state('k-mem', 'active');
          await s.count('mmax', 268435456, 536870912, { dur: 1000, fmt: (v) => String(Math.round(v)) });
          await s.text('mnote', '← docker update 512m');
        },
      },
      {
        title: '中から見ると、自分の cgroup が / に見える',
        text: 'cgroup v2 の Docker は既定で cgroup namespace も分けます（<code>--cgroupns=private</code>）。コンテナの中では自分の cgroup がルート <code>0::/</code> に見え、<code>/sys/fs/cgroup/memory.max</code> を読めば自分の上限が分かります。JVM や Node.js がコンテナのメモリ上限を知るのもこのファイルです。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker exec web cat /proc/self/cgroup
          ⟪0::/⟫
          $ docker exec web cat /sys/fs/cgroup/memory.max
          536870912` },
        run: async (s) => {
          s.state('k-mem', null);
          await s.show('xc', { fx: 'pop' });
          s.caption('コンテナ ＝ namespaces（見える範囲）+ cgroup（使える量）を付けたプロセス', { cls: 'ok', x: 717, y: 462 });
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 6 — ネットワーク
   * ============================================================= */
  TIM.scene('#sc-net', {
    intro: '<code>docker run -p 8080:3000</code> したコンテナに、外部のクライアント <code>192.0.2.10</code> から <code>http://198.51.100.20:8080/</code> でアクセスしたとき、パケットがどこで書き換わり、どのインターフェースを通るかを追います。',
    steps: [
      {
        title: 'docker0：ホスト上の Linux ブリッジ',
        text: 'Docker は起動時に Linux ブリッジ <code>docker0</code> を作り、<code>172.17.0.1/16</code> を付けます。これが既定の <code>bridge</code> ネットワークの実体で、コンテナから見たデフォルトゲートウェイです。',
        code: { title: 'bash', lang: 'bash', src: `
          $ ip -br addr show docker0
          docker0          UP             ⟪172.17.0.1/16⟫
          $ docker network inspect bridge -f '{{json .IPAM.Config}}'
          [{"Subnet":"172.17.0.0/16","Gateway":"172.17.0.1"}]
          $ docker network inspect bridge -f '{{index .Options "com.docker.network.bridge.name"}}'
          docker0` },
        run: async (s) => {
          s.state('br', 'active');
          await s.pulse('br');
        },
      },
      {
        title: 'veth ペア：片方はブリッジ、片方はコンテナの eth0',
        text: 'コンテナごとに veth ペア（仮想の LAN ケーブル）が作られ、片方 <code>veth3a1f2c9</code> は docker0 に接続、もう片方はコンテナの net namespace に移されて <code>eth0</code> に改名されます。<code>@if7</code> / <code>@if6</code> は相手側のインターフェース番号です。',
        code: { title: 'bash', lang: 'bash', src: `
          $ ip -br link show master docker0
          veth3a1f2c9@if6  UP             8e:51:3c:0a:7d:12 <BROADCAST,MULTICAST,UP,LOWER_UP>
          $ docker exec web ip -4 addr show eth0
          6: ⟪eth0@if7⟫: <BROADCAST,MULTICAST,UP,LOWER_UP,M-DOWN> mtu 1500 qdisc noqueue state UP
              inet 172.17.0.2/16 brd 172.17.255.255 scope global eth0
                 valid_lft forever preferred_lft forever` },
        run: async (s) => {
          s.state('br', null);
          await s.show('veth', { fx: 'up' });
          await s.line('br:b', 'veth:t', { cls: 'acc', id: 'n1' });
          await s.show('cns', { fx: 'fade' });
          await s.show('ceth', { fx: 'left' });
          await s.line('veth:r', 'ceth:l', { cls: 'acc', id: 'n2', label: 'veth pair', both: true, elbow: 'h' });
        },
      },
      {
        title: 'コンテナの IP とルーティング',
        text: 'Docker の IPAM が <code>172.17.0.0/16</code> から <code>172.17.0.2</code> を割り当て、デフォルトルートを docker0（<code>172.17.0.1</code>）に向けます。アプリは namespace 内の <code>0.0.0.0:3000</code> で待ち受けます。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} gw={{.Gateway}}{{end}}' web
          172.17.0.2 gw=172.17.0.1
          $ sudo nsenter -t 4321 -n ip route
          default via 172.17.0.1 dev eth0
          172.17.0.0/16 dev eth0 proto kernel scope link src 172.17.0.2
          $ sudo nsenter -t 4321 -n ss -ltn
          State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process
          LISTEN 0      511          0.0.0.0:3000      0.0.0.0:*` },
        run: async (s) => {
          await s.show('app', { fx: 'up' });
          await s.line('ceth:b', 'app:t', { cls: 'acc', id: 'n3' });
        },
      },
      {
        title: '-p 8080:3000 の正体：nat テーブルの DNAT ルール',
        text: '<code>-p 8080:3000</code> を付けると、dockerd が iptables の <b>nat テーブル</b>にルールを入れます。<code>PREROUTING</code> でホスト宛て（<code>--dst-type LOCAL</code>）のパケットを <code>DOCKER</code> チェーンへ送り、そこで <code>tcp dpt:8080</code> を <code>172.17.0.2:3000</code> に <b>DNAT</b>（宛先書き換え）します。',
        code: { title: 'bash', lang: 'bash', src: `
          $ sudo iptables -t nat -L DOCKER -n
          Chain DOCKER (2 references)
          target     prot opt source               destination
          RETURN     all  --  0.0.0.0/0            0.0.0.0/0
          ⟪DNAT       tcp  --  0.0.0.0/0            0.0.0.0/0            tcp dpt:8080 to:172.17.0.2:3000⟫
          $ sudo iptables -t nat -S | grep -e DOCKER -e MASQ
          -N DOCKER
          -A PREROUTING -m addrtype --dst-type LOCAL -j DOCKER
          -A OUTPUT ! -d 127.0.0.0/8 -m addrtype --dst-type LOCAL -j DOCKER
          -A POSTROUTING -s 172.17.0.0/16 ! -o docker0 -j MASQUERADE
          -A DOCKER -i docker0 -j RETURN
          -A DOCKER ! -i docker0 -p tcp -m tcp --dport 8080 -j DNAT --to-destination 172.17.0.2:3000` },
        run: async (s) => {
          await s.show('ipt', { fx: 'up' });
          s.state('ipt', 'active');
        },
      },
      {
        title: '外から来たパケット：PREROUTING で宛先が書き換わる',
        text: 'クライアントの SYN は <code>198.51.100.20:8080</code> 宛てに <code>eth0</code> へ届き、nat PREROUTING → DOCKER チェーンで宛先が <code>172.17.0.2:3000</code> に書き換わります。宛先がホスト自身ではなくなったので、パケットは INPUT ではなく <b>FORWARD</b> 経路で docker0 → veth → コンテナの eth0 へ流れます。',
        code: { title: 'パケットの宛先（tcpdump で見える値）', lang: 'text', src: `
          eth0     IP 192.0.2.10.51234 > 198.51.100.20.8080: Flags [S]
          docker0  IP 192.0.2.10.51234 > ⟪172.17.0.2.3000⟫: Flags [S]      ← DNAT 後
          eth0@if7 IP 192.0.2.10.51234 > 172.17.0.2.3000: Flags [S]` },
        run: async (s) => {
          s.state('ipt', null);
          await s.fly('client:r', 'eth0:l', { label: 'dst 198.51.100.20:8080', dur: 800 });
          await s.fly('eth0:r', 'ipt:l', { label: 'PREROUTING', dur: 500 });
          s.state('ipt', 'warn');
          await s.fly('ipt:b', 'br:t', { label: 'dst 172.17.0.2:3000', dur: 700 });
          await s.fly('br:b', 'veth:t', { dur: 400 });
          await s.fly('veth:r', 'ceth:l', { dur: 400 });
          await s.fly('ceth:b', 'app:t', { dur: 400 });
          s.state('app', 'ok');
        },
      },
      {
        title: '戻りのパケット：conntrack が元の宛先に戻す',
        text: 'NAT の対応は conntrack テーブルに記録されていて、アプリの応答（送信元 <code>172.17.0.2:3000</code>）は自動的に <code>198.51.100.20:8080</code> に書き戻されてクライアントへ返ります。クライアントからはホストの 8080 番と話しているようにしか見えません。',
        code: { title: 'bash', lang: 'bash', src: `
          $ sudo conntrack -L -p tcp --dport 8080
          tcp      6 431999 ESTABLISHED src=192.0.2.10 dst=⟪198.51.100.20⟫ sport=51234 dport=⟪8080⟫ src=⟪172.17.0.2⟫ dst=192.0.2.10 sport=⟪3000⟫ dport=51234 [ASSURED] mark=0 use=1
          conntrack v1.4.8 (conntrack-tools): 1 flow entries have been shown.` },
        run: async (s) => {
          s.state('ipt', null);
          await s.fly('app:t', 'ceth:b', { label: 'src 172.17.0.2:3000', cls: 'ghost', dur: 500 });
          await s.fly('ceth:l', 'br:r', { cls: 'ghost', dur: 500 });
          await s.fly('br:t', 'ipt:b', { cls: 'ghost', dur: 500 });
          await s.fly('ipt:l', 'client:r', { label: 'src 198.51.100.20:8080', cls: 'ghost', dur: 800, arc: 30 });
          await s.show('ct', { fx: 'pop' });
          s.state('app', null);
        },
      },
      {
        title: 'localhost:8080 は docker-proxy が受ける',
        text: 'nat OUTPUT のルールは <code>! -d 127.0.0.0/8</code> なので、ホスト上で <code>curl localhost:8080</code> した通信は DNAT されません。そこで dockerd は <code>-p</code> ごとに <b>docker-proxy</b> を起動して <code>0.0.0.0:8080</code> / <code>[::]:8080</code> を実際に listen させ、コンテナへ中継します（<code>"userland-proxy": false</code> で無効化可）。',
        code: { title: 'bash', lang: 'bash', src: `
          $ sudo ss -ltnp 'sport = :8080'
          State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process
          LISTEN 0      4096         0.0.0.0:8080      0.0.0.0:*     users:(("⟪docker-proxy⟫",pid=4270,fd=7))
          LISTEN 0      4096            [::]:8080         [::]:*     users:(("docker-proxy",pid=4277,fd=7))
          $ ps -o args= -p 4270
          /usr/bin/docker-proxy -proto tcp -host-ip 0.0.0.0 -host-port 8080 -container-ip 172.17.0.2 -container-port 3000 …` },
        run: async (s) => {
          await s.show('proxy', { fx: 'pop' });
          await s.show('local', { fx: 'pop' });
          await s.fly('local:t', 'proxy:b', { label: '127.0.0.1:8080', dur: 500 });
          await s.fly('proxy:b', 'br:r', { label: '→ 172.17.0.2:3000', dur: 900, arc: -40 });
          await s.fly('br:b', 'veth:t', { dur: 350 });
          await s.fly('veth:r', 'ceth:l', { dur: 350 });
          await s.fly('ceth:b', 'app:t', { dur: 350 });
        },
      },
      {
        title: 'コンテナから外へ：POSTROUTING の MASQUERADE',
        text: 'コンテナが外部（例：<code>203.0.113.50:443</code>）へ接続すると、パケットは docker0 からホストの eth0 へ転送され、nat <code>POSTROUTING</code> の <code>MASQUERADE</code> で送信元がホストの <code>198.51.100.20</code> に書き換わります。転送に必要な <code>net.ipv4.ip_forward=1</code> も Docker が有効にします。',
        code: { title: 'bash', lang: 'bash', src: `
          $ sudo iptables -t nat -L POSTROUTING -n
          Chain POSTROUTING (policy ACCEPT)
          target     prot opt source               destination
          ⟪MASQUERADE  all  --  172.17.0.0/16        0.0.0.0/0⟫
          $ sysctl net.ipv4.ip_forward
          net.ipv4.ip_forward = 1` },
        run: async (s) => {
          await s.fly('app:t', 'ceth:b', { label: 'dst 203.0.113.50:443', dur: 500 });
          await s.fly('ceth:l', 'br:r', { dur: 450 });
          await s.fly('br:t', 'ipt:b', { dur: 450 });
          s.state('ipt', 'active');
          await s.fly('ipt:l', 'eth0:r', { label: 'src → 198.51.100.20', dur: 600 });
          await s.show('fw', { fx: 'pop' });
          s.state('ipt', null);
        },
      },
      {
        title: 'DNS：既定 bridge はホストの設定をコピー、ユーザー定義網は 127.0.0.11',
        text: '既定の <code>bridge</code> ネットワークでは、コンテナの <code>/etc/resolv.conf</code> はホストの設定から作られます（systemd-resolved の <code>127.0.0.53</code> のようなループバックは使えないので上流サーバーに置き換え）。<code>docker network create</code> したユーザー定義ネットワークでは Docker の組み込み DNS <code>127.0.0.11</code> が入り、コンテナ名で名前解決できます。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker exec web grep ^nameserver /etc/resolv.conf
          nameserver 192.168.1.1
          $ docker network create appnet
          $ docker run --rm --network appnet alpine grep ^nameserver /etc/resolv.conf
          nameserver ⟪127.0.0.11⟫` },
        run: async (s) => {
          await s.show('dns', { fx: 'pop' });
          s.caption('<code>-p</code> ＝ iptables DNAT ＋ docker-proxy', { cls: 'ok', x: 680, y: 468 });
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 7 — 失敗ケース
   * ============================================================= */
  const HIDE1 = 'a1 a2 a3 f1';
  const HIDE2 = 'b1 b2 b3 b4';
  TIM.scene('#sc-fail', {
    intro: '① 同じホストポートを 2 つのコンテナが要求したとき、② メモリ上限を超えたとき、③ <code>docker stop</code> が 10 秒待たされるとき。それぞれ<b>どこで</b>失敗し、<b>何が</b>記録されるかを実際の出力で確認します。',
    steps: [
      {
        title: '① ポート衝突：2 つ目の -p 8080 が start で失敗',
        text: 'すでに <code>web</code> が <code>0.0.0.0:8080</code> を確保している状態で、もう 1 つ <code>-p 8080:3000</code> のコンテナを起動します。<code>POST /containers/create</code>（201）は成功しますが、start でネットワークを設定する段階で dockerd のポート割り当てが失敗し、CLI は終了コード <b>125</b> で終わります。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker run -d --name web2 -p 8080:3000 web:1.0
          docker: Error response from daemon: failed to set up container networking: driver failed programming external connectivity on endpoint web2 (${EP}): ⟪Bind for 0.0.0.0:8080 failed: port is already allocated⟫

          Run 'docker run --help' for more information
          $ echo $?
          ⟪125⟫` },
        run: async (s) => {
          s.state('k1', 'active');
          s.state('k2 k3', 'dim');
          await s.show('a1', { fx: 'up' });
          await s.term('t', '$ docker run -d --name web2 -p 8080:3000 web:1.0');
          await s.show('a2', { fx: 'up' });
          await s.line('a2:t', 'a1:b', { cls: 'bad', id: 'f1', label: '8080 は使用中' });
          await s.term('t', `docker: Error response from daemon: failed to set up container networking: driver failed programming external connectivity on endpoint web2 (${EP}): Bind for 0.0.0.0:8080 failed: port is already allocated\n\nRun 'docker run --help' for more information\n$ echo $?\n125`);
          s.state('a2', 'bad');
          s.shake('a2');
        },
      },
      {
        title: 'コンテナは Created のまま残る',
        text: '作成（create）までは済んでいるので、<code>web2</code> は <code>Created</code> 状態で残ります。同じ名前で作り直すには先に <code>docker rm web2</code> が必要です（しないと <code>Conflict. The container name "/web2" is already in use …</code>）。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker ps -a --filter name=web2 --format '{{.Names}}  {{.Status}}'
          web2  ⟪Created⟫
          $ docker inspect -f '{{.State.Status}} {{.State.Error}}' web2
          created failed to set up container networking: driver failed programming external connectivity on endpoint web2 (${EP}): Bind for 0.0.0.0:8080 failed: port is already allocated` },
        run: async (s) => {
          await s.term('t', "$ docker ps -a --filter name=web2 --format '{{.Names}}  {{.Status}}'\nweb2  Created");
          await s.stamp('a2', 'Created', { cls: 'st-warn' });
        },
      },
      {
        title: '誰が 8080 を持っているかを調べて直す',
        text: '<code>docker ps --filter publish=8080</code> で、そのポートを公開しているコンテナが分かります。Docker 以外のプロセスが握っている場合は <code>address already in use</code> を含むエラーになるので、<code>ss -ltnp</code> で持ち主を探します。別のホストポートにすれば起動できます。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker ps --filter publish=8080 --format '{{.Names}}  {{.Ports}}'
          ⟪web⟫  0.0.0.0:8080->3000/tcp, [::]:8080->3000/tcp
          $ sudo ss -ltnp 'sport = :8080'
          LISTEN 0 4096 0.0.0.0:8080 0.0.0.0:* users:(("docker-proxy",pid=4270,fd=7))
          $ docker rm web2 && docker run -d --name web2 -p ⟪8081⟫:3000 web:1.0
          web2
          ${WEB2}` },
        run: async (s) => {
          await s.term('t', "$ docker ps --filter publish=8080 --format '{{.Names}}  {{.Ports}}'\nweb  0.0.0.0:8080->3000/tcp, [::]:8080->3000/tcp\n$ docker rm web2 && docker run -d --name web2 -p 8081:3000 web:1.0\nweb2\n" + WEB2);
          await s.show('a3', { fx: 'pop' });
          s.state('k1', 'ok');
        },
      },
      {
        title: '② OOM：256MiB 制限のコンテナで 512MiB を確保する',
        text: '<code>-m 256m --memory-swap 256m</code>（swap なし）のコンテナで、Python に 512MiB の bytes を作らせます。メモリは実際に書き込まれるので <code>memory.current</code> が <code>memory.max</code> に達し、<b>カーネルの OOM killer</b> が cgroup 内のプロセスを SIGKILL します。<code>docker run</code> の終了コードは <b>137</b>（128 + 9）です。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker run --name hog -m 256m --memory-swap 256m python:3.12-alpine \\
              python3 -c "b = b'x' * (512 * 1024 * 1024)"
          $ echo $?
          ⟪137⟫` },
        run: async (s) => {
          s.$('.stamp').forEach((e) => e.remove());
          s.state('k1', 'dim');
          s.state('k2', 'active');
          s.state('k3', 'dim');
          await s.hide(HIDE1);
          await s.show('b1 b2', { fx: 'up' });
          await s.term('t', `$ docker run --name hog -m 256m --memory-swap 256m python:3.12-alpine python3 -c "b = b'x' * (512 * 1024 * 1024)"`, { clear: true });
          noTransition(s, 'bbar');
          s.el('bbar').style.width = '100%';
          await s.count('bv', 0, 256, { dur: 1400, fmt: (v) => Math.round(v) + ' / 256 MiB' });
          s.cls('b2', 'full');
          await s.term('t', '$ echo $?\n137');
        },
      },
      {
        title: 'カーネルログ：Memory cgroup out of memory',
        text: 'OOM Kill は Docker ではなく<b>カーネル</b>が行います。カーネルログには、どの cgroup（<code>oom_memcg=/system.slice/docker-&lt;id&gt;.scope</code>）の上限で、どのプロセスを殺したか（<code>anon-rss</code> が約 256MiB）が残ります。<code>memory.events</code> の <code>oom_kill</code> も 1 増えます。',
        code: { title: 'bash', lang: 'bash', src: `
          $ sudo journalctl -k | grep -E 'oom-kill|Killed process' | tail -2
          Sep 28 10:21:05 host kernel: oom-kill:constraint=⟪CONSTRAINT_MEMCG⟫,nodemask=(null),cpuset=docker-${HOG}.scope,mems_allowed=0,oom_memcg=/system.slice/docker-${HOG}.scope,task_memcg=/system.slice/docker-${HOG}.scope,task=python3,pid=5120,uid=0
          Sep 28 10:21:05 host kernel: ⟪Memory cgroup out of memory: Killed process 5120 (python3)⟫ total-vm:538944kB, anon-rss:260808kB, file-rss:4096kB, shmem-rss:0kB, UID:0 pgtables:572kB oom_score_adj:0` },
        run: async (s) => {
          await s.term('t', "$ sudo journalctl -k | grep 'Killed process' | tail -1\nSep 28 10:21:05 host kernel: Memory cgroup out of memory: Killed process 5120 (python3) total-vm:538944kB, anon-rss:260808kB, file-rss:4096kB, shmem-rss:0kB, UID:0 pgtables:572kB oom_score_adj:0");
          await s.text('bk', '1');
          await s.show('b3', { fx: 'pop' });
          s.state('b1', 'bad');
          s.shake('b1');
        },
      },
      {
        title: 'docker inspect：OOMKilled=true と ExitCode 137',
        text: '137 は「SIGKILL で死んだ」という意味でしかなく、<code>docker kill</code> や stop のタイムアウトでも同じ値になります。<b>OOM かどうかは <code>.State.OOMKilled</code> で判別</b>します（containerd からの OOM イベントを dockerd が記録したもの）。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker inspect -f '{{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}}' hog
          exited exit=⟪137⟫ oom=⟪true⟫
          $ docker ps -a --filter name=hog --format '{{.Status}}'
          Exited (137) 12 seconds ago` },
        run: async (s) => {
          await s.term('t', "$ docker inspect -f '{{.State.ExitCode}} {{.State.OOMKilled}}' hog\n137 true");
          await s.show('b4', { fx: 'pop' });
        },
      },
      {
        title: 'docker events で oom を捕まえる',
        text: '<code>docker events</code> には <code>oom</code> → <code>die</code> の順でイベントが流れます。監視に組み込むならこの <code>oom</code> イベントか、<code>OOMKilled</code> を見ます。対策はメモリ上限を上げるか、アプリ側の上限（JVM の <code>-XX:MaxRAMPercentage</code>、Node.js の <code>--max-old-space-size</code> など）を cgroup の上限より小さくすることです。',
        code: { title: 'bash', lang: 'bash', src: `
          $ docker events --filter container=hog --filter event=oom --filter event=die
          2026-09-28T10:21:05.183412904+09:00 container ⟪oom⟫ ${HOG} (image=python:3.12-alpine, name=hog)
          2026-09-28T10:21:05.301877215+09:00 container ⟪die⟫ ${HOG} (exitCode=137, image=python:3.12-alpine, name=hog)` },
        run: async (s) => {
          await s.term('t', '$ docker events --filter container=hog --filter event=oom\n2026-09-28T10:21:05.183412904+09:00 container oom ' + HOG + ' (image=python:3.12-alpine, name=hog)');
          s.state('k2', 'bad');
        },
      },
      {
        title: '③ PID 1 が sh：exec し忘れた起動スクリプト',
        text: '<code>api:1.0</code> は <code>CMD ["/app/start.sh"]</code> で、スクリプトの最後が <code>node server.js</code>（<b>exec なし</b>）です。そのため PID 1 は <code>/bin/sh</code> のまま、node はその子（PID 7）として動きます。',
        code: [
          { title: '/app/start.sh（問題のある版）', lang: 'bash', src: `
            #!/bin/sh
            node migrate.js
            ⟪node server.js⟫        # exec が無いので sh が親として残る` },
          { title: 'bash', lang: 'bash', src: `
            $ docker run -d --name api -p 8082:3000 api:1.0
            ${API}
            $ docker top api
            UID      PID      PPID     C    STIME    TTY    TIME        CMD
            root     6011     5990     0    10:40    ?      00:00:00    ⟪/bin/sh /app/start.sh⟫
            root     6042     6011     0    10:40    ?      00:00:00    node server.js` },
        ],
        run: async (s) => {
          s.state('k2', 'dim');
          s.state('k3', 'active');
          await s.hide(HIDE2);
          await s.term('t', '$ docker top api\nUID   PID   PPID  CMD\nroot  6011  5990  /bin/sh /app/start.sh\nroot  6042  6011  node server.js', { clear: true });
          await s.show('p1', { fx: 'up' });
          await s.show('p2', { fx: 'up' });
          s.line('p1:b', 'p2:t', { cls: 'dash', id: 'g1', label: 'child' });
        },
      },
      {
        title: 'docker stop：SIGTERM は PID 1 の sh にしか届かない',
        text: '<code>docker stop</code> はまず STOPSIGNAL（既定 SIGTERM）を <b>PID 1 だけ</b>に送ります。カーネルは PID namespace の init（PID 1）に対し、<b>ハンドラを登録していないシグナルを配送しません</b>。sh は SIGTERM のハンドラを持たないので何も起きず、node には転送もされません。dockerd は猶予の 10 秒を待ちます。',
        code: { title: 'bash', lang: 'bash', src: `
          $ time docker stop api
          # …10 秒間なにも返ってこない
          $ docker inspect -f '{{json .Config.StopSignal}} {{json .Config.StopTimeout}}' api
          "" null        # 未指定 → SIGTERM / 10 秒` },
        run: async (s) => {
          await s.term('t', '$ time docker stop api');
          await s.show('p3', { fx: 'up' });
          await s.fly('t:r', 'p1:l', { label: 'SIGTERM (15)', dur: 700 });
          s.state('p1', 'warn');
          s.state('p2', 'dim');
          noTransition(s, 'pbar');
          s.el('pbar').style.width = '100%';
          await s.count('psec', 0, 10, { dur: 2400, fmt: (v) => v.toFixed(1) + ' s' });
        },
      },
      {
        title: '10 秒後に SIGKILL → Exited (137)',
        text: '猶予が切れると dockerd は SIGKILL を送り、PID 1 が死ぬと namespace 内の全プロセスも kill されます。node は後片付け（接続のクローズ、キューの flush）をする機会なく終了し、終了コードは 137。dockerd のログにも記録が残ります。',
        code: [
          { title: 'bash', lang: 'bash', src: `
            $ time docker stop api
            api

            real	⟪0m10.431s⟫
            user	0m0.021s
            sys	0m0.013s
            $ docker ps -a --filter name=api --format '{{.Status}}'
            Exited (⟪137⟫) 5 seconds ago` },
          { title: 'dockerd のログ', lang: 'text', src: `
            $ journalctl -u docker --since "1 min ago" | grep force
            Sep 28 10:41:12 host dockerd[955]: time="2026-09-28T10:41:12.345678901+09:00" level=info msg="⟪Container failed to exit within 10s of signal 15 - using the force⟫" container=${API}` },
        ],
        run: async (s) => {
          s.cls('p3', 'done');
          await s.fly('t:r', 'p1:l', { label: 'SIGKILL (9)', cls: 'c-red', dur: 600 });
          s.state('p1', 'bad');
          s.state('p2', 'bad');
          s.shake('p1 p2');
          await s.term('t', 'api\n\nreal\t0m10.431s\nuser\t0m0.021s\nsys\t0m0.013s');
          await s.stamp('p1', 'Exited (137)', { cls: 'st-bad', pos: 'br' });
        },
      },
      {
        title: '直し方：exec で置き換える／--init／SIGTERM を処理する',
        text: 'スクリプトの最後を <code>exec node server.js</code> にすると sh が node に置き換わり、node が PID 1 になります。ただし <b>PID 1 の node も SIGTERM ハンドラが無ければ無視する</b>ので、<code>process.on("SIGTERM", …)</code> で終了処理を書きます。アプリを変えられないなら <code>docker run --init</code>（<code>docker-init</code> = tini が PID 1 になりシグナルを転送）を使います。',
        code: [
          { title: '/app/start.sh（修正版）', lang: 'bash', src: `
            #!/bin/sh
            node migrate.js
            ⟪exec⟫ node server.js` },
          { title: 'server.js（抜粋）', lang: 'js', src: `
            process.on('SIGTERM', () => {
              server.close(() => process.exit(0));   // 受付停止 → 処理中の接続を待って終了
            });` },
          { title: 'bash', lang: 'bash', src: `
            $ time docker stop api
            api
            real	⟪0m0.412s⟫
            $ docker ps -a --filter name=api --format '{{.Status}}'
            Exited (⟪0⟫) 2 seconds ago
            # アプリを変えられない場合
            $ docker run -d --init --name api -p 8082:3000 api:1.0` },
        ],
        run: async (s) => {
          s.$('.stamp').forEach((e) => e.remove());
          s.state('p1', 'ok');
          s.state('p2', 'ok');
          s.cls('p3', null, 'done');
          noTransition(s, 'pbar');
          s.el('pbar').style.width = '4%';
          await s.text('psec', '0.4 s');
          await s.show('p4', { fx: 'pop' });
          await s.term('t', '$ time docker stop api\napi\nreal\t0m0.412s', { clear: true });
          s.state('k3', 'ok');
        },
      },
    ],
  });
})();
