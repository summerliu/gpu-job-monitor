import { useMemo } from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { JobMetrics, MetricsRange } from '@/api/types';

const COLORS = ['#3b5bdb', '#0ca678', '#f08c00', '#ae3ec9', '#1098ad', '#e64980'];
const RANGES: MetricsRange[] = ['15m', '1h', '6h'];

interface Props {
    metrics: JobMetrics;
    range: MetricsRange;
    onRangeChange: (range: MetricsRange) => void;
}

export default function GpuUtilChart({ metrics, range, onRangeChange }: Props) {
    const { t } = useTranslation();

    // recharts 需要「每個時間點一列、每張 GPU 一個欄位」的扁平資料；缺值保留 null，
    // 這樣 recharts 畫線時會在該處斷開而不是畫成 0（見設計稿要求）。
    const data = useMemo(
        () =>
            metrics.points.map(point => {
                const row: Record<string, number | null | string> = {
                    ts: new Date(point.ts).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                    }),
                };
                metrics.gpus.forEach((gpuIndex, i) => {
                    row[`gpu${gpuIndex}`] = point.gpu[i]?.util ?? null;
                });
                return row;
            }),
        [metrics]
    );

    if (metrics.gpus.length === 0 || data.length === 0) {
        return (
            <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 320 }}>
                <Typography color='text.secondary'>{t('jobDetail.chart.noDataYet')}</Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                <ToggleButtonGroup
                    size='small'
                    exclusive
                    value={range}
                    onChange={(_, value: MetricsRange | null) => value && onRangeChange(value)}
                >
                    {RANGES.map(r => (
                        <ToggleButton key={r} value={r}>
                            {t(`jobDetail.chart.range.${r}`)}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Box>
            <ResponsiveContainer width='100%' height={360}>
                <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray='3 3' vertical={false} />
                    <XAxis dataKey='ts' tick={{ fontSize: 12 }} minTickGap={24} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit='%' width={44} />
                    <Tooltip />
                    <Legend />
                    {metrics.gpus.map((gpuIndex, i) => (
                        <Line
                            key={gpuIndex}
                            type='monotone'
                            dataKey={`gpu${gpuIndex}`}
                            name={t('jobDetail.chart.gpuLabel', { index: gpuIndex })}
                            stroke={COLORS[i % COLORS.length]}
                            dot={false}
                            strokeWidth={1.75}
                            connectNulls={false}
                            isAnimationActive={false}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </Box>
    );
}
