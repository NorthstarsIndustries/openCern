// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps): React.JSX.Element {
  useInput((_input, key) => {
    if (key.tab) {
      const idx = tabs.findIndex(t => t.id === activeTab);
      const next = (idx + 1) % tabs.length;
      onTabChange(tabs[next].id);
    }
  });

  return (
    <Box flexDirection="row" gap={0}>
      {tabs.map((tab, i) => {
        const active = tab.id === activeTab;
        return (
          <Box key={tab.id} flexDirection="row">
            {i > 0 && <Text dimColor> | </Text>}
            <Text
              color={active ? 'cyan' : 'gray'}
              bold={active}
              underline={active}
            >
              {tab.label}
            </Text>
          </Box>
        );
      })}
      <Text dimColor>  (Tab to switch)</Text>
    </Box>
  );
}

export default Tabs;
