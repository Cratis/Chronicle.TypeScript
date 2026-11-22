// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { JsonSerializer } from '@cratis/fundamentals';
import { chai, vi, type Assertion } from 'vitest';
import type { IClientArtifactsProvider } from '../../../../artifacts/IClientArtifactsProvider.js';
import type { ChronicleConnection } from '../../../../connection/ChronicleConnection.js';
import { getEventTypeMetadata } from '../../../../events/eventTypeDecorator.js';
import { ReadModelScenario } from '../../../../testing/ReadModelScenario.js';
import { UnsupportedProjectionOperation } from '../../../../testing/projections/UnsupportedProjectionOperation.js';
import { Projections } from '../../../Projections.js';
import { fluent, history, keyExpression } from './compiled_projection.js';

chai.should();
function should(value: unknown): Assertion { return (value as { should: Assertion }).should; }
export type Candidate = { name: string; model: new () => object; artifacts: IClientArtifactsProvider; compile: typeof fluent.compile };

export function assertCompositeDefinition(candidate: Candidate, mappings: Record<string, string>) {
    const child = candidate.compile().definitions[0].Children.items;
    should(child.IdentifiedBy).equal('id');
    should(child.From.map(entry => entry.Value!.Key).sort()).deep.equal([keyExpression(), keyExpression(true)].sort());
    for (const entry of child.From) should(entry.Value!.Properties).deep.equal(mappings);
}

export async function assertRegisteredDefinition(candidate: Candidate) {
    const register = vi.fn().mockResolvedValue(undefined);
    const connection = {
        readModels: { registerMany: vi.fn().mockResolvedValue(undefined) }, projections: { register }
    } as unknown as ChronicleConnection;
    await new Projections('test-store', 'test-namespace', connection, candidate.artifacts, 'test').register();
    should(JSON.parse(JSON.stringify(register.mock.calls[0][0].Projections))).deep.equal(JSON.parse(JSON.stringify(candidate.compile().definitions)));
}

export function assertOracleInputAndCreation(candidate: Candidate) {
    const fixture = JSON.parse(readFileSync(new URL(`../../../../testing/projections/fixtures/${candidate.name}.json`, import.meta.url), 'utf8'));
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
    const events = history();
    should(events.length).equal(fixture.events.length);
    events.forEach(({ source, event }, index) => {
        const type = getEventTypeMetadata(event.constructor)!.eventType;
        should(fixture.events[index].context.eventType).deep.equal({ Id: type.id.value, Generation: type.generation.value });
        should(fixture.events[index].context.eventSourceId).equal(source);
        should(fixture.events[index].content).deep.equal(JSON.parse(JsonSerializer.serialize(event)));
    });
    should(fixture.expected.length).equal(events.length);
    should(fixture.expected.every((step: { error?: unknown }) => !step.error)).be.true;
    should(fixture.expected[5].publicRead.A.items).deep.equal([
        { id: { left: 'a', right: 'x' }, name: 'reordered' },
        { id: { left: 'a', right: 'y' }, name: 'second' },
        { id: { left: 'b', right: 'x' }, name: 'third' }
    ]);
    should(fixture.expected[10].publicRead.A.items.length).equal(5);
    should(fixture.expected[10].publicRead.A.items[0]).deep.equal({ id: { left: 'a', right: 'x' }, name: 'final' });
    should(fixture.expected[10].publicRead.B.items).deep.equal([{ id: { left: 'a', right: 'x' }, name: 'independent' }]);
}

export function assertScenarioRemainsRejected(candidate: Candidate) {
    should(() => new ReadModelScenario(candidate.model, candidate.artifacts)).throw(UnsupportedProjectionOperation)
        .and.include({ name: 'UnsupportedProjectionOperation' });
}
