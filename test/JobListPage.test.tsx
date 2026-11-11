import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import * as api from '@/api/jobs';
import type { Job } from '@/api/types';
import JobListPage from '@/pages/JobListPage';

vi.mock('@/api/jobs');

const job = (id: number, name: string): Job => ({
    id,
    name,
    status: 'RUNNING',
    node: 'gpu-node-01',
    gpuCount: 1,
    owner: 'alice',
    description: '',
    createdAt: '2026-01-01T00:00:00Z',
    startedAt: null,
    finishedAt: null,
});

describe('JobListPage batch stop', () => {
    beforeEach(() => {
        vi.mocked(api.listJobs).mockResolvedValue({
            items: [job(1, 'job-a'), job(2, 'job-b')],
            total: 2,
            page: 1,
            pageSize: 50,
        });
        vi.mocked(api.stopJob).mockResolvedValue(job(1, 'job-a'));
    });

    it('stops the selected jobs', async () => {
        render(
            <MemoryRouter>
                <JobListPage />
            </MemoryRouter>
        );
        await screen.findByText('job-a');

        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[1]);
        fireEvent.click(checkboxes[2]);
        fireEvent.click(screen.getByText(/停止選取的 Job/));
        fireEvent.click(screen.getByText('確定停止'));

        await waitFor(() => expect(api.stopJob).toHaveBeenCalledTimes(2));
        expect(await screen.findByText('已停止 2 個 Job')).toBeInTheDocument();
    });
});
