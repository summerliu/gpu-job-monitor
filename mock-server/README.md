# mock backend

```bash
npm run mock
```

API 規格見 [openapi.yaml](./openapi.yaml)。

| 環境變數     | 預設   | 說明                                                 |
| ------------ | ------ | ---------------------------------------------------- |
| `MOCK_PORT`  | `4000` | 監聽埠                                               |
| `MOCK_SEED`  | `42`   | 假資料的亂數種子                                     |
| `MOCK_CHAOS` | `1`    | 設為 `0` 關閉偶發錯誤與連線中斷，讓 e2e 測試結果穩定 |

mock backend 的資料只存在記憶體中，重新啟動即重置。
