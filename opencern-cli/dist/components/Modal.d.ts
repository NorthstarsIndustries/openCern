import React from 'react';
interface ModalProps {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    destructive?: boolean;
}
export declare function Modal({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel, destructive, }: ModalProps): React.JSX.Element;
export default Modal;
//# sourceMappingURL=Modal.d.ts.map