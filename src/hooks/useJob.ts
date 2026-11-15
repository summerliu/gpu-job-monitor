import { useCallback, useEffect, useRef, useState } from 'react';
import { getJob, stopJob as stopJobApi } from '@/api/jobs';
import { ApiCallError } from '@/api/client';
import type { Job } from '@/api/types';
import { createLatestRequestGuard } from '@/lib/latestRequest';
import { useNotificationsStore } from '@/store/notifications';
import i18n from '@/i18n';
import { usePageVisible } from './usePageVisible';

const POLL_INTERVAL_MS = 5000;

export type JobStatusState = 'loading' | 'success' | 'error';

export interface UseJobResult {
    job: Job | null;
    status: JobStatusState;
    error: ApiCallError | null;
    isFetching: boolean;
    isStopping: boolean;
    refetch: () => void;
    stop: () => Promise<void>;
}

export function useJob(jobId: string): UseJobResult {
    const [job, setJob] = useState<Job | null>(null);
    const [status, setStatus] = useState<JobStatusState>('loading');
    const [error, setError] = useState<ApiCallError | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [isStopping, setIsStopping] = useState(false);

    const guardRef = useRef(createLatestRequestGuard());
    const isStoppingRef = useRef(false);
    const isVisible = usePageVisible();

    const load = useCallback(() => {
        const requestId = guardRef.current.start();
        // setState 延到 microtask 才呼叫，避免 effect 內同步觸發 setState（見 CLAUDE.md）。
        queueMicrotask(() => {
            if (guardRef.current.isCurrent(requestId)) setIsFetching(true);
        });
        getJob(jobId)
            .then(result => {
                if (!guardRef.current.isCurrent(requestId)) return;
                // 停止請求還在飛行中：不要讓這次輪詢把畫面上剛設的「停止中」蓋回原狀態。
                if (isStoppingRef.current) return;
                setJob(result);
                setStatus('success');
                setError(null);
            })
            .catch((err: unknown) => {
                if (!guardRef.current.isCurrent(requestId)) return;
                const apiErr =
                    err instanceof ApiCallError
                        ? err
                        : new ApiCallError(0, 'UNKNOWN', (err as Error).message);
                if (job) {
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
        // eslint-disable-next-line react-hooks/exhaustive-deps -- job 只用來判斷「是否已有資料」，不應觸發重新建立 load
    }, [jobId]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!isVisible) return;
        const timer = setInterval(load, POLL_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [isVisible, load]);

    const stop = useCallback(async () => {
        if (!job) return;
        const previous = job;
        isStoppingRef.current = true;
        setIsStopping(true);
        // 樂觀更新：使用者立即看到「停止中」，失敗時整個還原。
        setJob({ ...previous, status: 'STOPPING' });
        try {
            const updated = await stopJobApi(previous.id);
            setJob(updated);
            useNotificationsStore.getState().notify('success', i18n.t('jobDetail.stopSucceeded'));
        } catch (err) {
            setJob(previous);
            const message = err instanceof ApiCallError ? err.message : (err as Error).message;
            useNotificationsStore
                .getState()
                .notify('error', i18n.t('jobDetail.stopFailed', { message }));
        } finally {
            isStoppingRef.current = false;
            setIsStopping(false);
        }
    }, [job]);

    return { job, status, error, isFetching, isStopping, refetch: load, stop };
}
