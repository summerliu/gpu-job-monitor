import { render, screen } from '@testing-library/react';
import StatusChip from '@/components/StatusChip';

describe('StatusChip', () => {
    it('shows the translated status', () => {
        render(<StatusChip status='RUNNING' />);
        expect(screen.getByText('執行中')).toBeInTheDocument();
    });
});
