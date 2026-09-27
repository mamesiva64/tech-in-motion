/* SSH — scenes (AGENT.md §7). All key material below is demo-only (generated with ssh-keygen for this page). */
(function () {
  'use strict';

  /* ---------------------------------------------------------------
   * Demo values (real output of OpenSSH 10.3p1 ssh-keygen)
   * ------------------------------------------------------------- */
  const K = {
    upub: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIICs0g2weZhh4dhLtKRKd8Snoru8mXVH0iYNbsqPHJFp you@example.com',
    ufp: 'SHA256:1CJKc5w5H5JWqOQ3uHI55fN1NgyxwAOiwqyegCepEQ0',
    hpub: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBEDErqZ2CAGW7Qa5VehKWuP8A/nse1EVt8vPduCPiHr root@server',
    hfp: 'SHA256:KsUIdbXsTWf9c2BqWhUiXlD2hztj9R7T5QTNA9Tm5wA',
    epub: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBzpRcvwM4oLE11vzltMUoqCbh80EcoWBjKFGCFGhSg5 root@evil',
    efp: 'SHA256:X5D4nC+hhOLWMcY+S5AzAurGbqkJCciCt13WUy6/tek',
  };
  const KH_LINE = 'server.example.com ' + K.hpub.split(' ').slice(0, 2).join(' ');
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const te = new TextEncoder();

  function b64dec(s) {
    const bin = atob(s);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function b64enc(buf) {
    const u = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]);
    return btoa(bin);
  }
  function blobOf(line) {
    const f = String(line).trim().split(/\s+/).find((p) => /^AAAA[0-9A-Za-z+/]+=*$/.test(p));
    if (!f) throw new Error('base64 の鍵 blob（AAAA… で始まるフィールド）が見つかりません');
    return b64dec(f);
  }
  /** OpenSSH fingerprint: "SHA256:" + base64(SHA-256(blob)) without padding */
  async function fingerprint(line) {
    const d = await crypto.subtle.digest('SHA-256', blobOf(line));
    return 'SHA256:' + b64enc(d).replace(/=+$/, '');
  }
  /** RFC 4251 "string": uint32 length + bytes */
  function sshString(bytes) {
    const b = typeof bytes === 'string' ? te.encode(bytes) : bytes;
    const out = new Uint8Array(4 + b.length);
    new DataView(out.buffer).setUint32(0, b.length);
    out.set(b, 4);
    return out;
  }
  function concat(parts) {
    const n = parts.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(n);
    let o = 0;
    parts.forEach((p) => { out.set(p, o); o += p.length; });
    return out;
  }
  function parseBlob(blob) {
    const dv = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
    const fields = [];
    let o = 0;
    while (o + 4 <= blob.length) {
      const n = dv.getUint32(o);
      if (o + 4 + n > blob.length) break;
      fields.push({ len: n, bytes: blob.slice(o + 4, o + 4 + n) });
      o += 4 + n;
    }
    return { fields, rest: blob.length - o };
  }

  // この接続だけの値（ページ読み込みごとに乱数）: 交換ハッシュ H = session_id
  const H = crypto.getRandomValues(new Uint8Array(32));
  const HHEX = TIM.hex(H);

  // publickey-hostbound-v00@openssh.com の署名対象データ（実際のバイト列を組み立てる）
  const SIGNED = concat([
    sshString(H),
    new Uint8Array([50]),
    sshString('alice'),
    sshString('ssh-connection'),
    sshString('publickey-hostbound-v00@openssh.com'),
    new Uint8Array([1]),
    sshString('ssh-ed25519'),
    sshString(blobOf(K.upub)),
    sshString(blobOf(K.hpub)),
  ]);
  // デモ鍵で実際に Ed25519 署名（WebCrypto Ed25519 非対応ブラウザでは null）
  let sigP = null;
  function demoSignature() {
    if (!sigP) {
      sigP = (async () => {
        try {
          const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign']);
          return TIM.hex(await crypto.subtle.sign({ name: 'Ed25519' }, kp.privateKey, SIGNED));
        } catch (e) { return null; }
      })();
    }
    return sigP;
  }

  // 自己検査：ページ上の計算が ssh-keygen -lf の出力と一致すること
  if (window.crypto && crypto.subtle) {
    Promise.all([fingerprint(K.upub), fingerprint(K.hpub), fingerprint(K.epub)]).then((r) => {
      if (r[0] !== K.ufp || r[1] !== K.hfp || r[2] !== K.efp) console.error('[ssh] fingerprint self-check failed', r);
    });
  }

  /* ===============================================================
   * SCENE 1 — 鍵の生成と登録
   * ============================================================= */
  TIM.scene('#sc-keys', {
    intro: 'クライアントで <code>ssh-keygen</code> が鍵ペアを作り、<code>ssh-copy-id</code> が<strong>公開鍵だけ</strong>をサーバーの <code>~/.ssh/authorized_keys</code> に 1 行追記するまでを追います。秘密鍵 <code>~/.ssh/id_ed25519</code> はクライアントから一度も出ません。',
    steps: [
      {
        title: '<code>ssh-keygen</code> で鍵ペアを作る',
        text: '<code>-t ed25519</code> で鍵の種類、<code>-C</code> でコメント（公開鍵の末尾に付くただの文字列）を指定します。保存先の質問に Enter を押すと既定の <code>~/.ssh/id_ed25519</code> に保存され、パスフレーズを入れると秘密鍵ファイル自体が暗号化されます。OpenSSH 9.5 以降は <code>-t</code> を省略しても Ed25519 です。',
        code: { title: 'alice@laptop（OpenSSH 10.3p1 の実際の出力）', lang: 'bash', src: `
          $ ssh-keygen -t ed25519 -C "you@example.com"
          Generating public/private ed25519 key pair.
          Enter file in which to save the key (/home/alice/.ssh/id_ed25519):
          Enter passphrase for "/home/alice/.ssh/id_ed25519" (empty for no passphrase):
          Enter same passphrase again:
          Your identification has been saved in /home/alice/.ssh/id_ed25519
          Your public key has been saved in /home/alice/.ssh/id_ed25519.pub
          The key fingerprint is:
          SHA256:1CJKc5w5H5JWqOQ3uHI55fN1NgyxwAOiwqyegCepEQ0 you@example.com
          The key's randomart image is:
          +--[ED25519 256]--+
          |E   . .+.        |
          |oo ..o.=+..      |
          |oooooo@ +o.o     |
          |o+ .+=+* oo      |
          |B . .* .S  o     |
          |++o = o   . =    |
          |.o o . o . o .   |
          |        .        |
          |                 |
          +----[SHA256]-----+` },
        run: async (s) => {
          await s.term('tk', `
            $ ssh-keygen -t ed25519 -C "you@example.com"
            Generating public/private ed25519 key pair.
            Enter file in which to save the key (/home/alice/.ssh/id_ed25519):
            Enter passphrase for "/home/alice/.ssh/id_ed25519" (empty for no passphrase):
            Enter same passphrase again:
            Your identification has been saved in /home/alice/.ssh/id_ed25519
            Your public key has been saved in /home/alice/.ssh/id_ed25519.pub`);
        },
      },
      {
        title: '秘密鍵 <code>~/.ssh/id_ed25519</code>',
        text: 'PEM 風の枠ですが中身は OpenSSH 独自の <code>openssh-key-v1</code> 形式です。base64 を戻すと先頭はマジック文字列 <code>openssh-key-v1</code>、続いて暗号方式（パスフレーズなしなら <code>none</code>）、公開鍵、秘密鍵の順。<strong>このファイルだけは誰にも渡しません。</strong>',
        code: [
          { title: '~/.ssh/id_ed25519（デモ鍵。先頭 2 行のみ表示）', lang: 'pem', src: `
            -----BEGIN OPENSSH PRIVATE KEY-----
            b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
            QyNTUxOQAAACCArNINsHmYYeHYS7SkSnfEp6K7vJl1R9ImDW7KjxyRaQAAAJgLPKWLCzyl
            …（デモ用・以下省略。実物は 411 バイト・7 行）…
            -----END OPENSSH PRIVATE KEY-----` },
          { title: 'base64 を戻した先頭 64 バイト', lang: 'text', src: `
            $ sed '1d;$d' ~/.ssh/id_ed25519 | base64 -d | xxd | head -4
            00000000: 6f70 656e 7373 682d 6b65 792d 7631 0000  ⟪openssh-key-v1⟫..
            00000010: 0000 046e 6f6e 6500 0000 046e 6f6e 6500  ...⟪none⟫....⟪none⟫.
            00000020: 0000 0000 0000 0100 0000 3300 0000 0b73  ..........3....s
            00000030: 7368 2d65 6432 3535 3139 0000 0020 80ac  sh-ed25519... ..` },
        ],
        run: async (s) => {
          await s.show('priv');
          await s.pulse('priv');
        },
      },
      {
        title: '公開鍵 <code>~/.ssh/id_ed25519.pub</code>',
        text: '1 行に「鍵の種類・base64 の鍵 blob・コメント」の 3 つが並びます。blob をデコードすると 51 バイトで、長さ付きの文字列 <code>ssh-ed25519</code> と 32 バイトの Ed25519 公開鍵です（RFC 8709 §4）。こちらは配って構いません。',
        code: [
          { title: '~/.ssh/id_ed25519.pub（97 バイト = 96 文字 + 改行）', lang: 'text', src: `⟪ssh-ed25519⟫ AAAAC3NzaC1lZDI1NTE5AAAAIICs0g2weZhh4dhLtKRKd8Snoru8mXVH0iYNbsqPHJFp ⟪you@example.com⟫` },
          { title: 'blob をバイト列に戻す（51 バイト）', lang: 'text', src: `
            $ awk '{print $2}' ~/.ssh/id_ed25519.pub | base64 -d | xxd
            00000000: ⟪0000 000b⟫ 7373 682d 6564 3235 3531 3900  ....ssh-ed25519.
            00000010: ⟪0000 20⟫80 acd2 0db0 7998 61e1 d84b b4a4  .. .....y.a..K..
            00000020: 4a77 c4a7 a2bb bc99 7547 d226 0d6e ca8f  Jw......uG.&.n..
            00000030: 1c91 69                                  ..i
            # uint32 11 · "ssh-ed25519" · uint32 32 · Ed25519 公開鍵 32 バイト` },
        ],
        run: async (s) => {
          await s.show('pub');
          await s.scan('pub');
        },
      },
      {
        title: 'フィンガープリントを計算する',
        text: '<code>SHA256:</code> の後ろは「blob 51 バイトの SHA-256 を base64 にして末尾の <code>=</code> を削ったもの」（43 文字）。このステップでは<strong>ページ上で WebCrypto を使って実際に計算</strong>し、<code>ssh-keygen -lf</code> と同じ値になることを確かめています。',
        code: [
          { title: 'alice@laptop', lang: 'bash', src: `
            $ ssh-keygen -lf ~/.ssh/id_ed25519.pub
            256 ⟪SHA256:1CJKc5w5H5JWqOQ3uHI55fN1NgyxwAOiwqyegCepEQ0⟫ you@example.com (ED25519)
            $ awk '{print $2}' ~/.ssh/id_ed25519.pub | base64 -d | openssl dgst -sha256 -binary | base64 | tr -d '='
            ⟪1CJKc5w5H5JWqOQ3uHI55fN1NgyxwAOiwqyegCepEQ0⟫` },
          { title: 'このページの計算（scenes.js）', lang: 'js', src: `
            const blob = base64decode('AAAAC3NzaC1lZDI1NTE5AAAAIICs…');   // 51 bytes
            const d = await crypto.subtle.digest('SHA-256', blob);
            'SHA256:' + base64encode(d).replace(/=+$/, '');` },
        ],
        run: async (s) => {
          await s.term('tk', `
            $ ssh-keygen -lf ~/.ssh/id_ed25519.pub
            256 ${K.ufp} you@example.com (ED25519)`);
          await s.show('fp', { fx: 'pop' });
          let fp = K.ufp;
          try { fp = await fingerprint(K.upub); } catch (e) { /* keep static value */ }
          await s.scramble('fpv', fp, { chars: B64, dur: 1400 });
        },
      },
      {
        title: 'パーミッション：700 / 600 / 644',
        text: '<code>ssh-keygen</code> は秘密鍵を <code>600</code>（本人だけ読み書き）で作ります。<code>ssh</code> は自分の秘密鍵に group/other の権限が 1 ビットでもあると、その鍵を<strong>無視</strong>します（失敗ケース参照）。公開鍵は <code>644</code> で問題ありません。',
        code: { title: 'alice@laptop', lang: 'bash', src: `
          $ ls -la ~/.ssh
          total 16
          ⟪drwx------⟫  2 alice alice 4096 Sep 28 10:00 .
          drwxr-x--- 15 alice alice 4096 Sep 28 10:00 ..
          ⟪-rw-------⟫  1 alice alice  411 Sep 28 10:00 id_ed25519
          -rw-r--r--  1 alice alice   97 Sep 28 10:00 id_ed25519.pub` },
        run: async (s) => {
          await s.term('tk', `
            $ ls -l ~/.ssh
            -rw------- 1 alice alice 411 Sep 28 10:00 id_ed25519
            -rw-r--r-- 1 alice alice  97 Sep 28 10:00 id_ed25519.pub`);
          await s.show('perm');
          s.state('priv', 'ok');
        },
      },
      {
        title: '<code>ssh-copy-id</code> で公開鍵を送る',
        text: 'まだ鍵は登録されていないので、<code>ssh-copy-id</code> は<strong>パスワード認証</strong>でログインし、<code>.pub</code> の中身だけを標準入力でサーバーに流します。送られるのは公開鍵 1 行で、秘密鍵ファイルは読みもしません。',
        code: { title: 'alice@laptop', lang: 'bash', src: `
          $ ssh-copy-id -i ~/.ssh/id_ed25519.pub alice@server.example.com
          /usr/bin/ssh-copy-id: INFO: Source of key(s) to be installed: "/home/alice/.ssh/id_ed25519.pub"
          /usr/bin/ssh-copy-id: INFO: attempting to log in with the new key(s), to filter out any that are already installed
          /usr/bin/ssh-copy-id: INFO: 1 key(s) remain to be installed -- if you are prompted now it is to install the new keys
          alice@server.example.com's password:

          Number of key(s) added: 1

          Now try logging into the machine, with: "ssh -i /home/alice/.ssh/id_ed25519 'alice@server.example.com'"
          and check to make sure that only the key(s) you wanted were added.` },
        run: async (s) => {
          await s.term('tk', `
            $ ssh-copy-id -i ~/.ssh/id_ed25519.pub alice@server.example.com
            /usr/bin/ssh-copy-id: INFO: 1 key(s) remain to be installed -- if you are prompted now it is to install the new keys
            alice@server.example.com's password:`);
          s.state('sshd', 'active');
          await s.fly('pub', 'sshd:bl', { label: 'id_ed25519.pub の 1 行', arc: -50, dur: 1300 });
        },
      },
      {
        title: 'サーバーで <code>authorized_keys</code> に 1 行追記',
        text: 'ssh-copy-id がサーバー側で実行させるのは、<code>umask 077</code> → <code>mkdir -p .ssh</code> → <code>cat &gt;&gt; .ssh/authorized_keys</code> という短いシェルです。<code>umask 077</code> のおかげで新しく作られる <code>~/.ssh</code> は 700、ファイルは 600 になります。',
        code: [
          { title: 'サーバーで実行されるシェル（ssh-copy-id より。変数を展開して簡略化）', lang: 'bash', src: `
            exec sh -c 'cd; umask 077;
              mkdir -p ".ssh" &&
                cat >> ".ssh/authorized_keys" || exit 1;
              if type restorecon >/dev/null 2>&1; then
                restorecon -F ".ssh" ".ssh/authorized_keys";
              fi'` },
          { title: 'server: /home/alice/.ssh/authorized_keys（追記された 1 行）', lang: 'text', src: K.upub },
        ],
        run: async (s) => {
          await s.show('ts');
          await s.term('ts', `
            $ cd; umask 077
            $ mkdir -p .ssh
            $ cat >> .ssh/authorized_keys`, { pause: 120 });
          await s.show('ak');
          await s.set('akb', '<b>ssh-ed25519</b> AAAAC3NzaC1lZDI1NTE5AAAAIICs0g2weZhh4dhLtKRKd8Snoru8mXVH0iYNbsqPHJFp <b>you@example.com</b>');
          await s.show('sperm');
          s.state('sshd', null);
        },
      },
      {
        title: '以後はパスワードなしで鍵認証',
        text: '次の <code>ssh</code> からは、sshd が <code>authorized_keys</code> の公開鍵で<strong>署名</strong>を検証してログインさせます（詳しくは「ユーザー認証」のシーン）。サーバーのログには鍵のフィンガープリント付きで <code>Accepted publickey</code> が残ります。',
        code: [
          { title: 'alice@laptop', lang: 'bash', src: `
            $ ssh alice@server.example.com
            alice@server:~$` },
          { title: 'server: journalctl -u ssh（sshd のログ）', lang: 'text', src: `Accepted publickey for alice from 198.51.100.7 port 53422 ssh2: ED25519 ⟪${K.ufp}⟫` },
        ],
        run: async (s) => {
          await s.term('tk', `
            $ ssh alice@server.example.com
            alice@server:~$`);
          s.state('ak', 'active');
          await s.fly('tk:r', 'ak:l', { label: '署名（秘密鍵は送らない）', arc: 50, dur: 1200 });
          s.state('ak', 'ok');
          s.state('sshd', 'ok');
          await s.show('acc', { fx: 'pop' });
          await s.stamp('sshd', 'NO PASSWORD', { cls: 'st-ok' });
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 2 — 接続とホスト認証
   * ============================================================= */
  const CX = 118, SX = 522;
  const row = (y, o) => [{ x: CX, y }, { x: SX, y }, o];
  TIM.scene('#sc-kex', {
    intro: 'TCP 接続からトランスポート層の暗号化が始まるまで（RFC 4253）。左の縦線がクライアント、右がサーバーで、上から時間順にメッセージが並びます。ポイントは <strong>サーバーがホスト秘密鍵で交換ハッシュ H に署名し、クライアントが known_hosts の公開鍵で検証する</strong>ところです。例は OpenSSH 10.3 同士なので kex は <code>mlkem768x25519-sha256</code> になります。',
    steps: [
      {
        title: 'TCP で 22 番ポートへ接続',
        text: '<code>ssh</code> は <code>~/.ssh/config</code> と <code>/etc/ssh/ssh_config</code> を読んでから、名前解決して <code>203.0.113.10:22</code> に TCP 接続します。ここまでは暗号も鍵も関係ありません。',
        code: { title: 'ssh -v の該当行', lang: 'text', src: `
          debug1: Reading configuration data /home/alice/.ssh/config
          debug1: Reading configuration data /etc/ssh/ssh_config
          debug1: Connecting to server.example.com [⟪203.0.113.10⟫] port ⟪22⟫.
          debug1: Connection established.` },
        run: async (s) => {
          await s.term('tc', `
            $ ssh alice@server.example.com`, { pause: 100 });
          s.line(...row(100, { label: 'TCP SYN → 203.0.113.10:22', id: 'r1' }));
          await s.fly({ x: CX, y: 100 }, { x: SX, y: 100 }, { dur: 700 });
        },
      },
      {
        title: 'バージョン文字列を交換',
        text: '最初に平文で 1 行ずつ送り合います。書式は <code>SSH-2.0-ソフトウェア名 コメント</code> + CR LF（RFC 4253 §4.2）。この 2 行は後で交換ハッシュ H の材料（<code>V_C</code> / <code>V_S</code>）になります。',
        code: { title: 'TCP の最初のバイト列', lang: 'text', src: `
          client → server:  SSH-2.0-OpenSSH_10.3\\r\\n
          server → client:  SSH-2.0-OpenSSH_10.3\\r\\n

          # ssh -v では
          debug1: Local version string ⟪SSH-2.0-OpenSSH_10.3⟫
          debug1: Remote protocol version 2.0, remote software version ⟪OpenSSH_10.3⟫
          # Debian/Ubuntu 版は "OpenSSH_9.6p1 Ubuntu-3ubuntu13.5" のように版と配布元が付く` },
        run: async (s) => {
          s.line(...row(138, { label: 'SSH-2.0-OpenSSH_10.3', id: 'r2', both: true, cls: 'acc' }));
          await Promise.all([
            s.fly({ x: CX, y: 138 }, { x: SX, y: 138 }, { dur: 800 }),
            s.fly({ x: SX, y: 138 }, { x: CX, y: 138 }, { dur: 800 }),
          ]);
        },
      },
      {
        title: 'SSH_MSG_KEXINIT でアルゴリズムを交渉',
        text: '両者が「使えるアルゴリズムの一覧」を送り合い、項目ごとに<strong>クライアントの一覧の先頭から、サーバーも持っている最初のもの</strong>が選ばれます。鍵交換（kex）・ホスト鍵の種類・暗号・MAC・圧縮がここで決まります。',
        code: [
          { title: 'client の一覧（ssh -G で確認できる OpenSSH 10.3 の既定値・抜粋）', lang: 'text', src: `
            kexalgorithms      ⟪mlkem768x25519-sha256⟫,sntrup761x25519-sha512,sntrup761x25519-sha512@openssh.com,curve25519-sha256,…
            hostkeyalgorithms  ssh-ed25519-cert-v01@openssh.com,…,⟪ssh-ed25519⟫,ecdsa-sha2-nistp256,…,rsa-sha2-512,rsa-sha2-256
            ciphers            ⟪chacha20-poly1305@openssh.com⟫,aes128-gcm@openssh.com,aes256-gcm@openssh.com,aes128-ctr,aes192-ctr,aes256-ctr
            macs               umac-64-etm@openssh.com,umac-128-etm@openssh.com,hmac-sha2-256-etm@openssh.com,…` },
          { title: 'ssh -v', lang: 'text', src: `
            debug1: SSH2_MSG_KEXINIT sent
            debug1: SSH2_MSG_KEXINIT received
            debug1: kex: algorithm: mlkem768x25519-sha256
            debug1: kex: host key algorithm: ssh-ed25519
            debug1: kex: server->client cipher: chacha20-poly1305@openssh.com MAC: <implicit> compression: none
            debug1: kex: client->server cipher: chacha20-poly1305@openssh.com MAC: <implicit> compression: none` },
        ],
        run: async (s) => {
          s.line(...row(176, { label: 'SSH_MSG_KEXINIT (20)', id: 'r3', both: true, cls: 'acc' }));
          await Promise.all([
            s.fly({ x: CX, y: 176 }, { x: SX, y: 176 }, { dur: 800 }),
            s.fly({ x: SX, y: 176 }, { x: CX, y: 176 }, { dur: 800 }),
          ]);
          await s.show('kexc', { fx: 'right' });
          await s.scan('kexc');
        },
      },
      {
        title: 'クライアントが一時鍵 Q_C を送る',
        text: 'クライアントはこの接続だけの一時鍵ペアを作り、公開側 <code>Q_C</code> を <code>SSH_MSG_KEX_ECDH_INIT</code> で送ります。<code>mlkem768x25519-sha256</code> では ML-KEM-768 の公開鍵（1184 B）と X25519 公開鍵（32 B）を連結したもの、<code>curve25519-sha256</code> なら X25519 の 32 B だけです。',
        code: { title: 'SSH_MSG_KEX_ECDH_INIT（RFC 5656 §4 / mlkem768x25519）', lang: 'text', src: `
          byte    SSH_MSG_KEX_ECDH_INIT (30)
          string  Q_C   = ML-KEM-768 公開鍵 (1184 B) ‖ X25519 公開鍵 (32 B)

          debug1: expecting SSH2_MSG_KEX_ECDH_REPLY` },
        run: async (s) => {
          s.line(...row(214, { label: 'KEX_ECDH_INIT (30) : Q_C', id: 'r4' }));
          await s.fly({ x: CX, y: 214 }, { x: SX, y: 214 }, { label: 'Q_C', dur: 900 });
        },
      },
      {
        title: 'サーバーが K と H を計算し、ホスト鍵で署名',
        text: 'サーバーは共有秘密 <code>K</code> を求め、バナー・両者の KEXINIT・自分のホスト公開鍵 <code>K_S</code>・<code>Q_C</code>・<code>Q_S</code>・<code>K</code> をまとめた <strong>交換ハッシュ H</strong> を計算します。そして <code>/etc/ssh/ssh_host_ed25519_key</code> で H に署名し、<code>K_S</code>・<code>Q_S</code>・署名を返します。H はこの接続だけの値（ここではページ読み込みごとに乱数で表示）で、最初の H が <strong>session_id</strong> になります。',
        code: [
          { title: 'SSH_MSG_KEX_ECDH_REPLY', lang: 'text', src: `
            byte    SSH_MSG_KEX_ECDH_REPLY (31)
            string  K_S   = ホスト公開鍵 blob（ssh_host_ed25519_key.pub）
            string  Q_S   = ML-KEM 暗号文 (1088 B) ‖ X25519 公開鍵 (32 B)
            string  signature of H（"ssh-ed25519" + 64 B）` },
          { title: 'H の材料（OpenSSH kexgen.c の kex_gen_hash と同じ順）', lang: 'text', src: `
            H = SHA-256( string V_C        "SSH-2.0-OpenSSH_10.3"
                         string V_S        "SSH-2.0-OpenSSH_10.3"
                         string I_C        client の KEXINIT payload
                         string I_S        server の KEXINIT payload
                         string K_S        ホスト公開鍵 blob
                         string Q_C
                         string Q_S
                         K )               共有秘密` },
        ],
        run: async (s) => {
          s.state('sv', 'active');
          await s.show('hc', { fx: 'right' });
          await s.scramble('hv', 'H = ' + HHEX, { dur: 1200 });
          await s.show('hsig', { fx: 'fade' });
          s.line({ x: SX, y: 252 }, { x: CX, y: 252 }, { label: 'KEX_ECDH_REPLY (31) : K_S, Q_S, 署名', id: 'r5', cls: 'acc' });
          await s.fly({ x: SX, y: 252 }, { x: CX, y: 252 }, { label: 'K_S + sig', dur: 1000 });
          s.state('sv', null);
        },
      },
      {
        title: '受け取った K_S を known_hosts で探す',
        text: 'クライアントも同じ H を計算します。次に、受け取ったホスト公開鍵 <code>K_S</code> が <code>~/.ssh/known_hosts</code> に <code>server.example.com</code> として登録済みかを調べます。初めての接続なので、該当する行はありません。',
        code: { title: 'alice@laptop（別ターミナルで確認）', lang: 'bash', src: `
          $ ssh-keygen -F server.example.com
          $ echo $?
          1          # 見つからない` },
        run: async (s) => {
          await s.show('kh', { fx: 'right' });
          await s.scan('kh');
          s.state('kh', 'warn');
        },
      },
      {
        title: '初回だけ：フィンガープリントを人間が確認',
        text: 'known_hosts にないので、ssh はフィンガープリントを表示して止まります。<strong>ここで表示される値を、サーバー管理者が別経路で示した値と照合する</strong>のが本来の手順です。<code>yes</code> と答えると known_hosts に 1 行追記され、次回からは自動で照合されます。',
        code: { title: 'OpenSSH 10.3 の表示（9.x 以前は "fingerprint is SHA256:…." の形）', lang: 'text', src: `
          The authenticity of host 'server.example.com (203.0.113.10)' can't be established.
          ED25519 key fingerprint is: ⟪SHA256:KsUIdbXsTWf9c2BqWhUiXlD2hztj9R7T5QTNA9Tm5wA⟫
          This key is not known by any other names.
          Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
          Warning: Permanently added 'server.example.com' (ED25519) to the list of known hosts.

          # サーバー側で（コンソールなど別経路で）確認する値
          root@server# ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
          256 ⟪SHA256:KsUIdbXsTWf9c2BqWhUiXlD2hztj9R7T5QTNA9Tm5wA⟫ root@server (ED25519)` },
        run: async (s) => {
          await s.term('tc', `
            The authenticity of host 'server.example.com (203.0.113.10)' can't be established.
            ED25519 key fingerprint is: ${K.hfp}
            Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
            Warning: Permanently added 'server.example.com' (ED25519) to the list of known hosts.`);
          await s.set('khb', '<b>server.example.com</b> ssh-ed25519 ' + K.hpub.split(' ')[1]);
          s.state('kh', 'ok');
        },
      },
      {
        title: 'H の署名を K_S で検証',
        text: 'クライアントは自分で計算した H と、サーバーから届いた署名を、<code>K_S</code>（＝ known_hosts に載った公開鍵）で検証します。検証が通るのは「その公開鍵に対応する秘密鍵を持つ相手」だけなので、これで<strong>通信相手が本物の server.example.com</strong>だと確定します。',
        code: { title: '検証（擬似コード）', lang: 'text', src: `
          H'  = SHA-256(V_C ‖ V_S ‖ I_C ‖ I_S ‖ K_S ‖ Q_C ‖ Q_S ‖ K)   # client が自分で計算
          ok  = Ed25519-Verify(K_S, H', signature)                     # RFC 8709 §6
          ⟪ok && K_S == known_hosts の鍵⟫  →  続行

          debug1: Server host key: ssh-ed25519 SHA256:KsUIdbXsTWf9c2BqWhUiXlD2hztj9R7T5QTNA9Tm5wA
          debug1: Host 'server.example.com' is known and matches the ED25519 host key.
          debug1: Found key in /home/alice/.ssh/known_hosts:1` },
        run: async (s) => {
          await s.scan('hc');
          s.state('hc', 'ok');
          s.state('cl', 'ok');
          await s.stamp('hc', 'SIGNATURE OK', { cls: 'st-ok', pos: 'tl' });
        },
      },
      {
        title: 'SSH_MSG_NEWKEYS：ここから暗号化',
        text: '両者が <code>SSH_MSG_NEWKEYS</code> を送ると、K と H から方向ごとの IV・暗号鍵・MAC 鍵を導出して切り替えます（RFC 4253 §7.2。<code>"A"</code>〜<code>"F"</code> の 1 文字で 6 種類を作り分け）。<code>chacha20-poly1305@openssh.com</code> は AEAD なので MAC 鍵は使わず <code>MAC: &lt;implicit&gt;</code> と表示されます。',
        code: { title: '鍵の導出（HASH = SHA-256）', lang: 'text', src: `
          IV   client→server = HASH(K ‖ H ‖ "A" ‖ session_id)
          IV   server→client = HASH(K ‖ H ‖ "B" ‖ session_id)
          Key  client→server = HASH(K ‖ H ‖ "C" ‖ session_id)
          Key  server→client = HASH(K ‖ H ‖ "D" ‖ session_id)
          MAC  client→server = HASH(K ‖ H ‖ "E" ‖ session_id)
          MAC  server→client = HASH(K ‖ H ‖ "F" ‖ session_id)

          debug1: rekey out after 134217728 blocks
          debug1: SSH2_MSG_NEWKEYS sent
          debug1: SSH2_MSG_NEWKEYS received` },
        run: async (s) => {
          s.line(...row(300, { label: 'SSH_MSG_NEWKEYS (21)', id: 'r6', both: true, cls: 'ok' }));
          await Promise.all([
            s.fly({ x: CX, y: 300 }, { x: SX, y: 300 }, { dur: 700 }),
            s.fly({ x: SX, y: 300 }, { x: CX, y: 300 }, { dur: 700 }),
          ]);
          await s.swap('kexc', 'keys');
        },
      },
      {
        title: '以降のパケットはすべて暗号化',
        text: 'ここからのバイナリパケット（RFC 4253 §6）は暗号化されます。chacha20-poly1305 では長さフィールドも別鍵で暗号化され、末尾に 16 バイトの Poly1305 タグが付きます。最初の暗号化メッセージは <code>SSH_MSG_SERVICE_REQUEST "ssh-userauth"</code> — 次の「ユーザー認証」へ進みます。',
        code: { title: 'バイナリパケット（暗号化後）', lang: 'text', src: `
          uint32   packet_length      ← chacha20（長さ用の鍵）で暗号化
          byte     padding_length  ┐
          byte[n1] payload         ├ chacha20（本体用の鍵）で暗号化
          byte[n2] random padding  ┘
          byte[16] Poly1305 tag       ← 改ざん検知（MAC: <implicit>）

          payload = SSH_MSG_SERVICE_REQUEST (5) ‖ string "ssh-userauth"` },
        run: async (s) => {
          s.line(...row(346, { label: 'chacha20-poly1305@openssh.com', id: 'r7', cls: 'flow' }));
          await s.fly({ x: CX, y: 346 }, { x: SX, y: 346 }, { label: '暗号文（SERVICE_REQUEST）', cls: 'ghost', dur: 1000 });
          await s.show('note', { fx: 'pop' });
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 3 — ユーザー認証（publickey）
   * ============================================================= */
  TIM.scene('#sc-auth', {
    intro: '暗号化された経路の上で、alice が「authorized_keys に登録された公開鍵の持ち主」であることを示します（RFC 4252 / OpenSSH PROTOCOL 3.1）。秘密鍵は ssh-agent が持ち、署名だけを返します。署名対象には前のシーンの <code>session_id</code>（最初の H）が入ります。',
    steps: [
      {
        title: '<code>ssh-userauth</code> サービスを要求',
        text: 'トランスポート層の上で、まず認証サービスの開始を要求します。この時点で経路は暗号化済みなので、以降のユーザー名や署名は第三者には見えません。',
        code: { title: 'メッセージ / ssh -v', lang: 'text', src: `
          client → server: SSH_MSG_SERVICE_REQUEST (5)  string "ssh-userauth"
          server → client: SSH_MSG_SERVICE_ACCEPT (6)   string "ssh-userauth"

          debug1: SSH2_MSG_SERVICE_ACCEPT received` },
        run: async (s) => {
          await s.show('enc', { fx: 'down' });
          await s.fly('ssh:r', 'sshd:l', { label: 'SERVICE_REQUEST "ssh-userauth"', dur: 1100 });
          await s.fly('sshd:l', 'ssh:r', { label: 'SERVICE_ACCEPT', dur: 900 });
        },
      },
      {
        title: '使える認証方式を知る',
        text: 'OpenSSH のクライアントは最初に方式 <code>none</code> で要求し、失敗応答 <code>SSH_MSG_USERAUTH_FAILURE</code> に入っている「続けて使える方式」の一覧を受け取ります。これが <code>ssh -v</code> の <code>Authentications that can continue</code> です。',
        code: [
          { title: 'メッセージ', lang: 'text', src: `
            client → server: SSH_MSG_USERAUTH_REQUEST (50)  "alice", "ssh-connection", "none"
            server → client: SSH_MSG_USERAUTH_FAILURE (51)  ⟪"publickey,password"⟫, partial=FALSE` },
          { title: 'ssh -v', lang: 'text', src: `
            debug1: Authentications that can continue: publickey,password
            debug1: Next authentication method: publickey` },
        ],
        run: async (s) => {
          await s.fly('ssh:r', 'sshd:l', { label: 'USERAUTH_REQUEST "none"', dur: 1000 });
          await s.fly('sshd:l', 'ssh:r', { label: 'FAILURE: publickey,password', cls: 'c-amber', dur: 1000 });
        },
      },
      {
        title: 'ssh-agent から鍵の一覧をもらう',
        text: '<code>ssh-add</code> で読み込んだ秘密鍵は <code>ssh-agent</code> プロセスのメモリにあり、<code>ssh</code> は環境変数 <code>SSH_AUTH_SOCK</code> の UNIX ソケット経由で話します。agent が返すのは<strong>公開鍵の一覧だけ</strong>です。',
        code: [
          { title: 'alice@laptop', lang: 'bash', src: `
            $ eval "$(ssh-agent -s)"
            Agent pid 2150
            $ ssh-add ~/.ssh/id_ed25519
            Identity added: /home/alice/.ssh/id_ed25519 (you@example.com)
            $ ssh-add -l
            256 SHA256:1CJKc5w5H5JWqOQ3uHI55fN1NgyxwAOiwqyegCepEQ0 you@example.com (ED25519)` },
          { title: 'agent プロトコル', lang: 'text', src: `
            ssh → agent: SSH_AGENTC_REQUEST_IDENTITIES (11)
            agent → ssh: SSH_AGENT_IDENTITIES_ANSWER (12)  公開鍵 blob + コメント × n` },
        ],
        run: async (s) => {
          await s.show('agent', { fx: 'up' });
          await s.fly('ssh:b', 'agent:t', { label: 'REQUEST_IDENTITIES (11)', dur: 800 });
          await s.fly('agent:t', 'ssh:b', { label: 'IDENTITIES_ANSWER (12)', dur: 800 });
        },
      },
      {
        title: '公開鍵を提示（まだ署名しない）',
        text: 'まず「この公開鍵で認証できますか？」と<strong>署名なし</strong>で問い合わせます（<code>has_signature = FALSE</code>）。agent に鍵が何本もあると、ここを 1 本ずつ繰り返します。',
        code: [
          { title: 'SSH_MSG_USERAUTH_REQUEST（問い合わせ）', lang: 'text', src: `
            byte    SSH_MSG_USERAUTH_REQUEST (50)
            string  "alice"
            string  "ssh-connection"
            string  "publickey-hostbound-v00@openssh.com"
            bool    ⟪FALSE⟫                 ← 署名なし
            string  "ssh-ed25519"
            string  公開鍵 blob (51 B)
            string  サーバーのホスト公開鍵 blob` },
          { title: 'ssh -v', lang: 'text', src: `debug1: Offering public key: /home/alice/.ssh/id_ed25519 ED25519 SHA256:1CJKc5w5H5JWqOQ3uHI55fN1NgyxwAOiwqyegCepEQ0 agent` },
        ],
        run: async (s) => {
          await s.fly('ssh:r', 'sshd:l', { label: 'USERAUTH_REQUEST publickey（署名なし）', dur: 1200 });
          s.state('sshd', 'active');
        },
      },
      {
        title: 'sshd が authorized_keys と照合',
        text: 'sshd は <code>AuthorizedKeysFile</code>（既定 <code>.ssh/authorized_keys</code>）を <strong>alice の権限で</strong>開き、同じ公開鍵の行を探します。<code>StrictModes yes</code> ならファイルとディレクトリのモードも検査します。見つかれば <code>SSH_MSG_USERAUTH_PK_OK</code> で「その鍵なら署名を送れ」と返します。',
        code: [
          { title: 'server: /home/alice/.ssh/authorized_keys', lang: 'text', src: `⟪ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIICs0g2weZhh4dhLtKRKd8Snoru8mXVH0iYNbsqPHJFp⟫ you@example.com` },
          { title: 'メッセージ / ssh -v', lang: 'text', src: `
            server → client: SSH_MSG_USERAUTH_PK_OK (60)  "ssh-ed25519", 公開鍵 blob

            debug1: Server accepts key: /home/alice/.ssh/id_ed25519 ED25519 SHA256:1CJK… agent` },
        ],
        run: async (s) => {
          await s.show('ak', { fx: 'left' });
          await s.scan('ak');
          s.state('ak', 'ok');
          await s.fly('sshd:l', 'ssh:r', { label: 'USERAUTH_PK_OK (60)', cls: 'c-green', dur: 1000 });
          s.state('sshd', null);
        },
      },
      {
        title: '署名するデータを組み立てる',
        text: '署名対象は「<code>session_id</code>（最初の鍵交換の H）+ これから送る認証要求そのもの」です。OpenSSH 8.9 以降同士では方式名が <code>publickey-hostbound-v00@openssh.com</code> になり、<strong>サーバーのホスト公開鍵</strong>も含まれます。右のバイト数は、このページが実際に組み立てたバイト列の長さです。',
        code: { title: '署名対象データ（このページで組み立てた実バイト列）', lang: 'text', src: `
          string  session_id                       32 B + 4
          byte    50 (SSH_MSG_USERAUTH_REQUEST)     1 B
          string  "alice"                           5 B + 4
          string  "ssh-connection"                 14 B + 4
          string  "publickey-hostbound-v00@openssh.com"  35 B + 4
          bool    ⟪TRUE⟫                              1 B
          string  "ssh-ed25519"                    11 B + 4
          string  ユーザー公開鍵 blob                51 B + 4
          string  サーバーのホスト公開鍵 blob        51 B + 4
          ─────────────────────────────────────────────
          合計 ${SIGNED.length} バイト` },
        run: async (s) => {
          await s.show('sd', { fx: 'up' });
          await s.scan('sd');
        },
      },
      {
        title: 'ssh-agent が秘密鍵で署名',
        text: '<code>ssh</code> は署名対象を <code>SSH_AGENTC_SIGN_REQUEST</code> で agent に渡し、agent が Ed25519 署名（64 バイト）だけを返します。<strong>秘密鍵は agent の外に出ません。</strong>下の 64 バイトは、このページ上で生成したデモ鍵で、上のデータに WebCrypto で実際に署名した値です。',
        code: { title: 'agent プロトコル（$SSH_AUTH_SOCK）', lang: 'text', src: `
          ssh → agent: SSH_AGENTC_SIGN_REQUEST (13)
                       string 公開鍵 blob
                       string 署名対象データ（${SIGNED.length} B）
                       uint32 flags
          agent → ssh: SSH_AGENT_SIGN_RESPONSE (14)
                       string ( string "ssh-ed25519" ‖ string 署名 64 B )` },
        run: async (s) => {
          await s.fly('sd:l', 'agent:r', { label: 'SIGN_REQUEST (13)', dur: 900 });
          s.state('agent', 'active');
          await s.show('sig', { fx: 'up' });
          const sig = await demoSignature();
          if (sig) {
            s.text('signote', 'ページ上のデモ鍵で実署名', { flash: false });
            await s.scramble('sigv', sig, { dur: 1300 });
          } else {
            s.text('signote', 'Ed25519 非対応ブラウザ', { flash: false });
            s.text('sigv', '（このブラウザの WebCrypto は Ed25519 に未対応のため省略。形式は R 32 B ‖ S 32 B）', { flash: false });
          }
          await s.fly('agent:r', 'sig:l', { label: 'SIGN_RESPONSE (14)', dur: 900 });
          s.state('agent', null);
        },
      },
      {
        title: '署名付きで再送 → sshd が検証',
        text: '同じ要求を <code>TRUE</code> と署名付きで送ります。sshd は自分の手元の session_id とホスト鍵で同じデータを組み立て、<code>authorized_keys</code> の公開鍵で署名を検証します。通ればログに <code>Accepted publickey</code> が記録されます。',
        code: [
          { title: 'ssh -v', lang: 'text', src: `⟪Authenticated to server.example.com ([203.0.113.10]:22) using "publickey".⟫` },
          { title: 'server: journalctl -u ssh（sshd のログ）', lang: 'text', src: `Accepted publickey for alice from 198.51.100.7 port 53422 ssh2: ED25519 ${K.ufp}` },
        ],
        run: async (s) => {
          await s.fly('ssh:r', 'sshd:l', { label: 'USERAUTH_REQUEST + 署名', dur: 1100 });
          s.state('sshd', 'active');
          await s.scan('ak');
          await s.show('log', { fx: 'up' });
          await s.term('log', `
            Accepted publickey for alice from 198.51.100.7 port 53422 ssh2: ED25519 ${K.ufp}`);
          s.state('sshd', 'ok');
          await s.stamp('ak', 'VERIFIED', { cls: 'st-ok', pos: 'tl' });
        },
      },
      {
        title: '成功：ネットワークに流れたのは公開鍵と署名だけ',
        text: '<code>SSH_MSG_USERAUTH_SUCCESS</code> で認証完了です。流れたのは公開鍵 blob と、この接続の session_id を含むデータへの署名だけ。署名は別の接続では session_id が違うので使い回せず、<strong>秘密鍵そのものは一度もネットワークに出ていません</strong>。',
        code: { title: 'メッセージ', lang: 'text', src: `
          server → client: SSH_MSG_USERAUTH_SUCCESS (52)
          client → server: SSH_MSG_CHANNEL_OPEN (90) "session"   ← RFC 4254 のコネクション層へ` },
        run: async (s) => {
          await s.fly('sshd:l', 'ssh:r', { label: 'USERAUTH_SUCCESS (52)', cls: 'c-green', dur: 1000 });
          s.state('ssh', 'ok');
          await s.show('wl', { fx: 'fade' });
          await s.show('w1 w2 w3', { fx: 'pop', stagger: 160 });
          await s.caption('秘密鍵は <code>ssh-agent</code> の中。サーバーに渡るのは公開鍵と署名だけ', { cls: 'ok' });
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 4 — ssh -v を読む
   * ============================================================= */
  const P = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
  function phase(s, k) {
    P.forEach((p, i) => { if (i < k) s.state(p, 'ok'); });
    return s.state(P[k], 'active');
  }
  TIM.scene('#sc-verbose', {
    intro: '<code>ssh -v alice@server.example.com</code> の出力を、右の 7 段階に分けて順に流します（OpenSSH 10.3p1 同士・一部省略）。接続できないときは「最後に出た行がどの段階か」を見れば、どこを調べればよいかが決まります。',
    steps: [
      {
        title: '① 設定ファイルを読み、TCP 接続',
        text: '最初の行はクライアントの版（OpenSSL の版はビルドによって異なります）。<code>Reading configuration data</code> で読んだ設定ファイルが分かり、<code>Connecting to</code> の角括弧に<strong>実際に接続した IP アドレス</strong>が出ます。ここで止まるなら DNS・経路・ファイアウォールの問題です。',
        code: { title: 'ssh -v', lang: 'text', src: `
          debug1: OpenSSH_10.3p1, OpenSSL 3.5.7 9 Jun 2026
          debug1: Reading configuration data /home/alice/.ssh/config
          debug1: Reading configuration data /etc/ssh/ssh_config
          debug1: Connecting to server.example.com [⟪203.0.113.10⟫] port 22.
          debug1: Connection established.

          # 失敗例
          ssh: connect to host server.example.com port 22: Connection refused` },
        run: async (s) => {
          phase(s, 0);
          await s.term('tv', `
            $ ssh -v alice@server.example.com
            debug1: OpenSSH_10.3p1, OpenSSL 3.5.7 9 Jun 2026
            debug1: Reading configuration data /home/alice/.ssh/config
            debug1: Reading configuration data /etc/ssh/ssh_config
            debug1: Connecting to server.example.com [⟪203.0.113.10⟫] port 22.
            debug1: Connection established.`);
        },
      },
      {
        title: '② バナー交換',
        text: '<code>Remote protocol version</code> で<strong>サーバー側の SSH 実装と版</strong>が分かります。古い版だと、次の鍵交換で共通のアルゴリズムがなく失敗することがあります。',
        code: { title: 'ssh -v', lang: 'text', src: `
          debug1: Local version string SSH-2.0-OpenSSH_10.3
          debug1: Remote protocol version 2.0, remote software version ⟪OpenSSH_10.3⟫
          debug1: compat_banner: match: OpenSSH_10.3 pat OpenSSH* compat 0x04000000
          debug1: Authenticating to server.example.com:22 as 'alice'` },
        run: async (s) => {
          phase(s, 1);
          await s.term('tv', `
            debug1: Local version string SSH-2.0-OpenSSH_10.3
            debug1: Remote protocol version 2.0, remote software version ⟪OpenSSH_10.3⟫
            debug1: compat_banner: match: OpenSSH_10.3 pat OpenSSH* compat 0x04000000
            debug1: Authenticating to server.example.com:22 as 'alice'`);
        },
      },
      {
        title: '③ 鍵交換：決まったアルゴリズム',
        text: '<code>kex: algorithm</code>・<code>host key algorithm</code>・<code>cipher</code> が交渉結果です。共通のものがないと <code>Unable to negotiate with … no matching key exchange method found. Their offer: …</code> で終わり、<code>Their offer</code> にサーバーの一覧が出ます。',
        code: { title: 'ssh -v', lang: 'text', src: `
          debug1: SSH2_MSG_KEXINIT sent
          debug1: SSH2_MSG_KEXINIT received
          debug1: kex: algorithm: ⟪mlkem768x25519-sha256⟫
          debug1: kex: host key algorithm: ⟪ssh-ed25519⟫
          debug1: kex: server->client cipher: chacha20-poly1305@openssh.com MAC: <implicit> compression: none
          debug1: kex: client->server cipher: chacha20-poly1305@openssh.com MAC: <implicit> compression: none
          debug1: expecting SSH2_MSG_KEX_ECDH_REPLY
          debug1: SSH2_MSG_KEX_ECDH_REPLY received

          # 相手が耐量子でない kex しか持たない場合（OpenSSH 10.1 以降の警告）
          ** WARNING: connection is not using a post-quantum key exchange algorithm.
          ** This session may be vulnerable to "store now, decrypt later" attacks.
          ** The server may need to be upgraded. See https://openssh.com/pq.html` },
        run: async (s) => {
          phase(s, 2);
          await s.term('tv', `
            debug1: SSH2_MSG_KEXINIT sent
            debug1: SSH2_MSG_KEXINIT received
            debug1: kex: algorithm: ⟪mlkem768x25519-sha256⟫
            debug1: kex: host key algorithm: ⟪ssh-ed25519⟫
            debug1: kex: server->client cipher: ⟪chacha20-poly1305@openssh.com⟫ MAC: <implicit> compression: none
            debug1: kex: client->server cipher: chacha20-poly1305@openssh.com MAC: <implicit> compression: none
            debug1: expecting SSH2_MSG_KEX_ECDH_REPLY
            debug1: SSH2_MSG_KEX_ECDH_REPLY received`);
        },
      },
      {
        title: '④ ホスト鍵を known_hosts で確認',
        text: '<code>Server host key</code> がサーバーの提示したホスト鍵のフィンガープリント、<code>Found key in …known_hosts:1</code> が一致した行番号です。ここで不一致だと <code>REMOTE HOST IDENTIFICATION HAS CHANGED!</code> になります。',
        code: { title: 'ssh -v', lang: 'text', src: `
          debug1: Server host key: ssh-ed25519 ⟪SHA256:KsUIdbXsTWf9c2BqWhUiXlD2hztj9R7T5QTNA9Tm5wA⟫
          debug1: Host 'server.example.com' is known and matches the ED25519 host key.
          debug1: Found key in ⟪/home/alice/.ssh/known_hosts:1⟫` },
        run: async (s) => {
          phase(s, 3);
          await s.term('tv', `
            debug1: Server host key: ssh-ed25519 ⟪${K.hfp}⟫
            debug1: Host 'server.example.com' is known and matches the ED25519 host key.
            debug1: Found key in /home/alice/.ssh/known_hosts:1`);
        },
      },
      {
        title: '⑤ NEWKEYS：暗号化開始',
        text: '<code>SSH2_MSG_NEWKEYS</code> の送受信で新しい鍵に切り替わります。<code>rekey out after 134217728 blocks</code> は再鍵交換までの量で、chacha20-poly1305（ブロック長 8）では 2^30 / 8 = 134217728 ブロックです。<code>EXT_INFO</code> はサーバーが対応する署名アルゴリズム（<code>server-sig-algs</code>）などの通知です（RFC 8308）。',
        code: { title: 'ssh -v', lang: 'text', src: `
          debug1: rekey out after 134217728 blocks
          debug1: SSH2_MSG_NEWKEYS sent
          debug1: expecting SSH2_MSG_NEWKEYS
          debug1: SSH2_MSG_NEWKEYS received
          debug1: rekey in after 134217728 blocks
          debug1: SSH2_MSG_EXT_INFO received` },
        run: async (s) => {
          phase(s, 4);
          await s.term('tv', `
            debug1: rekey out after 134217728 blocks
            debug1: SSH2_MSG_NEWKEYS sent
            debug1: expecting SSH2_MSG_NEWKEYS
            debug1: SSH2_MSG_NEWKEYS received
            debug1: rekey in after 134217728 blocks
            debug1: SSH2_MSG_EXT_INFO received`);
        },
      },
      {
        title: '⑥ ユーザー認証',
        text: '<code>Authentications that can continue</code> がサーバーの許す方式。<code>Offering public key</code> が提示した鍵（末尾の <code>agent</code> は ssh-agent 経由の意味）、<code>Server accepts key</code> が authorized_keys に載っていたこと、<code>Authenticated to</code> が成功です。鍵が拒否されると <code>Offering</code> の直後に再び <code>Authentications that can continue</code> が出ます。',
        code: { title: 'ssh -v', lang: 'text', src: `
          debug1: SSH2_MSG_SERVICE_ACCEPT received
          debug1: Authentications that can continue: ⟪publickey,password⟫
          debug1: Next authentication method: publickey
          debug1: Will attempt key: /home/alice/.ssh/id_ed25519 ED25519 SHA256:1CJKc5w5H5JWqOQ3uHI55fN1NgyxwAOiwqyegCepEQ0 agent
          debug1: Offering public key: /home/alice/.ssh/id_ed25519 ED25519 SHA256:1CJKc5w5H5JWqOQ3uHI55fN1NgyxwAOiwqyegCepEQ0 agent
          debug1: ⟪Server accepts key⟫: /home/alice/.ssh/id_ed25519 ED25519 SHA256:1CJKc5w5H5JWqOQ3uHI55fN1NgyxwAOiwqyegCepEQ0 agent
          Authenticated to server.example.com ([203.0.113.10]:22) using "publickey".` },
        run: async (s) => {
          phase(s, 5);
          await s.term('tv', `
            debug1: SSH2_MSG_SERVICE_ACCEPT received
            debug1: Authentications that can continue: ⟪publickey,password⟫
            debug1: Next authentication method: publickey
            debug1: Offering public key: /home/alice/.ssh/id_ed25519 ED25519 ${K.ufp} agent
            debug1: ⟪Server accepts key⟫: /home/alice/.ssh/id_ed25519 ED25519 ${K.ufp} agent
            ⟪Authenticated to server.example.com ([203.0.113.10]:22) using "publickey".⟫`);
        },
      },
      {
        title: '⑦ セッション開始',
        text: '認証後はコネクション層（RFC 4254）です。<code>channel 0: new session</code> がシェル用のチャネル。<code>-L</code> / <code>-R</code> を付けていれば、ここでポートフォワード用のチャネルやリスナーも作られます。',
        code: { title: 'ssh -v', lang: 'text', src: `
          debug1: channel 0: new session [client-session] (inactive timeout: 0)
          debug1: Requesting no-more-sessions@openssh.com
          debug1: Entering interactive session.
          debug1: Sending environment.
          alice@server:~$` },
        run: async (s) => {
          phase(s, 6);
          await s.term('tv', `
            debug1: channel 0: new session [client-session] (inactive timeout: 0)
            debug1: Requesting no-more-sessions@openssh.com
            debug1: Entering interactive session.
            debug1: Sending environment.
            alice@server:~$`);
          s.state('p7', 'ok');
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 5 — 失敗ケース
   * ============================================================= */
  TIM.scene('#sc-fail', {
    intro: '3 つの失敗を順に見ます。(1) 通信経路に偽サーバーが入り、ホスト鍵が known_hosts と一致しない。(2) クライアントの秘密鍵のモードが緩い。(3) サーバー側の <code>~/.ssh</code> のモードが緩く、<code>StrictModes</code> に拒否される。どれも「どちらのマシンのどのファイルか」がポイントです。',
    steps: [
      {
        title: 'ケース 1：偽サーバーが経路に割り込む',
        text: 'DNS の偽装、公衆 Wi-Fi の偽アクセスポイント、ARP スプーフィングなどで、<code>server.example.com</code> 宛ての TCP 接続が攻撃者のホスト <code>192.0.2.66</code> に届いたとします。攻撃者はそのまま本物のサーバーへ中継するつもりです。',
        code: { title: 'ssh -v（接続先の IP が変わっている）', lang: 'text', src: `debug1: Connecting to server.example.com [⟪192.0.2.66⟫] port 22.` },
        run: async (s) => {
          await s.show('atk', { fx: 'pop' });
          s.line('cl:r', 'atk:l', { cls: 'bad', id: 'm1', label: 'TCP :22' });
          await s.line('atk:r', 'sv:l', { cls: 'dash', id: 'm2', label: '中継' });
        },
      },
      {
        title: '偽サーバーは自分のホスト鍵で正しく署名する',
        text: '攻撃者は本物の <code>/etc/ssh/ssh_host_ed25519_key</code> を持っていないので、<strong>自分のホスト鍵</strong>で H に署名して返します。署名自体は数学的に正しく検証できてしまいます。問題は「その公開鍵が server.example.com のものか」です。',
        code: { title: '攻撃者のホスト公開鍵（デモ）', lang: 'text', src: `
          ${K.epub}
          256 ${K.efp} root@evil (ED25519)` },
        run: async (s) => {
          await s.fly('atk:l', 'cl:r', { label: 'K_S = 偽の鍵 + 署名', cls: 'c-red', arc: -30, dur: 1100 });
        },
      },
      {
        title: 'known_hosts の鍵と比較 → 不一致',
        text: 'クライアントは known_hosts の 1 行目に保存した鍵と、受け取った <code>K_S</code> を比べます。フィンガープリント（このページで計算）が違うので、<strong>相手は以前と別の鍵を持つホスト</strong>だと分かります。',
        code: { title: 'alice@laptop', lang: 'bash', src: `
          $ ssh-keygen -F server.example.com
          # Host server.example.com found: line 1
          server.example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBEDErqZ2CAGW7Qa5VehKWuP8A/nse1EVt8vPduCPiHr
          $ ssh-keygen -F server.example.com | tail -1 | ssh-keygen -lf -
          256 ⟪SHA256:KsUIdbXsTWf9c2BqWhUiXlD2hztj9R7T5QTNA9Tm5wA⟫ server.example.com (ED25519)
          # 受信した鍵: ⟪SHA256:X5D4nC+hhOLWMcY+S5AzAurGbqkJCciCt13WUy6/tek⟫` },
        run: async (s) => {
          await s.show('cmp', { fx: 'up' });
          await s.scan('kh');
          let fp = K.efp;
          try { fp = await fingerprint(K.epub); } catch (e) { /* static */ }
          await s.scramble('cmp2', fp, { chars: B64, dur: 900 });
          s.state('cmp', 'bad');
          await s.shake('cmp');
          await s.stamp('cmp', 'MISMATCH', { cls: 'st-bad' });
        },
      },
      {
        title: '接続を中止：Host key verification failed.',
        text: '<code>StrictHostKeyChecking</code> が既定の <code>ask</code> でも、<strong>既知ホストの鍵が変わった場合は必ず中止</strong>します。この時点では鍵交換が終わっただけで、パスワードも署名もまだ送っていません。',
        code: { title: 'OpenSSH 10.3 の実際のメッセージ', lang: 'text', src: `
          @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
          @    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
          @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
          IT IS POSSIBLE THAT SOMEONE IS DOING SOMETHING NASTY!
          Someone could be eavesdropping on you right now (man-in-the-middle attack)!
          It is also possible that a host key has just been changed.
          The fingerprint for the ED25519 key sent by the remote host is
          ⟪SHA256:X5D4nC+hhOLWMcY+S5AzAurGbqkJCciCt13WUy6/tek⟫.
          Please contact your system administrator.
          Add correct host key in /home/alice/.ssh/known_hosts to get rid of this message.
          Offending ED25519 key in ⟪/home/alice/.ssh/known_hosts:1⟫
          Host key for server.example.com has changed and you have requested strict checking.
          Host key verification failed.` },
        run: async (s) => {
          await s.term('tf', `
            $ ssh alice@server.example.com
            @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
            @    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
            @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
            IT IS POSSIBLE THAT SOMEONE IS DOING SOMETHING NASTY!
            Someone could be eavesdropping on you right now (man-in-the-middle attack)!
            It is also possible that a host key has just been changed.
            The fingerprint for the ED25519 key sent by the remote host is
            ${K.efp}.
            Please contact your system administrator.
            Add correct host key in /home/alice/.ssh/known_hosts to get rid of this message.
            Offending ED25519 key in /home/alice/.ssh/known_hosts:1
            Host key for server.example.com has changed and you have requested strict checking.
            ⟪Host key verification failed.⟫`, { lineDelay: 25 });
          s.state('cl', 'bad');
          await s.shake('cl');
          await s.caption('パスワードも署名も送る前に切断される', { cls: 'bad' });
        },
      },
      {
        title: '正規の変更なら：確認してから <code>ssh-keygen -R</code>',
        text: 'サーバーを再構築した場合なども同じ警告になります。<strong>サーバー管理者から別経路（コンソール・社内 Wiki など）で新しいフィンガープリントを入手し、一致を確認してから</strong>古い行を消します。消した後の初回接続で、新しい鍵を確認して登録し直します。',
        code: [
          { title: 'server（コンソールで管理者が確認）', lang: 'bash', src: `
            # ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
            256 SHA256:… root@server (ED25519)` },
          { title: 'alice@laptop', lang: 'bash', src: `
            $ ssh-keygen -R server.example.com
            # Host server.example.com found: line 1
            /home/alice/.ssh/known_hosts updated.
            Original contents retained as /home/alice/.ssh/known_hosts.old` },
        ],
        run: async (s) => {
          await s.caption('');
          await Promise.all([s.hide('m1 m2'), s.hide('atk')]);
          await s.term('tf', `
            $ ssh-keygen -R server.example.com
            # Host server.example.com found: line 1
            /home/alice/.ssh/known_hosts updated.
            Original contents retained as /home/alice/.ssh/known_hosts.old`, { clear: true });
          await s.set('khb', '（1 行目を削除。次回接続時に新しい鍵を確認して追加）');
          s.state('cl', null);
          s.state('cmp', 'dim');
        },
      },
      {
        title: 'ケース 2：秘密鍵のモードが 0644',
        text: '秘密鍵を別マシンからコピーしたときなどにモードが <code>644</code> になっていると、ssh は <strong>その鍵を読み込まずに無視</strong>します。提示できる鍵がなくなり、結果としてサーバーには <code>Permission denied (publickey)</code> で拒否されます。',
        code: { title: 'alice@laptop（OpenSSH 10.3 の実際のメッセージ）', lang: 'bash', src: `
          $ ssh alice@server.example.com
          @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
          @         WARNING: UNPROTECTED PRIVATE KEY FILE!          @
          @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
          Permissions ⟪0644⟫ for '/home/alice/.ssh/id_ed25519' are too open.
          It is required that your private key files are NOT accessible by others.
          This private key will be ignored.
          Load key "/home/alice/.ssh/id_ed25519": bad permissions
          alice@server.example.com: Permission denied (publickey).` },
        run: async (s) => {
          await s.show('pk', { fx: 'up' });
          s.state('pk', 'bad');
          await s.term('tf', `
            $ ssh alice@server.example.com
            @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
            @         WARNING: UNPROTECTED PRIVATE KEY FILE!          @
            @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
            Permissions ⟪0644⟫ for '/home/alice/.ssh/id_ed25519' are too open.
            It is required that your private key files are NOT accessible by others.
            This private key will be ignored.
            Load key "/home/alice/.ssh/id_ed25519": bad permissions
            alice@server.example.com: Permission denied (publickey).`, { clear: true, lineDelay: 25 });
          await s.shake('pk');
        },
      },
      {
        title: '<code>chmod 600</code> で直る',
        text: 'group/other の権限を全部落とせば読み込まれます（<code>400</code> でも可）。<code>~/.ssh</code> ディレクトリ自体も <code>700</code> にしておきます。',
        code: { title: 'alice@laptop', lang: 'bash', src: `
          $ chmod 700 ~/.ssh
          $ chmod 600 ~/.ssh/id_ed25519
          $ ls -l ~/.ssh/id_ed25519
          -rw------- 1 alice alice 411 Sep 28 10:00 /home/alice/.ssh/id_ed25519
          $ ssh alice@server.example.com
          alice@server:~$` },
        run: async (s) => {
          await s.term('tf', `
            $ chmod 600 ~/.ssh/id_ed25519
            $ ssh alice@server.example.com
            alice@server:~$`, { clear: true });
          await s.set('pkm', '-rw-------（0600）');
          s.state('pk', 'ok');
        },
      },
      {
        title: 'ケース 3：サーバー側の <code>~/.ssh</code> が 0775',
        text: 'サーバーで誰かが <code>chmod 775 ~/.ssh</code> してしまった場合です（パスワード認証は無効化済みとします）。sshd は <code>StrictModes yes</code> により authorized_keys を<strong>読まずに拒否</strong>します。クライアントに見えるのは <code>Permission denied (publickey)</code> だけで、理由は<strong>サーバーのログにしか出ません</strong>。',
        code: [
          { title: 'alice@laptop', lang: 'text', src: `
            $ ssh -v alice@server.example.com
            …
            debug1: Offering public key: /home/alice/.ssh/id_ed25519 ED25519 SHA256:1CJK… agent
            debug1: Authentications that can continue: publickey      ← 同じ鍵が拒否された
            debug1: No more authentication methods to try.
            alice@server.example.com: Permission denied (publickey).` },
          { title: 'server: journalctl -u ssh（sshd のログ）', lang: 'text', src: `Authentication refused: ⟪bad ownership or modes for directory /home/alice/.ssh⟫` },
        ],
        run: async (s) => {
          await s.show('sd', { fx: 'up' });
          s.state('sd', 'bad');
          await s.term('tf', `
            $ ssh -v alice@server.example.com
            debug1: Offering public key: /home/alice/.ssh/id_ed25519 ED25519 ${K.ufp} agent
            debug1: Authentications that can continue: publickey
            debug1: No more authentication methods to try.
            alice@server.example.com: Permission denied (publickey).`, { clear: true, lineDelay: 30 });
          await s.show('alog', { fx: 'up' });
          s.state('alog', 'bad');
          await s.shake('sd');
        },
      },
      {
        title: 'サーバー側を直す',
        text: '<code>~/.ssh</code> を <code>700</code>、<code>authorized_keys</code> を <code>600</code> に戻せば通ります。ホームディレクトリ自体が group/other 書き込み可でも同じ拒否になるので、あわせて確認します。',
        code: { title: 'server（alice でログインできる別の手段で）', lang: 'bash', src: `
          $ chmod 700 ~/.ssh
          $ chmod 600 ~/.ssh/authorized_keys
          $ ls -ld ~ ~/.ssh ~/.ssh/authorized_keys
          drwxr-x--- 5 alice alice 4096 Sep 28 10:05 /home/alice
          drwx------ 2 alice alice 4096 Sep 28 10:05 /home/alice/.ssh
          -rw------- 1 alice alice   97 Sep 28 10:05 /home/alice/.ssh/authorized_keys` },
        run: async (s) => {
          await s.set('sdm', 'drwx------（0700）');
          s.state('sd', 'ok');
          s.state('alog', 'dim');
          await s.term('tf', `
            $ ssh alice@server.example.com
            alice@server:~$`, { clear: true });
          s.state('cl', 'ok');
          await s.caption('ホスト鍵は client の known_hosts、秘密鍵は client のモード、StrictModes は server のモード', { cls: 'ok' });
        },
      },
    ],
  });

  /* ===============================================================
   * LAB — 公開鍵のフィンガープリント
   * ============================================================= */
  const inp = document.getElementById('fp-in');
  const out = document.getElementById('fp-out');
  const go = document.getElementById('fp-go');
  const hostBtn = document.getElementById('fp-host');
  async function runLab() {
    const lines = [];
    try {
      const blob = blobOf(inp.value);
      const p = parseBlob(blob);
      const td = new TextDecoder();
      const type = p.fields[0] ? td.decode(p.fields[0].bytes) : '?';
      lines.push('blob       ' + blob.length + ' バイト');
      p.fields.forEach((f, i) => {
        const show = i === 0 ? '"' + td.decode(f.bytes) + '"' : TIM.hex(f.bytes).slice(0, 48) + (f.len > 24 ? '…' : '');
        lines.push('  string   len=' + String(f.len).padEnd(4) + ' ' + show);
      });
      if (p.rest) lines.push('  (解釈できない残り ' + p.rest + ' バイト)');
      const d = await crypto.subtle.digest('SHA-256', blob);
      lines.push('SHA-256    ' + TIM.hex(d));
      lines.push('');
      lines.push('⟪SHA256:' + b64enc(d).replace(/=+$/, '') + '⟫   (' + type + ')');
    } catch (e) {
      lines.push('エラー: ' + e.message);
    }
    out.innerHTML = '<code>' + TIM.codeLines(lines.join('\n'), 'text') + '</code>';
  }
  if (inp && out && go) {
    go.addEventListener('click', runLab);
    if (hostBtn) hostBtn.addEventListener('click', () => { inp.value = KH_LINE; runLab(); });
    if (window.crypto && crypto.subtle) runLab();
  }
})();
