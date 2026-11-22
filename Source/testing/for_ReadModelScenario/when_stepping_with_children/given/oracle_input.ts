// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { JsonSerializer } from '@cratis/fundamentals';
import { chai, type Assertion } from 'vitest';
import { getEventTypeMetadata } from '../../../../events/eventTypeDecorator.js';
import type { compile } from './compiled_projection.js';
import { history } from './lifecycle.js';

chai.should();
function should(value: unknown): Assertion { return (value as { should: Assertion }).should; }

export function assertOracleInput(candidate: { name: string; event: new (amount: number) => object; compile: typeof compile }) {
    const fixture = JSON.parse(readFileSync(new URL(`../../../projections/fixtures/${candidate.name}.json`, import.meta.url), 'utf8'));
    const compiled = candidate.compile();
    const { LastUpdated, ...wire } = compiled.definitions[0];
    should(LastUpdated).deep.equal(fixture.compilerLastUpdated);
    should(JSON.parse(JSON.stringify({ ...wire, NoAutoMapProperties: Object.hasOwn(wire, 'NoAutoMapProperties') ? wire.NoAutoMapProperties : [] }))).deep.equal(fixture.wireDefinition);
    should(JSON.parse(compiled.readModels[0].Schema)).deep.equal(fixture.readModel.schema);
    const schemas = [...compiled.eventSchemas.get(compiled.definitions[0])!.values()].map(entry => {
        should(entry.eventType.Tombstone).be.false;
        const { Tombstone: _falseFlag, ...eventType } = entry.eventType;
        return { ...entry, eventType };
    });
    should(schemas).deep.equal(fixture.eventSchemas);
    const events = history(amount => new candidate.event(amount));
    should(events.length).equal(fixture.events.length);
    events.forEach(({ source, event }, index) => {
        const captured = fixture.events[index];
        const type = getEventTypeMetadata(event.constructor)!.eventType;
        should(captured.context.eventType).deep.equal({ Id: type.id.value, Generation: type.generation.value });
        should(captured.context.eventSourceId).equal(source);
        should(captured.content).deep.equal(JSON.parse(JsonSerializer.serialize(event)));
    });
}
