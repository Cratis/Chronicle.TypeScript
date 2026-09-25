// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { runInNewContext } from 'node:vm';
import { ConceptAs, field, Guid } from '@cratis/fundamentals';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { JsonSchemaGenerator } from './JsonSchemaGenerator.js';
import { eventType, getEventTypeMetadata } from '../events/eventTypeDecorator.js';

const source = `
function mark() { return () => {}; }
class LegacyId extends ConceptAs {
    @mark() value!: Guid;
}
class LegacyHolder {
    @field(LegacyId) id!: LegacyId;
}
@eventType('no-defaults')
class NoDefaults {
    constructor(readonly name: string, readonly when: Date, readonly count: number) {}
}
class ExplicitField {
    constructor(readonly count: number) {}
}
field(Boolean)(ExplicitField.prototype, 'count');
eventType('explicit-field')(ExplicitField);
exports.types = { LegacyId, LegacyHolder, NoDefaults, ExplicitField };
`;

const compiled = ts.transpileModule(source, {
    compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        experimentalDecorators: true,
        emitDecoratorMetadata: true
    }
}).outputText;

describe('legacy emitDecoratorMetadata compatibility', () => {
    it('resolves a Guid-backed concept through emitted design:type', () => {
        const sandbox = { exports: {} as { types?: { LegacyId: Function; LegacyHolder: Function } }, ConceptAs, field, Guid, Reflect, eventType, String, Number, Boolean, Date };
        runInNewContext(compiled, sandbox);
        const { LegacyId, LegacyHolder } = sandbox.exports.types!;
        expect(Reflect.getMetadata('design:type', LegacyId.prototype, 'value')).toBe(Guid);
        expect(JsonSchemaGenerator.generate(LegacyHolder).properties?.id).toEqual({ type: 'string', format: 'guid' });
    });

    it('resolves constructor parameter properties without defaults from design:paramtypes', () => {
        const sandbox = { exports: {} as { types?: { NoDefaults: Function; ExplicitField: Function } }, ConceptAs, field, Guid, Reflect, eventType, String, Number, Boolean, Date };
        runInNewContext(compiled, sandbox);
        const { NoDefaults, ExplicitField } = sandbox.exports.types!;
        expect(getEventTypeMetadata(NoDefaults)?.schema.properties).toEqual({
            name: { type: 'string' },
            when: { type: 'string', format: 'date-time' },
            count: { type: 'number' }
        });
        expect(getEventTypeMetadata(ExplicitField)?.schema.properties?.count).toEqual({ type: 'boolean' });
    });
});
