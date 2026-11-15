import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as jobsApi from '@/api/jobs';
import { ApiCallError } from '@/api/client';
import type { Job } from '@/api/types';
import { useJob } from '@/hooks/useJob';
import { useNotificationsStore } from '@/store/notifications';

vi.mock('@/api/jobs');

function runningJob(): Job {
    return {
        id: '42',
        name: 'llama3-finetune',
        status: 'RUNNING',
        node: 'gpu-node-01',
        gpuCount: 4,
        owner: 'bob',
        description: '',
        createdAt: '2026-01-01T00:00:00Z',
        startedAt: '2026-01-01T00:01:00Z',
        finishedAt: null,
    };
}

describe('useJob stop()', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        useNotificationsStore.setState({ queue: [] });
    });

    it('optimistically shows STOPPING, then rolls back and notifies on failure', async () => {
        vi.mocked(jobsApi.getJob).mockResolvedValue(runningJob());
        let rejectStop!: (err: unknown) => void;
        vi.mocked(jobsApi.stopJob).mockReturnValue(
            new Promise((_, reject) => (rejectStop = reject))
        );

        const { result, unmount } = renderHook(() => useJob('42'));
        await waitFor(() => expect(result.current.job?.status).toBe('RUNNING'));

        act(() => {
            void result.current.stop();
        });
        // 樂觀更新：還沒等 API 回應，畫面應該已經顯示停止中
        expect(result.current.job?.status).toBe('STOPPING');
        expect(result.current.isStopping).toBe(true);

        await act(async () => rejectStop(new ApiCallError(200, 'STOP_FAILED', 'scheduler timeout')));

        expect(result.current.job?.status).toBe('RUNNING'); // 還原
        expect(result.current.isStopping).toBe(false);
        expect(useNotificationsStore.getState().queue.at(-1)?.severity).toBe('error');

        unmount();
    });

    it('keeps the server-returned job (e.g. STOPPING) on success', async () => {
        vi.mocked(jobsApi.getJob).mockResolvedValue(runningJob());
        vi.mocked(jobsApi.stopJob).mockResolvedValue({ ...runningJob(), status: 'STOPPING' });

        const { result, unmount } = renderHook(() => useJob('42'));
        await waitFor(() => expect(result.current.job?.status).toBe('RUNNING'));

        await act(async () => result.current.stop());

        expect(result.current.job?.status).toBe('STOPPING');
        expect(result.current.isStopping).toBe(false);
        expect(useNotificationsStore.getState().queue.at(-1)?.severity).toBe('success');

        unmount();
    });
});
