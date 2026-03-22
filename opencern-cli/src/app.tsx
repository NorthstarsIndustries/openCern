/**
 * Copyright (c) 2026 OpenCERN. All Rights Reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL — Enterprise Component
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 * See LICENSE.enterprise for full terms.
 */

import { tui } from './tui/app.js';

export async function startApp(): Promise<void> {
  await tui();
}

export default startApp;

// Auto-start when run directly
startApp();
