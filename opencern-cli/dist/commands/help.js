// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors
import { registry } from './registry.js';
export function getHelpText() {
    const lines = [
        '',
        '     ___                    ____ _____ ____  _   _',
        '    / _ \\ _ __   ___ _ __  / ___| ____|  _ \\| \\ | |',
        '   | | | | \'_ \\ / _ \\ \'_ \\| |   |  _| | |_) |  \\| |',
        '   | |_| | |_) |  __/ | | | |___| |___|  _ <| |\\  |',
        '    \\___/| .__/ \\___|_| |_|\\____|_____|_| \\_\\_| \\_|',
        '         |_|',
        '',
        '  AI-powered particle physics analysis',
        '  ────────────────────────────────────────────────────',
    ];
    for (const category of registry.getCategories()) {
        const cmds = registry.getByCategory(category);
        if (cmds.length === 0)
            continue;
        lines.push('');
        lines.push(`  ${registry.getCategoryLabel(category)}`);
        for (const cmd of cmds) {
            const usage = cmd.usage || cmd.name;
            const shortcut = cmd.shortcut ? `  (${cmd.shortcut})` : '';
            lines.push(`    ${usage.padEnd(32)} ${cmd.description}${shortcut}`);
        }
    }
    lines.push('', '  Keyboard Shortcuts', '  ────────────────────────────────────────────────────', '    Ctrl+D         Exit', '    Ctrl+L         Clear screen', '    Ctrl+K         Command palette', '    ?              Show all keyboard shortcuts', '    Tab            Autocomplete', '    Up/Down        Navigate command history', '    Esc            Cancel / dismiss', '    Enter          Approve tool execution', '', '  Agentic Mode', '  ────────────────────────────────────────────────────', '    When the AI uses tools (Python, bash, CLI), you will', '    see a tool approval card. Press Enter to approve or', '    Esc to deny. Tool output is fed back to the AI for', '    multi-step reasoning.', '', '  docs   https://docs.opencern.io', '  repo   https://github.com/opencern/opencern', '');
    return lines;
}
export function getBannerText() {
    return [
        '',
        '     ___                    ____ _____ ____  _   _',
        '    / _ \\ _ __   ___ _ __  / ___| ____|  _ \\| \\ | |',
        '   | | | | \'_ \\ / _ \\ \'_ \\| |   |  _| | |_) |  \\| |',
        '   | |_| | |_) |  __/ | | | |___| |___|  _ <| |\\  |',
        '    \\___/| .__/ \\___|_| |_|\\____|_____|_| \\_\\_| \\_|',
        '         |_|',
        '',
    ];
}
//# sourceMappingURL=help.js.map