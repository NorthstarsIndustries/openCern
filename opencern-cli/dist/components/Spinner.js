import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
const BRAILLE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
function InlineSpinnerComponent({ label, color = 'blue' }) {
    const [frame, setFrame] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => {
            setFrame(f => (f + 1) % BRAILLE_FRAMES.length);
        }, 150);
        return () => clearInterval(interval);
    }, []);
    return (_jsxs(Box, { flexDirection: "row", gap: 1, children: [_jsx(Text, { color: color, children: BRAILLE_FRAMES[frame] }), label && _jsx(Text, { color: "gray", children: label })] }));
}
export const InlineSpinner = React.memo(InlineSpinnerComponent);
export default InlineSpinner;
//# sourceMappingURL=Spinner.js.map