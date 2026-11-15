import { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    ListItemText,
    Menu,
    MenuItem,
    Select,
    TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import type { JobStatus, Node } from '@/api/types';
import type { JobFilters } from '@/lib/urlParams';
import { hasActiveFilters } from '@/lib/urlParams';
import StatusChip from './StatusChip';

const ALL_STATUSES: JobStatus[] = [
    'PENDING',
    'RUNNING',
    'STOPPING',
    'STOPPED',
    'SUCCEEDED',
    'FAILED',
];
const SEARCH_DEBOUNCE_MS = 400;

interface Props {
    filters: JobFilters;
    nodes: Node[];
    onChange: (next: Partial<JobFilters>) => void;
    onClear: () => void;
}

export default function JobsFilterBar({ filters, nodes, onChange, onClear }: Props) {
    const { t } = useTranslation();
    const [qDraft, setQDraft] = useState(filters.q);
    const [statusMenuAnchor, setStatusMenuAnchor] = useState<HTMLElement | null>(null);

    // 外部的 q 變了（例如「清除篩選」或瀏覽器上一頁）時要同步回草稿。這是在 render
    // 階段直接調整 state，而不是用 effect，依照 React 官方建議的作法。
    const [lastSyncedQ, setLastSyncedQ] = useState(filters.q);
    if (filters.q !== lastSyncedQ) {
        setLastSyncedQ(filters.q);
        setQDraft(filters.q);
    }

    // 搜尋框本地保留一份草稿，debounce 之後才真正更新 URL/觸發 API 呼叫，
    // 否則關鍵字越短 mock server 回得越慢，每打一個字都送一次請求會互相競爭。
    useEffect(() => {
        if (qDraft === filters.q) return;
        const timer = setTimeout(() => onChange({ q: qDraft, page: 1 }), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [qDraft]);

    const addStatus = (status: JobStatus) => {
        onChange({ status: [...filters.status, status], page: 1 });
        setStatusMenuAnchor(null);
    };
    const removeStatus = (status: JobStatus) => {
        onChange({ status: filters.status.filter(s => s !== status), page: 1 });
    };

    const availableStatuses = ALL_STATUSES.filter(s => !filters.status.includes(s));

    return (
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', p: 2 }}>
            <TextField
                size='small'
                placeholder={t('jobs.filters.searchPlaceholder')}
                value={qDraft}
                onChange={e => setQDraft(e.target.value)}
                sx={{ width: 300 }}
            />

            {filters.status.map(status => (
                <Chip
                    key={status}
                    label={t(`jobs.status.${status}`)}
                    onDelete={() => removeStatus(status)}
                    color='primary'
                    variant='outlined'
                    size='small'
                />
            ))}
            {availableStatuses.length > 0 && (
                <>
                    <Chip
                        icon={<AddIcon fontSize='small' />}
                        label={t('jobs.filters.addStatus')}
                        size='small'
                        variant='outlined'
                        onClick={e => setStatusMenuAnchor(e.currentTarget)}
                    />
                    <Menu
                        anchorEl={statusMenuAnchor}
                        open={Boolean(statusMenuAnchor)}
                        onClose={() => setStatusMenuAnchor(null)}
                    >
                        {availableStatuses.map(status => (
                            <MenuItem key={status} onClick={() => addStatus(status)}>
                                <StatusChip status={status} />
                            </MenuItem>
                        ))}
                    </Menu>
                </>
            )}

            <Select
                size='small'
                displayEmpty
                value={filters.node}
                onChange={e => onChange({ node: e.target.value, page: 1 })}
                sx={{ width: 200 }}
            >
                <MenuItem value=''>
                    <ListItemText>{t('jobs.filters.allNodes')}</ListItemText>
                </MenuItem>
                {nodes.map(node => (
                    <MenuItem key={node.name} value={node.name}>
                        {node.displayName}
                    </MenuItem>
                ))}
            </Select>

            <Box sx={{ flex: 1 }} />

            {hasActiveFilters(filters) && (
                <Button size='small' onClick={onClear}>
                    {t('jobs.filters.clear')}
                </Button>
            )}
        </Box>
    );
}
