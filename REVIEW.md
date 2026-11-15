# REVIEW: `review/batch-stop`（Job 列表 + 批次停止）

Review 對象：`git diff main...review/batch-stop`（`src/api/jobs.ts`、`src/pages/JobListPage.tsx`、
`src/components/BatchStopDialog.tsx`、`test/JobListPage.test.tsx`）。

**這份 review 是我（Claude Code）在這個 repo 裡實際跑過程式、讀過 `mock-server/openapi.yaml`
與 `mock-server/server.mjs` 之後寫的**，不是只看 diff 文字猜行為。下面每一條都附上我怎麼驗證
它會在什麼情況下出錯；也有一條我原本以為該列為「必須修正」、查過 git blame 後改列為「建議」
（見 #4），列在這裡是因為覺得這個修正過程本身也值得讓接手的人看到。

---

## 必須修正

### 1. 批次停止失敗時，使用者會被告知「已停止」——因為錯誤被靜靜吞掉了

**`src/pages/JobListPage.tsx:85`**（`await Promise.all(selected.map(id => stopJob(id)))`）
搭配 **`src/api/client.ts:36-39`**（這支 MR 沒有動到，但決定了 `stopJob` 的行為）：

```ts
const body = (await res.json()) as Envelope<T>;
if (!res.ok) throw new HttpError(res.status, body.error?.message ?? res.statusText);
return body.data as T;
```

`mock-server/openapi.yaml` 寫得很清楚：「業務邏輯錯誤以 HTTP 200 回傳，`error` 不為
null」。`/jobs/{id}/stop` 剛好就是這樣設計的端點——`mock-server/server.mjs` 裡
`stopJob()` 對已結束的 Job、或隨機 25%（`CHAOS` 開著時）都會回 `200 { data: null, error: {...} }`。
上面這段 `postJson` 只檢查 `res.ok`，完全沒檢查 `body.error`，所以**這些情況下 `stopJob()`
會正常 resolve（拿到 `null`），不會丟出例外**。

**會在什麼情況下出錯**：使用者選 3 個 Job 按下批次停止，其中 1 個因為 scheduler 沒回應
（mock server 模擬的真實情況）而停止失敗，`handleBatchStop` 的 `try` 區塊完全不會進到
`catch`，使用者看到的是「已停止 3 個 Job」的成功訊息，但實際上有一個 Job 還在跑。
這是整個功能最嚴重的問題：它讓使用者對自己操作的結果有錯誤的信任。

**建議**：`client.ts` 的 `getJson`/`postJson` 應該不管 `res.ok`，只要 `body.error` 不為
null 就要 throw（我在 Part A 的 `src/api/client.ts` 已經這樣修掉了，這支 MR 要 rebase
上去之後，再確認 `handleBatchStop` 真的會對每個失敗的 id 分別處理，而不是整批
`Promise.all` 一個失敗就全部當失敗、或像現在這樣全部吞掉）。

### 2. 樂觀更新沒有失敗復原，而且是先斬後奏

**`src/pages/JobListPage.tsx:79-93`**：

```ts
const handleBatchStop = async () => {
    setJobs(prev =>
        prev.map(j => (selected.includes(j.id) ? { ...j, status: 'STOPPED' as JobStatus } : j))
    );
    try {
        await Promise.all(selected.map(id => stopJob(id)));
        ...
    } catch {
        setMessage({ type: 'error', text: '停止失敗，請稍後再試' });
    } finally {
        setDialogOpen(false);
    }
};
```

即使 #1 被修掉、`stopJob` 開始會正確 throw，這裡的 `catch` 區塊也只顯示一個通用錯誤訊息，
**從來沒有把 `setJobs` 還原回呼叫前的狀態**。題目的設計稿（`06-stop-failed.png`）明確要求
「失敗時狀態還原」。而且這裡把狀態直接設成 `'STOPPED'`，但實際上 API 成功時 Job 會先變成
`STOPPING`、過幾秒才變 `STOPPED`（`mock-server/server.mjs` 的 `stopJob()`），這裡等於是
提前宣告了一個還沒發生的終態；如果使用者在這之後重新整理頁面，畫面上顯示的狀態會跟伺服器
實際狀態不一致一段時間。

**建議**：樂觀更新應該設成 `STOPPING`（跟 Part A 的單一 Job 停止邏輯一致），並在
`catch` 裡把每個「實際失敗」的 job 個別還原回原本的狀態，而不是整批假設全部失敗或全部
成功。

### 3. `dangerouslySetInnerHTML` 直接渲染使用者輸入的 `description`（XSS）

**`src/pages/JobListPage.tsx:169-178`**：

```tsx
<Tooltip
    title={
        <span dangerouslySetInnerHTML={{ __html: job.description }} />
    }
>
```

`mock-server/server.mjs` 的 `DESCRIPTIONS` 陣列裡就放了一筆
`'debug <img src=x onerror="alert(\'xss\')">'` ——不用任何惡意使用者，光是現有的
mock 資料就會在滑鼠移到那筆 Job 名稱上時執行這段 `onerror`。`description` 是
openapi.yaml 明確寫「使用者輸入的純文字」，不應該被當 HTML 解析。我在 Part A 的
`JobDetailPage` 是直接把 `description` 當純文字放進 `<pre>`（保留換行但不解析標籤），
這裡應該比照辦理，不要用 `dangerouslySetInnerHTML`。

