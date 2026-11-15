import { expect, test } from '@playwright/test';

test.describe('job list filters', () => {
    test('status filter is reflected in the URL and survives a reload', async ({ page }) => {
        await page.goto('/jobs');
        await page.locator('table').waitFor();

        await page.getByTestId('add-status-filter').click();
        await page.getByRole('menuitem', { name: '執行中' }).click();

        await expect(page).toHaveURL(/status=RUNNING/);
        // 篩選後表格裡每一列狀態都應該是「執行中」；用 toHaveText 等到重新抓取完成再讀內容，
        // 不然可能讀到篩選送出前、畫面上還沒換掉的舊資料。
        const statusCells = page.locator('table tbody tr td:nth-child(2)');
        await expect(statusCells.first()).toHaveText('執行中');
        for (const s of await statusCells.allTextContents()) expect(s).toBe('執行中');

        await page.reload();
        await page.locator('table').waitFor();
        await expect(page).toHaveURL(/status=RUNNING/);
        await expect(statusCells.first()).toHaveText('執行中');

        await page.getByRole('button', { name: '清除篩選' }).click();
        await expect(page).not.toHaveURL(/status=RUNNING/);
    });

    test('searching resets to page 1 and filters by name/owner', async ({ page }) => {
        await page.goto('/jobs?page=3');
        await page.locator('table').waitFor();

        await page.getByPlaceholder('搜尋名稱或擁有者').fill('llama3');
        await expect(page).toHaveURL(/q=llama3/, { timeout: 2000 });
        await expect(page).not.toHaveURL(/page=3/);

        const nameCells = page.locator('table tbody tr td:first-child');
        await expect(nameCells.first()).toContainText('llama3', { ignoreCase: true, timeout: 5000 });
        for (const name of await nameCells.allTextContents()) {
            expect(name.toLowerCase()).toContain('llama3');
        }
    });
});
