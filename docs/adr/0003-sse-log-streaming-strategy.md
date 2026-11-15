# 0003: 即時 log 用原生 EventSource，重連邏輯交給瀏覽器

## 狀態

已採用

## 背景

`/jobs/{id}/logs/stream` 是 SSE：每行 log 是一個事件，`id` 為遞增序號；帶
`Last-Event-ID` 時從該序號之後接著送。`mock-server/server.mjs` 會故意在
15–25 秒之間 `res.destroy()` 模擬前面 reverse proxy 隨機斷線。需求是：

- 斷線要能自動恢復，恢復後的內容「不重複、不遺漏」。
- log 可能累積到數十萬行，分頁不能卡住。
- 使用者往上捲要暫停自動捲動，且要顯示累積了多少新行。

## 決定

直接用瀏覽器原生 `EventSource`，不自己寫重連/游標回報邏輯：

- **重連**：原生 `EventSource` 連線被中斷時，瀏覽器會照 SSE 規格自動重連，
  並自動帶上目前收到的最後一個 `id` 作為 `Last-Event-ID` header。mock server
  正是依照 `Last-Event-ID` 決定從哪裡接著送，所以「斷線 → 自動重連 → 接續內容」
  這條路徑完全不用自己寫，瀏覽器 + server 的既有約定就處理掉了。
  實作在 `src/hooks/useLogStream.ts`。
- **正常結束要主動關閉**：server 送完全部 log 後會送一個自訂的 `end` 事件再
  關閉連線。原生 `EventSource` 預設行為是「連正常關閉的連線也會重連」，所以
  收到 `end` 必須呼叫 `es.close()`，否則已經結束的 job 會被不斷重新打開連線。
- **仍然做一層序號去重**：即使重連由瀏覽器處理，`src/lib/logBuffer.ts` 的
  `appendLogLines` 還是依 `seq` 過濾掉「已經顯示過的行」才合併進 buffer——
  這是防禦性的最後一道防線（例如重連瞬間、mock server 的 `_logSeq` 补到進度的
  邏輯等任何可能造成少量重疊的情形），不依賴「瀏覽器一定沒有 edge case」。
  這個函式本身不依賴 `EventSource`，所以能直接寫單元測試
  （`test/logBuffer.test.ts`），不用在測試裡真的開一條 SSE 連線。
- **大量行數**：同一個 buffer 設了 `MAX_LOG_LINES`（目前 20,000）上限，超過時
  從最舊的開始丟棄；畫面渲染用 `src/components/LogViewer.tsx` 裡簡易的固定列高
  虛擬捲動（只渲染可視範圍 + overscan 的列，用絕對定位 + 一個撐出總高度的容器），
  沒有另外引入 react-window 之類的套件——固定列高、單一捲動容器的情境自己寫
  大概 30 行，不足以為了這個再加一個依賴。

## 考慮過的替代方案

- **自己實作重連（`fetch` + `ReadableStream` 手動解析 SSE，記錄 `lastEventId`，
  斷線時自己 `setTimeout` 重新連線）**：好處是可以用自訂 header（`Last-Event-ID`
  而不只是 query）、可以做指數退避等更細緻的重試策略。沒有採用的原因是這題的
  mock server 行為剛好完全落在原生 `EventSource` 規格涵蓋的範圍內（用 query
  `lastEventId` 或 header 都支援、沒有要求自訂 retry 策略），自己刻一份等於
  重新實作瀏覽器本來就有的行為，多出來的程式碼只是多一個會不小心寫錯「序號
  有沒有算對」的地方。如果之後需要瀏覽器不支援的能力（例如 POST body、自訂
  header 建立連線），才需要換成手動實作。
- **WebSocket**：API 規格就是 SSE，沒有理由換協定。

## 代價

- 重連的時機、retry 間隔完全由瀏覽器決定（預設約 3 秒），沒辦法客製化重試策略
  或加上指數退避；畫面上「正在重新連線」的提示文字也只能反映
  `EventSource.readyState`，拿不到「這是第幾次嘗試」這種細節（對照設計稿
  `05-job-logs.png` 寫的「第 2 次嘗試」沒有做到，這點已記錄在 README 的
  取捨列表）。
- 原生 `EventSource` 不能設自訂 request header，所以只能透過 query string 或
  依賴瀏覽器自動帶的 `Last-Event-ID`；如果之後 API 改成需要帶認證 token 的
  header，會被迫換成手動實作。
