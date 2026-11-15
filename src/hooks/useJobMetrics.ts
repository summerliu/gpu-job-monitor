import { useCallback, useEffect, useRef, useState } from 'react';
import { getJobMetrics } from '@/api/jobs';
import { ApiCallError } from '@/api/client';
import type { JobMetrics, MetricsRange } from '@/api/types';
import { createLatestRequestGuard } from '@/lib/latestRequest';

export type MetricsStatus = 'loading' | 'success' | 'error';

export interface UseJobMetricsResult {
    metrics: JobMetrics | null;
    status: MetricsStatus;
    error: ApiCallError | null;
    refetch: () => void;
}

/**
 * metrics 是獨立的監控服務，可用性比 Job API 低（見 openapi.yaml），
 * 所以用自己的 loading/error 狀態，失敗時不影響頁面其他部分。
 */
export function useJobMetrics(jobId: string, range: MetricsRange): UseJobMetricsResult {
    const [metrics, setMetrics] = useState<JobMetrics | null>(null);
    const [status, setStatus] = useState<MetricsStatus>('loading');
    const [error, setError] = useState<ApiCallError | null>(null);
    const guardRef = useRef(createLatestRequestGuard());

    const load = useCallback(() => {
        const requestId = guardRef.current.start();
        // setState 延到 microtask 才呼叫，避免 effect 內同步觸發 setState（見 CLAUDE.md）。
        queueMicrotask(() => {
            if (guardRef.current.isCurrent(requestId)) setStatus('loading');
        });
        getJobMetrics(jobId, range)
            .then(result => {
                if (!guardRef.current.isCurrent(requestId)) return;
                setMetrics(result);
                setStatus('success');
                setError(null);
            })
            .catch((err: unknown) => {
                if (!guardRef.current.isCurrent(requestId)) return;
                setStatus('error');
                setError(
                    err instanceof ApiCallError ? err : new ApiCallError(0, 'UNKNOWN', String(err))
                );
            });
    }, [jobId, range]);

    useEffect(() => {
        load();
    }, [load]);

    return { metrics, status, error, refetch: load };
}
