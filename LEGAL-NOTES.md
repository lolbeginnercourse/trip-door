# 法務・規約メモ（運用担当向け）

最終確認日: 2026-09-12

このファイルは公開ページではなく、運用担当者向けの確認メモです。法律相談ではありません。

## 1. 景品表示法 / ステルスマーケティング

2023年10月1日から、広告であるにもかかわらず一般消費者が広告と判別しにくい表示は景品表示法上の規制対象になっています。

このサイトでは、ファーストビューにアフィリエイト広告利用を表示し、予約CTAにも「広告」を付けています。

公式確認先:
- https://www.caa.go.jp/policies/policy/representation/fair_labeling/stealth_marketing/
- https://www.caa.go.jp/policies/policy/representation/fair_labeling/faq/stealth_marketing/

## 2. 楽天アフィリエイト

楽天アフィリエイトでは、登録したメディアに所定の方法でアフィリエイトリンクを設置し、広告主等が指定する条件に従う必要があります。ユーザーに誤解を与える表現、クリックの依頼、許可されていないリンクやコンテンツの改変等は避けます。

公式確認先:
- https://affiliate.rakuten.co.jp/guideline/terms/
- https://affiliate.rakuten.co.jp/guideline/rule/
- https://affiliate.rakuten.co.jp/guideline/adrule/
- https://affiliate.rakuten.co.jp/guideline/stealth_marketing_regulation/

## 3. じゃらんnet / ASP

じゃらんnetはアフィリエイトパートナー募集を案内しており、提携後はASPで発行されたリンクを利用します。成果条件・禁止事項・広告素材の扱いは、公開時点の提携ASP管理画面のプログラム詳細を最優先で確認してください。

公式確認先:
- https://www.jalan.net/jalan/doc/news/link/vc.html

なお、旧じゃらんWebサービス（API）は現在、新規アカウント登録受付終了と案内されています。API利用を前提に本サイトの宿泊日検索を設計しない方針です。
- https://www.jalan.net/jw/jwp0300/jww0301.do

## 4. 旅行業法との境界

観光庁は、旅行予約サイトには「実際に旅行商品を販売し契約の相手方となるもの」と「単に他社の商品を比較紹介するもの」などがあり、形態によって旅行業法上の登録の有無が異なると案内しています。

このサイトは後者の「比較・情報提供」に寄せ、以下を行いません。
- 予約申込み受付
- 宿泊料金の収受
- 予約変更・取消の取次
- 宿泊契約の代理・媒介を自サイト上で行うこと

公式確認先:
- https://www.mlit.go.jp/kankocho/seisaku_seido/ryokochui/yoyakusite.html
- https://www.mlit.go.jp/kankocho/seisaku_seido/ryokogyoho/ryokogyohogaiyo.html

将来、予約・決済・有料手配等へ機能拡張する場合は、旅行業法上の登録・表示等について専門家または行政へ事前確認してください。

## 5. 個人情報 / Cookie

Cookieや閲覧履歴等は、利用形態によって個人関連情報等として扱われる場合があります。本サイト初期版は外部解析・広告配信JavaScriptを読み込まず、保存/比較はlocalStorageのみです。

公式確認先:
- https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/

Analytics、AdSense、ASPの自動リンク変換タグ、SNS埋込等を追加したときは、実際の送信先・送信情報・利用目的を確認して `privacy.html` と `external-transmission.html` を更新します。

## 6. 特定商取引法

現在の「情報提供 + 外部アフィリエイト送客」だけで、自サイトが宿泊や商品を販売する設計にはしていません。自サイトで有料サービス、掲載料、予約代行、物販等を開始する場合は、特定商取引法に基づく表示の要否を改めて確認してください。

## 7. 最後に優先するもの

法律・行政ガイド > 広告主規約 > ASP規約 > 本サイト内部ルール の順で優先して見直します。規約は変更されるため、公開時と大きな機能追加時に再確認します。
