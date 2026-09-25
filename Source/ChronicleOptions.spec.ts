// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, describe, expect, it } from 'vitest';
import { ChronicleOptions } from './ChronicleOptions.js';

const entry = process.argv[1];
afterEach(() => { process.argv[1] = entry; });

describe('default artifact discovery', () => {
    for (const extension of ['ts', 'mts', 'cts']) {
        it(`scans TypeScript sources for a .${extension} entry`, () => {
            process.argv[1] = `/app/index.${extension}`;
            expect(ChronicleOptions.development().discoveryPatterns).toEqual([
                '**/*.ts', '!**/*.d.ts', '!**/node_modules', '!**/dist', '!**/build',
                '!**/.git', '!**/.vscode', '!**/*.spec.ts', '!**/*.test.ts'
            ]);
        });
    }

    it('does not scan files for a compiled JavaScript entry', () => {
        process.argv[1] = '/app/dist/index.js';
        expect(ChronicleOptions.development().discoveryPatterns).toEqual([]);
    });

    it('always honors explicit discovery patterns', () => {
        process.argv[1] = '/app/dist/index.js';
        const patterns = ['app/**/*.js', '!app/**/*.spec.js'];
        expect(ChronicleOptions.development({ discoveryPatterns: patterns }).discoveryPatterns).toBe(patterns);
    });
});
