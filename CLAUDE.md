# CLAUDE.md

這份文件是寫給接手這個專案的 AI 與新同事看的，只記錄「不看過 API 規格/程式碼不會知道」的事，
一般的程式風格建議（命名、縮排之類）不在這裡重複。

## 這個 API 的兩個地雷，踩過一次

`mock-server/openapi.yaml` 刻意設計了兩個不直覺的行為，`src/api/client.ts` 已經處理掉了，
**任何新的 API 呼叫都要透過 `src/api/client.ts` 的 `getJson`/`postJson`，不要自己寫
`fetch(...)`**——`eslint.config.js` 用 `no-restricted-globals` 把這件事變成 lint error，
在 `src/api/` 以外的地方寫 `fetch(` 會直接 lint 失敗。

1. **業務邏輯錯誤用 HTTP 200 回傳**：例如對已經結束的 Job 呼叫 `/stop`，狀態碼是 200，
   但 body 的 `error` 欄位不為 null。只檢查 `res.ok` 會把這種失敗誤判成成功
   （拿到 `data: null` 卻當作「拿到資料」）。`client.ts` 的 `unwrap()` 一律先檢查
   `body.error`，不管狀態碼是什麼。
2. **Job id 是 int64，超過 `Number.MAX_SAFE_INTEGER`**：`mock-server/server.mjs` 的
   `ID_BASE = 2095791122068779008n`，用一般的 `JSON.parse` 會把它轉成精度不足的
   `number`（尾數被四捨五入），之後拿這個值打 `/jobs/{id}` 會打到別的 job 或 404。
   因此：
   - `Job.id`（`src/api/types.ts`）的型別是 `string`，不是 `number`。
   - `client.ts` 在 `JSON.parse` 之前，先用 regex 把 `"id":<digits>` 包成
     `"id":"<digits>"`，讓它以原始字串精度被保留。
   - 新增的任何 API 回應如果也有 id 類的大數字欄位，記得比照辦理，不要假設
     `JSON.parse` 後的數字是準的。

## 伺服器狀態：手刻 hook，不是 React Query

`src/hooks/useJobs.ts` / `useJob.ts` / `useJobMetrics.ts` 都是手刻的 fetch hook，決策
理由見 `docs/adr/0002-hand-rolled-fetch-hooks-over-a-query-library.md`。幾個容易被
破壞掉的細節：

- 這三個 hook 都用 `src/lib/latestRequest.ts` 的 `createLatestRequestGuard` 防止
  「先送出的請求比較晚回來、蓋掉新資料」——改這幾個 hook 時如果拿掉這個 guard，
  搜尋框快速輸入時會偶發顯示錯的結果（mock server 故意讓短關鍵字回得更慢，很容易
  重現）。
- 輪詢失敗時，如果畫面上已經有資料，不會把資料清空或整頁顯示錯誤，只會丟一個
  通知（`useNotificationsStore`），資料原封不動留著。只有「完全沒資料時第一次載入
  失敗」才整頁顯示錯誤。
- 這幾個 hook 裡「開始 fetch 時 setState」的那一行都用 `queueMicrotask` 包起來
  （而不是直接同步呼叫）。這不是沒事找事做：`eslint-plugin-react-hooks@7` 的
  `react-hooks/set-state-in-effect` 規則會擋掉「在 effect 裡同步呼叫 setState」，
  即使是透過另一個函式間接呼叫也會被抓到；用 `queueMicrotask`／丟進
  `.then()` 之類的callback 就不會被擋。如果看到類似的 lint 錯誤，這是慣例解法，
  不是要整個改寫成別的資料抓取模式。

## SSE log：重連靠瀏覽器原生行為，不要自己重寫

`src/hooks/useLogStream.ts` 刻意不自己實作重連，理由與細節見
`docs/adr/0003-sse-log-streaming-strategy.md`。簡單說：原生 `EventSource` 斷線時會自動
帶著目前收到的最後一個 event id（`Last-Event-ID`）重新連線，mock server 也是照這個
header/query 決定要從哪裡接著送，兩邊的行為剛好互補，不需要自己手刻重連或游標回報。
**唯一要注意的是收到自訂的 `end` 事件要主動呼叫 `es.close()`**，否則原生 `EventSource`
會把「正常結束」也當成斷線，一直嘗試重連已經結束的 job。

## 開發用 mock server 的 `MOCK_CHAOS`

`mock-server/server.mjs` 預設會隨機回 502、隨機讓 SSE 斷線、讓 `/stop` 有 25% 機率失敗
（`npm run mock` 預設開著）。這是故意的，用來測前端的各種失敗狀態——**不要把它當成
server 本身不穩定去「修掉」**。Playwright e2e（`playwright.config.ts` 的 webServer）
已經設定 `MOCK_CHAOS: '0'`，讓 e2e 測試在關掉亂數的情況下跑，結果才會是確定的。
本機手動測試想看確定性行為時也可以 `MOCK_CHAOS=0 npm run mock`。

另外，metrics 端點的 503（`index % 7 === 3` 的 job 永遠拿不到 GPU 使用率）**不受
`MOCK_CHAOS` 控制**，是固定的測試資料，不是隨機失敗——這是用來測「部分失敗」畫面
（`04-job-detail-partial.png`）用的，不要誤以為是 bug 去修 mock server。

## 測試環境：`npm test` 在某些 Node 22 版本上會炸掉

`jsdom@31` 依賴的 `undici@8.12.4` 在模組載入時會呼叫 `zlib.createZstdDecompress`，但
這個 API 在 Node 23.8 之前不存在，導致 `vitest run` 連 worker 都啟動不了
（`Cannot read properties of undefined (reading 'bind')`）。`package.json` 用
`overrides` 把 `undici` 釘在 `8.0.0`（那個版本有做 runtime feature 檢查，不會無條件
呼叫這個 API），讓測試在 README 要求的 Node 22 上也能跑。如果之後升級 `jsdom` 且測試
又在 Node 22 上炸開，先檢查是不是同一個 `undici` 問題，而不是假設是自己程式碼的問題。

## i18n：兩份語言檔要一起改

`src/locales/zh-Hant.json` 和 `en.json` 的 key 結構必須完全對稱——目前沒有 CI 檢查
這件事，加新字串時兩個檔案都要加，不然 `react-i18next` 會 fallback 成英文 key 字串
原樣顯示（不會報錯，容易漏看）。

## Part A 沒做的部分

這些在設計稿裡有畫出來，但題目的功能需求文字沒有明確要求，為了控制範圍沒有實作，
細節與理由在 README「取捨與未完成」：log 的關鍵字搜尋/等級篩選/下載按鈕、
log 斷線提示的「第幾次嘗試」計數、Job 列表的批次操作（批次操作只出現在 Part B 要
review 的 `review/batch-stop` 分支，不是 Part A 的要求）。
