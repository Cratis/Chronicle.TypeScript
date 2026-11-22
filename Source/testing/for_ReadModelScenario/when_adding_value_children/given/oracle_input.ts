// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { JsonSerializer } from '@cratis/fundamentals';
import { expect } from 'vitest';
import { getEventTypeMetadata } from '../../../../events/eventTypeDecorator.js';
import { candidate, history } from './compiled_projection.js';

export function oracleFixture() {
    return JSON.parse(readFileSync(new URL('../../../projections/fixtures/value-children-fluent.json', import.meta.url), 'utf8'));
}

export function assertOracleInput(): void {
    const fixture = oracleFixture();
    const compiled = candidate.compile();
    const { LastUpdated, ...wire } = compiled.definitions[0];
    expect(LastUpdated).toEqual(fixture.compilerLastUpdated);
    const captured = JSON.parse(JSON.stringify(wire));
    if (!Object.hasOwn(captured, 'NoAutoMapProperties')) captured.NoAutoMapProperties = [];
    expect(captured).toEqual(fixture.wireDefinition);
    expect(JSON.parse(compiled.readModels[0].Schema)).toEqual(fixture.readModel.schema);
    const schemas = [...compiled.eventSchemas.get(compiled.definitions[0])!.values()].map(entry => {
        expect(entry.eventType.Tombstone).toBe(false);
        const { Tombstone: _falseFlag, ...eventType } = entry.eventType;
        return { ...entry, eventType };
    });
    expect(schemas).toEqual(fixture.eventSchemas);
    const events = history();
    expect(events.length).toBe(fixture.events.length);
    events.forEach(({ source, event }, index) => {
        const captured = fixture.events[index];
        const type = getEventTypeMetadata(event.constructor)!.eventType;
        expect(captured.context.eventType).toEqual({ Id: type.id.value, Generation: type.generation.value });
        expect(captured.context.eventSourceId).toBe(source);
        expect(captured.context.sequenceNumber).toBe(String(index));
        expect(captured.context.occurred).toBe('2025-01-01T00:00:00Z');
        expect(captured.content).toEqual(JSON.parse(JsonSerializer.serialize(event)));
    });
}
