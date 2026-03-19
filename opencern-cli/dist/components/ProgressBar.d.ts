import React from 'react';
interface ProgressBarProps {
    label: string;
    percent: number;
    speed?: number;
    eta?: number;
    mode?: 'download' | 'process' | 'quantum' | 'upload';
    indeterminate?: boolean;
    done?: boolean;
    error?: boolean;
    nested?: {
        label: string;
        percent: number;
    }[];
}
export declare function ProgressBar({ label, percent, speed, eta, mode, indeterminate, done, error, nested, }: ProgressBarProps): React.JSX.Element;
export default ProgressBar;
//# sourceMappingURL=ProgressBar.d.ts.map