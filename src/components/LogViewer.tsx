import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { LogLine } from '@/api/types';
import type { LogConnectionState } from '@/hooks/useLogStream';
import { parseLogText, type LogLevel } from '@/lib/ansi';
import { truncateForDisplay } from '@/lib/logBuffer';

const ROW_HEIGHT = 21;
const LOG_HEIGHT = 480;
const OVERSCAN = 12;

const LEVEL_COLOR: Record<LogLevel, string> = {
    INFO: '#69db7c',
    DEBUG: '#7b8494',
    WARN: '#ffd43b',
    ERROR: '#ff8787',
};

interface Props {
    lines: LogLine[];
    connectionState: LogConnectionState;
}

export default function LogViewer({ lines, connectionState }: Props) {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [paused, setPaused] = useState(false);
    const [pausedAtCount, setPausedAtCount] = useState(0);
    const [expandedLine, setExpandedLine] = useState<LogLine | null>(null);

    // 新行進來時自動捲到底；使用者按「回到最新」把 paused 設回 false 時也要再捲一次，
    // 所以兩個情境共用同一個 effect。
    useEffect(() => {
        if (!paused && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [lines.length, paused]);

    const handleScroll = (e: UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        setScrollTop(el.scrollTop);
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        const atBottom = distanceFromBottom < ROW_HEIGHT;
        if (atBottom && paused) {
            setPaused(false);
        } else if (!atBottom && !paused) {
            setPaused(true);
            setPausedAtCount(lines.length);
        }
    };

    const jumpToLatest = () => setPaused(false);

    const { startIndex, visibleLines } = useMemo(() => {
        const visibleCount = Math.ceil(LOG_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2;
        const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
        const end = Math.min(lines.length, start + visibleCount);
        return { startIndex: start, visibleLines: lines.slice(start, end) };
    }, [lines, scrollTop]);

    const newLineCount = paused ? lines.length - pausedAtCount : 0;

    return (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            {(connectionState === 'reconnecting' || connectionState === 'error') && (
                <Alert severity='warning' icon={false} sx={{ borderRadius: 0 }}>
                    {connectionState === 'reconnecting'
                        ? t('jobDetail.logs.reconnecting')
                        : t('jobDetail.logs.connectionError')}
                </Alert>
            )}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    py: 1,
                    borderBottom: 1,
                    borderColor: 'divider',
                }}
            >
                <Typography variant='caption' color='text.secondary'>
                    {t('jobDetail.logs.lineCount', { count: lines.length })}
                </Typography>
                {connectionState === 'ended' && (
                    <Typography variant='caption' color='text.secondary'>
                        {t('jobDetail.logs.ended')}
                    </Typography>
                )}
            </Box>
            <Box sx={{ position: 'relative' }}>
                <Box
                    ref={containerRef}
                    onScroll={handleScroll}
                    sx={{
                        height: LOG_HEIGHT,
                        overflowY: 'auto',
                        bgcolor: '#111418',
                        color: '#d7dae0',
                        fontFamily: '"JetBrains Mono", Menlo, monospace',
                        fontSize: 13,
                    }}
                >
                    <Box sx={{ position: 'relative', height: lines.length * ROW_HEIGHT }}>
                        {visibleLines.map((line, i) => {
                            const { level, text } = parseLogText(line.text);
                            const { text: shown, truncated, fullLength } = truncateForDisplay(text);
                            return (
                                <Box
                                    key={line.seq}
                                    sx={{
                                        position: 'absolute',
                                        top: (startIndex + i) * ROW_HEIGHT,
                                        left: 0,
                                        right: 0,
                                        height: ROW_HEIGHT,
                                        display: 'flex',
                                        px: 2,
                                        gap: 1.5,
                                        whiteSpace: 'pre',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <Box
                                        component='span'
                                        sx={{ color: '#4b525d', width: 64, flex: 'none', textAlign: 'right' }}
                                    >
                                        {line.seq}
                                    </Box>
                                    <Box
                                        component='span'
                                        sx={{ color: level ? LEVEL_COLOR[level] : undefined, flex: 1 }}
                                    >
                                        {shown}
                                        {truncated && (
                                            <Box
                                                component='button'
                                                onClick={() => setExpandedLine(line)}
                                                sx={{
                                                    background: 'none',
                                                    border: 0,
                                                    color: '#7b8494',
                                                    cursor: 'pointer',
                                                    font: 'inherit',
                                                    ml: 1,
                                                }}
                                            >
                                                {t('jobDetail.logs.expand', { count: fullLength })}
                                            </Box>
                                        )}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
                {paused && newLineCount > 0 && (
                    <Button
                        onClick={jumpToLatest}
                        variant='contained'
                        size='small'
                        sx={{ position: 'absolute', right: 20, bottom: 16, borderRadius: 5 }}
                    >
                        {t('jobDetail.logs.jumpToLatest', { count: newLineCount })}
                    </Button>
                )}
            </Box>
            <Dialog open={Boolean(expandedLine)} onClose={() => setExpandedLine(null)} maxWidth='md' fullWidth>
                <DialogTitle>{t('jobDetail.logs.fullLineTitle', { seq: expandedLine?.seq })}</DialogTitle>
                <DialogContent>
                    <Box
                        component='pre'
                        sx={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            fontFamily: '"JetBrains Mono", Menlo, monospace',
                            fontSize: 13,
                        }}
                    >
                        {expandedLine ? parseLogText(expandedLine.text).text : ''}
                    </Box>
                </DialogContent>
            </Dialog>
        </Box>
    );
}
