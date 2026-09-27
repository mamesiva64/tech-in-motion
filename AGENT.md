# AGENT.md — Tech in Motion 開発ガイド

このリポジトリで作業するエージェント（人間を含む）は、作業前に必ずこのファイルを読むこと。

---

## 1. プロジェクトの目的

**Tech in Motion** は「わかりにくい IT 技術を、モーショングラフィックスで“実物のまま”見せる」静的サイト。

- 対象読者：現場のエンジニア（新人〜中堅）。概念はなんとなく知っているが、**実際に何がどこにあって、どのコマンドで何が起きるか**を説明できない人。
- 公開先：GitHub Pages（`https://mamesiva64.github.io/tech-in-motion/`）
- リポジトリ：`https://github.com/mamesiva64/tech-in-motion`（public）

## 2. 最重要原則：実物主義（ふわっとした概念図の禁止）

1. **必ず実物を出す**。すべてのトピックで以下を具体的に見せる。
   - 実際のコマンドとフラグ（例：`openssl x509 -in server.crt -noout -text`）
   - 実際のファイル名・パス（例：`/var/lib/docker/overlay2/<id>/diff`、`~/.ssh/known_hosts`）
   - 実際のフィールド名・ヘッダ名・パラメータ名（例：`DKIM-Signature: v=1; a=rsa-sha256; bh=...`）
   - 実際のデータ形式（JSON / YAML / PEM / DER / HTTP メッセージ / DNS レコード）
2. **「どこで・何を・どうやって」をセットで描く**。
   - どこで：どのホスト／プロセス／ファイル（例：「署名は *送信側 MTA（Postfix + OpenDKIM）* で、`/etc/opendkim/keys/example.com/sel1.private` を使って」）
   - 何を：どのバイト列／フィールドを（例：「`h=` に列挙したヘッダと本文ハッシュ `bh=` を」）
   - どうやって：どのアルゴリズム／コマンド／API で
3. **禁止表現**：鍵と鍵穴の比喩だけ、雲アイコンと矢印だけの図、「安全に通信します」で終わる説明、根拠のない数値。
4. **例示値はフォーマットとして正しいこと**。base64url は本当に base64url、SHA-256 は 64 桁 hex、ポート番号・ステータスコード・フラグは実在のもの。可能ならページ上で WebCrypto 等を使って**本当に計算**する。
5. **仕様の根拠を載せる**。RFC 番号・節、公式ドキュメント URL を各ページ末尾の「仕様・参考」に列挙。
6. **不確かなことは書かない**。バージョン依存は明記（例：Compose v2 は `docker compose`、v1 の `docker-compose` は非推奨／OpenSSL 3.x 前提）。
7. **改ざん・失敗ケースも見せる**。署名・検証系は「正しく検証が通る流れ」と「改ざんされて検証に失敗する流れ」を両方アニメーションにする。

## 3. 技術スタックと制約

- 素の HTML / CSS / JavaScript。**ビルドなし・npm 依存なし**。
- 外部読み込みは Google Fonts のみ（JetBrains Mono / Space Grotesk）。CDN ライブラリは使わない。
- スクリプトは **classic script（`<script src>`）**。ES modules・`fetch()` によるローカルファイル読み込みは使わない（`file://` で開いても動くようにするため）。
- ブラウザ API：Web Animations API（`element.animate`）、IntersectionObserver、ResizeObserver、WebCrypto（`crypto.subtle`）。
- 対象ブラウザ：最新の Chrome / Edge / Firefox / Safari。
- ルートに `.nojekyll` を置き、GitHub Pages は `main` ブランチの `/`（root）から配信。

## 4. ディレクトリ構成

