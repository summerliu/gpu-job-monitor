import { createBrowserRouter, Navigate } from 'react-router';
import AppLayout from '@/layouts/AppLayout';
import JobDetailPage from '@/pages/JobDetailPage';
import JobListPage from '@/pages/JobListPage';

export const router = createBrowserRouter([
    {
        path: '/',
        element: <AppLayout />,
        children: [
            { index: true, element: <Navigate to='/jobs' replace /> },
            { path: 'jobs', element: <JobListPage /> },
            { path: 'jobs/:jobId', element: <JobDetailPage /> },
        ],
    },
]);
