import type { LogLine } from '@/api/types';

/**
 * 保留在記憶體/DOM 裡的最大行數。log 可能累積到數十萬行，全部留著會拖慢分頁，
 * 所以超過上限時從最舊的開始丟棄（UI 用虛擬捲動呈現其餘部分）。
 */
export const MAX_LOG_LINES = 20_000;

export const LINE_TRUNCATE_LENGTH = 500;

/**
 * 把新收到的 log 行併入既有 buffer：
 * - 依 seq 去重（SSE 重連可能重送已經收過的行）
 * - 假設輸入已依 seq 遞增排序（SSE 本身保證），只需跟目前最後一筆比較
 * - 超過 MAX_LOG_LINES 時從頭裁切
 */
export function appendLogLines(buffer: LogLine[], incoming: LogLine[]): LogLine[] {
    if (incoming.length === 0) return buffer;
    const lastSeq = buffer.length ? buffer[buffer.length - 1].seq : -1;
    const fresh = incoming.filter(line => line.seq > lastSeq);
    if (fresh.length === 0) return buffer;

    const merged = buffer.concat(fresh);
    if (merged.length > MAX_LOG_LINES) {
        return merged.slice(merged.length - MAX_LOG_LINES);
    }
    return merged;
}

export interface TruncatedLine {
    text: string;
    truncated: boolean;
    fullLength: number;
}

/** 單行過長（曾見過 8000+ 字元）時截斷顯示，避免單一 DOM 節點撐爆版面。 */
export function truncateForDisplay(text: string): TruncatedLine {
    if (text.length <= LINE_TRUNCATE_LENGTH) {
        return { text, truncated: false, fullLength: text.length };
    }
    return { text: text.slice(0, LINE_TRUNCATE_LENGTH), truncated: true, fullLength: text.length };
}
