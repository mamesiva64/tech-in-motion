# TECH IN MOTION

**見えないプロトコルを、動かして見る。** — わかりにくい IT 技術を、モーショングラフィックスで「実物のまま」可視化するサイトです。

🌐 **https://mamesiva64.github.io/tech-in-motion/**

概念図だけで終わらせず、実際の **コマンド・フラグ・ファイルパス・ヘッダ名・フィールド名・バイト列** をアニメーションの中で見せます。
「どこで署名されて、どこで検証されるのか」「そのとき実際にどのファイルが読まれ、どんなメッセージが流れるのか」をステップ再生で追えます。

## トピック

| カテゴリ | トピック |
|---|---|
| コンテナ | Docker / Docker Compose |
| Web・HTTP | HTTP / Web API (REST) / CORS |
| 暗号・PKI | HTTPS・TLS 1.3 / X.509 証明書 (X.501 DN) / CA と証明書チェーン |
| 認証・認可 | JWT / OAuth 2.0・OIDC |
| メール | DKIM (+SPF/DMARC) |
| ネットワーク | DNS / SSH |
| 開発基盤 | Git の中身 |

## 仕組み

- ビルド不要の素の HTML / CSS / JavaScript（依存ライブラリなし）
- 自作の軽量モーションエンジン（`assets/js/tim.js`）で、各シーンをステップ単位に再生・巻き戻し・ジャンプ
- GitHub Pages で `main` ブランチのルートを配信

## ローカルで見る

```bash
# Windows (PowerShell)
powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1 -Port 8123
# → http://localhost:8123/

# macOS / Linux
python3 -m http.server 8123
```

## コントリビュート

新しいトピックの追加方法・執筆ルール・エンジン API は [AGENT.md](AGENT.md) を参照してください。
