import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import { globalIgnores } from 'eslint/config';

export default tseslint.config([
    globalIgnores(['dist', 'node_modules', 'test-results', 'playwright-report']),
    {
        files: ['**/*.{ts,tsx}'],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
            reactHooks.configs.flat['recommended-latest'],
            reactRefresh.configs.vite,
            prettier,
        ],
        languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    },
    {
        // 只有 src/api/client.ts 可以直接呼叫 fetch()。這支 API 刻意回傳「業務錯誤用
        // HTTP 200 + error 欄位」且「id 是超過 Number.MAX_SAFE_INTEGER 的 int64」，兩者
        // 都不是直接用 fetch + res.json() 看得出來的，client.ts 已經把這兩個處理掉了。
        // 在別處重新手刻一個 fetch call，很容易又把這兩個 bug 生出來一次。
        files: ['src/**/*.{ts,tsx}'],
        ignores: ['src/api/**'],
        rules: {
            'no-restricted-globals': [
                'error',
                {
                    name: 'fetch',
                    message:
                        '請改用 src/api/client.ts 的 getJson/postJson，不要直接呼叫 fetch()。' +
                        '原因見 client.ts 開頭的註解與 CLAUDE.md。',
                },
            ],
        },
    },
    {
        files: ['mock-server/**/*.mjs'],
        extends: [js.configs.recommended, prettier],
        languageOptions: { globals: globals.node },
    },
]);
