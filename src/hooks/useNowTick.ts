import { useEffect, useState } from 'react';

/** 單純每隔 intervalMs 觸發一次重新渲染，給相對時間／經過時數之類會隨時間變舊的文字用。 */
export function useNowTick(intervalMs: number): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(timer);
    }, [intervalMs]);

    return now;
}
