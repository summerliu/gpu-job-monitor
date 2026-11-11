import { createTheme } from '@mui/material';

// 數值與 design/tokens.json 一致
export const theme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#3b5bdb' },
        secondary: { main: '#0ca678' },
        error: { main: '#e03131' },
        warning: { main: '#f08c00' },
        background: { default: '#f5f6f8', paper: '#ffffff' },
    },
    shape: { borderRadius: 8 },
    typography: {
        fontFamily: '"Inter", "Noto Sans TC", system-ui, sans-serif',
    },
});