**建議**：改成 `<span style={{ whiteSpace: 'pre-wrap' }}>{job.description}</span>`
這類純文字渲染；需要處理換行的話用 CSS 的 `white-space`，不要解析成 HTML。

### 4. 5 秒輪詢用的是掛載當下的 `filters`，使用者改篩選條件後會被輪詢偷偷蓋回去

**`src/pages/JobListPage.tsx:64-69`**：

```ts
useEffect(() => {
    const timer = setInterval(() => load(filters), 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

這個 `useEffect` 的 dependency array 是空的，`filters` 只會是第一次 render 時的值，
之後每次 `setInterval` 觸發的 `load(filters)` 永遠用的是**第一次掛載時**的 filters，
不是使用者目前看到的篩選條件（這就是那行 eslint-disable 想繞過的警告，但繞過的是
一個真實的 bug，不是 false positive）。

> 我一開始把這條列進「必須修正」，後來想確認這是不是這支 MR 自己引入的、還是從 starter
> 繼承來的既有問題，查了一下：`git log -p -- src/pages/JobListPage.tsx` 顯示這整段輪詢
> 邏輯（包含這個 effect）就是這支 MR 第一次加進來的，不是繼承自 starter。所以它確實是
> 這次改動要負責的新 bug，不是「既有程式碼」，維持列在這份 review 裡；只是因為它「會被
> 使用者立刻感受到」而不是「資料損毀」等級，嚴重度上我歸類成建議修正而不是最高優先。

**會在什麼情況下出錯**：使用者在搜尋框打了關鍵字、或切換了狀態篩選，5 秒後輪詢觸發，
列表會悄悄變回「沒有篩選」時的結果，使用者完全不會意識到自己的篩選被蓋掉了，只會覺得
「搜尋怎麼時好時壞」。

**建議**：輪詢的 effect 要把 `filters` 放進 dependency array（或用 `useRef` 存最新的
`filters`，在 interval callback 裡讀 ref 而不是閉包裡的舊值）。

---

## 建議修正

### 5. `key={index}`，不是 `key={job.id}`

**`src/pages/JobListPage.tsx:161-162`**：`{jobs.map((job, index) => (<TableRow key={index} ...>`。

這張表格每 5 秒輪詢一次、排序/篩選條件改變時整批替換 `jobs`，用陣列 index 當 key 在這種
「內容會重新排序/替換」的情境下是典型的 React 反模式：React 會把「第 N 列現在換了不同的
job」誤判成「同一列的 props 變了」，導致 checkbox 的勾選狀態、hover、動畫這些跟 DOM 節點
綁在一起的狀態可能對不上正確的那一列資料。`job.id` 本身就是唯一值，改成
`key={job.id}` 沒有任何代價。

### 6. 搜尋框沒有 debounce，也沒有防止「舊回應蓋掉新回應」

**`src/pages/JobListPage.tsx:103-109`**：`onChange` 直接 `setFilters`，每打一個字就觸發
一次 API 呼叫。`mock-server/server.mjs` 的 `listJobs` 刻意設計成「關鍵字越短，回應越慢」
（見 `openapi.yaml` 的敘述與 server 的延遲公式）。快速輸入時，例如先打 "a" 再打 "ab"，
"a" 那次請求有不小的機率比 "ab" 晚回來，而這裡的 `load()`／`useEffect` 完全沒有依請求
順序取捨，最後蓋在畫面上的可能是比較舊的那次查詢結果。（我在 Part A 的
`src/lib/latestRequest.ts` 專門處理了這個情境，也有對應的單元測試
`test/latestRequest.test.ts` 重現這個 race condition。）

**建議**：搜尋輸入加 debounce（300–400ms），並用遞增的 request id／AbortController
確保只採用最新一次請求的結果。

### 7. 批次停止回報「已停止 N 個」，但其實不知道每一個是不是真的成功

**`src/pages/JobListPage.tsx:85-87`**：`Promise.all` 只要有一個 reject 就整個 catch，
沒有辦法知道「3 個裡面是哪一個失敗、哪兩個成功」；即使 #1 修好、`stopJob` 開始正確
throw，使用者還是只會看到「全部成功」或「全部失敗」兩種訊息，對不上實際上「部分成功」
的情況。

**建議**：用 `Promise.allSettled`，分別統計成功/失敗數量，訊息裡註明「成功 N 個、
失敗 M 個」，並把失敗的那幾個 job 的樂觀更新個別還原。

### 8. 新增的文字全部是寫死的中文，繞過了 `react-i18next`

**`src/pages/JobListPage.tsx`** 裡的 `'搜尋名稱或擁有者'`（106）、`'狀態'`（116）、
`'全部'`（122）、`'停止選取的 Job (...)'`（138）、`'已停止 ... 個 Job'`（86）、
`'停止失敗，請稍後再試'`（89），以及 **`src/components/BatchStopDialog.tsx`** 整個
元件的所有文字，都是字面量中文，沒有用這個專案已經設好的 `useTranslation()`／`t()`。
題目的 Part A 功能需求明確要求「支援繁體中文與英文，切換不需重新整理」；把英文介面
切過去的話，這整個功能會是唯一一塊維持中文的地方。

**建議**：比照這個檔案裡已經存在的 `t('jobs.title')`、`t(\`jobs.status.${s}\`)`
模式，把所有新字串加進 `src/locales/zh-Hant.json` 和 `en.json`。

### 9. 批次停止對話框沒有「處理中」狀態，可以被連點多次

**`src/components/BatchStopDialog.tsx:17-19`**：確認按鈕沒有 `disabled`／loading
狀態，`onConfirm` 是直接呼叫 `handleBatchStop`（一個 async function），在它 resolve
之前使用者可以重複點擊，對同一批 job id 送出多次重複的 stop 請求。Part A 的單一 Job
停止（`StopJobDialog`）有正確處理這件事（`isStopping` 控制 `disabled`），這裡沒有比照。

### 10. 沒有限制只能對可停止的 Job 執行批次停止

`toggleAll`／`toggle`（**`src/pages/JobListPage.tsx:71-77`**）允許勾選任何狀態的
Job，包含已經 `SUCCEEDED`/`FAILED`/`STOPPED` 的。對這些 Job 呼叫 `/stop` 伺服器會回
`INVALID_STATE` 業務錯誤（見 #1，目前這個錯誤還是被吞掉的），就算 #1 修好了，使用者
選了一批混合狀態的 Job 按下停止，也只會在事後才從錯誤訊息知道某幾個「本來就不能停」，
而不是在選取的當下就被告知。Part A 的 Job 詳情頁已經用
`STOPPABLE.has(job.status)` 限制只有 `PENDING`/`RUNNING` 才顯示停止按鈕，這裡應該
比照：對不可停止的 Job disable 它的 checkbox，或至少不把它算進可送出的批次裡。

---

## 小瑕疵

### 11. Tooltip 用 HTML 渲染「純文字」描述，就算拿掉 XSS 疑慮，呈現方式本身也不對

即使把 #3 的 `dangerouslySetInnerHTML` 換成安全的方式，如果是用「解析 HTML」的心智
模型去處理這個欄位，像 `'<b>重要</b> 請勿停止'` 這種 mock 資料就會被渲染成真的粗體，
而不是使用者原本輸入的那串文字。這個欄位應該全程被當成純文字字串處理，從抓資料到
顯示都不應該出現「解析」這個步驟。

### 12. 新增的測試只測了成功路徑，對 #1／#2 這種最危險的 bug 完全沒有覆蓋

`test/JobListPage.test.tsx` 裡 `api.stopJob` 永遠 `mockResolvedValue(...)`，從來
沒有測過「其中一個 stop 失敗」的情境。這份測試目前能通過，給人的錯覺是「批次停止這個
功能是可靠的」，但它完全沒有驗證過這個功能真正關鍵的部分：失敗時使用者會不會被正確
告知、畫面會不會正確還原。

### 13. 全選 checkbox 用數量比對，不是用實際的 id 集合比對

**`src/pages/JobListPage.tsx:148`**：`checked={jobs.length > 0 && selected.length === jobs.length}`。
這張表格每 5 秒會整批替換 `jobs`（輪詢），如果替換後的 `jobs` 跟 `selected` 剛好數量
相同但實際上不是同一批 id，「全選」checkbox 會顯示已勾選，但其實跟畫面上真正被選取的
那些列對不起來。影響層面不大（下一次使用者互動多半會重新同步），所以只列為小瑕疵，
但如果要修，應該比較 id 的集合是否相等，而不是比較長度。

---

## 結論：需要重寫

這份 MR 的 UI 骨架（批次選取 + 確認對話框 + 批次操作按鈕的排版）是可以保留的，不需要
整個丟掉重新設計畫面；但它完全沒有處理這個 API 最重要的一個約定（業務錯誤用 HTTP 200
回傳），導致整個「批次停止」功能唯一的存在理由——讓使用者可靠地知道自己的操作有沒有
成功——目前是不成立的，而且沒有任何測試會告訴你這件事。再加上一個現成資料就能觸發的
XSS，以及一個會讓使用者的篩選條件被輪詢悄悄蓋掉的 bug，這些已經不是「幾行小修正」可以
解決的範圍，而是「重新設計這個功能的請求/狀態更新/錯誤處理邏輯」，所以歸類為需要重寫，
而不是修改後合併。

重寫時建議的順序：先確定 `stopJob` 在 `client.ts` 層就會對業務錯誤正確 throw（而不是
在這支 MR 裡各自處理一次），再重新設計 `handleBatchStop` 用 `Promise.allSettled`
分別處理每個 id 的成功/失敗與對應的樂觀更新還原，之後再補上 i18n、debounce、
key、停止對話框的 loading 狀態、停止權限限制，最後把 #1/#2 的失敗情境補進測試。
