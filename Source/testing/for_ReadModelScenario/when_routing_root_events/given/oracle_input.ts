// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { JsonSerializer, type Constructor } from '@cratis/fundamentals';
import { chai, type Assertion } from 'vitest';
import { getEventTypeMetadata } from '../../../../events/eventTypeDecorator.js';
import { ReadModelScenario } from '../../../ReadModelScenario.js';
import { history, type Model } from './compiled_projection.js';
import type { fluent } from './compiled_projection.js';

chai.should();
function should(value: unknown): Assertion { return (value as { should: Assertion }).should; }
type Candidate = { name: string; model: Constructor<Model>; artifacts: typeof fluent.artifacts; compile: typeof fluent.compile };

function fixtureFor(candidate: Candidate) {
    return JSON.parse(readFileSync(new URL(`../../../projections/fixtures/${candidate.name}.json`, import.meta.url), 'utf8'));
}

export function assertOracleInput(candidate: Candidate) {
    const fixture = fixtureFor(candidate);
    const compiled = candidate.compile();
    const { LastUpdated, ...wire } = compiled.definitions[0];
    should(LastUpdated).deep.equal(fixture.compilerLastUpdated);
    should(JSON.parse(JSON.stringify({ ...wire, NoAutoMapProperties: Object.hasOwn(wire, 'NoAutoMapProperties') ? wire.NoAutoMapProperties : [] }))).deep.equal(fixture.wireDefinition);
    should({ schema: JSON.parse(compiled.readModels[0].Schema) }).deep.equal(fixture.readModel);
    const schemas = [...compiled.eventSchemas.get(compiled.definitions[0])!.values()].map(entry => {
        should(entry.eventType.Tombstone).be.false;
        const { Tombstone: _falseFlag, ...eventType } = entry.eventType;
        return { ...entry, eventType };
    });
    should(schemas).deep.equal(fixture.eventSchemas);
    const events = history();
    should(events.length).equal(fixture.events.length);
    events.forEach(({ source, event }, index) => {
        const captured = fixture.events[index];
        const type = getEventTypeMetadata(event.constructor)!.eventType;
        should(captured).deep.equal({
            context: {
                eventType: { Id: type.id.value, Generation: type.generation.value }, eventSourceId: source,
                sequenceNumber: String(index), occurred: '2025-01-01T00:00:00Z'
            },
            content: JSON.parse(JsonSerializer.serialize(event))
        });
    });
}

export async function assertOracleReads(candidate: Candidate) {
    const fixture = fixtureFor(candidate);
    const scenario = new ReadModelScenario(candidate.model, candidate.artifacts);
    const events = history();
    should(fixture.expected.length).equal(events.length);
    for (const [index, { source, event }] of events.entries()) {
        scenario.given.forEventSource(source).events(event);
        for (const id of ['A', 'B', 'source-1', 'source-2']) {
            const expected = fixture.expected[index].publicRead[id] ?? null;
            const actual = await scenario.instanceForEventSourceId(id);
            should([JSON.parse(JSON.stringify(actual))]).deep.equal([expected]);
            should([JSON.parse(JSON.stringify(await scenario.instanceForEventSourceId(id)))]).deep.equal([expected]);
        }
    }
}
