import React from 'react';
interface FilePreviewProps {
    content: string;
    filename?: string;
    size?: number;
    fileType?: 'json' | 'text' | 'root-meta';
    onClose?: () => void;
    focused?: boolean;
    maxHeight?: number;
}
export declare function FilePreview({ content, filename, size, fileType, onClose, focused, maxHeight, }: FilePreviewProps): React.JSX.Element;
export default FilePreview;
//# sourceMappingURL=FilePreview.d.ts.map