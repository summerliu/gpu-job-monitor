import { describe, expect, it } from 'vitest';
import { createLatestRequestGuard } from '@/lib/latestRequest';

describe('createLatestRequestGuard', () => {
    it('considers the first (and only) request current', () => {
        const guard = createLatestRequestGuard();
        const id = guard.start();
        expect(guard.isCurrent(id)).toBe(true);
    });

    it('invalidates an earlier request once a newer one has started', () => {
        // 這是列表搜尋最容易出錯的地方：關鍵字越短 mock server 故意回得越慢，
        // 使用者打字時先送出的請求可能比後送出的晚回來，必須確保只採用最新一次的結果。
        const guard = createLatestRequestGuard();
        const first = guard.start();
        const second = guard.start();
        expect(guard.isCurrent(first)).toBe(false);
        expect(guard.isCurrent(second)).toBe(true);
    });

    it('keeps invalidating stale ids even after several more requests', () => {
        const guard = createLatestRequestGuard();
        const first = guard.start();
        guard.start();
        const third = guard.start();
        expect(guard.isCurrent(first)).toBe(false);
        expect(guard.isCurrent(third)).toBe(true);
    });
});
