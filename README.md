# 韓國代購 LINE 報價 Bot

這是一個可部署到 Vercel 的 LINE webhook MVP。客戶貼商品連結後，bot 會嘗試抓商品頁價格，必要時用 Gemini 從頁面文字判讀韓元售價，再依你的代購設定回覆台幣報價與購買須知。

## 目前功能

- LINE Messaging API webhook
- LINE 簽章驗證
- 商品連結辨識
- 手動韓元價格覆蓋：`價格 59000 https://商品連結`
- 商品頁價格擷取
- Gemini JSON fallback
- 報價公式：商品台幣 + 代購費 + 預估運費
- Vercel 環境變數設定

## 報價公式

```txt
商品台幣 = 韓元售價 * KRW_TO_TWD_RATE
代購費 = 商品台幣 * AGENCY_FEE_RATE
合計 = 商品台幣 + 代購費 + DEFAULT_SHIPPING_TWD
```

## 環境變數

複製 `.env.example` 的內容到 Vercel Project Settings 的 Environment Variables。

```txt
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
GEMINI_API_KEY=
ADMIN_TOKEN=請換成一組只有你知道的管理密碼
GITHUB_TOKEN=
GITHUB_OWNER=oneeric
GITHUB_REPO=koreabuy-line-quote-bot
SETTINGS_PATH=settings.json
KRW_TO_TWD_RATE=0.025
AGENCY_FEE_RATE=0.15
DEFAULT_SHIPPING_TWD=200
SHOP_NAME=韓國代購
BANK_INFO=銀行：000 / 帳號：000000000000 / 戶名：王小明
NOTICE_TEXT=報價為預估金額，實際以付款當下匯率、商品庫存與韓國境內運費為準。下單後不接受取消，缺貨會全額退款。
```

## LINE 設定

1. 到 LINE Developers 建立 Messaging API Channel。
2. 取得 `Channel secret`，填入 `LINE_CHANNEL_SECRET`。
3. 發行 Channel access token，填入 `LINE_CHANNEL_ACCESS_TOKEN`。
4. 部署到 Vercel 後，將 webhook URL 設為：

```txt
https://你的網域.vercel.app/api/line/webhook
```

5. 開啟 Use webhook，並用 LINE Developers 的 Verify 測試。

## Gemini 設定

到 Google AI Studio 建立 API key，填入 `GEMINI_API_KEY`。沒有設定也可以跑，只是會少掉 AI 判讀 fallback。

## 首頁費用設定

首頁是管理 UI，可以調整匯率、代購費、預設運費、匯款資訊與購買須知。

設定會存成 GitHub repo 裡的 `settings.json`。bot 每次報價會讀 GitHub 上最新的 JSON，不需要資料庫，也不用每次改設定都重新部署。

要讓首頁按下「儲存設定」後真的寫入 GitHub，需要在 Vercel 加這些環境變數：

```txt
ADMIN_TOKEN=一組只有你知道的管理密碼
GITHUB_TOKEN=GitHub fine-grained token，需有此 repo 的 Contents read/write 權限
GITHUB_OWNER=oneeric
GITHUB_REPO=koreabuy-line-quote-bot
SETTINGS_PATH=settings.json
```

如果還沒設定 GitHub token，bot 仍會使用 Vercel 內的預設環境變數報價，只是首頁不能儲存。

## 本機開發

```bash
npm install
npm run dev
```

本機要讓 LINE 打到 webhook，可以用 ngrok 或 Cloudflare Tunnel 暫時公開：

```txt
https://你的暫時網址/api/line/webhook
```

## 使用方式

客戶只貼連結：

```txt
https://example.kr/product/123
```

如果自動抓不到價格，就改傳：

```txt
價格 59000 https://example.kr/product/123
```

## 注意事項

- 有些韓國網站的價格需要選規格、登入或由瀏覽器 JavaScript 載入，免費 Vercel serverless 不一定能抓到。這時候手動價格覆蓋會最穩。
- LINE reply token 只能短時間使用，所以 webhook 內的處理不能拖太久。若未來要做大量爬蟲或排隊報價，建議改成先回「處理中」，再用 push message 補報價。
- 爬取網站前請確認該網站條款與 robots 規則；內部報價工具也建議保留人工確認流程。
