import type { ApiError, Envelope } from './types';

const BASE = '/api/v1';

/**
 * 代表一個確定失敗的 API 呼叫：HTTP 層錯誤（4xx/5xx、非 JSON 的 proxy 錯誤頁）
 * 或業務邏輯錯誤（HTTP 200 但 envelope.error 不為 null，見 openapi.yaml）。
 * 呼叫端一律用這個類別分支，不要分別判斷 res.ok 與 error 欄位。
 */
export class ApiCallError extends Error {
    constructor(
        public status: number,
        public code: string,
        message: string
    ) {
        super(message);
    }
}

type Query = Record<string, string | number | undefined>;

function buildUrl(path: string, query?: Query) {
    const url = new URL(BASE + path, window.location.origin);
    Object.entries(query ?? {}).forEach(([k, v]) => {
        if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    });
    return url.toString();
}

// Job.id 是 int64，超過 Number.MAX_SAFE_INTEGER；JSON.parse 預設會把它轉成
// 精度不足的 number（例如結尾被四捨五入成 0），之後拿這個值去打
// `/jobs/{id}` 會打到錯的 job 或 404。在交給 JSON.parse 之前，先把
// `"id":<digits>` 的裸數字包成字串，讓它以原始字串精度被保留下來。
function quoteInt64Ids(text: string): string {
    return text.replace(/"id":(\d+)/g, '"id":"$1"');
}

async function parseEnvelope<T>(res: Response): Promise<Envelope<T>> {
    const text = await res.text();
    try {
        return JSON.parse(quoteInt64Ids(text)) as Envelope<T>;
    } catch {
        // 前面的 reverse proxy 偶爾會回傳它自己的 HTML 錯誤頁，不是 JSON。
        throw new ApiCallError(
            res.status || 502,
            'UPSTREAM_ERROR',
            'The server returned an unexpected response. Please try again.'
        );
    }
}

function unwrap<T>(res: Response, body: Envelope<T>): T {
    // 業務邏輯錯誤會以 HTTP 200 回傳，error 欄位不為 null，必須先檢查這個欄位，
    // 不能只看 res.ok（這是本案在開發過程中真正發生過的一個 bug，見 README）。
    if (body.error) {
        const err: ApiError = body.error;
        throw new ApiCallError(res.status, err.code, err.message);
    }
    if (!res.ok) {
        throw new ApiCallError(res.status, 'HTTP_ERROR', res.statusText || `HTTP ${res.status}`);
    }
    return body.data as T;
}

export async function getJson<T>(path: string, query?: Query): Promise<T> {
    const res = await fetch(buildUrl(path, query));
    const body = await parseEnvelope<T>(res);
    return unwrap(res, body);
}

export async function postJson<T>(path: string, payload?: unknown): Promise<T> {
    const res = await fetch(buildUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const body = await parseEnvelope<T>(res);
    return unwrap(res, body);
}
