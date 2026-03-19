import React from 'react';
export type ToastType = 'info' | 'success' | 'warning' | 'error';
export interface ToastMessage {
    id: string;
    type: ToastType;
    text: string;
    duration?: number;
}
interface ToastProps {
    messages: ToastMessage[];
    onDismiss: (id: string) => void;
}
declare function ToastComponent({ messages, onDismiss }: ToastProps): React.JSX.Element | null;
export declare const Toast: React.MemoExoticComponent<typeof ToastComponent>;
export declare function useToast(): {
    messages: ToastMessage[];
    addToast: (type: ToastType, text: string, duration?: number) => void;
    dismissToast: (id: string) => void;
};
export default Toast;
//# sourceMappingURL=Toast.d.ts.map