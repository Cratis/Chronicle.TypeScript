// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { JsonSerializer } from '@cratis/fundamentals';
import { chai, type Assertion } from 'vitest';
import { getEventTypeMetadata } from '../../../../events/eventTypeDecorator.js';
import { history, unhandledSchema, type Candidate } from './compiled_projection.js';

chai.should();
function should(value: unknown): Assertion { return (value as { should: Assertion }).should; }

export function emittedInput(candidate: Candidate) {
    const compiled = candidate.compile();
    return {
        wireDefinition: JSON.parse(JSON.stringify(compiled.definitions[0])),
        readModel: { schema: JSON.parse(compiled.readModels[0].Schema) },
        eventSchemas: [...compiled.eventSchemas.get(compiled.definitions[0])!.values(), ...unhandledSchema()],
        events: history().map(({ source, event }, index) => {
            const type = getEventTypeMetadata(event.constructor)!.eventType;
            return {
                context: { eventType: { Id: type.id.value, Generation: type.generation.value }, eventSourceId: source,
                    sequenceNumber: String(index), occurred: '2025-01-01T00:00:00Z' },
                content: JSON.parse(JsonSerializer.serialize(event))
            };
        })
    };
}

export function assertOracleInput(candidate: Candidate): void {
    const fixture = JSON.parse(readFileSync(new URL(`../../../projections/fixtures/${candidate.name}.json`, import.meta.url), 'utf8'));
    const emitted = emittedInput(candidate);
    const { LastUpdated, ...wire } = emitted.wireDefinition;
    should(LastUpdated).deep.equal(fixture.compilerLastUpdated);
    should({ ...wire, NoAutoMapProperties: Object.hasOwn(wire, 'NoAutoMapProperties') ? wire.NoAutoMapProperties : [] }).deep.equal(fixture.wireDefinition);
    should(emitted.readModel).deep.equal(fixture.readModel);
    const schemas = emitted.eventSchemas.map(entry => {
        should(entry.eventType.Tombstone).be.false;
        const { Tombstone: _falseFlag, ...eventType } = entry.eventType;
        return { ...entry, eventType };
    });
    should(schemas).deep.equal(fixture.eventSchemas);
    should(emitted.events).deep.equal(fixture.events);
}
