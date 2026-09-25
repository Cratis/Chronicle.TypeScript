// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, describe, expect, it } from 'vitest';
import { ChronicleOptions } from './ChronicleOptions.js';

const entry = process.argv[1];
const execArgv = [...process.execArgv];
const vitest = process.env.VITEST;
const patterns = [
    '**/*.ts', '**/*.tsx', '!**/*.d.ts', '!**/node_modules', '!**/dist', '!**/build',
    '!**/.git', '!**/.vscode', '!**/*.spec.ts', '!**/*.test.ts', '!**/*.spec.tsx', '!**/*.test.tsx'
];
afterEach(() => {
    process.argv[1] = entry;
    process.execArgv = [...execArgv];
    if (vitest === undefined) delete process.env.VITEST;
    else process.env.VITEST = vitest;
});

describe('default artifact discovery', () => {
    for (const extension of ['ts', 'tsx', 'mts', 'cts']) {
        it(`scans TypeScript sources for a .${extension} entry`, () => {
            process.argv[1] = `/app/index.${extension}`;
            expect(ChronicleOptions.development().discoveryPatterns).toEqual(patterns);
        });
    }

    it('scans a JavaScript entry under vitest', () => {
        process.argv[1] = '/app/dist/index.js';
        process.env.VITEST = 'true';
        expect(ChronicleOptions.development().discoveryPatterns).toEqual(patterns);
    });

    it.each(['tsx', 'ts-node', '--experimental-strip-types', '--experimental-transform-types'])(
        'scans a JavaScript entry with %s loader', loader => {
            process.argv[1] = '/app/dist/index.js';
            process.execArgv = [loader];
            expect(ChronicleOptions.development().discoveryPatterns).toEqual(patterns);
        });

    it('does not scan files for a compiled JavaScript entry without a TypeScript runtime', () => {
        process.argv[1] = '/app/dist/index.js';
        delete process.env.VITEST;
        process.execArgv = [];
        expect(ChronicleOptions.development().discoveryPatterns).toEqual([]);
    });

    it('always honors explicit discovery patterns', () => {
        process.argv[1] = '/app/dist/index.js';
        const patterns = ['app/**/*.js', '!app/**/*.spec.js'];
        expect(ChronicleOptions.development({ discoveryPatterns: patterns }).discoveryPatterns).toBe(patterns);
    });
});
