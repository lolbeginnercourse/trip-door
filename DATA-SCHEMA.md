# 推し宿 DB設計 v4

運用上の原本は `data/hotels.json` です。HTMLは編集対象ではなく生成物です。

## レコード単位

「ホテル」だけではなく、**どの客室・どの公式案内で確認できた情報か**を分けて管理します。楽天・じゃらんで販売される特定プランを本サイトの商品単位にはしません。

### 基本情報
- `id`
- `hotel`
- `room`
- `officialContext` — 「公式の推し活向け客室案内で確認」など、確認範囲の説明
- `area` / `station` / `address`
- `officialUrl` — 予約CTAではなく根拠・構造化データ用
- `checked` — レコード全体の最終確認日
- `summary`

### occupancy
人数は単一の `capacity` で持たず、確認できた範囲を分けます。
- `minGuests`
- `maxGuests`
- `soloAllowed` (`確認済み` / `不可` / `未確認` など)
- `note`

未確認は利用不可として除外しません。検索結果に「人数条件未確認」と表示します。

### colors
ホテル側が明示した推し色のみ登録します。複数色検索は OR 条件です。

### bookingLinks
- `rakuten`
- `jalan`

設備の根拠データとは分離します。URLは発行元のルールに従って登録し、ページ生成前に設定します。

### venueRoutes
- `venue`
- `status`
- `totalMinutes`
- `walkMinutes`
- `transfers`
- `note`
- `checkedAt`
- `nextReviewAt`
- `sourceUrl`

所要時間・乗換回数は実測/経路確認できたものだけ確定値にします。

## details

各項目は単なる値ではなく、**根拠・確認日・対象範囲**をセットで持ちます。

```json
"Blu-ray": {
  "status": "確認済み",
  "note": "Blu-rayレコーダーを客室に設置",
  "scope": "推し活応援ルーム",
  "sourceIds": ["hotel-src-1"],
  "checkedAt": "2026-09-12",
  "nextReviewAt": "2026-12-11"
}
```

- `status`: `確認済み` / `条件付き` / `未確認`
- `note`: 利用者向けの具体的説明
- `scope`: どの客室・対応範囲で確認したか
- `sourceIds`: `sources` のID
- `checkedAt`: 項目単位の確認日
- `nextReviewAt`: 再確認期限

## sources

```json
{
  "id": "hotel-src-1",
  "label": "ホテル公式 推し活案内",
  "url": "https://...",
  "note": "確認した内容",
  "checkedAt": "2026-09-12"
}
```

第三者記事・口コミだけで `確認済み` にはしません。

## 目的別判定

`purposes` をホテルレコードに手入力しません。装飾・映像・ケーキ・遠征条件などの `details` から自動判定します。

公開画面では「適合78%」のような疑似精密な数値を表示せず、以下を表示します。
- A / B / C
- 条件付き
- 要確認
- 必須項目の確認数

内部スコアは並び替えにのみ使います。

## 生成フロー

```text
data/hotels.json
  ↓
python build_site.py
  ↓
index.html / records.json / hotels/ / 個別詳細ページ
  ↓
python validate-production.py
```

本番公開時は、アフィリエイトURLも `data/hotels.json` に入れてから生成します。
