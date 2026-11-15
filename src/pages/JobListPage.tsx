import { useMemo } from 'react';
import {
    Box,
    LinearProgress,
    Paper,
    Skeleton,
    TablePagination,
    Typography,
    useMediaQuery,
} from '@mui/material';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InboxIcon from '@mui/icons-material/Inbox';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import EmptyState from '@/components/EmptyState';
import JobsFilterBar from '@/components/JobsFilterBar';
import JobsTable from '@/components/JobsTable';
import { useJobs } from '@/hooks/useJobs';
import { useNodes } from '@/hooks/useNodes';
import { useNowTick } from '@/hooks/useNowTick';
import { relativeTimeParts } from '@/lib/format';
import { DEFAULT_FILTERS, filtersToSearchParams, hasActiveFilters, parseFilters } from '@/lib/urlParams';

const TABLET_BREAKPOINT = '(max-width:1024px)';

function LiveIndicator({ lastUpdatedAt }: { lastUpdatedAt: number | null }) {
    const { t } = useTranslation();
    useNowTick(1000);

    if (!lastUpdatedAt) return null;
    const { unit, value } = relativeTimeParts(new Date(lastUpdatedAt).toISOString());
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
            <Box
                sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'secondary.main',
                    boxShadow: '0 0 0 4px rgba(12,166,120,.18)',
                }}
            />
            <Typography variant='caption'>
                {t('jobs.liveUpdatedAgo', { time: t(`time.${unit}Ago`, { count: value }) })}
            </Typography>
        </Box>
    );
}

export default function JobListPage() {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const isTablet = useMediaQuery(TABLET_BREAKPOINT);
    const nodes = useNodes();

    const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
    const { jobs, total, status, isFetching, lastUpdatedAt, refetch } = useJobs(filters);

    const updateFilters = (patch: Partial<typeof filters>) => {
        setSearchParams(filtersToSearchParams({ ...filters, ...patch }));
    };
    const clearFilters = () =>
        setSearchParams(filtersToSearchParams({ ...DEFAULT_FILTERS, sort: filters.sort }));

    const showSkeleton = status === 'loading';
    const showFullError = status === 'error';
    const showEmpty = status === 'success' && jobs.length === 0;

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 2 }}>
                <Typography variant='h5'>{t('jobs.title')}</Typography>
                {status === 'success' && (
                    <Typography variant='body2' color='text.secondary'>
                        {t('jobs.total', { count: total })}
                    </Typography>
                )}
                <Box sx={{ flex: 1 }} />
                <LiveIndicator lastUpdatedAt={lastUpdatedAt} />
            </Box>

            <Paper variant='outlined'>
                <JobsFilterBar filters={filters} nodes={nodes} onChange={updateFilters} onClear={clearFilters} />

                <Box sx={{ height: 3 }}>
                    {isFetching && !showSkeleton && <LinearProgress sx={{ height: 3 }} />}
                </Box>

                {showFullError ? (
                    <EmptyState
                        icon={<ErrorOutlineIcon color='error' sx={{ fontSize: 34 }} />}
                        title={t('jobs.loadErrorTitle')}
                        description={t('jobs.loadErrorBody')}
                        actionLabel={t('common.retry')}
                        onAction={refetch}
                    />
                ) : showSkeleton ? (
                    <Box sx={{ p: 2 }}>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton key={i} height={40} sx={{ my: 0.5 }} />
                        ))}
                    </Box>
                ) : showEmpty ? (
                    hasActiveFilters(filters) ? (
                        <EmptyState
                            icon={<SearchOffIcon color='primary' sx={{ fontSize: 34 }} />}
                            title={t('jobs.noResultsTitle')}
                            description={t('jobs.noResultsBody')}
                            actionLabel={t('jobs.filters.clear')}
                            onAction={clearFilters}
                        />
                    ) : (
                        <EmptyState
                            icon={<InboxIcon color='disabled' sx={{ fontSize: 34 }} />}
                            title={t('jobs.noDataTitle')}
                            description={t('jobs.noDataBody')}
                        />
                    )
                ) : (
                    <>
                        <Box sx={{ overflowX: 'auto' }}>
                            <JobsTable
                                jobs={jobs}
                                isTablet={isTablet}
                                sort={filters.sort}
                                onSortChange={sort => updateFilters({ sort, page: 1 })}
                            />
                        </Box>
                        <TablePagination
                            component='div'
                            count={total}
                            page={filters.page - 1}
                            rowsPerPage={filters.pageSize}
                            rowsPerPageOptions={[20, 50, 100]}
                            onPageChange={(_, page) => updateFilters({ page: page + 1 })}
                            onRowsPerPageChange={e =>
                                updateFilters({ pageSize: Number(e.target.value), page: 1 })
                            }
                        />
                    </>
                )}
            </Paper>
        </Box>
    );
}
