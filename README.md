# 推し宿 — Production Candidate v5

推し活向けホテルを、ホテル名ではなく「その客室・対応範囲で何が確認できるか」から探す静的Webサイトです。

## 現在の状態

公開直前まで実装した **Production Candidate** です。運営者情報・本番ドメイン・実際の楽天トラベル / じゃらんnet のアフィリエイトURLだけは、利用者固有の情報なので未設定です。

初期状態は安全側に倒し、`noindex,nofollow` と `robots.txt: Disallow /` にしています。

## 実装済みの検索・操作

- 客室 / 対応範囲単位の検索
- エリア / ホテル / 最寄駅検索
- ライブ・イベント会場検索
- 検索候補の自動表示
- Enterキー検索
- 目的検索：本人不在の誕生日 / 映像鑑賞会 / ライブ遠征 / 祭壇・撮影 / 推し会・オフ会
- 人数検索（人数情報が未確認の施設は除外せず、その旨を表示）
- 推し色フィルター
- 装飾 / 映像 / ケーキ / 飲食 / 祭壇 / 遠征条件の詳細フィルター
- PCは即時絞り込み、スマホは「選択 → この条件で表示」の確定式
- 目的別の必須項目・確認度（A/B/C/条件付き/要確認。％表示なし）
- 「確認済み / 条件付き / 未確認」を分離
- 保存機能（localStorage / ブラウザ内のみ）
- 保存済みのみ表示
- 比較機能（最大3件 / localStorage / ブラウザ内のみ）
- 比較から個別削除 / 全解除
- ホテル固有の静的詳細ページへの遷移
- 詳細モーダルとタブ切替（クイック確認用）
- キーボード操作 / Escapeで閉じる / モーダル内フォーカストラップ
- 検索・絞り込み条件はsessionStorageに保存（URLへは付与しない）
- 該当なし時の全条件リセット
- 操作結果のトースト通知
- 390pxスマホ幅の横スクロール防止

## SEO向けのページ構成

ホテルカードのホテル名・画像・「推し活条件を詳しく見る」はホテル固有URLへ遷移します。検索・絞り込み条件はURLへ出さず、SEOは静的ページ側で取ります。

- `/hotels/` — ホテル一覧
- `/hotels/<slug>/` — ホテル固有の推し活条件ページ

個別ページには title / description / canonical / H1 / パンくず / BreadcrumbList / Hotel 構造化データ / 項目別確認根拠 / 確認日 / 関連ホテルを生成します。


## 自動判定とSEO公開基準

- 目的対応は手入力タグではなく、項目ごとの確認状態から派生判定します。
- 複数の推し色は「いずれかに対応」のOR条件です。
- 人数が未確認の施設は勝手に除外せず、「人数条件未確認」と表示します。
- 公開UIでは精密に見える適合率％を出さず、A / B / C / 条件付き / 要確認と必須項目の確認数を表示します。
- 個別ホテルページは、確認済み・条件付きが5項目以上、URL付き情報源2件以上、固有要約40字以上をSEO公開の最低基準にしています。基準未達は `noindex,follow` でsitemapから除外します。
- トップのホテル詳細導線も、SEO公開基準を満たしたページから自動生成します。

## データの原本

**唯一の編集元は `data/hotels.json` です。** `index.html` や `/hotels/` 以下のHTMLをDB代わりに直接編集しません。

```bash
python build_site.py
```

この処理で `data/hotels.json` から、トップ検索用データ、`records.json`、ホテル一覧、各ホテル詳細ページを生成します。

ホテルレコードは特定のOTA宿泊プランを販売商品として扱わず、「どの客室・どの公式案内で何を確認できたか」を管理します。

## 予約リンク

`data/hotels.json` の `bookingLinks.rakuten` / `bookingLinks.jalan` に、発行元の規約に従った実アフィリエイトURLを登録します。ホテル公式サイトは予約CTAには使用せず、設備・ルール等の根拠リンクとしてのみ使用します。

本サイトでは宿泊日・リアルタイム空室・リアルタイム料金を扱いません。予約・決済・変更・キャンセルも受け付けません。

## 公開手順

公開順序は固定です。

1. `data/hotels.json` のホテル情報・根拠・確認日を更新
2. 楽天 / じゃらんの実アフィリエイトURLを登録
3. `python build_site.py`
4. `python validate-production.py`
5. `python release-production.py --domain ... --operator ... --contact-email ...`
6. 再度 `python validate-production.py`
7. デプロイ

`release-production.py` は通常、楽天・じゃらんURLが未設定のレコードがあると停止します。テスト用途だけ `--allow-missing-affiliate` を使えます。

運用時は以下も使います。

```bash
python maintenance_report.py
python check_external_links.py   # 外部HTTPへ接続できる環境で任意実行
```

`maintenance_report.py` は再確認期限、アフィリエイト未設定、会場経路未確認、人数条件未確認、SEO公開基準未達を一覧化します。

## 法務・運用ページ

- `terms.html` — 利用規約
- `privacy.html` — プライバシーポリシー
- `affiliate-disclosure.html` — 広告・アフィリエイト方針
- `external-transmission.html` — 外部送信 / Cookie
- `editorial-policy.html` — 調査・更新方針
- `operator.html` — 運営者情報
- `404.html` — 404ページ

これらは「比較・情報提供 + 外部予約サイトへの広告リンク」で、自サイトでは予約を受け付けない現在の仕様を前提にしています。独自予約、会員機能、問い合わせフォーム、Analytics、AdSense、外部広告JavaScript等を追加する場合は内容を再点検してください。

## SEO / セキュリティ土台

- 公開前 `robots.txt`
- `robots.production.txt`
- `sitemap.xml.template`
- 公開時に全HTMLから `sitemap.xml` を自動生成
- `release-production.py`
- `validate-production.py`
- `vercel.json` セキュリティヘッダー

`vercel.json` のCSPは現在の「インラインCSS/JS + 外部画像なし」構成用です。Analytics、AdSense、ASP JavaScript等を追加する場合は許可ドメインを追加してください。

## データ品質ルール

- ホテル全体ではなく客室 / 対応範囲単位で確認
- 「確認済み」は一次情報を基本とする
- 第三者記事だけで確認済みにしない
- 情報源URL・確認日・対象範囲を残す
- 分からない情報を推測で埋めない
- 公式案内の終了・変更時は該当情報を更新または検索対象から外す
- 会場所要時間・乗換回数は実際に確認したデータだけ公開する

## QA済み

PC 1440pxとモバイル390pxで実ブラウザ操作テストを実施しています。

確認した操作：目的選択、保存、詳細表示、詳細タブ、比較追加、比較削除、Enter検索、リセット、モバイル絞り込みの確定動作、楽天/じゃらん仮ボタン、横スクロール有無。
