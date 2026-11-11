import { useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Grid,
    MenuItem,
    Snackbar,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { listJobs, stopJob } from '@/api/jobs';
import type { Job, JobStatus } from '@/api/types';
import BatchStopDialog from '@/components/BatchStopDialog';
import StatusChip from '@/components/StatusChip';

const STATUSES: JobStatus[] = ['PENDING', 'RUNNING', 'STOPPING', 'STOPPED', 'SUCCEEDED', 'FAILED'];

interface Filters {
    q: string;
    status: JobStatus | '';
    page: number;
    pageSize: number;
}

export default function JobListPage() {
    const { t } = useTranslation();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [total, setTotal] = useState(0);
    const [filters, setFilters] = useState<Filters>({ q: '', status: '', page: 0, pageSize: 50 });
    const [selected, setSelected] = useState<number[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
        null
    );

    const load = (f: Filters) =>
        listJobs({
            q: f.q,
            status: f.status ? [f.status] : undefined,
            page: f.page + 1,
            pageSize: f.pageSize,
        })
            .then(res => {
                setJobs(res.items);
                setTotal(res.total);
            })
            .catch(err => setMessage({ type: 'error', text: (err as Error).message }));

    useEffect(() => {
        load(filters);
    }, [filters]);

    // 每 5 秒自動更新狀態
    useEffect(() => {
        const timer = setInterval(() => load(filters), 5000);
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggle = (id: number) => {
        setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
    };

    const toggleAll = () => {
        setSelected(selected.length === jobs.length ? [] : jobs.map(j => j.id));
    };

    const handleBatchStop = async () => {
        // 先更新畫面，讓使用者立即看到結果
        setJobs(prev =>
            prev.map(j => (selected.includes(j.id) ? { ...j, status: 'STOPPED' as JobStatus } : j))
        );
        try {
            await Promise.all(selected.map(id => stopJob(id)));
            setMessage({ type: 'success', text: `已停止 ${selected.length} 個 Job` });
            setSelected([]);
        } catch {
            setMessage({ type: 'error', text: '停止失敗，請稍後再試' });
        } finally {
            setDialogOpen(false);
        }
    };

    return (
        <Box>
            <Typography variant='h5' sx={{ mb: 2 }}>
                {t('jobs.title')}
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                        fullWidth
                        size='small'
                        placeholder='搜尋名稱或擁有者'
                        value={filters.q}
                        onChange={e => setFilters({ ...filters, q: e.target.value, page: 0 })}
                    />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                    <TextField
                        select
                        fullWidth
                        size='small'
                        label='狀態'
                        value={filters.status}
                        onChange={e =>
                            setFilters({ ...filters, status: e.target.value as JobStatus, page: 0 })
                        }
                    >
                        <MenuItem value=''>全部</MenuItem>
                        {STATUSES.map(s => (
                            <MenuItem key={s} value={s}>
                                {t(`jobs.status.${s}`)}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                    <Button
                        fullWidth
                        variant='contained'
                        color='error'
                        disabled={selected.length === 0}
                        onClick={() => setDialogOpen(true)}
                    >
                        停止選取的 Job ({selected.length})
                    </Button>
                </Grid>
            </Grid>

            <Table size='small'>
                <TableHead>
                    <TableRow>
                        <TableCell padding='checkbox'>
                            <Checkbox
                                checked={jobs.length > 0 && selected.length === jobs.length}
                                onChange={toggleAll}
                            />
                        </TableCell>
                        <TableCell>名稱</TableCell>
                        <TableCell>狀態</TableCell>
                        <TableCell>節點</TableCell>
                        <TableCell>GPU</TableCell>
                        <TableCell>擁有者</TableCell>
                        <TableCell>建立時間</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {jobs.map((job, index) => (
                        <TableRow key={index} hover>
                            <TableCell padding='checkbox'>
                                <Checkbox
                                    checked={selected.includes(job.id)}
                                    onChange={() => toggle(job.id)}
                                />
                            </TableCell>
                            <TableCell>
                                <Tooltip
                                    title={
                                        <span
                                            dangerouslySetInnerHTML={{ __html: job.description }}
                                        />
                                    }
                                >
                                    <Link to={`/jobs/${job.id}`}>{job.name}</Link>
                                </Tooltip>
                            </TableCell>
                            <TableCell>
                                <StatusChip status={job.status} />
                            </TableCell>
                            <TableCell>{job.node}</TableCell>
                            <TableCell>{job.gpuCount}</TableCell>
                            <TableCell>{job.owner}</TableCell>
                            <TableCell>{new Date(job.createdAt).toLocaleString()}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <TablePagination
                component='div'
                count={total}
                page={filters.page}
                rowsPerPage={filters.pageSize}
                rowsPerPageOptions={[20, 50, 100]}
                onPageChange={(_, page) => setFilters({ ...filters, page })}
                onRowsPerPageChange={e =>
                    setFilters({ ...filters, pageSize: Number(e.target.value), page: 0 })
                }
            />

            <BatchStopDialog
                open={dialogOpen}
                count={selected.length}
                onClose={() => setDialogOpen(false)}
                onConfirm={handleBatchStop}
            />
            <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage(null)}>
                <Alert severity={message?.type}>{message?.text}</Alert>
            </Snackbar>
        </Box>
    );
}
