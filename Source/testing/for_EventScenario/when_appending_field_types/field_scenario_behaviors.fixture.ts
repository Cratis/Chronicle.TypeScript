// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { Guid, JsonSerializer, type Constructor } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it, vi, type Assertion } from 'vitest';
import type { ChronicleConnection } from '../../../connection/index.js';
import { EventSequence } from '../../../eventSequences/EventSequence.js';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import type { IUnitOfWorkManager } from '../../../transactions/IUnitOfWorkManager.js';
import { getEventTypeMetadata } from '../../../events/eventTypeDecorator.js';
import { EventScenario, ReactorScenario, ReadModelScenario, UnsupportedEventSequenceOperation, UnsupportedProjectionOperation } from '../../index.js';
import { InProcessConstraints } from '../../InProcessConstraints.js';

chai.should();
const should = (value: unknown): Assertion => (value as { should: Assertion }).should;

export function fieldScenarioBehaviors(fixtures: {
    recorded: Constructor;
    reactor: Constructor;
    model: Constructor;
    reducer: Constructor;
    guidConstraint: Constructor;
    numberConstraint: Constructor;
    projection: Constructor;
    objectProjection: Constructor;
    hashProjection: Constructor;
    guid: Constructor<{ key: Guid }>;
    number: Constructor<{ key: number }>;
    guidConcept: Constructor;
    numberConcept: Constructor;
    rejected: Constructor[];
}): void {
    const artifacts = { eventTypes: [fixtures.recorded], reducers: [], projections: [] };
    const serialized = () => JSON.parse(JsonSerializer.serialize(new fixtures.recorded())) as Record<string, unknown>;

    describe('when appending unconstrained primitive and concept fields', () => {
        let scenario: EventScenario;
        let connectedContent: Record<string, unknown>;
        beforeEach(async () => {
            scenario = new EventScenario({ artifacts });
            const append = vi.fn().mockResolvedValue({ Response: { SequenceNumber: 0n, ConstraintViolations: [], Errors: [] } });
            const connected = new EventSequence(EventSequenceId.eventLog, 'store', 'default',
                { eventSequences: { append } } as unknown as ChronicleConnection, {} as IUnitOfWorkManager);
            const event = new fixtures.recorded();
            await connected.append('A', event);
            connectedContent = JSON.parse(append.mock.calls[0][0].Content as string) as Record<string, unknown>;
            await scenario.given.forEventSource('A').events(event);
            await scenario.append('B', event);
            await scenario.appendMany('C', [event]);
            await scenario.appendMany([{ eventSourceId: 'D', event }]);
        });
        it('should serialize every append overload exactly like the connected client', () => {
            should(scenario.appendedEvents.map(event => event.content)).deep.equal(Array(4).fill(connectedContent));
            should(scenario.results.map(result => result.isSuccess)).deep.equal([true, true, true]);
        });
        it('should retain independent nested history snapshots', async () => {
            const first = scenario.appendedEvents[0].content;
            (first.payload as Record<string, unknown>).amount = -1;
            const read = await scenario.eventSequence.getForEventSourceIdAndEventTypes('A', [fixtures.recorded]);
            should(read[0].content).deep.equal(connectedContent);
        });
    });

    describe('when delivering new field types through a reactor', () => {
        let scenario: ReactorScenario;
        beforeEach(async () => {
            scenario = new ReactorScenario(fixtures.reactor, { artifacts });
            await scenario.when.forEventSource('A').events(new fixtures.recorded());
        });
        it('should deliver serialized JSON rather than concept wrappers', () => {
            should(scenario.results[0].completed).equal(true);
            should(scenario.produced[0]).deep.equal(serialized());
        });
    });

    describe('when observing new field types through a reducer', () => {
        let result: object | null;
        beforeEach(async () => {
            const scenario = new EventScenario({ artifacts });
            const models = new ReadModelScenario(fixtures.model, { ...artifacts, reducers: [fixtures.reducer] }).observe(scenario);
            await scenario.append('A', new fixtures.recorded());
            result = await models.instanceForEventSourceId('A');
        });
        it('should give the reducer the same JSON as history', () => { should(result).deep.equal(serialized()); });
    });

    describe('when observing new scalar fields through a projection', () => {
        let result: object | null;
        beforeEach(async () => {
            const scenario = new EventScenario({ artifacts });
            const models = new ReadModelScenario(fixtures.projection, artifacts).observe(scenario);
            await scenario.append('A', new fixtures.recorded());
            result = await models.instanceForEventSourceId('A');
        });
        it('should preserve the existing fixture-backed projection conversion', () => {
            const content = serialized();
            should(JSON.parse(JsonSerializer.serialize(result))).deep.equal({
                id: 'A', amount: content.amount, identifier: String(content.identifier).toLowerCase(), occurred: content.occurred });
        });
    });

    it('should still reject object projection targets independently of accepted event content', () => {
        should(() => new ReadModelScenario(fixtures.objectProjection, artifacts)).throw(UnsupportedProjectionOperation);
    });

    it('should reject a projection that treats a new payload hash as a kernel hash', async () => {
        const scenario = new EventScenario({ artifacts });
        const models = new ReadModelScenario(fixtures.hashProjection, artifacts).observe(scenario);
        await scenario.append('A', new fixtures.recorded());
        const error = await models.instanceForEventSourceId('A').then(() => undefined, error => error);
        should(error).instanceOf(UnsupportedProjectionOperation);
        should(String(error)).include('Hash');
    });

    for (const type of fixtures.rejected) {
        describe(`when registering the unproven ${type.name} unique key`, () => {
            it('should name the constraint boundary rather than rejecting ordinary event serialization', async () => {
                should(() => new EventScenario({ artifacts: { eventTypes: [type] } })).throw(UnsupportedEventSequenceOperation, 'artifacts.constraints');
                const scenario = new EventScenario({ artifacts: { eventTypes: [type] }, constraints: 'disabled' });
                should((await scenario.append('A', new type())).isSuccess).equal(true);
            });
        });
    }

    for (const type of [fixtures.guidConcept, fixtures.numberConcept]) {
        describe(`when claiming the same ${type.name} concept key`, () => {
            it('should compare its serialized primitive and report the duplicate', async () => {
                const scenario = new EventScenario({ artifacts: { eventTypes: [type] } });
                should((await scenario.append('A', new type())).isSuccess).equal(true);
                const duplicate = await scenario.append('B', new type());
                should(duplicate.isSuccess).equal(false);
                should(duplicate.constraintViolations[0].details.PropertyValue).equal(
                    String((JSON.parse(JsonSerializer.serialize(new type())) as { key: unknown }).key).toLowerCase());
            });
        });
    }

    for (const value of [1.5, 1e-7, Number.MAX_SAFE_INTEGER + 1, -Number.MAX_SAFE_INTEGER - 1, NaN, Infinity]) {
        describe(`when a constrained number contains ${value}`, () => {
            it('should reject the entire batch before recording results or history', async () => {
                const scenario = new EventScenario({ artifacts: { eventTypes: [fixtures.number], constraints: [fixtures.numberConstraint] } });
                const event = new fixtures.number(); event.key = value;
                const error = await scenario.appendMany('A', [new fixtures.number(), event]).then(() => undefined, error => error);
                should(error).instanceOf(UnsupportedEventSequenceOperation);
                should(scenario.results).have.lengthOf(0);
                should(scenario.appendedEvents).have.lengthOf(0);
            });
        });
    }

    it('should normalize negative zero using production serialization before comparing numeric keys', async () => {
        const scenario = new EventScenario({ artifacts: { eventTypes: [fixtures.number], constraints: [fixtures.numberConstraint] } });
        const zero = new fixtures.number(); zero.key = 0;
        const negative = new fixtures.number(); negative.key = -0;
        await scenario.append('A', zero);
        should((await scenario.append('B', negative)).isSuccess).equal(false);
    });

    const fixture = JSON.parse(readFileSync(new URL('../../fixtures/constraints-field-types.json', import.meta.url), 'utf8')) as {
        fieldConstraintCases: Array<{ kind: string; eventType: string; operations: Array<{ mode: string; events: Array<{ source: string; content: string }> }> }>;
        expected: Array<Array<{ success: boolean; sequences: string[]; wireViolations: unknown[]; history: unknown[]; next: string }>>;
    };
    for (const [caseIndex, test] of fixture.fieldConstraintCases.entries()) {
        if (test.kind !== 'kernelSemantics') continue;
        describe(`when replaying the packaged ${test.eventType} constraint fixture`, () => {
            it('should match every raw violation, hash, history, sequence and atomic rejection', async () => {
                const type = test.eventType === 'OracleFieldGuid' ? fixtures.guid : fixtures.number;
                should(getEventTypeMetadata(type)!.eventType.id.value).equal(test.eventType);
                const scenario = new EventScenario({ artifacts: { eventTypes: [type],
                    constraints: [type === fixtures.guid ? fixtures.guidConstraint : fixtures.numberConstraint] } });
                const validate = vi.spyOn(InProcessConstraints.prototype, 'validate');
                try {
                    for (const [index, operation] of test.operations.entries()) {
                        const expected = fixture.expected[caseIndex][index];
                        const events = operation.events.map(entry => {
                            const event = new type();
                            const key = (JSON.parse(entry.content) as { key: string | number }).key;
                            Object.assign(event, { key });
                            return { eventSourceId: entry.source, event };
                        });
                        const results = operation.mode === 'single'
                            ? [await scenario.append(events[0].eventSourceId, events[0].event)] : await scenario.appendMany(events);
                        should(results.every(result => result.isSuccess === expected.success)).equal(true);
                        should(results.map(result => result.sequenceNumber.value.toString())).deep.equal(
                            expected.success ? expected.sequences : results.map(() => '0'));
                        const raw = validate.mock.results.at(-1)!.value as ReturnType<InProcessConstraints['validate']>;
                        should(raw.map(({ SequenceNumber, ...violation }) => ({ ...violation, SequenceNumber: SequenceNumber.toString() })))
                            .deep.equal(expected.wireViolations);
                        should(scenario.appendedEvents.map(event => ({ source: event.context.eventSourceId,
                            sequence: event.context.sequenceNumber.toString(), content: event.content, hash: event.context.hash }))).deep.equal(expected.history);
                        should((await scenario.eventSequence.getNextSequenceNumber()).value.toString()).equal(expected.next);
                    }
                } finally { validate.mockRestore(); }
            });
        });
    }
}
