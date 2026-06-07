# Travel Journal

一個使用 HTML、Tailwind CSS、Vanilla JavaScript 與 LocalStorage 製作的旅行手帳 Web App。可選擇透過 Google Apps Script 將旅程同步到 Google Sheet，並提供只讀分享頁。

## 功能

- Dashboard 首頁顯示所有旅程卡片
- Dashboard 月曆可點擊日期查看當日景點
- Add Trip 頁面新增旅程名稱、日期、天數與目的地
- 每個旅程可保存團友名單
- 點擊旅程卡片進入 Trip Detail
- Trip Detail 顯示每日行程，並可新增日期、Day、地點、車程、住宿地點與景點列表
- Trip Detail 可新增、刪除與查看團友
- Budget 頁面可新增分帳支出、選擇支付者、計算每人金額
- Budget 頁面顯示總支出、每人平均支出與支出列表
- 旅程資料儲存在瀏覽器 LocalStorage
- 可同步旅程資料到 Google Sheet
- `share.html` 可讀取 Google Sheet 並顯示只讀團友版
- 適合部署到 GitHub Pages

## 技術

- HTML
- Tailwind CSS CDN
- Vanilla JavaScript
- LocalStorage
- Google Apps Script
- Google Sheet

## 使用方式

直接開啟 `index.html`，或使用 GitHub Pages 部署。

主要頁面：

- `index.html`：Dashboard 首頁
- `add-trip.html`：新增旅程
- `trip-detail.html?id=xxx`：旅程詳情與每日行程
- `budget.html?id=xxx`：旅程分帳記帳
- `share.html?tripId=xxx`：Google Sheet 只讀分享頁

## Google Sheet 雲端分享 MVP

這個版本保留 LocalStorage 作為本機資料來源與備份。當你在旅程詳情頁按「同步到 Google Sheet」時，網站會把該旅程資料送到 Google Apps Script，再寫入 Google Sheet。團友打開 `share.html?tripId=xxx` 後，只會讀取 Google Sheet 資料，不會看到任何新增、編輯或刪除按鈕。

### 建立 Google Sheet

1. 建立一份新的 Google Sheet。
2. 建立以下 4 個工作表，名稱必須完全一致：
   - `Trips`
   - `DailyPlans`
   - `Members`
   - `Expenses`
3. 第一列欄位建議如下。Apps Script 第一次執行時也會自動補上空表的標題列。

`Trips`

| tripId | title | startDate | endDate | destination | updatedAt |
|---|---|---|---|---|---|

`DailyPlans`

| tripId | planId | date | dayNumber | location | transport | accommodation | spots |
|---|---|---|---|---|---|---|---|

`Members`

| tripId | memberName |
|---|---|

`Expenses`

| tripId | expenseId | date | name | category | amount | currency | payer | splitAmount |
|---|---|---|---|---|---|---|---|---|

### 設定 Apps Script

1. 在 Google Sheet 裡選擇 Extensions > Apps Script。
2. 將 [apps-script/Code.gs](apps-script/Code.gs) 的內容貼到 Apps Script 的 `Code.gs`。
3. 在 Apps Script 左側選擇 Project Settings。
4. 新增 Script property：
   - Property：`ADMIN_KEY`
   - Value：自行設定一組管理用 key
5. 儲存專案。

### 部署 Web App

1. 在 Apps Script 右上角選擇 Deploy > New deployment。
2. Type 選擇 Web app。
3. Execute as 選擇 `Me`。
4. Who has access 選擇 `Anyone`。
5. 部署後複製 Web App URL。

### 填入 sheets-api.js

打開 [sheets-api.js](sheets-api.js)，填入 Apps Script Web App URL 和 adminKey：

```js
const SHEETS_API_CONFIG = {
  webAppUrl: "你的 Apps Script Web App URL",
  adminKey: "你的 ADMIN_KEY"
};
```

`adminKey` 只用於同步資料到 Google Sheet。團友打開分享頁讀取資料時不需要登入，也不需要密碼。

### 使用同步和分享

1. 在 Dashboard 建立旅程。
2. 到 `trip-detail.html?id=xxx` 新增每日行程與團友。
3. 到 `budget.html?id=xxx` 新增記帳資料。
4. 回到旅程詳情頁，按「同步到 Google Sheet」。
5. 按「複製分享連結」。
6. 將 `share.html?tripId=xxx` 分享給團友。

### 安全提醒

Google Sheet 是這個 MVP 的雲端資料來源。任何持有分享連結的人都可以查看該旅程資料。請不要存放護照號碼、訂單編號、信用卡資料、完整地址、電話、證件資料或其他敏感個人資料。

`adminKey` 不應該公開分享。若 repository 是公開的，正式使用時建議不要把真實 adminKey commit 到 GitHub；可以部署前手動填入，或改成更安全的後端管理方式。

## GitHub Pages 部署

1. 進入 GitHub Repository 的 Settings。
2. 選擇 Pages。
3. Source 選擇 `Deploy from a branch`。
4. Branch 選擇 `main` 與 `/root`。
5. 儲存後即可取得 GitHub Pages 網址。
