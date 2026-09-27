/* Git internals — scenes (AGENT.md §7). Object IDs are computed on this page with WebCrypto SHA-1
 * and cross-checked against the values produced by real git 2.55 (constants G below). */
(function () {
  'use strict';

  /* ---------------------------------------------------------------
   * Git object hashing (same bytes as `git hash-object`)
   * ------------------------------------------------------------- */
  const te = new TextEncoder();
  function cat(parts) {
    const n = parts.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(n);
    let o = 0;
    parts.forEach((p) => { out.set(p, o); o += p.length; });
    return out;
  }
  function hexBytes(h) {
    const u = new Uint8Array(h.length / 2);
    for (let i = 0; i < u.length; i++) u[i] = parseInt(h.substr(i * 2, 2), 16);
    return u;
  }
  /** "<type> <size>\0<body>" */
  function obj(type, body) {
    const b = typeof body === 'string' ? te.encode(body) : body;
    return cat([te.encode(type + ' ' + b.length + '\0'), b]);
  }
  async function digest(alg, bytes) { return TIM.hex(await crypto.subtle.digest(alg, bytes)); }
  const sha1 = (bytes) => digest('SHA-1', bytes);
  const blobId = (text) => sha1(obj('blob', text));
  function treeBody(entries) {
    return cat(entries.map((e) => cat([te.encode(e.mode + ' ' + e.name + '\0'), hexBytes(e.id)])));
  }
  const treeId = (entries) => sha1(obj('tree', treeBody(entries)));
  function commitText(c) {
    return 'tree ' + c.tree + '\n' + (c.parent ? 'parent ' + c.parent + '\n' : '') +
      'author Alice <alice@example.com> ' + c.time + ' +0900\n' +
      'committer Alice <alice@example.com> ' + c.time + ' +0900\n\n' + c.msg + '\n';
  }
  const commitId = (c) => sha1(obj('commit', commitText(c)));

  // Values produced by real git 2.55 (GIT_AUTHOR/COMMITTER_* fixed as on this page)
  const G = {
    blob: 'ce013625030ba8dba906f756967f9e9ca394464a',
    readme: 'fc72a5c1094e203eefcd1c710f060957ebbbaac4',
    blob3: '94bab17c85ac96c4dd0cfcb7a16f22f6862733eb',
    tree1: 'aaa96ced2d9a1c8e72c56b253a0e2fe78393feb7',
    tree2: '123a018a9ee40c870f50a18c60f75d9acbb3f0eb',
    tree3: '61848c78bc4fad6711083996faf17e2507477606',
    c1: '1936b6d40aeaa479cceac281d7ff7b60874b415d',
    c2: '5dd578e04fe83f3ed1ff46fa56e32fa9d824d1c7',
    c3: '6c6efca04b0dcda0c0810953a0a5000ab91445af',
    tblob: '4b32b59cf6f008703c95a6d2284f027e6ef86b54',
    ttree1: '72c7b16fbf7a3252478cff3272b43156ce39d073',
    tc1: '21be53fef7cf213d7e72b688a8853e9fa52214e3',
    ttree2: 'a60b20d0cc28bf8957e96e421b86b392291471af',
    tc2: '20b0b5f29d75c09eec0582427bde1264a0b1401a',
    rawsum: 'f572d396fae9206628714fb2ce00f72e94f2258f',
  };

  let allP = null;
  /** Compute every ID on this page (memoized). */
  function computeAll() {
    if (!allP) {
      allP = (async () => {
        const r = {};
        r.blob = await blobId('hello\n');
        r.readme = await blobId('# demo\n');
        r.blob3 = await blobId('hello, git\n');
        r.rawsum = await sha1(te.encode('hello\n'));
        r.tree1 = await treeId([{ mode: '100644', name: 'hello.txt', id: r.blob }]);
        r.tree2 = await treeId([{ mode: '100644', name: 'README.md', id: r.readme }, { mode: '100644', name: 'hello.txt', id: r.blob }]);
        r.tree3 = await treeId([{ mode: '100644', name: 'README.md', id: r.readme }, { mode: '100644', name: 'hello.txt', id: r.blob3 }]);
        r.c1 = await commitId({ tree: r.tree1, time: 1727500000, msg: 'first commit' });
        r.c2 = await commitId({ tree: r.tree2, parent: r.c1, time: 1727500600, msg: 'add README' });
        r.c3 = await commitId({ tree: r.tree3, parent: r.c2, time: 1727501200, msg: 'update greeting' });
        // tampered: 'hello\n' -> 'hellO\n'
        r.tblob = await blobId('hellO\n');
        r.ttree1 = await treeId([{ mode: '100644', name: 'hello.txt', id: r.tblob }]);
        r.tc1 = await commitId({ tree: r.ttree1, time: 1727500000, msg: 'first commit' });
        r.ttree2 = await treeId([{ mode: '100644', name: 'README.md', id: r.readme }, { mode: '100644', name: 'hello.txt', id: r.tblob }]);
        r.tc2 = await commitId({ tree: r.ttree2, parent: r.tc1, time: 1727500600, msg: 'add README' });
        return r;
      })().catch(() => Object.assign({}, G));
    }
    return allP;
  }
  // 自己検査：ページ上の計算が実際の git の出力と一致すること
  if (window.crypto && crypto.subtle) {
    computeAll().then((r) => {
      const bad = Object.keys(G).filter((k) => r[k] !== G[k]);
      if (bad.length) console.error('[git-internals] hash self-check failed:', bad.join(', '));
    });
  }
  const HEX = '0123456789abcdef';

  /* ===============================================================
   * SCENE 1 — git init
   * ============================================================= */
  const gtLine = (n) => '[data-el="gt"] .ln:nth-child(' + n + ')';
  TIM.scene('#sc-init', {
    intro: '<code>git init</code> 直後の <code>.git/</code> を見ます。できるのは設定ファイルと空のディレクトリだけで、オブジェクトもブランチもまだありません。',
    steps: [
      {
        title: '<code>git init</code> を実行',
        text: '<code>demo/.git/</code> が作られます。作業ツリー（<code>demo/</code>）はまだ空で、ファイルも履歴もありません。既定のブランチ名は <code>init.defaultBranch</code> の設定で決まります（ここでは <code>main</code> に設定済み）。',
        code: { title: 'alice@laptop（git 2.55）', lang: 'bash', src: `
          $ git config --global init.defaultBranch main   # 未設定なら Git 2.x は master（ヒントが出る）
          $ git init demo
          Initialized empty Git repository in /home/alice/demo/.git/
          $ cd demo && ls -A
          .git` },
        run: async (s) => {
          await s.term('tg', `
            $ git init demo
            Initialized empty Git repository in /home/alice/demo/.git/
            $ cd demo && ls -A
            .git`);
        },
      },
      {
        title: '<code>.git/</code> の骨組み',
        text: '中身は、テキストファイル 3 つ（<code>HEAD</code> <code>config</code> <code>description</code>）と、<code>hooks/</code>（サンプルのスクリプト）、<code>info/exclude</code>、そして空の <code>objects/</code> と <code>refs/</code> です。<strong>リポジトリの本体は objects/ と refs/</strong> で、以降のコマンドはほぼこの 2 か所を書き換えます。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ ls -A .git
          HEAD  config  description  hooks  info  objects  refs
          $ find .git/objects .git/refs
          .git/objects
          .git/objects/info
          .git/objects/pack
          .git/refs
          .git/refs/heads
          .git/refs/tags` },
        run: async (s) => {
          await s.show('gt', { fx: 'right' });
          await s.scan('gt');
        },
      },
      {
        title: '<code>HEAD</code>：今いるブランチ',
        text: '<code>.git/HEAD</code> は 1 行だけのテキスト <code>ref: refs/heads/main</code>（シンボリック ref）。「今のブランチは main」という意味です。コミットしても<strong>このファイルは変わらず</strong>、書き換わるのは <code>refs/heads/main</code> の方です。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ cat .git/HEAD
          ref: refs/heads/main
          $ wc -c .git/HEAD
          21 .git/HEAD
          $ git symbolic-ref HEAD
          refs/heads/main` },
        run: async (s) => {
          s.cls(gtLine(2), 'hl');
          await s.show('hd', { fx: 'up' });
          await s.pulse('hd');
        },
      },
      {
        title: '<code>config</code>：このリポジトリだけの設定',
        text: '<code>git config --local</code> で書かれる場所です。<code>repositoryformatversion = 0</code> は SHA-1 の通常のリポジトリ（SHA-256 などの拡張を使うと 1）。Windows / macOS では <code>ignorecase</code> や <code>symlinks</code> などが追加されます。',
        code: { title: '.git/config（Linux）', lang: 'ini', src: `
          [core]
          	repositoryformatversion = 0
          	filemode = true
          	bare = false
          	logallrefupdates = true` },
        run: async (s) => {
          s.cls(gtLine(2), '', 'hl');
          s.cls(gtLine(3), 'hl');
          await s.show('cf', { fx: 'up' });
        },
      },
      {
        title: '<code>objects/</code> はまだ空',
        text: 'オブジェクト DB は空です。<code>git add</code> や <code>git commit</code> をすると、ここに <code>xx/yyyy…</code> というファイルが増えていきます。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ find .git/objects -type f
          $ git count-objects -v
          count: 0
          size: 0
          in-pack: 0
          packs: 0
          size-pack: 0
          prune-packable: 0
          garbage: 0
          size-garbage: 0` },
        run: async (s) => {
          s.cls(gtLine(3), '', 'hl');
          s.cls([gtLine(8), gtLine(9), gtLine(10)], 'hl');
          await s.show('c-obj', { fx: 'pop' });
        },
      },
      {
        title: 'ブランチ <code>main</code> はまだ存在しない',
        text: '<code>HEAD</code> は <code>refs/heads/main</code> を指していますが、そのファイルはまだありません（<strong>unborn branch</strong>）。コミットが 1 つもないので <code>git log</code> はエラーになります。最初の <code>git commit</code> で初めてこのファイルが作られます。',
        code: { title: 'alice@laptop:~/demo（git 2.55 の実際の出力）', lang: 'bash', src: `
          $ ls .git/refs/heads/
          $ git log
          fatal: your current branch 'main' does not have any commits yet
          $ git rev-parse HEAD
          fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree.
          Use '--' to separate paths from revisions, like this:
          'git <command> [<revision>...] -- [<file>...]'
          HEAD` },
        run: async (s) => {
          s.cls([gtLine(8), gtLine(9), gtLine(10)], '', 'hl');
          s.cls([gtLine(11), gtLine(12)], 'hl');
          await s.term('tg', `
            $ git log
            fatal: your current branch 'main' does not have any commits yet`);
          await s.show('c-ref', { fx: 'pop' });
          await s.show('c-idx', { fx: 'pop' });
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 2 — git add = blob
   * ============================================================= */
  TIM.scene('#sc-blob', {
    intro: '<code>hello.txt</code>（中身は <code>hello</code> + 改行の 6 バイト）を <code>git add</code> したとき、<code>.git/objects/</code> に何が書かれるかを 1 バイトずつ追います。SHA-1 はこのページ上で WebCrypto により実際に計算しています。',
    steps: [
      {
        title: '作業ツリーのファイル（6 バイト）',
        text: '<code>hello.txt</code> の中身は <code>68 65 6c 6c 6f 0a</code> — "hello" の 5 バイトと改行 LF の 1 バイトです。git が扱うのはこのバイト列で、ファイル名や更新日時はここには含まれません。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ printf 'hello\\n' > hello.txt
          $ wc -c hello.txt
          6 hello.txt
          $ xxd hello.txt
          00000000: 6865 6c6c 6f0a                           hello.` },
        run: async (s) => { await s.pulse('wf'); },
      },
      {
        title: 'ヘッダ <code>blob 6\\0</code> を付ける',
        text: 'git は中身の前に「種類・空白・10 進のバイト数・NUL（0x00）」のヘッダを付けます。種類は <code>blob</code> <code>tree</code> <code>commit</code> <code>tag</code> の 4 つ。サイズが入るので、中身の長さが違えば必ず別のバイト列になります。',
        code: { title: 'オブジェクトの形式', lang: 'text', src: `
          <type> SP <size（10 進）> NUL <content>
          ⟪blob⟫ ⟪6⟫\\0hello\\n` },
        run: async (s) => {
          s.cls('hdr', '', 'hide');
          await s.show('[data-el="hdr"] > span', { fx: 'up', stagger: 140 });
        },
      },
      {
        title: 'ハッシュ対象は 13 バイト',
        text: 'ヘッダ 7 バイト（<code>62 6c 6f 62 20 36 00</code>）と中身 6 バイトを連結した 13 バイトが、ID を計算する対象です。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ printf 'blob 6\\0hello\\n' | xxd
          00000000: ⟪626c 6f62 2036 00⟫68 656c 6c6f 0a         blob 6.hello.` },
        run: async (s) => {
          await s.show('raw', { fx: 'up' });
          await s.scan('raw');
        },
      },
      {
        title: 'SHA-1 を計算 → これがオブジェクト ID',
        text: '13 バイトの SHA-1（20 バイト = 16 進 40 桁）がこの blob の ID です。このステップでは<strong>ページ上で <code>crypto.subtle.digest(\'SHA-1\', …)</code> を実行</strong>しており、<code>git hash-object</code> と同じ <code>ce013625…</code> になります。',
        code: [
          { title: 'alice@laptop:~/demo', lang: 'bash', src: `
            $ git hash-object hello.txt
            ⟪ce013625030ba8dba906f756967f9e9ca394464a⟫
            $ printf 'blob 6\\0hello\\n' | sha1sum
            ⟪ce013625030ba8dba906f756967f9e9ca394464a⟫  -` },
          { title: 'このページの計算（scenes.js）', lang: 'js', src: `
            const bytes = new TextEncoder().encode('blob 6\\0hello\\n');
            const id = hex(await crypto.subtle.digest('SHA-1', bytes));` },
        ],
        run: async (s) => {
          await s.show('sha', { fx: 'zoom' });
          const r = await computeAll();
          await s.scramble('shav', r.blob, { chars: HEX, dur: 1500 });
        },
      },
      {
        title: '<code>sha1sum hello.txt</code> とは一致しない',
        text: 'ファイルそのものの SHA-1 は <code>f572d396…</code> で、git の ID とは別物です。git の ID は<strong>ヘッダ込み</strong>のハッシュだからです。「同じ中身なら同じ ID」は git の中だけの約束で、外部ツールで検算するときはヘッダを付けます。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ sha1sum hello.txt
          ⟪f572d396fae9206628714fb2ce00f72e94f2258f⟫  hello.txt
          $ git hash-object hello.txt
          ce013625030ba8dba906f756967f9e9ca394464a` },
        run: async (s) => {
          await s.show('sum', { fx: 'up' });
          const r = await computeAll();
          await s.scramble('sumv', r.rawsum, { chars: HEX, dur: 900 });
          s.state('sum', 'bad');
        },
      },
      {
        title: '保存先：ID の先頭 2 桁がディレクトリ',
        text: '<code>git add</code> は ID の先頭 2 桁をディレクトリ名、残り 38 桁をファイル名にして保存します。1 つのディレクトリにファイルが集中しないよう、最大 256 個のディレクトリに振り分ける仕組みです。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ git add hello.txt
          $ find .git/objects -type f
          .git/objects/⟪ce⟫/013625030ba8dba906f756967f9e9ca394464a
          $ git cat-file -t ce0136
          blob
          $ git cat-file -s ce0136
          6` },
        run: async (s) => {
          await s.show('path', { fx: 'up' });
          await s.line('sha:b', 'path:t', { cls: 'acc' });
        },
      },
      {
        title: 'zlib で圧縮して書き込む',
        text: 'ファイルの中身は「ヘッダ + 中身」を zlib（deflate）で圧縮したもので、13 バイトが 21 バイトになっています（小さすぎて圧縮が効かない例）。<code>78 01</code> は zlib のヘッダです。ファイルは読み取り専用（<code>-r--r--r--</code>）で作られ、以後書き換えられません。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ ls -l .git/objects/ce/
          -r--r--r-- 1 alice alice 21 Sep 28 10:00 013625030ba8dba906f756967f9e9ca394464a
          $ xxd .git/objects/ce/013625030ba8dba906f756967f9e9ca394464a
          00000000: ⟪7801⟫ 4bca c94f 5230 63c8 48cd c9c9 e702  x.K..OR0c.H.....
          00000010: 001d c504 14                             .....
          $ python3 -c 'import sys,zlib; print(zlib.decompress(open(sys.argv[1],"rb").read()))' \\
              .git/objects/ce/013625030ba8dba906f756967f9e9ca394464a
          b'blob 6\\x00hello\\n'` },
        run: async (s) => {
          await s.show('zl', { fx: 'left' });
          await s.line('path:r', 'zl:l', { cls: 'acc' });
        },
      },
      {
        title: 'index に「hello.txt = この blob」と記録',
        text: '最後に <code>.git/index</code> にエントリを書きます。ここで初めて<strong>ファイル名とモード（<code>100644</code>）</strong>が blob の ID と結び付きます。<code>0</code> は stage 番号（マージ衝突中だけ 1〜3 を使う）。次の <code>git commit</code> はこの index から tree を作ります。',
        code: [
          { title: 'alice@laptop:~/demo', lang: 'bash', src: `
            $ git ls-files --stage
            ⟪100644⟫ ⟪ce013625030ba8dba906f756967f9e9ca394464a⟫ 0	⟪hello.txt⟫
            $ git status
            On branch main

            No commits yet

            Changes to be committed:
              (use "git rm --cached <file>..." to unstage)
            	new file:   hello.txt` },
          { title: '.git/index の先頭', lang: 'text', src: `
            $ xxd .git/index | head -1
            00000000: ⟪4449 5243⟫ 0000 0002 0000 0001 …        DIRC…   ← "DIRC" / version 2 / 1 entry` },
        ],
        run: async (s) => {
          await s.show('idx', { fx: 'up' });
          await s.line('path:b', 'idx:t', { cls: 'dash' });
          s.state('idx', 'ok');
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 3 — git commit = tree + commit + ref
   * ============================================================= */
  TIM.scene('#sc-commit', {
    intro: '<code>git commit -m "first commit"</code> で作られる 2 つのオブジェクト（tree と commit）と、書き換わる ref を追います。名前・メール・時刻を固定しているので、ID は手元の git で再現できます（「手元で試す」参照）。',
    steps: [
      {
        title: '<code>git commit</code> の正体',
        text: 'porcelain（普段使うコマンド）の <code>git commit</code> は、plumbing の <code>write-tree</code> → <code>commit-tree</code> → <code>update-ref</code> と同じことをしています。出発点は <code>.git/index</code> です。',
        code: [
          { title: 'alice@laptop:~/demo', lang: 'bash', src: `
            $ git commit -m "first commit"
            [main (root-commit) 1936b6d] first commit
             1 file changed, 1 insertion(+)
             create mode 100644 hello.txt` },
          { title: '同じことを plumbing で', lang: 'bash', src: `
            $ tree=$(git write-tree)
            $ commit=$(echo "first commit" | git commit-tree $tree)
            $ git update-ref refs/heads/main $commit` },
        ],
        run: async (s) => { await s.pulse('idx'); },
      },
      {
        title: 'index から tree を作る（<code>git write-tree</code>）',
        text: 'tree は「1 つのディレクトリの一覧」です。各エントリはモード・名前・ID で、ID は blob（ファイル）か別の tree（サブディレクトリ）を指します。<strong>ファイル名を持つのは blob ではなく tree</strong>です。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ git write-tree
          aaa96ced2d9a1c8e72c56b253a0e2fe78393feb7
          $ git cat-file -p aaa96ced
          100644 blob ce013625030ba8dba906f756967f9e9ca394464a	hello.txt` },
        run: async (s) => {
          await s.show('tr', { fx: 'up' });
          await s.line('idx:b', 'tr:t', { cls: 'acc', label: 'git write-tree' });
        },
      },
      {
        title: 'tree の生バイト列と ID',
        text: 'tree の中身はテキストではありません。<code>100644 hello.txt</code> + NUL + <strong>20 バイトの生の ID</strong>（16 進文字列ではなくバイナリ）で、合計 37 バイト。これに <code>tree 37\\0</code> を付けて SHA-1 を取ると tree の ID になります（ページ上で計算）。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ git cat-file -s aaa96ced
          37
          $ git cat-file tree aaa96ced | xxd
          00000000: 3130 3036 3434 2068 656c 6c6f 2e74 7874  100644 hello.txt
          00000010: ⟪00⟫⟪ce 0136 2503 0ba8 dba9 06f7 5696 7f9e⟫  ...6%.......V...
          00000020: ⟪9ca3 9446 4a⟫                             ...FJ
          $ { printf 'tree 37\\0'; git cat-file tree aaa96ced; } | sha1sum
          ⟪aaa96ced2d9a1c8e72c56b253a0e2fe78393feb7⟫  -` },
        run: async (s) => {
          const r = await computeAll();
          await s.scramble('trv', 'tree ' + r.tree1, { chars: HEX, dur: 1300 });
          s.state('tr', 'ok');
        },
      },
      {
        title: 'commit オブジェクトの本文',
        text: 'commit はテキストです。<code>tree</code>（ルートの tree の ID）、<code>author</code> / <code>committer</code>（名前・メール・<strong>Unix 秒</strong>・タイムゾーン）、空行、メッセージ。最初のコミットなので <code>parent</code> 行はありません。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ git cat-file -p HEAD
          ⟪tree⟫ aaa96ced2d9a1c8e72c56b253a0e2fe78393feb7
          ⟪author⟫ Alice <alice@example.com> ⟪1727500000 +0900⟫
          ⟪committer⟫ Alice <alice@example.com> 1727500000 +0900

          first commit
          $ date -u -d @1727500000 --iso-8601=seconds     # +0900 なら 14:06:40
          2024-09-28T05:06:40+00:00` },
        run: async (s) => {
          await s.show('cm', { fx: 'left' });
          await s.line('cm:l', 'tr:r', { cls: 'acc' });
        },
      },
      {
        title: 'commit の ID もヘッダ込みの SHA-1',
        text: '本文 163 バイトに <code>commit 163\\0</code> を付けて SHA-1 を取ると <code>1936b6d4…</code>（ページ上で計算）。本文に tree の ID が入っているので、<strong>ファイルが 1 バイト変われば commit の ID も変わります</strong>。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ git cat-file -s HEAD
          163
          $ { printf 'commit 163\\0'; git cat-file commit HEAD; } | sha1sum
          ⟪1936b6d40aeaa479cceac281d7ff7b60874b415d⟫  -` },
        run: async (s) => {
          const r = await computeAll();
          await s.scramble('cmv', 'commit ' + r.c1, { chars: HEX, dur: 1300 });
          s.state('cm', 'ok');
        },
      },
      {
        title: '<code>refs/heads/main</code> に ID を書く',
        text: 'ブランチ <code>main</code> の実体は、commit の ID（40 桁）と改行だけの <strong>41 バイトのテキストファイル</strong>です。unborn だった <code>main</code> がここで生まれます。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ cat .git/refs/heads/main
          1936b6d40aeaa479cceac281d7ff7b60874b415d
          $ wc -c .git/refs/heads/main
          41 .git/refs/heads/main
          $ tail -c 1 .git/refs/heads/main | xxd
          00000000: 0a                                       .` },
        run: async (s) => {
          await s.show('rm', { fx: 'up' });
          await s.line('rm:t', 'cm:b', { cls: 'acc', curve: -30 });
        },
      },
      {
        title: '<code>HEAD</code> → <code>main</code> → commit',
        text: '<code>git log</code> や <code>git rev-parse HEAD</code> は、<code>.git/HEAD</code> → <code>refs/heads/main</code> → commit と辿ります。HEAD の移動は reflog（<code>.git/logs/HEAD</code>）にも 1 行ずつ記録されます。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ git rev-parse HEAD
          1936b6d40aeaa479cceac281d7ff7b60874b415d
          $ git log --oneline
          1936b6d first commit
          $ cat .git/logs/HEAD
          0000000000000000000000000000000000000000 1936b6d40aeaa479cceac281d7ff7b60874b415d Alice <alice@example.com> 1727500000 +0900	commit (initial): first commit` },
        run: async (s) => {
          await s.show('hd', { fx: 'up' });
          await s.line('hd:r', 'rm:l', { cls: 'acc' });
        },
      },
      {
        title: '<code>objects/</code> には 3 つ',
        text: 'blob・tree・commit の 3 オブジェクトが、それぞれ ID の先頭 2 桁のディレクトリに入っています。どれも「中身のハッシュ = 名前」なので、同じ中身は 2 回保存されません。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ find .git/objects -type f | sort
          .git/objects/19/36b6d40aeaa479cceac281d7ff7b60874b415d
          .git/objects/aa/a96ced2d9a1c8e72c56b253a0e2fe78393feb7
          .git/objects/ce/013625030ba8dba906f756967f9e9ca394464a
          $ git cat-file -t 1936b6d; git cat-file -t aaa96ce; git cat-file -t ce01362
          commit
          tree
          blob` },
        run: async (s) => {
          await s.show('ob', { fx: 'left' });
          await s.scan('ob');
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 4 — DAG / branch / HEAD
   * ============================================================= */
  TIM.scene('#sc-branch', {
    intro: '2 つ目・3 つ目のコミットでグラフがどう伸びるか、ブランチと HEAD のファイルがどう書き換わるかを見ます。上段が commit、中段が tree、下段が blob、一番下が refs のファイルの中身です。',
    steps: [
      {
        title: '最初のコミット：commit → tree → blob',
        text: 'commit は tree を指し、tree は名前付きで blob を指します。矢印はすべて「ID を中身に含む」という関係です。<code>main</code> は commit <code>1936b6d</code> を、<code>HEAD</code> は <code>main</code> を指しています。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ git cat-file -p main
          tree aaa96ced2d9a1c8e72c56b253a0e2fe78393feb7
          author Alice <alice@example.com> 1727500000 +0900
          committer Alice <alice@example.com> 1727500000 +0900

          first commit
          $ git ls-tree main
          100644 blob ce013625030ba8dba906f756967f9e9ca394464a	hello.txt` },
        run: async (s) => {
          s.line('c1:b', 't1:t', { cls: 'acc' });
          await s.line('t1:b', 'b1:t', { cls: 'acc', label: 'hello.txt' });
        },
      },
      {
        title: 'README.md を追加してコミット',
        text: '新しい blob（README.md）、新しい tree（2 エントリ）、新しい commit が作られます。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ printf '# demo\\n' > README.md
          $ git add README.md
          $ git commit -m "add README"
          [main 5dd578e] add README
           1 file changed, 1 insertion(+)
           create mode 100644 README.md` },
        run: async (s) => {
          await s.show('b2', { fx: 'up' });
          await s.show('t2', { fx: 'up' });
          await s.show('c2', { fx: 'up' });
          s.line('c2:b', 't2:t', { cls: 'acc' });
          await s.line('t2:b', 'b2:t', { cls: 'acc', label: 'README.md' });
        },
      },
      {
        title: '変わっていない hello.txt は同じ blob を指す',
        text: '新しい tree の <code>hello.txt</code> のエントリは、前と同じ <code>ce013625…</code> を指します。中身が同じなら ID が同じなので、<strong>ファイルはコピーされず共有</strong>されます。オブジェクトは 3 + 3 = 6 個で、7 個にはなりません。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ git ls-tree HEAD
          100644 blob fc72a5c1094e203eefcd1c710f060957ebbbaac4	README.md
          100644 blob ⟪ce013625030ba8dba906f756967f9e9ca394464a⟫	hello.txt
          $ git count-objects -v | head -1
          count: 6` },
        run: async (s) => {
          await s.line('t2:b', 'b1:t', { cls: 'ok thick', label: 'hello.txt（同じ blob）' });
          await s.pulse('b1');
          s.state('b1', 'ok');
        },
      },
      {
        title: '<code>parent</code> で 1 つ前を指す',
        text: '2 つ目の commit には <code>parent 1936b6d4…</code> 行が入ります。コミット同士は子から親への一方向リンクでつながった DAG（有向非巡回グラフ）で、<code>git log</code> はこれを辿って表示します。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ git cat-file -p HEAD
          tree 123a018a9ee40c870f50a18c60f75d9acbb3f0eb
          ⟪parent 1936b6d40aeaa479cceac281d7ff7b60874b415d⟫
          author Alice <alice@example.com> 1727500600 +0900
          committer Alice <alice@example.com> 1727500600 +0900

          add README
          $ git rev-parse HEAD~1
          1936b6d40aeaa479cceac281d7ff7b60874b415d` },
        run: async (s) => {
          await s.line('c2:l', 'c1:r', { cls: 'acc thick', label: 'parent' });
        },
      },
      {
        title: '<code>main</code> が 1 つ進む',
        text: 'コミットの最後に、<code>refs/heads/main</code> の中身が新しい commit ID に<strong>上書き</strong>されます。ブランチを進めるとは、この 41 バイトを書き換えることです。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ cat .git/refs/heads/main
          ⟪5dd578e04fe83f3ed1ff46fa56e32fa9d824d1c7⟫
          $ tail -1 .git/logs/refs/heads/main
          1936b6d4… 5dd578e0… Alice <alice@example.com> 1727500600 +0900	commit: add README` },
        run: async (s) => {
          await Promise.all([s.move('bmain', { x: 420, y: 44 }), s.move('head', { x: 416, y: 8 })]);
          await s.set('rmainv', G.c2);
        },
      },
      {
        title: '<code>git switch -c feature</code>：ファイルが 1 つ増えるだけ',
        text: '新しいブランチは <code>refs/heads/feature</code> に<strong>今の commit ID を書いたファイル</strong>を作るだけで、オブジェクトは 1 つも増えません。<code>HEAD</code> の中身が <code>ref: refs/heads/feature</code> に変わります。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ git switch -c feature
          Switched to a new branch 'feature'
          $ cat .git/HEAD
          ref: refs/heads/⟪feature⟫
          $ ls -l .git/refs/heads/
          -rw-r--r-- 1 alice alice 41 Sep 28 10:10 feature
          -rw-r--r-- 1 alice alice 41 Sep 28 10:10 main` },
        run: async (s) => {
          await s.show('bfeat', { fx: 'pop' });
          await s.show('rfeat', { fx: 'up' });
          await s.move('head', { x: 500, y: 8 });
          await s.set('rheadv', 'ref: refs/heads/feature');
        },
      },
      {
        title: 'feature でコミット：README.md の blob を再利用',
        text: '<code>hello.txt</code> を変えてコミットすると、新しい blob・tree・commit ができます。変えていない <code>README.md</code> は前の blob を共有。<code>feature</code> だけが進み、<code>main</code> は <code>5dd578e</code> のままです。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ printf 'hello, git\\n' > hello.txt
          $ git commit -am "update greeting"
          [feature 6c6efca] update greeting
           1 file changed, 1 insertion(+), 1 deletion(-)
          $ git log --oneline --graph --all
          * 6c6efca (HEAD -> feature) update greeting
          * 5dd578e (main) add README
          * 1936b6d first commit` },
        run: async (s) => {
          await s.show('b3', { fx: 'up' });
          await s.show('t3', { fx: 'up' });
          await s.show('c3', { fx: 'up' });
          s.line('c3:b', 't3:t', { cls: 'acc' });
          s.line('t3:b', 'b3:t', { cls: 'acc', label: 'hello.txt' });
          s.line('t3:b', 'b2:t', { cls: 'ok thick', label: 'README.md（同じ blob）' });
          await s.line('c3:l', 'c2:r', { cls: 'acc thick', label: 'parent' });
          await Promise.all([s.move('bfeat', { x: 780, y: 44 }), s.move('head', { x: 786, y: 8 })]);
          await s.set('rfeatv', G.c3);
        },
      },
      {
        title: '<code>git switch main</code>：HEAD の中身が変わる',
        text: 'ブランチの切り替えは、作業ツリーと index を <code>main</code> の tree（<code>123a018</code>）に合わせてから、<code>.git/HEAD</code> を書き換える操作です。<code>hello.txt</code> の中身は <code>hello</code> に戻ります。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ git switch main
          Switched to branch 'main'
          $ cat .git/HEAD
          ref: refs/heads/main
          $ cat hello.txt
          hello` },
        run: async (s) => {
          await s.move('head', { x: 416, y: 8 });
          await s.set('rheadv', 'ref: refs/heads/main');
        },
      },
      {
        title: 'detached HEAD：HEAD に ID を直接書く',
        text: 'ブランチではなく commit を直接指定すると、<code>.git/HEAD</code> には <code>ref:</code> ではなく<strong>commit ID そのもの</strong>が書かれます。この状態でコミットすると、どのブランチからも辿れない commit になるので、残すなら <code>git switch -c 名前</code> でブランチを作ります。',
        code: { title: 'alice@laptop:~/demo（git 2.55 の実際の出力）', lang: 'bash', src: `
          $ git switch --detach 1936b6d
          HEAD is now at 1936b6d first commit
          $ cat .git/HEAD
          ⟪1936b6d40aeaa479cceac281d7ff7b60874b415d⟫
          $ git status | head -1
          HEAD detached at 1936b6d` },
        run: async (s) => {
          await s.move('head', { x: 104, y: 44 });
          s.state('head', 'warn');
          s.cls('head', 'c-amber');
          await s.set('rheadv', G.c1);
          s.state('rhead', 'warn');
        },
      },
    ],
  });

  /* ===============================================================
   * SCENE 5 — tamper detection
   * ============================================================= */
  const setBad = (s, name) => s.state(name, 'bad');
  TIM.scene('#sc-tamper', {
    intro: '左は git が実際に作った履歴。右は、過去の blob の中身を 1 バイトだけ（<code>o</code> → <code>O</code>）書き換えたときに、同じ規則で計算し直した ID です（右の値はすべてこのページ上で SHA-1 を計算しています）。最後に、オブジェクトファイルを直接すり替えた場合に git がどこで気付くかを見ます。',
    steps: [
      {
        title: '元の履歴：ID が ID を含む鎖',
        text: 'commit「add README」は <code>parent</code> で commit「first commit」の ID を、それは <code>tree</code> で tree の ID を、tree は blob の ID を中身に含んでいます。<code>main</code> が指しているのは一番上の <code>5dd578e0…</code> です。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ git cat-file -p main | head -2
          tree 123a018a9ee40c870f50a18c60f75d9acbb3f0eb
          parent ⟪1936b6d40aeaa479cceac281d7ff7b60874b415d⟫
          $ git cat-file -p 1936b6d | head -1
          tree ⟪aaa96ced2d9a1c8e72c56b253a0e2fe78393feb7⟫
          $ git ls-tree aaa96ced
          100644 blob ⟪ce013625030ba8dba906f756967f9e9ca394464a⟫	hello.txt` },
        run: async (s) => {
          s.line('ot:t', 'ob:b', { cls: 'acc' });
          s.line('oc1:t', 'ot:b', { cls: 'acc' });
          await s.line('oc2:t', 'oc1:b', { cls: 'acc' });
          s.state('om', 'ok');
        },
      },
      {
        title: '攻撃：過去の blob を 1 バイト書き換える',
        text: '<code>hello\\n</code> の 5 バイト目 <code>o</code>（0x6f）を <code>O</code>（0x4f）に変えます。ヘッダ <code>blob 6\\0</code> は同じ（長さは変わらない）なので、違うのは 13 バイト中の 1 バイトだけです。',
        code: { title: 'バイト列の差', lang: 'diff', src: `
          - 626c 6f62 2036 0068 656c 6c⟪6f⟫ 0a   blob 6.hello.
          + 626c 6f62 2036 0068 656c 6c⟪4f⟫ 0a   blob 6.hellO.` },
        run: async (s) => {
          await s.show('rl', { fx: 'fade' });
          await s.show('tb', { fx: 'left' });
        },
      },
      {
        title: 'blob の ID がまったく別の値になる',
        text: 'SHA-1 は 1 ビットの違いでも出力の約半分のビットが変わるように設計されています。<code>ce013625…</code> とは似ても似つかない <code>4b32b59c…</code> になります（ページ上で計算）。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ printf 'hellO\\n' | git hash-object --stdin
          ⟪4b32b59cf6f008703c95a6d2284f027e6ef86b54⟫
          $ printf 'hello\\n' | git hash-object --stdin
          ce013625030ba8dba906f756967f9e9ca394464a` },
        run: async (s) => {
          const r = await computeAll();
          await s.scramble('tbv', r.tblob, { chars: HEX, dur: 1200 });
          setBad(s, 'tb');
        },
      },
      {
        title: 'tree の ID も変わる',
        text: 'tree は blob の ID（20 バイト）を中身に含むので、tree のバイト列が変わり、tree の ID も変わります。<code>hello.txt</code> という名前もモードも同じなのに、です。',
        code: { title: 'alice@laptop:~/demo', lang: 'bash', src: `
          $ printf '100644 blob 4b32b59cf6f008703c95a6d2284f027e6ef86b54\\thello.txt\\n' | git mktree --missing
          ⟪72c7b16fbf7a3252478cff3272b43156ce39d073⟫           # 元は aaa96ced…` },
        run: async (s) => {
          await s.show('tt', { fx: 'left' });
          await s.line('tt:t', 'tb:b', { cls: 'bad', id: 'l1' });
          const r = await computeAll();
          await s.scramble('ttv', r.ttree1, { chars: HEX, dur: 1100 });
          setBad(s, 'tt');
        },
      },
      {
        title: 'commit の ID も変わる',
        text: '作者・時刻・メッセージをまったく同じにしても、<code>tree</code> 行が違うので commit の ID は <code>21be53fe…</code> になります。元の <code>1936b6d4…</code> を持っている人とは一致しません。',
        code: { title: '同じ作者・時刻で commit を作り直す', lang: 'bash', src: `
          $ export GIT_AUTHOR_NAME=Alice GIT_AUTHOR_EMAIL=alice@example.com GIT_AUTHOR_DATE="1727500000 +0900"
          $ export GIT_COMMITTER_NAME=Alice GIT_COMMITTER_EMAIL=alice@example.com GIT_COMMITTER_DATE="1727500000 +0900"
          $ echo "first commit" | git commit-tree 72c7b16f
          ⟪21be53fef7cf213d7e72b688a8853e9fa52214e3⟫           # 元は 1936b6d4…` },
        run: async (s) => {
          await s.show('tc1', { fx: 'left' });
          await s.line('tc1:t', 'tt:b', { cls: 'bad', id: 'l2' });
          const r = await computeAll();
          await s.scramble('tc1v', r.tc1, { chars: HEX, dur: 1100 });
          setBad(s, 'tc1');
        },
      },
      {
        title: '子孫の commit も変わり、main と一致しない',
        text: '後続の commit は <code>parent</code> 行で親の ID を含むので、<strong>書き換えた地点から先の履歴はすべて ID が変わります</strong>。<code>main</code>、他の人の clone、署名付きタグが指している <code>5dd578e0…</code> とは一致せず、改ざんは隠せません。',
        code: { title: '元の ID と改ざん後の ID', lang: 'text', src: `
                         元（git が作った値）                          1 バイト改ざん後
          blob           ce013625030ba8dba906f756967f9e9ca394464a   ⟪4b32b59cf6f008703c95a6d2284f027e6ef86b54⟫
          tree           aaa96ced2d9a1c8e72c56b253a0e2fe78393feb7   ⟪72c7b16fbf7a3252478cff3272b43156ce39d073⟫
          first commit   1936b6d40aeaa479cceac281d7ff7b60874b415d   ⟪21be53fef7cf213d7e72b688a8853e9fa52214e3⟫
          tree (2)       123a018a9ee40c870f50a18c60f75d9acbb3f0eb   ⟪a60b20d0cc28bf8957e96e421b86b392291471af⟫
          add README     5dd578e04fe83f3ed1ff46fa56e32fa9d824d1c7   ⟪20b0b5f29d75c09eec0582427bde1264a0b1401a⟫` },
        run: async (s) => {
          await s.show('tc2', { fx: 'left' });
          await s.line('tc2:t', 'tc1:b', { cls: 'bad', id: 'l3' });
          const r = await computeAll();
          await s.scramble('tc2v', r.tc2, { chars: HEX, dur: 1100 });
          setBad(s, 'tc2');
          await s.show('tm', { fx: 'pop' });
          await s.stamp('tc2', 'MISMATCH', { cls: 'st-bad', pos: 'tl' });
        },
      },
      {
        title: 'オブジェクトファイルをすり替えたら：<code>git fsck</code>',
        text: '今度は ID を変えずに、<code>.git/objects/ce/013625…</code> のファイルの中身だけを <code>hellO</code> の圧縮データにすり替えます。<code>git cat-file</code> や <code>checkout</code> はそのまま読んでしまいますが、<code>git fsck</code> は中身を再ハッシュして<strong>「パス（ID）と中身のハッシュが一致しない」</strong>と報告します。',
        code: { title: 'alice@laptop:~/demo（git 2.55 の実際の出力）', lang: 'bash', src: `
          $ chmod u+w .git/objects/ce/013625030ba8dba906f756967f9e9ca394464a
          $ cp .git/objects/4b/32b59cf6f008703c95a6d2284f027e6ef86b54 \\
               .git/objects/ce/013625030ba8dba906f756967f9e9ca394464a
          $ git cat-file -p ce013625
          hellO
          $ git fsck
          error: 4b32b59cf6f008703c95a6d2284f027e6ef86b54: ⟪hash-path mismatch⟫, found at: .git/objects/ce/013625030ba8dba906f756967f9e9ca394464a
          missing blob ce013625030ba8dba906f756967f9e9ca394464a
          $ echo $?
          3` },
        run: async (s) => {
          await s.hide('tb tt tc1 tc2 tm l1 l2 l3 rl', { dur: 250 });
          await s.show('tf', { fx: 'fade' });
          await s.term('tf', `
            $ git cat-file -p ce013625
            hellO
            $ git fsck
            error: 4b32b59cf6f008703c95a6d2284f027e6ef86b54: ⟪hash-path mismatch⟫, found at: .git/objects/ce/013625030ba8dba906f756967f9e9ca394464a
            ⟪missing blob ce013625030ba8dba906f756967f9e9ca394464a⟫`);
          s.state('ob', 'bad');
          await s.shake('ob');
        },
      },
      {
        title: 'clone / fetch / push では受け取った側が検出',
        text: '転送では送信側が pack を作り、受信側の <code>git index-pack</code> が<strong>受け取った全オブジェクトの ID を自分で計算し直します</strong>。すり替えた中身は <code>4b32b59c…</code> として届くので、tree が要求する <code>ce013625…</code> が見つからず clone が失敗します。',
        code: { title: 'alice@laptop:~（git 2.55 の実際の出力）', lang: 'bash', src: `
          $ git clone --no-local demo copy
          Cloning into 'copy'...
          fatal: did not receive expected object ⟪ce013625030ba8dba906f756967f9e9ca394464a⟫
          fatal: fetch-pack: invalid index-pack output` },
        run: async (s) => {
          await s.term('tf', `
            $ cd .. && git clone --no-local demo copy
            fatal: did not receive expected object ⟪ce013625030ba8dba906f756967f9e9ca394464a⟫
            fatal: fetch-pack: invalid index-pack output`);
          s.state('tf', 'bad');
          await s.stamp('tf', 'REJECTED', { cls: 'st-bad', pos: 'tl' });
        },
      },
    ],
  });

  /* ===============================================================
   * LAB — git hash-object
   * ============================================================= */
  const gin = document.getElementById('gh-in');
  const gnl = document.getElementById('gh-nl');
  const gout = document.getElementById('gh-out');
  const ggo = document.getElementById('gh-go');
  function printfArg(str) {
    return str.replace(/\\/g, '\\\\').replace(/%/g, '%%').replace(/'/g, "'\\''").replace(/\n/g, '\\n').replace(/\t/g, '\\t');
  }
  async function runLab() {
    const text = gin.value.replace(/\r\n?/g, '\n') + (gnl.checked ? '\n' : '');
    const body = te.encode(text);
    const header = 'blob ' + body.length;
    const bytes = obj('blob', body);
    const id1 = await sha1(bytes);
    const id256 = await digest('SHA-256', bytes);
    const preview = Array.from(bytes.slice(0, 24)).map((b) => b.toString(16).padStart(2, '0')).join(' ') + (bytes.length > 24 ? ' …' : '');
    const lines = [
      '中身        ' + body.length + ' バイト（UTF-8）',
      'ヘッダ      "' + header + '\\0"（' + (header.length + 1) + ' バイト）',
      'ハッシュ対象 ' + preview,
      '',
      'SHA-1      ⟪' + id1 + '⟫',
      '保存先      .git/objects/⟪' + id1.slice(0, 2) + '⟫/' + id1.slice(2),
      'SHA-256    ' + id256 + '   (--object-format=sha256)',
      '',
      "再現        printf '" + printfArg(text) + "' | git hash-object --stdin",
    ];
    gout.innerHTML = '<code>' + TIM.codeLines(lines.join('\n'), 'text') + '</code>';
  }
  if (gin && gout && ggo) {
    ggo.addEventListener('click', runLab);
    gnl.addEventListener('change', runLab);
    if (window.crypto && crypto.subtle) runLab();
  }
})();