```
/
├── index.html              # トップ＝サイトマップ（モーショングラフィックス）
├── AGENT.md                # このファイル
├── CLAUDE.md               # AGENT.md を読み込むだけ
├── README.md
├── .nojekyll
├── assets/
│   ├── css/
│   │   ├── tim.css         # 共通デザインシステム＋ステージ部品
│   │   └── home.css        # トップページ専用
│   └── js/
│       ├── topics.js       # トピック登録簿（カテゴリ・タイトル・関連・サンプルコマンド）
│       ├── tim.js          # モーションエンジン＋共通ヘッダ/フッタ/TOC/コードハイライト
│       └── home.js         # トップページ専用アニメーション
├── tools/
│   └── serve.ps1           # ローカル確認用の静的サーバー（PowerShell）
├── .claude/launch.json     # Claude Code のプレビュー設定（serve.ps1 を起動）
└── topics/
    ├── _template/          # 新規トピックの雛形（コピーして使う）
    │   ├── index.html
    │   └── scenes.js
    └── <topic-id>/
        ├── index.html      # 本文（静的なリファレンス表・コード・解説）
        ├── scenes.js       # そのページのシーン定義（TIM.scene 呼び出し）
        └── page.css        # （任意）ページ固有 CSS
```

## 5. トピック追加手順（チェックリスト）

1. `assets/js/topics.js` の `TIM_TOPICS` にエントリを追加（`id`, `cat`, `title`, `sub`, `cmds`, `tags`, `related`, `status`）。
2. `topics/_template/` を `topics/<id>/` にコピー。
3. `index.html` の `<body data-topic="<id>">` と `<title>` を設定。
4. 本文とシーンを書く（§6 の必須構成を満たすこと）。
5. ブラウザで開いて確認（§10）。
6. `status: 'ready'` にする（`'soon'` のままだとトップページでリンクされない）。
7. コミット → push（§11）。

## 6. トピックページの必須構成

各ページは次の順で構成する。見出し `h2` はそれぞれ `<section class="chapter" id="...">` の中に置く（TOC は自動生成）。

| # | セクション | 内容 |
|---|---|---|
| 0 | ヒーロー `.hero` | カテゴリ、タイトル、1〜2 文のリード、`.facts`（「署名する場所」「検証する場所」「主要ファイル」「仕様」など 3〜4 個の要点） |
| 1 | 全体像シーン | 登場人物（ホスト・プロセス・ファイル）を並べ、データがどこからどこへ流れるかを 1 本のシーンで |
| 2 | 実物の中身 | ファイル／メッセージ／データ構造をフィールド単位で分解（シーン＋表） |
| 3 | 処理の流れ（複数シーン可） | 生成・署名・送信・検証など各フェーズを、実際のコマンド・HTTP・ログ付きでステップ再生 |
| 4 | 失敗・改ざんケース | 改ざん・期限切れ・設定ミス時に**どこで**何のエラーになるか（実際のエラーメッセージ） |
| 5 | コマンド早見表 | `table.ref`：コマンド／主要フラグ／何が起きるか |
| 6 | 手元で試す | コピペで再現できる手順（`pre[data-lang="bash"]`） |
| 7 | ハマりどころ | `.note.warn` などで箇条書き |
| 8 | 仕様・参考 | RFC・公式ドキュメントへのリンク |

- シーンは **1 ページあたり最低 3 本**、1 シーン 5〜12 ステップ目安。
- 各ステップには、そのステップで実際に流れる **コード／コマンド／メッセージ** を `code` に必ず付ける。
- 文体は「です・ます」。技術用語は原語表記（`Authorization` ヘッダ、`kid`、`overlay2` など）。

## 7. モーションエンジン API（`assets/js/tim.js`）

### 7.1 シーンの HTML

```html
<div class="scene" id="sc-flow" data-title="トークン発行の流れ">
  <div class="stage" data-w="960" data-h="460">
    <!-- 直下の要素はすべて position:absolute。left/top/width を px（設計座標）で指定 -->
    <div class="node" data-el="client" style="left:40px;top:180px;width:170px">
      <div class="node-h"><i data-icon="browser"></i><b class="node-t">Browser</b></div>
      <div class="node-s">app.example.com</div>
    </div>
    <div class="file hide" data-el="jwk" style="left:600px;top:40px;width:300px">
      <div class="file-h">jwks.json</div>
      <pre data-lang="json">{ "keys": [ ... ] }</pre>
    </div>
  </div>
</div>
```

