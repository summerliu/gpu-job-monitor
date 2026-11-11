import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: [
        {
            command: 'npm run mock',
            url: 'http://localhost:4000/api/v1/nodes',
            env: { MOCK_CHAOS: '0' },
            reuseExistingServer: !process.env.CI,
        },
        {
            command: 'npm run dev',
            url: 'http://localhost:5173',
            reuseExistingServer: !process.env.CI,
        },
    ],
});
