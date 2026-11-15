export type RelativeUnit = 'second' | 'minute' | 'hour' | 'day';

export interface RelativeTime {
    unit: RelativeUnit;
    value: number;
}

/** 回傳結構化的相對時間（不含文字），由呼叫端用 i18next 翻譯單位。 */
export function relativeTimeParts(iso: string, nowMs: number = Date.now()): RelativeTime {
    const diffSec = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 1000));
    if (diffSec < 60) return { unit: 'second', value: diffSec };
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return { unit: 'minute', value: diffMin };
    const diffHour = Math.round(diffMin / 60);
    if (diffHour < 24) return { unit: 'hour', value: diffHour };
    return { unit: 'day', value: Math.round(diffHour / 24) };
}

export interface DurationParts {
    hours: number;
    minutes: number;
}

/** 兩個時間點之間經過的時數／分鐘數，供「已執行 X 小時 Y 分」之類的文字使用。 */
export function formatDurationParts(startMs: number, endMs: number): DurationParts {
    const totalMinutes = Math.max(0, Math.floor((endMs - startMs) / 60_000));
    return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}
