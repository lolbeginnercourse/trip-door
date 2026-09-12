# ファイル構成

## データ原本

- `data/hotels.json` — **唯一の編集元**。ホテル・客室・推し活対応情報、根拠、確認日、再確認日、人数条件、予約リンクを管理

## 生成される公開ページ

- `index.html` — トップ / ブラウザ内検索 / 保存 / 比較 / クイック詳細
- `records.json` — ブラウザ・確認用の軽量データ
- `hotels/index.html` — 静的ホテル一覧
- `hotels/<hotel-slug>/index.html` — ホテル固有の静的詳細ページ
- `mobile-preview.html` — 390×844確認用プレビュー

## 生成・公開・検証

- `build_site.py` — `data/hotels.json` からトップ用データ・一覧・詳細ページを生成
- `build_detail_pages.py` — 互換用ラッパー。内部では `build_site.py` を呼ぶ
- `validate-production.py` — データ、JavaScript、内部リンク、プライバシー設計、SEO公開状態を検証
- `maintenance_report.py` — 再確認期限、人数未確認、会場経路未確認、アフィリエイト未設定、SEO公開基準未達を一覧化
- `check_external_links.py` — 公式情報源・アフィリエイトURLの外部リンク確認（外部HTTP接続可能な環境で実行）
- `release-production.py` — 本番ドメイン・運営者・連絡先・robots・canonical・sitemapを公開設定へ切替

## 公開関連

- `robots.txt` — 公開前クロール拒否
- `robots.production.txt` — 公開用robotsテンプレート
- `sitemap.xml.template` — sitemapテンプレート
- `vercel.json` — Vercel向けセキュリティヘッダー
- `404.html` — 404ページ

## 方針・法務

- `terms.html` — 利用規約
- `privacy.html` — プライバシーポリシー
- `affiliate-disclosure.html` — 広告・アフィリエイト方針
- `external-transmission.html` — Cookie / 外部送信 / 端末内保存
- `editorial-policy.html` — 調査・更新方針
- `operator.html` — 運営者情報
- `LEGAL-NOTES.md` — 法務・広告運用メモ
- `DATA-SCHEMA.md` — データ設計
- `PRODUCTION-CHECKLIST.md` — 公開前手動チェック
- `QA-REPORT.md` — 実装・ブラウザ・公開フローの検証結果
- `README.md` — 導入・運用手順

## 原則

`index.html` や `hotels/` 以下の生成HTMLをデータ更新のために直接編集しません。

更新順序は必ず、

`data/hotels.json` 更新 → アフィリエイトURL設定 → `build_site.py` → `validate-production.py` → `release-production.py` → 再検証 → 公開

です。
