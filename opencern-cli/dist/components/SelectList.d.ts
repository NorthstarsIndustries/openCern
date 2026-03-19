import React from 'react';
export interface SelectItem {
    label: string;
    value: string;
    description?: string;
}
interface SelectListProps {
    items: SelectItem[];
    onSelect: (item: SelectItem) => void;
    onCancel?: () => void;
    title?: string;
    multiSelect?: boolean;
    maxVisible?: number;
    searchable?: boolean;
}
export declare function SelectList({ items, onSelect, onCancel, title, multiSelect, maxVisible, searchable, }: SelectListProps): React.JSX.Element;
export default SelectList;
//# sourceMappingURL=SelectList.d.ts.map