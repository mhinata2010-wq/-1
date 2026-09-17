# Φ Camera — 黄金比カメラ

iPhone の Safari で使える静的 Web カメラです。黄金比グリッドと黄金螺旋をライブ映像に重ね、ガイド入りの JPEG を撮影・保存できます。前後カメラの切替にも対応します。画像は端末内だけで処理します。

## 使い方

1. HTTPS で公開した URL を iPhone の Safari で開きます。
2. 「カメラを起動」を押し、カメラへのアクセスを許可します。
3. ガイドを選び、シャッターを押します。
4. プレビューの「写真を保存」を押します。iPhone では共有画面から「画像を保存」を選べます。

## GitHub Pages で公開

このフォルダのファイルを GitHub リポジトリのルートに置き、リポジトリの **Settings → Pages → Build and deployment** で **Deploy from a branch / main / /(root)** を選びます。公開 URL は `https://<ユーザー名>.github.io/<リポジトリ名>/` です。GitHub Pages の HTTPS がカメラ使用に必要です。

## ローカル確認

`python3 -m http.server 8000` をこのフォルダで実行し、`http://localhost:8000` を開きます。iPhone での確認には HTTPS で公開してください。

外部ライブラリ、ビルド手順、サーバーは不要です。
