# 0002: 伺服器狀態用手刻的 hook，不加 React Query / SWR

## 狀態

已採用

## 背景

這個專案需要管理好幾種「伺服器狀態」：

- Job 列表：依篩選條件抓取、每 5 秒輪詢、分頁切到背景要暫停。
- 單一 Job：輪詢、樂觀停止＋失敗還原。
- GPU 使用率：依 range（15m/1h/6h）重新抓取，失敗不影響頁面其他部分。
- 即時 log：SSE 串流，不是請求/回應模式。

starter 裡已經裝好的狀態管理相關套件只有 `zustand`，沒有 TanStack Query / SWR 這類
「伺服器狀態快取」函式庫。

## 決定

每一種資料各寫一個小 hook（`src/hooks/useJobs.ts`、`useJob.ts`、`useJobMetrics.ts`、
`useLogStream.ts`），自己管 `loading/success/error`、輪詢、依賴變化重新抓取；
`zustand` 只用在真正跨元件、跟「哪個請求觸發的」無關的全域狀態——目前只有一個全站共用的
通知佇列（`src/store/notifications.ts`），因為列表頁、詳情頁、停止對話框彼此沒有父子關係，
用它比 prop drilling 或額外包一層 Context 單純。

## 考慮過的替代方案

- **加裝 TanStack Query**：好處是內建快取、去重、重試、`staleTime`/`refetchInterval` 等，
  本來就是為這類需求設計的，程式碼量可能更少。沒有採用的原因：
  1. 題目列出的技術選型沒有包含它，starter 也沒有為它做任何設定（例如 `QueryClientProvider`）；
     現有的四種資料抓取需求（列表輪詢、單筆輪詢、依 range 重抓、SSE）用純 hook 大概 200
     行內可以寫完且容易逐行看懂，不足以證明需要再引入一個全域套件與它的心智模型。
  2. 這題本身在考「怎麼自己設計資料流、怎麼處理 race condition / 樂觀更新 / 輪詢暫停」，
     手刻一次更能展示這些細節怎麼被處理掉（見下方「刻意處理的坑」），全部交給函式庫反而
     把這些決策都藏起來了。
  - 如果這是一個會持續擴張、加更多種資料類型的真實產品，這個決定大概會反過來：
    資料種類一多，手刻 hook 的輪詢/快取/去重邏輯會重複地到處複製貼上，那時候
    TanStack Query 的邊際成本就划算了。
- **把所有伺服器狀態也放進 zustand**：可行，但 zustand 本身不處理「這次 fetch 是不是已經
  過期」「元件卸載後要不要還 setState」這類問題，仍然要在 store 裡手刻跟 hook 版本一樣的
  邏輯，只是把它搬到 store 檔案裡，並沒有讓問題變簡單，徒增一層訂閱的間接性。

## 刻意處理的坑

純手刻最容易漏掉、也最容易被忽略到驗收時才發現的兩個問題：

1. **過期回應蓋掉新回應**：關鍵字搜尋時，mock server 故意讓短關鍵字回得更慢
   （`mock-server/server.mjs` 的 `listJobs` 延遲邏輯），使用者快速輸入時，先送出的
   請求有可能比後送出的晚回來。`src/lib/latestRequest.ts` 的 `createLatestRequestGuard`
   是這題唯一解法：每次 fetch 要來前先跟 guard 要一個遞增 id，回應進來時先確認自己是不是
   目前最新的那個 id，不是就直接丟棄。`useJobs`/`useJob`/`useJobMetrics` 都用了它，
   並有對應的單元測試（`test/latestRequest.test.ts`、`test/useJobs.test.tsx`）模擬
   「舊請求晚回來」的情境。
2. **輪詢失敗不該把畫面清空**：列表或詳情頁已經顯示資料後，背景輪詢若剛好碰到
   mock server 故意回的 502/503，不應該把使用者正在看的資料換成錯誤畫面——只有「從頭
   載入、手上完全沒有資料」時失敗才整頁顯示錯誤；已經有資料時失敗只丟一個通知，
   資料原封不動留在畫面上（`test/useJobs.test.tsx` 的第二個測試案例）。

## 代價

- 四個 hook 之間有一部分結構很像（guard + loading/error state + 輪詢 + 分頁可見性），
  沒有抽成共用的「資料抓取」抽象層；目前判斷這點重複可以接受，之後如果要加第五種資料
  類型，值得抽出一個 `useResource` 之類的共用 hook。
- 沒有請求去重/跨元件快取——如果同一個 `jobId` 同時被兩個元件 mount，會各自發一次
  請求。目前畫面架構沒有這種情境（每個 job 只有一個詳情頁會顯示它），先不處理。
