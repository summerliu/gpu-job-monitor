import { Alert, Snackbar } from '@mui/material';
import { useNotificationsStore } from '@/store/notifications';

/** 掛在 AppLayout 最外層一次即可；任何地方呼叫 useNotificationsStore().notify() 都會顯示在這裡。 */
export default function NotificationsSnackbar() {
    const queue = useNotificationsStore(state => state.queue);
    const dismiss = useNotificationsStore(state => state.dismiss);
    const current = queue[0];

    return (
        <Snackbar
            key={current?.id}
            open={Boolean(current)}
            autoHideDuration={5000}
            onClose={() => current && dismiss(current.id)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
            {current ? (
                <Alert severity={current.severity} onClose={() => dismiss(current.id)}>
                    {current.message}
                </Alert>
            ) : undefined}
        </Snackbar>
    );
}