- ステージは設計座標 `data-w × data-h`（既定 960×460）で作り、画面幅に合わせて自動スケールする。
- **位置決めに CSS `transform` を使わない**（アニメーションは個別プロパティ `translate`/`scale` を使うので、`transform` と競合しないが、`left/top` で配置するのが原則）。
- 最初は隠しておく要素には `class="hide"`。`display:none` は使わない（座標計算ができなくなる）。
- 要素は `data-el="名前"` で参照する。ステップ関数では `'client'` のように名前で指定できる。

### 7.2 シーンの JS（`scenes.js`）

```js
TIM.scene('#sc-flow', {
  title: 'トークン発行の流れ',            // 省略時は data-title
  intro: 'このシーンの概要（再生前に表示）',
  steps: [
    {
      title: 'ログイン要求を送る',
      text: 'ブラウザが <code>POST /oauth/token</code> を送ります。',
      code: { title: 'HTTP request', lang: 'http', src: `
        POST /oauth/token HTTP/1.1
        Host: auth.example.com
        Content-Type: application/x-www-form-urlencoded

        grant_type=password&username=alice&password=********` },
      run: async (s) => {
        await s.show('client');
        await s.fly('client:r', 'auth:l', { label: 'POST /oauth/token' });
        s.state('auth', 'active');
      },
      // hold: 5000,  // 自動再生時の滞在 ms（省略時は文字量から自動計算）
    },
  ],
});
```

**再生モデル**：ステップ N へ移動するときは、ステージを初期 HTML に戻し、ステップ 0..N-1 を「瞬時モード」で早送りしてから、N だけをアニメーション再生する。
→ **`run` はステージ状態のみに依存して冪等に書くこと**（外部変数に状態を持たない）。前後移動・ドットジャンプが自動で正しく動く。

### 7.3 ステップ関数 `run(s)` で使えるヘルパー

すべて Promise を返す（`spawn` / `el` / `$` を除く）。`await` すると完了を待つ。並行させたいときは `await` しない、または `Promise.all`。

| ヘルパー | 説明 |
|---|---|
| `s.$(sel)` / `s.el(sel)` | 要素取得。`'a b'` のような英数字語の並びは `data-el` 名、それ以外は CSS セレクタ。`'css:hdr span'` のように `css:` を付けると常に CSS セレクタとして扱う |
| `s.show(sel, {fx, dur, delay, stagger})` | `.hide` を外して登場。`fx`: `up`(既定) `down` `left` `right` `zoom` `pop` `fade` `blur` `draw`(SVG path) |
| `s.hide(sel, {dur})` | 退場して `.hide` を付与 |
| `s.swap(outSel, inSel)` | 入れ替え |
| `s.set(sel, html)` / `s.text(sel, str)` | 中身を差し替え（フラッシュ演出付き） |
| `s.append(sel, html)` | 子要素を追加（ログ行の追加など） |
| `s.type(sel, str, {cps, dur, append})` | タイプライター表示 |
| `s.scramble(sel, final, {dur, chars})` | ランダム文字が確定値に収束（ハッシュ・署名・暗号文の演出） |
| `s.count(sel, from, to, {dur, fmt})` | 数値カウント |
| `s.term(sel, text, {clear, raw, cls})` | `.term` にターミナル出力。`$ ` で始まる行はタイプ入力、それ以外は出力行。`raw` で dedent しない、`cls` で出力行にクラス（例 `c-red`） |
| `s.fly(from, to, {label, cls, arc, dur, keep, id})` | パケット（ラベル付きチップ）を飛ばす。`keep:true` で到着後も残す |
| `s.line(from, to, {cls, label, curve, elbow, arrow, both, id, dur})` | 接続線を描画（残る）。`cls`: `acc` `dash` `flow` `ok` `bad` `warn` |
| `s.move(sel, {x, y, dx, dy, to})` | 要素を移動（`to` は目標要素の中心へ） |
| `s.state(sel, st)` | `data-state` を設定：`ok` `bad` `warn` `active` `dim`（`null` で解除） |
| `s.cls(sel, add, remove)` | クラス付け外し |
| `s.pulse(sel)` / `s.shake(sel)` / `s.scan(sel)` | 注目リング／振動（エラー）／スキャン線（検証中） |
| `s.stamp(sel, text, {cls})` / `s.unstamp(sel)` | 判子（`st-ok` `st-bad` `st-warn` `st-acc`）。署名・検証結果の演出 / 判子を外す |
| `s.caption(html, {cls, x, y})` | ステージ下部の字幕（強調メッセージ）。`''` で消す。`x`（中心）/`y`（上端）で位置指定可 |
| `s.camera({scale, x, y, to, dur})` | カメラズーム／パン。引数なしで戻す |
| `s.spawn(html, {x, y, into, fx})` | 要素を動的生成して返す（同期） |
| `s.hl(lines, blockIndex)` | 下部コードパネルの行をハイライト（1 始まり） |
| `s.code(sel, src, lang)` | ステージ内の `pre` をハイライト付きコードで差し替え |
| `s.lines(sel, [3,4], cls, {only, remove})` | ステージ内 `pre` の特定行（1 始まり）にクラスを付ける。`cls`: `hl` `ok` `bad` `warn` `dim`。`only:true` で他の行から外す |
| `s.wait(ms)` | 待機 |

