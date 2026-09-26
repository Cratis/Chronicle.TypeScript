// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { readFileSync, readdirSync } from 'node:fs';
import { chai, describe, it } from 'vitest';
import { ReadModelObserverType, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import { EventType } from '../../events/EventType.js';
import type { EventContext } from '../../events/EventContext.js';
import { buildReadModelDefinition } from '../../readModels/buildReadModelDefinition.js';
import type { CompiledProjectionDefinitions } from '../../projections/CompiledProjectionDefinitions.js';
import type { ProjectionEventSchema } from '../../projections/ProjectionEventSchema.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import type { ScenarioEvent } from '../ScenarioEvent.js';
import { ProjectionReadModelProcessor } from './ProjectionReadModelProcessor.js';

chai.should();

type FixtureSchema = Omit<JsonSchema, 'type' | 'properties' | 'items' | 'additionalProperties'> & {
    type?: JsonSchema['type'] | readonly ['string', 'null'];
    properties?: Record<string, FixtureSchema>;
    items?: FixtureSchema;
    additionalProperties?: boolean | FixtureSchema;
};

interface Fixture {
    kind: 'kernelSemantics' | 'oracleGuard';
    wireDefinition: ProjectionDefinition;
    readModel: { schema: FixtureSchema };
    eventSchemas: Array<{ eventType: { Id: string; Generation: number }; schema: FixtureSchema }>;
    events: Array<{ context: Record<string, unknown> & { eventType: { Id: string; Generation: number }; eventSourceId: string; sequenceNumber: string; occurred: string }; content: unknown }>;
    expected: Array<{ sequenceNumber: string; engineState: Record<string, unknown>; publicRead: Record<string, unknown> }>;
}

class OracleReadModel {}
const directory = new URL('./fixtures/', import.meta.url);
const allFixtures = readdirSync(directory).filter(name => name.endsWith('.json'))
    .map(name => ({ name, fixture: JSON.parse(readFileSync(new URL(name, directory), 'utf8')) as Fixture }));
const fixtures = allFixtures.filter(({ fixture }) => fixture.kind === 'kernelSemantics');

describe('when replaying committed kernel semantics fixtures', () => {
    it('should run at least one kernel fixture and exclude oracle guards', () => {
        fixtures.length.should.be.greaterThan(0);
        allFixtures.every(({ fixture }) => fixture.kind === 'kernelSemantics' || fixture.kind === 'oracleGuard').should.be.true;
    });

    for (const { name, fixture } of fixtures) {
        it(`should match each engine and public read snapshot for ${name}`, async () => {
            const definition = fixture.wireDefinition;
            const schemas = new Map<string, ProjectionEventSchema>(fixture.eventSchemas.map(entry => [
                `${entry.eventType.Id}:${entry.eventType.Generation}:0`,
                { eventType: { ...entry.eventType, Tombstone: false }, schema: entry.schema as JsonSchema }
            ]));
            const compiled: CompiledProjectionDefinitions = {
                definitions: [definition],
                readModels: [buildReadModelDefinition({ identifier: definition.ReadModel, schema: JSON.stringify(fixture.readModel.schema),
                    sinkTypeId: 'test', observerType: ReadModelObserverType.Projection, observerIdentifier: definition.Identifier })],
                provenance: new Map([[definition, []]]), eventSchemas: new Map([[definition, schemas]])
            };
            const processor = new ProjectionReadModelProcessor(OracleReadModel, compiled, definition);
            fixture.expected.length.should.equal(fixture.events.length);
            const events: ScenarioEvent[] = fixture.events.map(({ context, content }) => ({
                sourceId: context.eventSourceId, content,
                context: {
                    ...context,
                    eventType: EventType.parse(`${context.eventType.Id}+${context.eventType.Generation}`),
                    sequenceNumber: BigInt(context.sequenceNumber), occurred: new Date(context.occurred),
                    causation: context.causation ?? [], tags: context.tags ?? [],
                    correlationId: context.correlationId ?? '00000000-0000-0000-0000-000000000000'
                } as EventContext
            }));
            for (let step = 0; step < events.length; step++) {
                const expected = fixture.expected[step];
                expected.sequenceNumber.should.equal(fixture.events[step].context.sequenceNumber);
                await processor.process(events.slice(0, step + 1));
                processor.engineState.should.deep.equal(expected.engineState);
                processor.publicRead.should.deep.equal(expected.publicRead);
            }
        });
    }
});
