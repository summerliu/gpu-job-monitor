import { AppBar, Box, Container, MenuItem, Select, Toolbar, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import NotificationsSnackbar from '@/components/NotificationsSnackbar';

export default function AppLayout() {
    const { t, i18n } = useTranslation();

    return (
        <Box sx={{ minHeight: '100vh' }}>
            <AppBar position='static' elevation={0}>
                <Toolbar sx={{ gap: 2 }}>
                    <Typography variant='h6' sx={{ flexGrow: 1 }}>
                        {t('app.title')}
                    </Typography>
                    <Select
                        size='small'
                        value={i18n.language}
                        onChange={e => i18n.changeLanguage(e.target.value)}
                        aria-label={t('app.language')}
                        sx={{ color: 'inherit', '.MuiOutlinedInput-notchedOutline': { border: 0 } }}
                    >
                        <MenuItem value='zh-Hant'>繁體中文</MenuItem>
                        <MenuItem value='en'>English</MenuItem>
                    </Select>
                </Toolbar>
            </AppBar>
            <Container maxWidth='xl' sx={{ py: 3 }}>
                <Outlet />
            </Container>
            <NotificationsSnackbar />
        </Box>
    );
}
