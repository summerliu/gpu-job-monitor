# 設計稿

用瀏覽器開啟 [`mockups.html`](./mockups.html) 可以看到所有畫面與設計標註。PNG 是同一批畫面的匯出圖，`tokens.json` 是色彩、圓角、字型等設計參數（`src/theme.ts` 已套用）。

| 匯出圖                      | 畫面                                           |
| --------------------------- | ---------------------------------------------- |
| `01-job-list.png`           | Job 列表：篩選列、表格、分頁                   |
| `02-job-list-states.png`    | 列表的載入中、無資料、錯誤狀態                 |
| `03-job-detail.png`         | Job 詳情：基本資訊、GPU 使用率圖表、停止按鈕   |
| `04-job-detail-partial.png` | 詳情頁部分失敗：基本資訊正常、圖表區塊載入失敗 |
| `05-job-logs.png`           | 即時 log：暫停自動捲動、回到最新、連線中斷提示 |
| `06-stop-confirm.png`       | 停止 Job 的確認對話框                          |
| `06-stop-failed.png`        | 停止失敗的通知                                 |
| `07-tablet.png`             | 平板寬度（1024px）版面                         |

設計稿是示意，不要求像素級還原；沒畫到的細節請自行判斷，並在 README 說明。

修改 `mockups.html` 後可用 `node design/export.mjs` 重新匯出 PNG（需先 `npx playwright install chromium`）。
