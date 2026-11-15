import { useEffect, useState } from 'react';
import { logStreamUrl } from '@/api/jobs';
import type { LogLine } from '@/api/types';
import { appendLogLines } from '@/lib/logBuffer';

export type LogConnectionState = 'connecting' | 'open' | 'reconnecting' | 'ended' | 'error';

export interface UseLogStreamResult {
    lines: LogLine[];
    connectionState: LogConnectionState;
}

/**
 * 包裝 SSE log 串流。de-dup/重連的策略：
 * - 瀏覽器原生 EventSource 在連線被中斷（mock server 會隨機 destroy socket 模擬 proxy 斷線）
 *   時會自動重連，並自動帶上最後收到的 `Last-Event-ID`，所以恢復後的內容不會重複也不會遺漏，
 *   不需要自己實作重連/位置回報的邏輯（細節見 docs/adr/0003-sse-log-streaming.md）。
 * - 收到 `end` 事件代表 job 已經結束、log 送完了，這時要主動呼叫 close()，
 *   否則 EventSource 預設行為是連正常結束的連線也會重連。
 */
export function useLogStream(jobId: string): UseLogStreamResult {
    const [lines, setLines] = useState<LogLine[]>([]);
    const [connectionState, setConnectionState] = useState<LogConnectionState>('connecting');

    useEffect(() => {
        const endedRef = { current: false };
        // setState 延到 microtask 才呼叫，避免 effect 內同步觸發 setState（見 CLAUDE.md）。
        queueMicrotask(() => {
            if (endedRef.current) return;
            setLines([]);
            setConnectionState('connecting');
        });

        const es = new EventSource(logStreamUrl(jobId));

        es.onopen = () => setConnectionState('open');

        es.onmessage = event => {
            const seq = Number(event.lastEventId);
            if (!Number.isFinite(seq)) return;
            setLines(prev => appendLogLines(prev, [{ seq, text: event.data }]));
        };

        es.addEventListener('end', () => {
            endedRef.current = true;
            setConnectionState('ended');
            es.close();
        });

        es.onerror = () => {
            if (endedRef.current) return;
            setConnectionState(es.readyState === EventSource.CONNECTING ? 'reconnecting' : 'error');
        };

        return () => {
            endedRef.current = true;
            es.close();
        };
    }, [jobId]);

    return { lines, connectionState };
}
