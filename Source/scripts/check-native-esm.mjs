// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
const entries = Object.keys(packageJson.exports ?? {});
if (!entries.includes('.') || entries.length < 2) {
    throw new Error('No package root or export subpaths to check');
}

const temporaryRoot = mkdtempSync(join(tmpdir(), 'chronicle-native-esm-'));
if (!relative(packageRoot, temporaryRoot).startsWith('..')) {
    throw new Error('Native ESM probe must run outside the package workspace');
}

function run(command, args, cwd) {
    const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} ${args[0]} failed (${result.status ?? result.signal})`);
}

try {
    const dist = join(packageRoot, 'dist');
    const emittedFiles = readdirSync(dist, { recursive: true })
        .filter(file => file.endsWith('.js') || file.endsWith('.d.ts'));
    if (emittedFiles.length === 0) throw new Error('No emitted JavaScript or declarations to check');
    let checkedSpecifiers = 0;
    const relativeSpecifier = /(?:\bfrom\s*|\bimport\s*\(|\bimport\s*|\brequire\s*\()\s*['"](\.{1,2}\/[^'"\n]+)['"]/g;
    for (const file of emittedFiles) {
        const content = readFileSync(join(dist, file), 'utf8');
        for (const [, specifier] of content.matchAll(relativeSpecifier)) {
            checkedSpecifiers++;
            const target = resolve(dirname(join(dist, file)), specifier);
            const expected = file.endsWith('.d.ts') ? target.replace(/\.js$/, '.d.ts') : target;
            if (!specifier.endsWith('.js') || !existsSync(expected)) {
                throw new Error(`Unresolvable relative specifier ${specifier} in dist/${file}`);
            }
        }
    }
    if (checkedSpecifiers === 0) throw new Error('No relative specifiers in emitted files');
    console.log(`Checked ${checkedSpecifiers} relative specifiers in ${emittedFiles.length} emitted files`);

    const archive = join(temporaryRoot, 'chronicle.tgz');
    run('yarn', ['pack', '--out', archive], packageRoot);
    run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', archive], temporaryRoot);

    const imports = entries.map(entry => entry === '.' ? packageJson.name : `${packageJson.name}/${entry.slice(2)}`);
    const probe = `
        const entries = ${JSON.stringify(imports)};
        for (const entry of entries) {
            await import(entry, entry.endsWith('/package.json') ? { with: { type: 'json' } } : undefined);
        }
        console.log('Native ESM imports passed: ' + entries.length + ' entry points');
    `;
    run(process.execPath, ['--input-type=module', '-e', probe], temporaryRoot);
} finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
}