- 座標指定 `from/to` は `'name'`（中心）、`'name:r'`（右端中央。`c t b l r tl tr bl br`）、または `{x, y}`。
- `fly` / `line` の `label` は **HTML として**挿入される（アイコン等を入れられる）。`<` を含む生テキストは `{ text: '...' }` を使う（自動エスケープ）。
- `s.stamp(sel, text, { layer: 'fx' })` で判子を最上位レイヤーに置く（親の `overflow:hidden` で切れない）。`.file` は判子がはみ出せる。
- `.zone` のラベルは大文字表示。URL など大小文字が意味を持つラベルは `class="zone raw"`。
- 確認用：`await TIM.inspect(sceneIndex, stepIndex, { x, y, scale })` で指定ステップの最終状態を画面全体に拡大表示（クリックで閉じる）。`TIM.instant = true` にすると以降のステップ再生がすべて瞬時モードになる（非表示タブで WAAPI が進まない環境での検証用）。
- 色バリエーションは親や要素に `c-cyan c-lime c-violet c-pink c-amber c-blue c-orange c-green c-red` を付ける（`--accent` が切り替わる）。

### 7.4 下部パネルのコード `code`

- `code` はオブジェクトまたは配列：`{ title, lang, src, hl: [行番号] }`。文字列だけなら bash 扱い。
- `lang`: `bash` `http` `json` `yaml` `dockerfile` `dns` `ini` `pem` `cert`(openssl -text 出力) `mail` `js` `py` `go` `tree` `diff` `text`
- ソース中の `⟪ ⟫` で囲んだ部分は `<mark>` で強調される（**改行をまたがないこと**）。
- インデントは自動で dedent される。

## 8. ステージ部品（CSS クラス）

| クラス | 用途 |
|---|---|
| `.node` | ホスト／プロセス。中に `.node-h`（`<i data-icon>` + `.node-t`）、`.node-s`（サブテキスト mono） |
| `.zone[data-label]` | 領域（ホスト境界、ネットワーク、名前空間）。破線枠＋左上ラベル |
| `.file` | ファイルカード。`.file-h`（ファイル名）＋ `pre[data-lang]` |
| `.term` | ターミナル。`.term-h`（タイトル）＋ `.term-b`（本体） |
| `.chip` | 小さなラベル |
| `.kv` | `<dl class="kv"><dt>alg</dt><dd>RS256</dd></dl>` |
| `.seg` | 連結された区間（JWT の 3 パート、パケットのヘッダ/ペイロードなど）。子 `span` に `c-*` で色 |
| `.label` / `.big` | 自由テキスト（`.big` は大きな見出し） |
| `.bytes` | 16 進ダンプ風の等幅ブロック |

アイコン：`<i data-icon="名前"></i>`。名前：`laptop server browser db key lock unlock cert file folder box layers mail globe shield shieldok user users cloud gear terminal check x network git link attacker clock hash sign code eye warn arrow search router phone`

## 9. 静的コンテンツ部品（本文）

