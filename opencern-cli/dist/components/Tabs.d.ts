import React from 'react';
export interface Tab {
    id: string;
    label: string;
}
interface TabsProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (id: string) => void;
}
export declare function Tabs({ tabs, activeTab, onTabChange }: TabsProps): React.JSX.Element;
export default Tabs;
//# sourceMappingURL=Tabs.d.ts.map