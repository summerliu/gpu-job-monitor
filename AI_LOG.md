# AI_LOG

## 先說一件跟一般 AI_LOG 不一樣的事

這次 Part A/B 的程式、測試、ADR、這份文件本身，都是在同一個 Claude Code session 裡由
我（Claude Code，模型 `claude-sonnet-5`）在拿到題目與 starter repo 後自主完成的，使用者
的指示是「讀題目、把 `gpu-job-monitor/` 完成、開新分支並視情況 commit」，中途只有追加一句
「請以邏輯區塊逐步 commit」。這跟題目原本設想的「人類開發者用 Claude Code 輔助、自己下
prompt、自己驗證」不太一樣——這裡沒有一來一往的 prompt 紀錄可以摘錄。

因此這份文件不假裝有那種對話紀錄，而是誠實記錄：我在沒有人逐步確認的情況下做了哪些判斷、
怎麼驗證自己做的東西是對的、以及過程中真的犯過哪些錯（用 `lint`/`type-check`/`test`/
e2e 的輸出當證據，不是事後編的）。

## 工具與設定

- Claude Code（`claude-sonnet-5`），沒有額外的 MCP server 或自訂 slash command/skill
  接到這個 repo。
- 驗證手段：`npm run lint` / `type-check` / `test` / `test:e2e`，另外用 Playwright
  （既有的 devDependency）寫了幾支一次性腳本手動操作畫面、截圖檢查畫面長相，操作完就刪掉
  （沒有留在 repo 裡）。沒有用瀏覽器擴充套件或互動式 MCP 操作畫面。

## 三個關鍵決策點（取代「prompt 片段」）

因為沒有多輪人類 prompt 可以摘錄，這裡改列三個「如果我隨便做、題目會因此不過關」的
判斷點，以及怎麼決定、怎麼驗證：

1. **Job id 要不要當 `number`？** 讀 `mock-server/server.mjs` 時注意到
   `ID_BASE = 2095791122068779008n`——這個數字遠超過 `Number.MAX_SAFE_INTEGER`，
   而 server 的註解也寫「id 是 int64，以 JSON number 輸出」。如果照 starter 原本的
   `Job.id: number` 寫下去，`JSON.parse` 會默默把尾數四捨五入掉，之後拿這個值打
   `/jobs/{id}` 會打到錯的 job。我在寫任何頁面之前先跑了
   `node -e "console.log(2095791122068779008n > Number.MAX_SAFE_INTEGER)"` 確認
   這不是我多慮，再決定把 `Job.id` 全面改成 `string`，並在 `client.ts` 用 regex
   把裸數字包成字串再丟給 `JSON.parse`。這個決定在寫完 `client.ts` 之後，立刻用
   `test/client.test.ts` 的其中一個 case（故意塞一個超過安全整數範圍的 id）驗證過。
2. **業務錯誤用 HTTP 200 回傳，`client.ts` 要怎麼設計？** `openapi.yaml` 明寫這件事，
   但如果照一般「檢查 `res.ok` 就好」的直覺寫，會剛好漏掉這個案例（事實上 starter
   原本的 `client.ts` 就是這樣寫的）。決定讓 `unwrap()` 不管狀態碼、優先看
   `body.error`，並且用 `eslint` 的 `no-restricted-globals` 把「只能透過 `client.ts`
   呼叫 API」變成強制規則，而不是只在 PR 描述裡提醒人注意（細節見
   `eslint.config.js` 與 `CLAUDE.md`）。
3. **列表要分頁還是虛擬捲動？** 10,000 筆資料、`API` 本身是分頁設計、設計稿畫的也是
   頁碼分頁——這三個線索都指向同一個方向，所以沒有引入 `react-window`/`TanStack
   Virtual`，只有即時 log（數十萬行、存取模式完全不同）才自己寫了簡易的固定列高
   虛擬捲動。完整的取捨比較在 `docs/adr/0001-pagination-not-virtual-scroll-for-the-job-list.md`。

## 真的犯過的錯（用工具輸出當證據）

這五個都是這個 session 裡 `lint`/`type-check`/`test`/e2e 實際擋下來、我再回去修的，
不是回顧性編的：

1. **`eslint-plugin-react-hooks@7` 的 `react-hooks/set-state-in-effect`**：
   `useJobs`/`useJob`/`useJobMetrics`/`useLogStream` 這四個 hook 的「開始 fetch 時
   setState」以及 `JobsFilterBar` 裡「外部 `q` 變了要同步回本地草稿」的 effect，
   都被這條（相對新的）規則擋下來，錯誤訊息是
   `Calling setState synchronously within an effect can trigger cascading renders`。
   **怎麼發現**：`npm run lint` 直接報錯，不是我自己發現的。
   **怎麼修**：資料抓取的四個 hook 把「設定 loading/fetching 狀態」那行用
   `queueMicrotask` 包起來，讓它變成非同步 callback；`JobsFilterBar` 則改用
   React 官方建議的「render 階段直接比較並調整 state」寫法，不用 effect 同步 prop
   變化。兩種修法都記在對應程式碼的註解裡，避免下一次又被同一條規則擋下來時
   不知道為什麼要這樣寫。
