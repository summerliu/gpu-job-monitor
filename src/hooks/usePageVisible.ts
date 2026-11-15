import { useEffect, useState } from 'react';

/** 分頁是否在前景；切到背景分頁或最小化時會變成 false。 */
export function usePageVisible(): boolean {
    const [visible, setVisible] = useState(() => document.visibilityState === 'visible');

    useEffect(() => {
        const onChange = () => setVisible(document.visibilityState === 'visible');
        document.addEventListener('visibilitychange', onChange);
        return () => document.removeEventListener('visibilitychange', onChange);
    }, []);

    return visible;
}
