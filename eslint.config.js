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
        files: ['mock-server/**/*.mjs'],
        extends: [js.configs.recommended, prettier],
        languageOptions: { globals: globals.node },
    },
]);
