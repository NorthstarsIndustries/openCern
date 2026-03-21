// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

const BRAILLE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface SpinnerProps {
  label?: string;
  color?: string;
}

function InlineSpinnerComponent({ label, color = 'blue' }: SpinnerProps): React.JSX.Element {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % BRAILLE_FRAMES.length);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box flexDirection="row" gap={1}>
      <Text color={color}>{BRAILLE_FRAMES[frame]}</Text>
      {label && <Text color="gray">{label}</Text>}
    </Box>
  );
}

export const InlineSpinner = React.memo(InlineSpinnerComponent);
export default InlineSpinner;
