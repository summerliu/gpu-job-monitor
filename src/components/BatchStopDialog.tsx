import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

interface Props {
    open: boolean;
    count: number;
    onClose: () => void;
    onConfirm: () => void;
}

export default function BatchStopDialog({ open, count, onClose, onConfirm }: Props) {
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>停止 Job</DialogTitle>
            <DialogContent>確定要停止選取的 {count} 個 Job 嗎？此操作無法復原。</DialogContent>
            <DialogActions>
                <Button onClick={onClose}>取消</Button>
                <Button color='error' variant='contained' onClick={onConfirm}>
                    確定停止
                </Button>
            </DialogActions>
        </Dialog>
    );
}
