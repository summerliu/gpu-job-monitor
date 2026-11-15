import { describe, expect, it } from 'vitest';
import { appendLogLines, LINE_TRUNCATE_LENGTH, MAX_LOG_LINES, truncateForDisplay } from '@/lib/logBuffer';

describe('appendLogLines', () => {
    it('appends new lines in order', () => {
        const buffer = appendLogLines([], [
            { seq: 0, text: 'a' },
            { seq: 1, text: 'b' },
        ]);
        expect(buffer.map(l => l.seq)).toEqual([0, 1]);
    });

    it('drops lines already present (SSE resume can re-send the last batch)', () => {
        const buffer = [
            { seq: 0, text: 'a' },
            { seq: 1, text: 'b' },
        ];
        const next = appendLogLines(buffer, [
            { seq: 1, text: 'b (resent)' },
            { seq: 2, text: 'c' },
        ]);
        expect(next.map(l => l.seq)).toEqual([0, 1, 2]);
        expect(next[1].text).toBe('b'); // 保留原本已經顯示的那份，不是重送的版本
    });

    it('ignores a batch that is entirely already-seen (no-op, same reference)', () => {
        const buffer = [{ seq: 5, text: 'x' }];
        const next = appendLogLines(buffer, [{ seq: 5, text: 'x (dup)' }]);
        expect(next).toBe(buffer);
    });

    it('returns the same buffer reference when there is nothing new', () => {
        const buffer = [{ seq: 0, text: 'a' }];
        expect(appendLogLines(buffer, [])).toBe(buffer);
    });

    it('caps the buffer at MAX_LOG_LINES by dropping the oldest lines', () => {
        const big = Array.from({ length: MAX_LOG_LINES }, (_, i) => ({ seq: i, text: String(i) }));
        const next = appendLogLines(big, [{ seq: MAX_LOG_LINES, text: 'new' }]);
        expect(next).toHaveLength(MAX_LOG_LINES);
        expect(next[0].seq).toBe(1); // 最舊的一行 (seq 0) 被丟掉
        expect(next[next.length - 1].seq).toBe(MAX_LOG_LINES);
    });
});

describe('truncateForDisplay', () => {
    it('leaves short lines untouched', () => {
        expect(truncateForDisplay('short line')).toEqual({
            text: 'short line',
            truncated: false,
            fullLength: 10,
        });
    });

    it('truncates lines longer than the limit and reports the full length', () => {
        const long = 'x'.repeat(LINE_TRUNCATE_LENGTH + 123);
        const result = truncateForDisplay(long);
        expect(result.truncated).toBe(true);
        expect(result.text).toHaveLength(LINE_TRUNCATE_LENGTH);
        expect(result.fullLength).toBe(long.length);
    });
});
