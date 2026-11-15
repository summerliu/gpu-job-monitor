import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TableSortLabel,
    Tooltip,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { Job } from '@/api/types';
import { relativeTimeParts } from '@/lib/format';
import StatusChip from './StatusChip';

type SortableField = 'name' | 'status' | 'gpuCount' | 'createdAt';
const SORTABLE_FIELDS: SortableField[] = ['name', 'status', 'gpuCount', 'createdAt'];

interface Props {
    jobs: Job[];
    isTablet: boolean;
    sort: string;
    onSortChange: (sort: string) => void;
}

function RelativeOrAbsoluteTime({ iso, relative }: { iso: string; relative: boolean }) {
    const { t } = useTranslation();
    if (!relative) return <>{new Date(iso).toLocaleString()}</>;
    const { unit, value } = relativeTimeParts(iso);
    return <>{t(`time.${unit}Ago`, { count: value })}</>;
}

export default function JobsTable({ jobs, isTablet, sort, onSortChange }: Props) {
    const { t } = useTranslation();
    const [sortField, sortDir] = sort.split(':') as [SortableField, 'asc' | 'desc'];

    const handleSort = (field: SortableField) => {
        if (field === sortField) {
            onSortChange(`${field}:${sortDir === 'asc' ? 'desc' : 'asc'}`);
        } else {
            onSortChange(`${field}:asc`);
        }
    };

    const headerCell = (field: SortableField, label: string) => (
        <TableCell sortDirection={sortField === field ? sortDir : false}>
            {SORTABLE_FIELDS.includes(field) ? (
                <TableSortLabel
                    active={sortField === field}
                    direction={sortField === field ? sortDir : 'asc'}
                    onClick={() => handleSort(field)}
                >
                    {label}
                </TableSortLabel>
            ) : (
                label
            )}
        </TableCell>
    );

    return (
        <Table size='small' stickyHeader>
            <TableHead>
                <TableRow>
                    {headerCell('name', t('jobs.columns.name'))}
                    {headerCell('status', t('jobs.columns.status'))}
                    <TableCell>{t('jobs.columns.node')}</TableCell>
                    {headerCell('gpuCount', t('jobs.columns.gpuCount'))}
                    {!isTablet && <TableCell>{t('jobs.columns.owner')}</TableCell>}
                    {headerCell('createdAt', t('jobs.columns.createdAt'))}
                </TableRow>
            </TableHead>
            <TableBody>
                {jobs.map(job => (
                    <TableRow key={job.id} hover>
                        <TableCell sx={{ maxWidth: 320 }}>
                            <Tooltip title={job.name}>
                                <Typography
                                    component={Link}
                                    to={`/jobs/${job.id}`}
                                    variant='body2'
                                    color='primary'
                                    noWrap
                                    sx={{ display: 'block', textDecoration: 'none' }}
                                >
                                    {job.name}
                                </Typography>
                            </Tooltip>
                        </TableCell>
                        <TableCell>
                            <StatusChip status={job.status} />
                        </TableCell>
                        <TableCell>
                            {job.node ?? (
                                <Typography variant='body2' color='text.disabled'>
                                    {t('jobs.unscheduled')}
                                </Typography>
                            )}
                        </TableCell>
                        <TableCell>{job.gpuCount}</TableCell>
                        {!isTablet && <TableCell>{job.owner}</TableCell>}
                        <TableCell>
                            <RelativeOrAbsoluteTime iso={job.createdAt} relative={isTablet} />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
