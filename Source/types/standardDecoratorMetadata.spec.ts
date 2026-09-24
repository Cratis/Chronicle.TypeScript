// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: false };
const fixture = ts.transpileModule(`
function mark(_value: Function, context: ClassDecoratorContext) {
    if (!context.metadata) throw new Error('Missing standard decorator metadata');
    context.metadata.marked = true;
}
@mark class Example {}
exports.attached = Example[Symbol.metadata]?.marked;
`, { compilerOptions }).outputText;

const shim = ts.transpileModule(
    readFileSync(new URL('./standardDecoratorMetadata.ts', import.meta.url), 'utf8'),
    { compilerOptions }
).outputText;

describe('standard decorator metadata shim with TypeScript output', () => {
    it('attaches metadata when the runtime does not provide Symbol.metadata', () => {
        expect(() => runInNewContext(fixture, { exports: {} })).toThrow('Missing standard decorator metadata');
        const sandbox = { exports: {} as { attached?: boolean } };
        runInNewContext(`${shim}\n${fixture}`, sandbox);
        expect(sandbox.exports.attached).toBe(true);
    });
});
