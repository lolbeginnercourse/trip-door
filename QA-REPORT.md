# 推し宿 QAレポート

確認日: 2026-09-12

## 今回の構造改善

- 唯一のデータ原本を `data/hotels.json` に変更
- `index.html` をDB代わりに直接編集する運用を廃止
- 特定の宿泊プランを販売商品として扱わず、「客室・推し活対応情報」を管理単位に変更
- 人数を `minGuests / maxGuests / soloAllowed` で管理し、人数未確認を勝手に利用不可にしない
- 目的対応を手入力タグではなく、確認済み・条件付きの項目から派生判定
- 公開側の「適合○%」を廃止し、A / B / C / 条件付き / 要確認と必須項目確認数に変更
- 複数推し色はANDではなくOR検索
- 保存・比較の古いIDは起動時に自動整理
- 項目ごとに `sourceIds / checkedAt / nextReviewAt / scope` を保持
- SEO公開基準を満たさないホテル詳細は `noindex,follow` のまま維持
- ホームのおすすめ詳細リンクもSEO公開基準を満たしたレコードから自動生成
- アフィリエイトURLは canonical data に設定してからページ生成・公開する一方向フローに変更

## 実ブラウザ操作テスト

ChromiumでJavaScriptを実行し、PC 1440px / スマートフォン 390px相当を確認。

### PC

- 初期表示: 3件
- `BD` 検索: 2件（Blu-ray同義語検索が機能）
- 目的「鑑賞会」: 3件
- 1名指定: 3件を維持し、「人数条件未確認を含む」と表示
- 赤 + 黒を同時選択: 3件（複数推し色OR検索）
- クイック詳細: 開閉正常
- 確認度表示: `主要項目 7/20 確認済み`
- 公開表示に `%` なし
- JavaScript実行エラー: 0件

### モバイル 390px

- 絞り込みシート: 開閉正常
- 黒を選択しただけでは結果を変更しない
- 「この条件で表示」押下後: 1件
- 適用後に絞り込みシートが閉じる
- JavaScript実行エラー: 0件

## 公開フローテスト

ダミードメインで `build -> release -> validate` を実行。

- `release-production.py --allow-missing-affiliate`: 正常完了
- `validate-production.py --publication-ready`: 0 errors
- SEO公開基準を満たす2ページ: `index,follow`
- 新宿プリンスホテル: 確認項目4件のため `noindex,follow`
- sitemap: noindexページを除外
- 通常のrelease（overrideなし）: 楽天 / じゃらんURL未設定のため正しく公開停止

## 現在の検査結果

`python validate-production.py`

- 0 errors
- 4 warnings

警告内訳:

1. 変なホテル東京 羽田: 楽天 / じゃらんURL未設定
2. 新宿プリンスホテル: 楽天 / じゃらんURL未設定
3. ホテルメトロポリタン: 楽天 / じゃらんURL未設定
4. 新宿プリンスホテル: SEO公開基準未達（確認済み・条件付き4項目 / 情報源3件）

## 運用上の未確認事項

`maintenance_report.py` で現在以下を検出。

- 会場経路未確認: 3件
- 人数条件未確認: 3件
- SEO公開基準未達: 1件
- 再確認期限超過: 0件

未確認は推測で埋めず、確認できるまで未確認として表示します。

## 端末内データ方針

- 検索語・会場・目的・人数・絞り込み・並び順: `sessionStorage`
- 保存・比較: `localStorage`
- 検索条件のURLクエリ反映: なし
- `fetch` / `XMLHttpRequest` / `sendBeacon` / `document.cookie`: 使用なし
- 検索用サーバーAPI: なし
- CSP: `connect-src 'self'`
