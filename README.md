# GPU Job Monitor

GPU 叢集管理平台的 Job 監控頁面：Job 列表（篩選/排序/分頁/輪詢）、Job 詳情
（基本資訊、GPU 使用率圖表、停止 Job）、即時 log（SSE）。

## 啟動

需要 Node.js 22 以上與一般瀏覽器，不需要 GPU：所有 Job、GPU 使用率與 log 都由 mock backend 產生。

```bash
npm install
npm run mock     # mock backend，http://localhost:4000
npm run dev      # 前端，http://localhost:5173（/api 已 proxy 到 mock backend）
```

## 指令

| 指令                 | 用途                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm run lint`       | ESLint                                                                                                  |
| `npm run type-check` | TypeScript 型別檢查                                                                                     |
| `npm run test`       | 單元測試（Vitest，測試放在 `test/`）                                                                    |
| `npm run test:e2e`   | e2e 測試（Playwright，會自動啟動 mock 與 dev server，且會把 `MOCK_CHAOS` 關掉讓結果是確定的）。第一次請先執行 `npx playwright install chromium` |

四個指令目前都是綠的。

## 目錄

| 路徑              | 內容                                                          |
| ----------------- | ------------------------------------------------------------- |
| `mock-server/`    | mock backend 與 API 規格 `openapi.yaml`                        |
| `design/`         | 設計稿、匯出圖與 design tokens                                 |
| `src/api/`        | API client 與型別（`client.ts` 處理了 envelope 的兩個地雷，見下方與 `CLAUDE.md`） |
| `src/hooks/`      | 資料抓取／輪詢／SSE／樂觀更新的 hook                           |
| `src/components/` | 畫面元件（表格、篩選列、圖表、log viewer、對話框等）           |
| `src/pages/`      | `JobListPage`、`JobDetailPage`                                 |
| `src/lib/`        | 跟 React 無關的純函式（URL↔篩選條件、log 去重、ANSI 處理等），也是單元測試主要覆蓋的地方 |
| `src/store/`      | 全站共用的通知佇列（zustand）                                  |
| `docs/adr/`       | 架構決策紀錄                                                   |
| `test/`           | 單元測試（Vitest）                                             |
| `e2e/`            | e2e 測試（Playwright）                                         |

## 功能完成度

Part A 的六項功能需求（Job 列表、Job 詳情、即時 log、各種狀態、i18n、響應式）都已實作，
細節與取捨見下面「取捨與未完成」。

## 取捨與未完成

設計稿有畫出來、但題目「功能需求」文字沒有明確要求，為了控制範圍沒有做的部分：

- **Log 的關鍵字搜尋／等級篩選／下載按鈕**（`05-job-logs.png` 的 toolbar）：功能需求只要求
  「自動捲到底、暫停/恢復、斷線重連不重不漏、大量資料不卡頓」，這幾個都做了；搜尋/篩選/下載
  是額外的瀏覽體驗，沒有在需求文字裡，先不做。
- **重連提示的「第幾次嘗試」**：見 `docs/adr/0003-sse-log-streaming-strategy.md`——
  重連邏輯交給瀏覽器原生 `EventSource`，換到的好處是不用自己實作重連/序號回報，代價是拿不到
  「這是第幾次重試」這種細節，只能顯示「正在重新連線」。
- **分頁而非無限捲動**：見 `docs/adr/0001-pagination-not-virtual-scroll-for-the-job-list.md`。
- **Job 列表沒有批次操作**：題目的 Part A 功能需求沒有要求批次停止；批次停止只出現在
  Part B 要 review 的 `review/batch-stop` 分支（且那支 MR 本身有嚴重問題，見 `REVIEW.md`），
  沒有被合併進 Part A 的實作。
- **平板版的詳情頁上下排列**：設計稿寫「未畫出，請比照處理」，`JobDetailPage` 用 MUI
  `Grid` 的 `size={{ xs: 12, md: ... }}` 讓基本資訊卡片跟圖表卡片在窄螢幕自動變成上下排列
  （沒有另外為 1024px 做客製化版面，用跟列表一致的斷點）。

## 測試怎麼選的

單元測試刻意集中在 `src/lib/`（跟 React 無關的純函式）跟 hook 的邊界行為，而不是替每個
元件都寫 snapshot/render 測試，原因：

- **`src/lib/latestRequest.ts` + `useJobs`/`useJob` 的「過期回應」測試**：這題的 mock
  server 故意讓短關鍵字回得更慢，快速輸入時「先送出的請求比較晚回來」是真的會發生、而且
  肉眼很難在手動測試時穩定重現的情境，寫成單元測試才能可靠地重現「兩個請求故意亂序回來」
  並斷言畫面只採用最新一次的結果。
- **`src/api/client.ts` 的 envelope 處理**：業務錯誤用 HTTP 200 回傳、int64 id 精度
  這兩件事都是「不仔細讀 API 規格就會寫錯、寫錯了也不會立刻在開發時發現」的那種 bug
  （本機測試資料裡剛好的 job 可能不會馬上觸發），所以特別寫測試把這兩個情境釘死。
- **`src/lib/logBuffer.ts` 的去重/裁切**：SSE 重連後「不重複、不遺漏」是功能需求明講的
  驗收標準，而且牽涉到邊界條件（完全重疊的批次、剛好超過上限的裁切），比起整個串起
  EventSource 去手動測試斷線重連，測試這個純函式更快、更穩定。
- **`useJob` 的樂觀更新/失敗還原**：這是「停止 Job」整個功能的正確性核心（設計稿明確要求
  失敗要還原狀態），用 mock 的 `stopJob` 控制 resolve/reject 時機，比在 e2e 裡硬湊一個
  「剛好失敗」的時機更可靠。
- **e2e 只挑了「篩選狀態要反映在 URL 且重新整理後還在」跟「停止 Job 的樂觀更新/最終狀態」
  這兩條端到端流程**，因為這兩個是最需要「真的串起瀏覽器網址列 + 真的跟 mock server
  互動」才測得出來的行為，其他邏輯已經被上面的單元測試覆蓋掉了。

## 讓 AI 不再犯同樣的錯

**挑的錯**：`src/api/client.ts` 原本（starter 版本）的 `getJson`/`postJson` 只檢查
`res.ok` 來判斷成功或失敗。但 `mock-server/openapi.yaml` 明確寫「業務邏輯錯誤以 HTTP
200 回傳，`error` 不為 null」（例如對已結束的 Job 呼叫 `/stop`）。只檢查 `res.ok`
會把這種情況誤判成「成功」，拿到的其實是 `null` 資料。

**怎麼發現的**：讀 API 規格時注意到這段敘述，不是等到功能跑起來才發現——但我認為這正是
會一犯再犯的那種錯：`res.ok` 檢查在「正常的」REST API 幾乎都是對的，直覺上很容易照抄
這個 pattern，尤其是之後如果要新增別的 API 呼叫（不管是我自己還是其他 AI 工具接手），
很可能又在新的呼叫點重新手刻一次 `fetch(...).then(r => r.json())`，而忘記這個 API
的這個特例。Part B 要 review 的 `review/batch-stop` 分支就是一個活生生的例子：那支 MR
完全沒處理這件事，導致「批次停止」失敗時使用者會被告知成功（詳見 `REVIEW.md` 的
第 1 點）——這不是我編出來的假設情境，是這份作業裡實際存在、我在 review 時驗證過
會發生的 bug。

**選的機制**：兩層，而不是只選一種：

1. **ESLint 規則**（`eslint.config.js`）：用 `no-restricted-globals` 禁止在
   `src/api/` 以外的地方直接呼叫 `fetch()`，逼所有 API 呼叫都要經過已經處理好這個
   地雷的 `getJson`/`postJson`。這是「擋在犯錯之前」的機制——不管是人還是 AI 要加新的
   API 呼叫，想抄 `fetch(...).then(...)` 這個最直覺的寫法會直接 lint failed，而不是
   等 code review 或測試才發現。
2. **單元測試**（`test/client.test.ts`）：直接模擬「HTTP 200 + `error` 不為 null」
   的回應，斷言 `getJson`/`postJson` 一定要 throw。這是「擋在犯錯之後」的機制——萬一
   以後有人覺得 ESLint 規則太嚴格而放寬它，或者直接改了 `client.ts` 內部的判斷邏輯，
   這個測試會在 `npm run test`（CI 必跑）失敗，而不是要等到真的對一個已結束的 Job
   按下停止才發現。

選兩層而不是只選一層的原因：純粝 lint 規則只能擋「新寫一個 fetch call」這種情況，擋不住
「改錯 `client.ts` 內部邏輯」；純粹測試又是「已經寫錯了才抓到」，不如直接讓錯誤的寫法
在編輯器裡就標紅。兩個一起用，涵蓋的是「寫新程式碼」跟「改現有程式碼」兩種會重犯這個
錯誤的途徑。

## 其他文件

| 檔案                              | 內容                       |
| --------------------------------- | -------------------------- |
| `CLAUDE.md`                       | 給接手這個專案的 AI/新同事看的非顯而易見細節 |
| `docs/adr/`                       | 架構決策紀錄（至少 2 篇，實際寫了 3 篇） |
| `REVIEW.md`                       | Part B：對 `review/batch-stop` 的 review |
| `AI_LOG.md`                       | AI 使用紀錄                |

## Review 題

`review/batch-stop` 分支是 Part B 要 review 的 MR：

```bash
git diff main...review/batch-stop
```

結果見 `REVIEW.md`。
