import { expect, test } from '@playwright/test';

test('app loads the job list page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/jobs$/);
    await expect(page.getByRole('heading', { name: 'Job 列表' })).toBeVisible();
});
