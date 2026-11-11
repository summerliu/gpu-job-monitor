# 設計稿

- Figma：**（連結待補）**
- 沒有 Figma 帳號也能完成：本資料夾的 PNG 是每個畫面的匯出圖，`tokens.json` 是色彩、圓角、字型等設計參數（`src/theme.ts` 已套用）。

| 匯出圖                      | 畫面                                                       |
| --------------------------- | ---------------------------------------------------------- |
| `01-job-list.png`           | Job 列表：篩選列、表格、分頁或無限捲動                     |
| `02-job-list-states.png`    | 列表的 loading、empty、error 狀態                          |
| `03-job-detail.png`         | Job 詳情：基本資訊、GPU 使用率圖表、停止按鈕               |
| `04-job-detail-partial.png` | 詳情頁部分失敗：基本資訊正常、圖表區塊載入失敗             |
| `05-job-logs.png`           | 即時 log：自動捲動、暫停時的「回到最新」按鈕、連線中斷提示 |
| `06-stop-confirm.png`       | 停止 Job 的確認對話框與失敗提示                            |
| `07-tablet.png`             | 平板寬度（1024px）版面                                     |
