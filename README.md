# GPU Job Monitor — 前端實作題 starter

題目說明請見我們寄給你的作業文件。這份 README 只說明 starter 本身。

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
| `npm run test:e2e`   | e2e 測試（Playwright，會自動啟動 mock 與 dev server）。第一次請先執行 `npx playwright install chromium` |

## 目錄

| 路徑           | 內容                                          |
| -------------- | --------------------------------------------- |
| `mock-server/` | mock backend 與 API 規格 `openapi.yaml`       |
| `design/`      | 設計稿連結、匯出圖與 design tokens            |
| `src/api/`     | API client 與型別                             |
| `src/pages/`   | 頁面，`JobListPage`、`JobDetailPage` 待你實作 |
| `src/locales/` | 繁體中文與英文翻譯                            |

starter 裡的既有程式碼可以自由修改或重寫。

## Review 題

`review/batch-stop` 分支是 Part B 要 review 的 MR：

```bash
git diff main...review/batch-stop
```
