// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { transform } from 'esbuild';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [{
        name: 'standard-decorators-esbuild',
        enforce: 'pre',
        async transform(code, id) {
            const file = id.split('?', 1)[0];
            if (!file.endsWith('.ts') || file.includes('/node_modules/')) return;
            return transform(code, {
                loader: 'ts',
                sourcefile: file,
                target: 'es2022',
                format: 'esm',
                sourcemap: true,
                tsconfigRaw: { compilerOptions: { useDefineForClassFields: true, experimentalDecorators: file.endsWith('.legacy.spec.ts') } }
            });
        }
    }],
    test: {
        include: ['**/*.spec.ts', '**/*.spec.js'],
        exclude: ['node_modules', 'dist'],
        environment: 'node'
    }
});
