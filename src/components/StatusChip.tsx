import { Chip, type ChipProps } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { JobStatus } from '@/api/types';

const COLOR: Record<JobStatus, ChipProps['color']> = {
    PENDING: 'default',
    RUNNING: 'primary',
    STOPPING: 'warning',
    STOPPED: 'default',
    SUCCEEDED: 'success',
    FAILED: 'error',
};

export default function StatusChip({ status }: { status: JobStatus }) {
    const { t } = useTranslation();
    return <Chip size='small' color={COLOR[status]} label={t(`jobs.status.${status}`)} />;
}
