import { Box, Button, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface Props {
    icon: ReactNode;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    minHeight?: number | string;
}

/** 共用的空狀態畫面：無資料、篩選後無結果、載入失敗都用這個，差別只在 icon/文字/按鈕。 */
export default function EmptyState({
    icon,
    title,
    description,
    actionLabel,
    onAction,
    minHeight = 360,
}: Props) {
    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: 1.25,
                p: 5,
                minHeight,
            }}
        >
            <Box
                sx={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    mb: 0.5,
                    bgcolor: 'action.hover',
                }}
            >
                {icon}
            </Box>
            <Typography variant='subtitle1' fontWeight={600}>
                {title}
            </Typography>
            {description && (
                <Typography variant='body2' color='text.secondary' sx={{ maxWidth: 360 }}>
                    {description}
                </Typography>
            )}
            {actionLabel && onAction && (
                <Button variant='outlined' onClick={onAction} sx={{ mt: 1 }}>
                    {actionLabel}
                </Button>
            )}
        </Box>
    );
}
