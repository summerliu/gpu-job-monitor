import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiCallError, getJson } from '@/api/client';

function mockFetchOnce(body: string, init: ResponseInit = { status: 200 }) {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(body, init))
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('getJson', () => {
    it('returns the envelope data on a plain success response', async () => {
        mockFetchOnce('{"data":{"ok":true},"error":null}');
        await expect(getJson('/nodes')).resolves.toEqual({ ok: true });
    });

    it('throws when the envelope carries a business error even though HTTP status is 200', async () => {
        // 這是本案在開發中真正發生過的一個 bug：stop job 對已結束的 job 回 HTTP 200
        // 但 error 不為 null，如果只檢查 res.ok 會把這個失敗誤判成成功（見 README）。
        mockFetchOnce(
            '{"data":null,"error":{"code":"INVALID_STATE","message":"job is SUCCEEDED"}}',
            { status: 200 }
        );
        await expect(getJson('/jobs/1/stop')).rejects.toMatchObject({
            code: 'INVALID_STATE',
            message: 'job is SUCCEEDED',
        });
    });

    it('preserves int64 job ids exactly instead of rounding them to a JS number', async () => {
        // ID_BASE 在 mock-server 裡是 2095791122068779008n，遠超過
        // Number.MAX_SAFE_INTEGER，naive JSON.parse 會把尾數四捨五入掉。
        mockFetchOnce('{"data":{"id":2095791122068779011,"name":"x"},"error":null}');
        const job = await getJson<{ id: string; name: string }>('/jobs/2095791122068779011');
        expect(job.id).toBe('2095791122068779011');
        expect(typeof job.id).toBe('string');
    });

    it('does not mangle ordinary small numeric fields', async () => {
        mockFetchOnce('{"data":{"gpuCount":4,"page":1},"error":null}');
        const data = await getJson<{ gpuCount: number; page: number }>('/jobs/1');
        expect(data).toEqual({ gpuCount: 4, page: 1 });
    });

    it('surfaces a friendly error when the reverse proxy returns a non-JSON error page', async () => {
        mockFetchOnce('<html><body>502 Bad Gateway</body></html>', { status: 502 });
        const error = await getJson('/jobs').catch((err: unknown) => err);
        expect(error).toBeInstanceOf(ApiCallError);
        expect(error).toMatchObject({ status: 502, code: 'UPSTREAM_ERROR' });
    });

    it('throws on a 4xx/5xx JSON error response', async () => {
        mockFetchOnce('{"data":null,"error":{"code":"JOB_NOT_FOUND","message":"not found"}}', {
            status: 404,
        });
        await expect(getJson('/jobs/999')).rejects.toMatchObject({
            status: 404,
            code: 'JOB_NOT_FOUND',
        });
    });
});
