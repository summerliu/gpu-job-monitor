import { expect, test } from '@playwright/test';

test.describe('job detail', () => {
    test('shows live logs and can stop a running job', async ({ page }) => {
        await page.goto('/jobs?status=RUNNING&pageSize=20');
        await page.locator('table').waitFor();
        await page.locator('table tbody tr').first().getByRole('link').click();
        await expect(page).toHaveURL(/\/jobs\/\d+$/);

        await expect(page.getByRole('button', { name: '停止 Job' })).toBeVisible();

        await page.getByRole('tab', { name: '即時 Log' }).click();
        await expect(page.getByText(/^\d+ 行$/)).toBeVisible();
        await expect
            .poll(async () => {
                const text = await page.getByText(/^\d+ 行$/).textContent();
                return Number(text?.match(/\d+/)?.[0] ?? 0);
            }, { timeout: 5000 })
            .toBeGreaterThan(0);

        await page.getByRole('tab', { name: '總覽' }).click();
        await page.getByRole('button', { name: '停止 Job' }).click();
        await page.getByRole('button', { name: '停止 Job' }).last().click();
        // 對話框關閉的淡出動畫期間，對話框裡跟畫面上都會同時有一份「停止中」的 chip，
        // 等對話框真的從 DOM 消失再去斷言畫面上的狀態，避免 strict-mode 選到兩個元素。
        await expect(page.getByRole('dialog')).toBeHidden();

        // 樂觀更新：還沒等伺服器回應，狀態應該立刻變成「停止中」
        await expect(page.getByText('停止中', { exact: true })).toBeVisible();

        // chaos 關閉時 stop 一定成功；輪詢最終會把狀態同步成「已停止」
        await expect(page.getByText('已停止', { exact: true })).toBeVisible({ timeout: 10_000 });
    });

    test('shows a partial-failure state when GPU metrics are unavailable', async ({ page }) => {
        // mock-server 讓 (id - ID_BASE) % 7 === 3 的 job 的 metrics 永遠回 503，
        // 跟 chaos 開關無關，是用來測「部分失敗」畫面用的固定資料。
        await page.goto('/jobs?q=00003');
        await page.locator('table').waitFor();
        await page.locator('table tbody tr').first().getByRole('link').click();
        await expect(page).toHaveURL(/\/jobs\/\d+$/);

        // 不管圖表有沒有資料，基本資訊一定要照常顯示
        await expect(page.getByText('基本資訊')).toBeVisible();
    });
});