- コード：`<pre data-lang="bash" data-title="手元で試す">...</pre>`（ヘッダとコピー釦が自動付与。`<` は `&lt;` でエスケープ）
- 表：`<div class="tbl"><table class="ref">...</table></div>`
- 注記：`<div class="note">`、`<div class="note warn">`、`<div class="note tip">`、`<div class="note bad">`
- 要点カード：`<div class="facts"><div class="fact"><span>ラベル</span><b>値</b></div>...</div>`
- ファイルツリー：`<pre data-lang="tree">` （`# コメント` 可、`dir/` は強調）
- 2 カラム：`<div class="cols">...</div>`
- スクロール登場：任意の要素に `class="reveal"`

## 10. 品質チェック（push 前に必ず）

1. ブラウザでページを開き、**コンソールエラー 0**。さらにコンソールで `await TIM.audit()` を実行し、`OK` になること（全シーン全ステップを瞬時再生して、ステージ外へのはみ出し・要素内テキストのあふれ・要素同士や線ラベルとの重なり・ステップ例外を列挙する）。意図的に重ねる要素には `data-overlap-ok` を付ける。`zone` は入れ物なので重なり判定の対象外。
2. すべてのシーンを最後のステップまで再生し、要素がはみ出したり重なったりしないこと。前へ／次へ／ドットジャンプでも崩れないこと。
3. 幅 375px でもレイアウトが崩れないこと（ステージは縮小表示・全画面ボタンあり）。
4. コマンド・フラグ・ヘッダ名・ファイルパスが実在すること（記憶に頼らず、不確かなら書かない）。
5. トップページのカードから遷移でき、ヘッダの TOPICS メニューから他ページへ移動できること。
6. 相対パス：トピックページは `data-root="../../"`、アセットは `../../assets/...`。

内蔵ブラウザで確認するときは、自分専用のタブを 1 つだけ開き、**確認が終わったら `tabs_close` で閉じる**（タブ数には上限があり、並行作業者が使えなくなる）。

ローカル確認は同梱の簡易サーバーを使う（Python/Node 不要）：

```
powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1 -Port 8123
# → http://localhost:8123/ と http://localhost:8123/topics/<id>/
```

Claude Code デスクトップでは `.claude/launch.json` の `site` 構成で `preview_start` できる。`file://` で直接開いても基本的に動くが、環境によっては静的スナップショット扱いになるため、確認はサーバー経由で行う。

## 11. Git / デプロイ運用

- ブランチ：`main` に直接コミットしてよい（Pages が `main` の root を配信）。大きな変更は機能ごとにコミットを分ける。
- コミットメッセージ：英語の命令形 1 行 + 必要なら本文。例：`Add DKIM topic with signing/verification scenes`
- `gh` で認証済み（アカウント `mamesiva64`）。Pages 設定：`gh api repos/mamesiva64/tech-in-motion/pages`。
- 秘密鍵・トークンなどの実物はコミットしない。ページ内の鍵はデモ用にページ上で生成するか、明示的に「デモ用」と書いた値のみ。

## 12. デザインガイド

- ダーク基調・グリッド背景・ネオンアクセント。カテゴリ色が `--accent` になる。
  - container `#22d3ee`／web `#a3e635`／pki `#a78bfa`／auth `#f472b6`／mail `#fbbf24`／net `#60a5fa`／dev `#fb923c`
- 状態色：成功 `--green`、失敗 `--red`、警告 `--amber`。
- 動きの原則：意味のある動きだけ。データの移動＝`fly`、処理中＝`scan`/`scramble`、結果＝`stamp`/`state`。装飾だけのアニメは控えめに。
- `prefers-reduced-motion` のときは自動再生しない（エンジンが対応済み）。

## 13. トピック一覧（ロードマップ）

`assets/js/topics.js` が正。新しいトピック候補を思いついたら `status: 'soon'` で登録してよい。

候補（未着手）：TCP/IP ハンドシェイク、Kubernetes Pod/Service、OAuth PKCE 詳細、SAML、WebSocket、HTTP/2・HTTP/3、SPF/DMARC 単独ページ、Cookie と SameSite、CSP、TOTP(2FA)、Linux パーミッション、systemd、Nginx リバースプロキシ、ロードバランサ、CDN キャッシュ、正規表現エンジン など。