2. **i18next 的型別不接受直接丟一個物件當 interpolation 參數**：
   `t('jobDetail.duration', duration)`（`duration` 是 `{ hours, minutes }`）在
   `tsc -b` 時報 `TOptions` 型別不符。**怎麼發現**：`npm run type-check`。
   **怎麼修**：改成明確展開 `t('jobDetail.duration', { hours: duration.hours,
   minutes: duration.minutes })`。
3. **`undici`/Node 版本的工具鏈問題**：第一次跑 `npm run test` 時，vitest 連 worker
   都啟動不了，錯誤是 `TypeError: Cannot read properties of undefined (reading
   'bind')`，發生在 `node_modules/undici/lib/interceptor/decompress.js`。
   **怎麼發現**：不是 lint/type-check 能抓到的，是實際跑測試才炸開；追下去發現
   `jsdom@31` 依賴的 `undici@8.12.4` 在模組載入時無條件呼叫
   `zlib.createZstdDecompress`，但這個 API 在系統裝的 Node 22.12 上不存在（查了
   `node -e "console.log(typeof require('node:zlib').createZstdDecompress)"`
   印出 `undefined` 來確認，再用 `nvm` 切到 Node 23.8 驗證同一份測試在那裡能跑，
   證實問題出在 Node 版本/這個套件版本的組合，不是我的程式碼）。
   **怎麼修**：沒有要求使用者換 Node 版本（README 承諾的是「Node 22 以上」），
   而是去查 undici 的 git history，找到 `8.0.0` 版本對同一段邏輯有做 runtime
   feature 檢查、不會無條件呼叫這個 API，用 `package.json` 的 `overrides` 把
   `undici` 釘住，在 Node 22.12 上重新驗證測試能跑。
4. **Playwright e2e 的一個 strict-mode 衝突**：`jobDetail.spec.ts` 第一版在點擊
   「停止 Job」確認後立刻斷言畫面上有「停止中」文字，結果噴
   `strict mode violation: ... resolved to 2 elements`——MUI `Dialog` 關閉時有
   淡出動畫，對話框自己的內容（裡面也有一份 `StatusChip`）會在 DOM 裡多留一段
   時間，跟主畫面上同時出現兩個「停止中」。**怎麼發現**：`npm run test:e2e`
   的錯誤輸出直接附了兩個匹配到的元素。**怎麼修**：斷言主畫面狀態之前，先
   `await expect(page.getByRole('dialog')).toBeHidden()` 等對話框真的從 DOM
   消失。
5. **同一支 e2e 測試檔裡，篩選後立刻讀表格內容讀到舊資料**：
   `jobFilters.spec.ts` 點了狀態篩選之後馬上用 `allTextContents()` 讀表格，
   拿到的是篩選送出前、畫面還沒換掉的舊資料（`已完成` 而不是預期的
   `執行中`）。**怎麼發現**：測試斷言失敗，印出實際值跟預期值不符。
   **怎麼修**：`allTextContents()` 不會自動重試，改成先用
   `expect(locator.first()).toHaveText(...)`（會自動重試到符合或逾時）等資料
   真的刷新完，再去讀全部內容做後續斷言。

## 我自己判斷「這裡該花比較多心思、不能照 pattern 硬套」的地方

- **Part B 的 `REVIEW.md` 嚴重程度分級與最終結論**：這不是把 diff 丟進去做 pattern
  matching 就能得到合理結果的地方——我刻意去查了 `git log -p` 確認「輪詢用掛載時
  filters」是不是這支 MR 自己引入的問題（結果是），也去讀了 base branch 的
  `client.ts` 確認「業務錯誤被吞掉」具體會在什麼情境下發生（25% chaos 或已結束的
  job），才敢把結論定在「需要重寫」而不是「修改後合併」。
- **三篇 ADR 的「考慮過的替代方案」**：每篇都刻意寫了「如果情境不同，這個決定會怎麼
  反過來」（例如 ADR 0002 提到「資料種類一多，手刻 hook 的邊際成本會輸給 TanStack
  Query」），這是我覺得单純列「選了什麼」沒有意義、一定要連「什麼情況下會選別的」
  一起寫才有參考價值的地方。
- **範圍的刻意取捨**：log 的關鍵字搜尋/等級篩選/下載按鈕、重連提示的「第幾次嘗試」
  這些設計稿有畫但功能需求文字沒有明講要做的細節，決定不做，並且記錄在 README 跟
  CLAUDE.md 裡，而不是悄悄省略不提——這題目明講「做不完沒關係，取捨本身也是評分
  項目」，所以我判斷「清楚講為什麼不做」比「硬是把所有畫面細節都做出來、但核心的
  SSE/樂觀更新/URL 狀態同步沒時間做好」更符合題目想看的東西。

## 加分項

沒有做。沒有另外接 Playwright MCP 讓 AI 自己操作畫面驗證（這次驗證畫面是用一次性
Playwright 腳本手動跑的，不是透過 MCP 讓 AI 在對話中直接操作瀏覽器），也沒有另外寫
一個可重複使用的 AI 指令/skill。如果要做，比較合理的加分項是幫「新增一個 API 端點」
這類重複性工作寫一個 skill，照著 `src/api/client.ts` 的錯誤處理慣例、
`src/hooks/` 的 fetch hook 慣例、以及這份文件裡提到的 int64 id 處理方式去產生
對應的程式碼與測試骨架。
