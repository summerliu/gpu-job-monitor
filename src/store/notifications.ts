import { create } from 'zustand';

export interface Notification {
    id: number;
    severity: 'success' | 'error' | 'info';
    message: string;
}

interface NotificationsState {
    queue: Notification[];
    notify: (severity: Notification['severity'], message: string) => void;
    dismiss: (id: number) => void;
}

let nextId = 1;

/**
 * 全站共用的通知佇列（停止 Job 失敗、列表載入錯誤等都會丟到這裡），
 * 用 zustand 是因為來源元件（列表、詳情頁、對話框）彼此沒有父子關係，
 * 用 prop drilling 或 context 都比直接訂閱一個小 store 麻煩。
 */
export const useNotificationsStore = create<NotificationsState>(set => ({
    queue: [],
    notify: (severity, message) =>
        set(state => ({ queue: [...state.queue, { id: nextId++, severity, message }] })),
    dismiss: id => set(state => ({ queue: state.queue.filter(n => n.id !== id) })),
}));
