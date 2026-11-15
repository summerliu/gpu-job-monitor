import { useCallback, useEffect, useRef, useState } from 'react';
import { listJobs } from '@/api/jobs';
import { ApiCallError } from '@/api/client';
import type { Job } from '@/api/types';
import type { JobFilters } from '@/lib/urlParams';
import { createLatestRequestGuard } from '@/lib/latestRequest';
import { useNotificationsStore } from '@/store/notifications';
import i18n from '@/i18n';
import { usePageVisible } from './usePageVisible';

const POLL_INTERVAL_MS = 5000;

export type JobsStatus = 'loading' | 'success' | 'error';

export interface UseJobsResult {
    jobs: Job[];
    total: number;
    status: JobsStatus;
    error: ApiCallError | null;
    /** true 的時候代表「目前正在打 API」，不代表沒有資料可顯示（換頁/改篩選時仍保留舊資料）。 */
    isFetching: boolean;
    lastUpdatedAt: number | null;
    refetch: () => void;
}

export function useJobs(filters: JobFilters): UseJobsResult {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [total, setTotal] = useState(0);
    const [status, setStatus] = useState<JobsStatus>('loading');
    const [error, setError] = useState<ApiCallError | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

    const guardRef = useRef(createLatestRequestGuard());
    const hasDataRef = useRef(false);
    const isVisible = usePageVisible();

    const load = useCallback(() => {
        const requestId = guardRef.current.start();
        // setState 延到 microtask 才呼叫，避免 effect 內同步觸發 setState（見 CLAUDE.md）。
        queueMicrotask(() => {
            if (guardRef.current.isCurrent(requestId)) setIsFetching(true);
        });
        listJobs({
            q: filters.q || undefined,
            status: filters.status,
            node: filters.node || undefined,
            sort: filters.sort,
            page: filters.page,
            pageSize: filters.pageSize,
        })
            .then(res => {
                if (!guardRef.current.isCurrent(requestId)) return; // 舊的回應，已經有更新的請求了
                hasDataRef.current = true;
                setJobs(res.items);
                setTotal(res.total);
                setStatus('success');
                setError(null);
                setLastUpdatedAt(Date.now());
            })
            .catch((err: unknown) => {
                if (!guardRef.current.isCurrent(requestId)) return;
                const apiErr =
                    err instanceof ApiCallError
                        ? err
                        : new ApiCallError(0, 'UNKNOWN', (err as Error).message);
                if (hasDataRef.current) {
                    // 已經有資料在畫面上了（例如輪詢失敗）：保留舊資料，只用通知告知使用者。
                    useNotificationsStore
                        .getState()
                        .notify('error', i18n.t('jobs.refreshFailed', { message: apiErr.message }));
                } else {
                    setStatus('error');
                    setError(apiErr);
                }
            })
            .finally(() => {
                if (guardRef.current.isCurrent(requestId)) setIsFetching(false);
            });
    }, [filters.q, filters.status, filters.node, filters.sort, filters.page, filters.pageSize]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!isVisible) return;
        const timer = setInterval(load, POLL_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [isVisible, load]);

    return { jobs, total, status, error, isFetching, lastUpdatedAt, refetch: load };
}
