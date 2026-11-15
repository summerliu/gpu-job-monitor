import { useEffect, useState } from 'react';
import { listNodes } from '@/api/jobs';
import type { Node } from '@/api/types';

/** 節點清單變動很少，不需要輪詢，失敗的話篩選列就少一個節點選項，不影響其他功能。 */
export function useNodes(): Node[] {
    const [nodes, setNodes] = useState<Node[]>([]);

    useEffect(() => {
        listNodes()
            .then(setNodes)
            .catch(() => setNodes([]));
    }, []);

    return nodes;
}
