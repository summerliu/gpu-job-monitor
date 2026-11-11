import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

// TODO: 依設計稿實作 Job 列表（見 README「Part A」）
export default function JobListPage() {
    const { t } = useTranslation();
    return <Typography variant='h5'>{t('jobs.title')}</Typography>;
}
