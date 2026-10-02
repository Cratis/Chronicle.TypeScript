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
    events: Array<{ context: Record<string, unknown> & { eventType: { Id: string; Generation: number }; eventSourceId: string; sequenceNumber: string; occurred: string }; content: unknown; expectedError?: { type: string; message: string } }>;
    expected: Array<{ sequenceNumber: string; engineState: Record<string, unknown>; publicRead: Record<string, unknown>; error?: { type: string; message: string } }>;
}

class OracleReadModel {}
const directory = new URL('./fixtures/', import.meta.url);
const allFixtures = readdirSync(directory).filter(name => name.endsWith('.json'))
    .map(name => ({ name, fixture: JSON.parse(readFileSync(new URL(name, directory), 'utf8')) as Fixture }));
const fixtures = allFixtures.filter(({ fixture }) => fixture.kind === 'kernelSemantics');
const guardErrors: Record<string, { type: string; message: string }> = {
    'composite-parent-key-without-constant.json': { type: 'UnsupportedProjectionOperation', message: 'only a lowercase id with a fixture-backed string, GUID, or number/double schema' },
    'composite-child-join-key-expression-parts.json': { type: 'UnsupportedProjectionOperation', message: 'only a lowercase id with a fixture-backed string, GUID, or number/double schema' },
    'composite-key-expression-parts.json': { type: 'UnsupportedProjectionOperation', message: 'only a lowercase id with a fixture-backed string, GUID, or number/double schema' },
    'composite-parent-key-expression-parts.json': { type: 'UnsupportedProjectionOperation', message: 'only a lowercase id with a fixture-backed string, GUID, or number/double schema' },
    'composite-join-key-expression-parts.json': { type: 'UnsupportedProjectionOperation', message: 'join keys other than $eventSourceId' },
    'from-all-only.json': { type: 'UnsupportedProjectionOperation', message: 'subscribe-to-all projections require a kernel-backed test' },
    'from-all-mixed.json': { type: 'UnsupportedProjectionOperation', message: 'subscribe-to-all projections require a kernel-backed test' },
    'from-all-exclude-children.json': { type: 'UnsupportedProjectionOperation', message: 'subscribe-to-all projections require a kernel-backed test' },
    'from-all-empty.json': { type: 'UnsupportedProjectionOperation', message: 'subscribe-to-all projections require a kernel-backed test' },
    'from-every-restricted.json': { type: 'UnsupportedProjectionOperation', message: 'fromEvery/all subscriptions require a kernel-backed test' },
    'joins-custom-key.json': { type: 'UnsupportedProjectionOperation', message: 'join keys other than $eventSourceId' },
    'joins-initial-state.json': { type: 'UnsupportedProjectionOperation', message: 'joins with initial model state' },
    'arithmetic-string-operand.json': { type: 'UnsupportedProjectionOperation', message: 'arithmetic operands must have number/double' },
    'arithmetic-nonnumeric-operand.json': { type: 'UnsupportedProjectionOperation', message: 'arithmetic operands must have number/double' },
    'arithmetic-uint32-overflow.json': { type: 'UnsupportedProjectionOperation', message: 'arithmetic targets must be number/double or integer/int32' },
    'arithmetic-null-initial.json': { type: 'UnsupportedProjectionOperation', message: 'initial numeric value must be a JSON number' },
    'null-accumulator.json': { type: 'UnsupportedProjectionOperation', message: 'clearing an arithmetic accumulator requires a kernel-backed test' },
    'concept-shaped-objects.json': { type: 'UnsupportedProjectionOperation', message: 'nested event property paths require a kernel-backed test' },
    'mapped-and-removed.json': { type: 'UnsupportedProjectionOperation', message: 'both From and RemovedWith require a kernel-backed test' },
    'mapped-id-key-wins.json': { type: 'UnsupportedProjectionOperation', message: 'identifier or case-insensitively colliding target mappings require a kernel-backed test' },
    'reject-protected-fields.json': { type: 'UnsupportedProjectionOperation', message: 'protected fields require a kernel-backed test' },
    'reject-protected-identifier.json': { type: 'UnsupportedProjectionOperation', message: 'protected fields require a kernel-backed test' }
};

function setup(fixture: Fixture): { processor: ProjectionReadModelProcessor<OracleReadModel>; events: ScenarioEvent[] } {
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
    return { processor: new ProjectionReadModelProcessor(OracleReadModel, compiled, definition), events };
}

describe('when replaying committed kernel semantics fixtures', () => {
    it('should run kernel fixtures and assert every oracle guard', () => {
        fixtures.length.should.be.greaterThan(0);
        allFixtures.filter(({ fixture }) => fixture.kind === 'oracleGuard').length.should.equal(Object.keys(guardErrors).length);
        allFixtures.every(({ fixture }) => fixture.kind === 'kernelSemantics' || fixture.kind === 'oracleGuard').should.be.true;
    });

    for (const { name, fixture } of fixtures) {
        it(`should match each engine and public read snapshot for ${name}`, async () => {
            const { processor, events } = setup(fixture);
            fixture.expected.length.should.equal(fixture.events.length);
            for (let step = 0; step < events.length; step++) {
                const expected = fixture.expected[step];
                const input = fixture.events[step];
                expected.sequenceNumber.should.equal(input.context.sequenceNumber);
                if (input.expectedError) {
                    expected.error!.should.deep.equal(input.expectedError);
                    (step === events.length - 1).should.be.true;
                    await processor.process(events.slice(0, step + 1)).then(
                        () => { throw new Error('Evaluator accepted a kernel-rejected mapping'); },
                        error => {
                            (error instanceof RangeError).should.be.true;
                            (error as Error).message.should.include(input.expectedError!.type === 'System.OverflowException'
                                ? 'outside the supported integer/int32 range' : 'not supported by integer/int32');
                        }
                    );
                    processor.engineState.should.deep.equal(expected.engineState);
                    processor.publicRead.should.deep.equal(expected.publicRead);
                } else {
                    await processor.process(events.slice(0, step + 1));
                    processor.engineState.should.deep.equal(expected.engineState);
                    processor.publicRead.should.deep.equal(expected.publicRead);
                }
            }
        });
    }

    for (const { name, fixture } of allFixtures.filter(({ fixture }) => fixture.kind === 'oracleGuard')) {
        it(`should reject the oracle guard ${name} rather than silently reproduce unproven behavior`, async () => {
            const expected = guardErrors[name];
            (expected !== undefined).should.be.true;
            for (let index = 0; index < fixture.events.length; index++) {
                const error = fixture.events[index].expectedError;
                if (error) {
                    fixture.expected[index].error!.should.deep.equal(error);
                    (index === fixture.events.length - 1).should.be.true;
                }
            }
            let actual: unknown;
            try {
                const { processor, events } = setup(fixture);
                await processor.process(events);
            } catch (error) {
                actual = error;
            }
            (actual instanceof Error).should.be.true;
            (actual as Error).name.should.equal(expected.type);
            (actual as Error).message.should.include(expected.message);
        });
    }
});
