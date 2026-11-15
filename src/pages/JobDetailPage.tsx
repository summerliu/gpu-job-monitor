import { useState, type ReactNode } from 'react';
import {
    Box,
    Button,
    Grid,
    IconButton,
    Paper,
    Skeleton,
    Tab,
    Tabs,
    Tooltip,
    Typography,
} from '@mui/material';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import EmptyState from '@/components/EmptyState';
import GpuUtilChart from '@/components/GpuUtilChart';
import LogViewer from '@/components/LogViewer';
import StatusChip from '@/components/StatusChip';
import StopJobDialog from '@/components/StopJobDialog';
import { useJob } from '@/hooks/useJob';
import { useJobMetrics } from '@/hooks/useJobMetrics';
import { useLogStream } from '@/hooks/useLogStream';
import { useNodes } from '@/hooks/useNodes';
import { useNowTick } from '@/hooks/useNowTick';
import { formatDurationParts } from '@/lib/format';
import type { MetricsRange } from '@/api/types';

const STOPPABLE = new Set(['PENDING', 'RUNNING']);

type Tab_ = 'overview' | 'logs';

export default function JobDetailPage() {
    const { t } = useTranslation();
    const { jobId } = useParams<{ jobId: string }>();
    const nodes = useNodes();
    const { job, status, error, isStopping, refetch, stop } = useJob(jobId!);
    const [tab, setTab] = useState<Tab_>('overview');
    const [logsEverVisited, setLogsEverVisited] = useState(false);
    const [stopDialogOpen, setStopDialogOpen] = useState(false);
    const [range, setRange] = useState<MetricsRange>('15m');
    const now = useNowTick(30_000);

    const metrics = useJobMetrics(jobId!, range);
    const logStream = useLogStream(jobId!);

    const selectTab = (next: Tab_) => {
        setTab(next);
        if (next === 'logs') setLogsEverVisited(true);
    };

    if (status === 'error') {
        return (
            <EmptyState
                icon={<ErrorOutlineIcon color='error' sx={{ fontSize: 34 }} />}
                title={t('jobDetail.loadErrorTitle')}
                description={error?.message}
                actionLabel={t('common.retry')}
                onAction={refetch}
            />
        );
    }

    if (!job) {
        return (
            <Box>
                <Skeleton width={200} height={24} sx={{ mb: 2 }} />
                <Skeleton height={48} sx={{ mb: 2 }} />
                <Skeleton height={320} />
            </Box>
        );
    }

    const node = nodes.find(n => n.name === job.node);
    const startedMs = job.startedAt ? Date.parse(job.startedAt) : null;
    const endMs = job.finishedAt ? Date.parse(job.finishedAt) : now;
    const duration = startedMs !== null ? formatDurationParts(startedMs, endMs) : null;

    return (
        <Box>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                <Link to='/jobs'>{t('jobs.title')}</Link> / {job.name}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Typography variant='h5' sx={{ wordBreak: 'break-word' }}>
                    {job.name}
                </Typography>
                <StatusChip status={job.status} />
                <Box sx={{ flex: 1 }} />
                {STOPPABLE.has(job.status) && (
                    <Button
                        variant='outlined'
                        color='error'
                        startIcon={<StopCircleIcon />}
                        disabled={isStopping}
                        onClick={() => setStopDialogOpen(true)}
                    >
                        {isStopping ? t('jobDetail.stopDialog.stopping') : t('jobDetail.stop')}
                    </Button>
                )}
            </Box>

            <Tabs value={tab} onChange={(_, v: Tab_) => selectTab(v)} sx={{ mb: 2 }}>
                <Tab value='overview' label={t('jobDetail.tabs.overview')} />
                <Tab value='logs' label={t('jobDetail.tabs.logs')} />
            </Tabs>

            <Box sx={{ display: tab === 'overview' ? 'block' : 'none' }}>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Paper variant='outlined' sx={{ p: 2.5 }}>
                            <Typography variant='subtitle2' sx={{ mb: 2 }}>
                                {t('jobDetail.info.title')}
                            </Typography>
                            <InfoRow label={t('jobDetail.info.id')}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography variant='body2' fontFamily='monospace'>
                                        {job.id}
                                    </Typography>
                                    <Tooltip title={t('jobDetail.info.copy')}>
                                        <IconButton
                                            size='small'
                                            onClick={() => navigator.clipboard?.writeText(job.id)}
                                        >
                                            <ContentCopyIcon fontSize='inherit' />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </InfoRow>
                            <InfoRow label={t('jobDetail.info.node')}>
                                {job.node ? (
                                    <>
                                        {job.node}
                                        {node ? ` · ${node.gpuModel}` : ''}
                                    </>
                                ) : (
                                    t('jobs.unscheduled')
                                )}
                            </InfoRow>
                            <InfoRow label={t('jobDetail.info.gpuCount')}>{job.gpuCount}</InfoRow>
                            <InfoRow label={t('jobDetail.info.owner')}>{job.owner}</InfoRow>
                            <InfoRow label={t('jobDetail.info.createdAt')}>
                                {new Date(job.createdAt).toLocaleString()}
                            </InfoRow>
                            <InfoRow label={t('jobDetail.info.startedAt')}>
                                {job.startedAt ? new Date(job.startedAt).toLocaleString() : '—'}
                            </InfoRow>
                            {duration && (
                                <InfoRow label={t('jobDetail.info.duration')}>
                                    {t('jobDetail.duration', {
                                        hours: duration.hours,
                                        minutes: duration.minutes,
                                    })}
                                </InfoRow>
                            )}
                            <InfoRow label={t('jobDetail.info.description')}>
                                {job.description ? (
                                    <Box
                                        component='pre'
                                        sx={{
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            fontFamily: 'inherit',
                                            fontSize: 'inherit',
                                            bgcolor: 'action.hover',
                                            borderRadius: 1,
                                            p: 1,
                                            m: 0,
                                        }}
                                    >
                                        {job.description}
                                    </Box>
                                ) : (
                                    '—'
                                )}
                            </InfoRow>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 8 }}>
                        <Paper variant='outlined' sx={{ p: 2.5 }}>
                            <Typography variant='subtitle2' sx={{ mb: 1 }}>
                                {t('jobDetail.chart.title')}
                            </Typography>
                            {job.status === 'PENDING' ? (
                                <EmptyState
                                    icon={<HourglassEmptyIcon color='disabled' sx={{ fontSize: 30 }} />}
                                    title={t('jobDetail.chart.pendingTitle')}
                                    minHeight={300}
                                />
                            ) : metrics.status === 'loading' ? (
                                <Skeleton height={360} />
                            ) : metrics.status === 'error' ? (
                                <EmptyState
                                    icon={<WarningAmberIcon color='warning' sx={{ fontSize: 30 }} />}
                                    title={t('jobDetail.chart.unavailableTitle')}
                                    description={t('jobDetail.chart.unavailableBody')}
                                    actionLabel={t('common.retry')}
                                    onAction={metrics.refetch}
                                    minHeight={300}
                                />
                            ) : metrics.metrics ? (
                                <GpuUtilChart metrics={metrics.metrics} range={range} onRangeChange={setRange} />
                            ) : null}
                        </Paper>
                    </Grid>
                </Grid>
            </Box>

            {logsEverVisited && (
                <Box sx={{ display: tab === 'logs' ? 'block' : 'none' }}>
                    <LogViewer lines={logStream.lines} connectionState={logStream.connectionState} />
                </Box>
            )}

            <StopJobDialog
                job={job}
                open={stopDialogOpen}
                isStopping={isStopping}
                onClose={() => setStopDialogOpen(false)}
                onConfirm={() => {
                    setStopDialogOpen(false);
                    void stop();
                }}
            />
        </Box>
    );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 1, mb: 1.5, fontSize: 14 }}>
            <Typography variant='body2' color='text.secondary'>
                {label}
            </Typography>
            <Box sx={{ wordBreak: 'break-word' }}>{children}</Box>
        </Box>
    );
}
