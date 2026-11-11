import { Typography } from '@mui/material';
import { useParams } from 'react-router';

// TODO: 依設計稿實作 Job 詳情頁、GPU 使用率圖表、停止按鈕與即時 log
export default function JobDetailPage() {
    const { jobId } = useParams();
    return <Typography variant='h5'>Job {jobId}</Typography>;
}
