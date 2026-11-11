import type { Envelope } from './types';

const BASE = '/api/v1';

export class HttpError extends Error {
    constructor(
        public status: number,
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

export async function getJson<T>(path: string, query?: Query): Promise<T> {
    const res = await fetch(buildUrl(path, query));
    const body = (await res.json()) as Envelope<T>;
    if (!res.ok) throw new HttpError(res.status, body.error?.message ?? res.statusText);
    return body.data as T;
}

export async function postJson<T>(path: string, payload?: unknown): Promise<T> {
    const res = await fetch(buildUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const body = (await res.json()) as Envelope<T>;
    if (!res.ok) throw new HttpError(res.status, body.error?.message ?? res.statusText);
    return body.data as T;
}
