// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { TypeDiscoverer } from './TypeDiscoverer.js';

describe('TypeDiscoverer', () => {
    it('passes included patterns and stripped exclusions to glob ignore', async () => {
        const glob = vi.fn().mockResolvedValue([]);
        await new TypeDiscoverer(glob).discover([
            '**/*.ts', '!**/*.d.ts', '!**/node_modules', '!**/dist', '!**/build', '!**/.git', '!**/.vscode', '!**/*.spec.ts', '!**/*.test.ts'
        ]);
        expect(glob).toHaveBeenCalledWith(['**/*.ts'], {
            ignore: [
                '**/*.d.ts', '**/*.d.ts/**', '**/node_modules', '**/node_modules/**',
                '**/dist', '**/dist/**', '**/build', '**/build/**', '**/.git', '**/.git/**',
                '**/.vscode', '**/.vscode/**', '**/*.spec.ts', '**/*.spec.ts/**',
                '**/*.test.ts', '**/*.test.ts/**'
            ]
        });
    });

    it('excludes declaration files, tests and directory contents with the real glob', async () => {
        const directory = await mkdtemp(path.join(tmpdir(), 'chronicle-discovery-'));
        try {
            for (const subdirectory of ['node_modules', 'dist', 'build', '.git', '.vscode']) {
                await mkdir(path.join(directory, subdirectory));
                await writeFile(path.join(directory, subdirectory, 'excluded.ts'), '');
            }
            for (const file of ['included.ts', 'excluded.d.ts', 'excluded.spec.ts', 'excluded.test.ts']) {
                await writeFile(path.join(directory, file), '');
            }
            const imported: string[] = [];
            const discoverer = new TypeDiscoverer(undefined, async file => { imported.push(file); });
            await discoverer.discover([
                `${directory}/**/*.ts`, `!${directory}/**/*.d.ts`, `!${directory}/**/*.spec.ts`,
                `!${directory}/**/*.test.ts`, ...['node_modules', 'dist', 'build', '.git', '.vscode'].map(name => `!${directory}/**/${name}`)
            ]);
            expect(imported).toEqual([path.join(directory, 'included.ts')]);
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });

    it('reports the path and preserves the cause of a failed import', async () => {
        const failure = new SyntaxError('invalid decorator');
        const discoverer = new TypeDiscoverer(async () => ['broken.ts'], async () => { throw failure; });
        const file = path.resolve('broken.ts');
        await expect(discoverer.discover('*.ts')).rejects.toMatchObject({
            message: expect.stringContaining(file),
            cause: failure
        });
    });
});
