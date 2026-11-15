/**
 * 保護against「慢的舊請求晚回來蓋掉快的新請求」的常見 race condition。
 * 例如列表搜尋：關鍵字越短，mock server 故意回得越慢，使用者快速輸入時
 * 先送出的請求可能比後送出的晚回來。
 */
export function createLatestRequestGuard() {
    let currentId = 0;
    return {
        start(): number {
            currentId += 1;
            return currentId;
        },
        isCurrent(id: number): boolean {
            return id === currentId;
        },
    };
}

export type LatestRequestGuard = ReturnType<typeof createLatestRequestGuard>;
