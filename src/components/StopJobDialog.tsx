import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Stack,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { Job } from '@/api/types';
import StatusChip from './StatusChip';

interface Props {
    job: Job;
    open: boolean;
    isStopping: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export default function StopJobDialog({ job, open, isStopping, onClose, onConfirm }: Props) {
    const { t } = useTranslation();
    return (
        <Dialog open={open} onClose={isStopping ? undefined : onClose}>
            <DialogTitle>{t('jobDetail.stopDialog.title')}</DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>
                    {t('jobDetail.stopDialog.body')}
                </DialogContentText>
                <Stack
                    direction='row'
                    spacing={1.5}
                    alignItems='center'
                    sx={{ bgcolor: 'action.hover', borderRadius: 1, px: 1.5, py: 1 }}
                >
                    <StatusChip status={job.status} />
                    <strong>{job.name}</strong>
                    <span>· {t('jobDetail.gpuCount', { count: job.gpuCount })}</span>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isStopping}>
                    {t('common.cancel')}
                </Button>
                <Button
                    color='error'
                    variant='contained'
                    onClick={onConfirm}
                    disabled={isStopping}
                    autoFocus
                >
                    {isStopping ? t('jobDetail.stopDialog.stopping') : t('jobDetail.stopDialog.confirm')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
