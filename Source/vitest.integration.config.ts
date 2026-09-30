// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.js';

// Kernel-backed specifications. They need a running Chronicle kernel and are skipped unless
// CHRONICLE_INTEGRATION_CONNECTION_STRING points at one, for example
// chronicle://chronicle-dev-client:chronicle-dev-secret@localhost:35000
export default defineConfig({
    ...baseConfig,
    test: {
        include: ['**/*.integration.spec.ts'],
        exclude: ['node_modules', 'dist'],
        environment: 'node',
        testTimeout: 60_000,
        hookTimeout: 60_000
    }
});
