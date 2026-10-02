// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field, Guid } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { eventType, getEventTypeMetadata } from '../../../events/eventTypeDecorator.js';
import { unique } from '../../../events/constraints/unique.js';
import { constraint } from '../../../events/constraints/constraint.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import type { JsonSchema } from '../../../schemas/JsonSchema.js';
import { EventScenario, UnsupportedEventSequenceOperation } from '../../index.js';

chai.should();

for (const schema of [
    { type: 'string', format: 'date' }, { type: 'string', format: 'date-time' },
    { type: 'object' }, { type: 'integer', format: 'int64' }, { type: 'number', format: 'decimal' }
] satisfies JsonSchema[]) {
    describe(`when registering a ${schema.type}/${schema.format ?? 'unformatted'} constrained schema`, () => {
        it('should reject the constraint without rejecting an unconstrained field', async () => {
            class Recorded { @field(Object) @unique(`Unsupported${schema.type}${schema.format ?? ''}`) key: unknown = {}; }
            eventType(`Unsupported${schema.type}${schema.format ?? ''}`)(Recorded);
            getEventTypeMetadata(Recorded)!.schema.properties!.key = schema;
            (() => new EventScenario({ artifacts: { eventTypes: [Recorded] } })).should.throw(UnsupportedEventSequenceOperation, 'artifacts.constraints');
            const scenario = new EventScenario({ artifacts: { eventTypes: [Recorded] }, constraints: 'disabled' });
            const event = new Recorded();
            event.key = schema.type === 'string' ? '2025-01-02' : schema.type === 'object' ? { value: 42 } : 1.5;
            if (schema.format === 'date-time') event.key = '2025-01-02T03:04:05.000Z';
            if (schema.type === 'integer') event.key = 42;
            (await scenario.append('A', event)).isSuccess.should.equal(true);
        });
    });
}

for (const mode of ['composite', 'scoped', 'ignoreCasing']) {
    describe(`when registering a ${mode} Guid key without fixture evidence`, () => {
        it('should reject instead of inheriting plain-string constraint support', () => {
            class Recorded { @field(Guid) key = Guid.empty; @field(String) label = ''; }
            eventType(`UnprovenGuid${mode}`)(Recorded);
            class Definition {
                define(builder: IConstraintBuilder) {
                    if (mode === 'scoped') builder.perEventSourceType();
                    builder.unique(key => {
                        if (mode === 'composite') key.on(Recorded, event => event.key, event => event.label);
                        else key.on(Recorded, event => event.key);
                        if (mode === 'ignoreCasing') key.ignoreCasing();
                    });
                }
            }
            constraint(`UnprovenGuid${mode}`)(Definition);
            (() => new EventScenario({ artifacts: { eventTypes: [Recorded], constraints: [Definition] } }))
                .should.throw(UnsupportedEventSequenceOperation, 'artifacts.constraints');
        });
    });
}

for (const protection of ['compliance', 'security'] as const) {
    describe(`when registering nested ${protection} metadata`, () => {
        it('should reject before serializing an object payload', () => {
            class Recorded { @field(Object) payload = {}; }
            eventType(`Nested${protection}`)(Recorded);
            getEventTypeMetadata(Recorded)!.schema.properties!.payload = {
                type: 'object', properties: { nested: { type: 'string', [protection]: [{ metadataType: 'protected', details: '' }] } }
            };
            (() => new EventScenario({ artifacts: { eventTypes: [Recorded] }, constraints: 'disabled' }))
                .should.throw(UnsupportedEventSequenceOperation, 'artifacts.eventTypes.schema');
        });
    });
}

describe('when registering a uuid constraint schema alias', () => {
    it('should reject unproven constraint semantics but accept a valid unconstrained payload', async () => {
        class Recorded { @field(Guid) @unique('UuidAlias') key: Guid | string = Guid.empty; }
        eventType('UuidAlias')(Recorded);
        getEventTypeMetadata(Recorded)!.schema.properties!.key.format = 'uuid';
        (() => new EventScenario({ artifacts: { eventTypes: [Recorded] } }))
            .should.throw(UnsupportedEventSequenceOperation, 'artifacts.constraints');
        const scenario = new EventScenario({ artifacts: { eventTypes: [Recorded] }, constraints: 'disabled' });
        (await scenario.append('A', new Recorded())).isSuccess.should.equal(true);
    });
});
