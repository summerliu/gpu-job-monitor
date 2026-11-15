import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as jobsApi from '@/api/jobs';
import type { Job, Paged } from '@/api/types';
import { useJobs } from '@/hooks/useJobs';
import { DEFAULT_FILTERS } from '@/lib/urlParams';

vi.mock('@/api/jobs');

function job(name: string): Job {
    return {
        id: '1',
        name,
        status: 'RUNNING',
        node: 'gpu-node-01',
        gpuCount: 1,
        owner: 'alice',
        description: '',
        createdAt: '2026-01-01T00:00:00Z',
        startedAt: null,
        finishedAt: null,
    };
}

function paged(name: string): Paged<Job> {
    return { items: [job(name)], total: 1, page: 1, pageSize: 50 };
}

describe('useJobs', () => {
    afterEach(() => vi.restoreAllMocks());

    it('ignores a stale response that resolves after a newer request has already landed', async () => {
        // 關鍵字越短，mock server 故意回得越慢：使用者從 "a" 多打一個字變成 "ab" 時，
        // "a" 的那次請求完全可能比 "ab" 還晚回來，必須確保畫面上最後顯示的是最新一次查詢的結果。
        const resolvers: ((value: Paged<Job>) => void)[] = [];
        vi.mocked(jobsApi.listJobs).mockImplementation(
            () => new Promise(resolve => resolvers.push(resolve))
        );

        const { result, rerender, unmount } = renderHook(
            ({ filters }) => useJobs(filters),
            { initialProps: { filters: { ...DEFAULT_FILTERS, q: 'a' } } }
        );

        rerender({ filters: { ...DEFAULT_FILTERS, q: 'ab' } });
        expect(resolvers).toHaveLength(2);

        // 先回來的是比較新的那次請求 (q=ab)
        act(() => resolvers[1](paged('from-ab')));
        await waitFor(() => expect(result.current.status).toBe('success'));
        expect(result.current.jobs[0].name).toBe('from-ab');

        // 舊的請求 (q=a) 比較晚才回來，必須被忽略
        act(() => resolvers[0](paged('from-a')));
        await act(async () => {});
        expect(result.current.jobs[0].name).toBe('from-ab');

        unmount();
    });

    it('keeps showing the last good data when a background refresh fails', async () => {
        vi.mocked(jobsApi.listJobs)
            .mockResolvedValueOnce(paged('ok'))
            .mockRejectedValueOnce(new Error('network down'));

        const { result, rerender, unmount } = renderHook(
            ({ filters }) => useJobs(filters),
            { initialProps: { filters: DEFAULT_FILTERS } }
        );

        await waitFor(() => expect(result.current.status).toBe('success'));
        expect(result.current.jobs[0].name).toBe('ok');

        // 模擬一次輪詢失敗（換個 filters 參照觸發重新抓取，但這裡直接 refetch 更直接）
        await act(async () => result.current.refetch());
        rerender({ filters: DEFAULT_FILTERS });

        expect(result.current.status).toBe('success');
        expect(result.current.jobs[0].name).toBe('ok'); // 資料保留，沒有被清空

        unmount();
    });
});
