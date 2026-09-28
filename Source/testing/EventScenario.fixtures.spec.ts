// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { readFileSync, readdirSync } from 'node:fs';
import { chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { eventType } from '../events/eventTypeDecorator.js';
import { unique } from '../events/constraints/unique.js';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber.js';
import { CorrelationId, correlationIdManager } from '../correlation/index.js';
import { EventScenario, UnsupportedEventSequenceOperation } from './index.js';

chai.should();

class OracleEventRecorded {
    @field(String) name: string;
    @field(Boolean) active: boolean;
    constructor(name: string, active: boolean) { this.name = name; this.active = active; }
}
eventType('OracleEventRecorded')(OracleEventRecorded);
class AlternateRecorded {
    @field(String) label: string;
    constructor(label: string) { this.label = label; }
}
eventType('AlternateRecorded')(AlternateRecorded);
class BoundaryRecorded {
    @field(String) firstName: string;
    @field(String) label: string;
    constructor(firstName: string, label: string) { this.firstName = firstName; this.label = label; }
}
eventType('BoundaryRecorded')(BoundaryRecorded);
class UnknownEvent {}
class UnprovenNumber {
    @field(Number) amount = 1;
}
eventType('UnprovenNumber')(UnprovenNumber);
class ConstrainedEvent {
    @field(String) value = 'value';
}
eventType('ConstrainedEvent')(ConstrainedEvent);
unique()(ConstrainedEvent);

interface Fixture {
    actions: Array<{ type?: string; source: string; name?: string; firstName?: string; active?: boolean; label?: string; occurred?: string; correlationId?: string; clientCausation?: boolean }>;
    expected: {
        results: Array<{ success: boolean; sequenceNumber: string; violations: number; errors: number;
            concurrencyViolation: boolean; waitError: string }>;
        history: Array<{ sequenceNumber: string; source: string; sourceType: string; streamType: string; streamId: string;
            subject: string; store: string; namespace: string; eventType: string; generation: number; hash: string; content: object;
            occurredValid: boolean; correlationValid: boolean; explicitOccurred: string | null; explicitCorrelation: string | null;
            tagsCount: number; causedByName: string; observationState: number; causationCount: number;
            causation: Array<{ type: string; properties: Record<string, string> }> }>;
        next: string; tail: string; tailA: string; hasSourceA: boolean; sourceA: string[]; fromOne: string[]; byType: string[];
    };
}
const directory = new URL('./fixtures/', import.meta.url);
const fixtures = readdirSync(directory).filter(name => name.endsWith('.json') &&
    !['batches.json', 'batch-omitted-routes.json', 'batch-rollback.json', 'builders.json', 'constraints.json'].includes(name)).map(name => ({
    name, fixture: JSON.parse(readFileSync(new URL(name, directory), 'utf8')) as Fixture
}));
const artifacts = { eventTypes: [OracleEventRecorded, AlternateRecorded, BoundaryRecorded], constraints: [] };
const makeScenario = (action?: Fixture['actions'][number]) => new EventScenario({
    artifacts, constraints: 'disabled',
    clock: action?.occurred ? () => new Date(action.occurred!) : undefined,
    correlationId: action?.correlationId ? () => action.correlationId! : undefined
});

async function unsupportedAsync(action: () => Promise<unknown>, operation: string): Promise<void> {
    await action().then(
        () => { throw new Error(`Expected ${operation} rejection`); },
        error => {
            (error instanceof UnsupportedEventSequenceOperation).should.be.true;
            (error as Error).message.should.include(operation);
            (error as Error).message.should.include('Use a kernel-backed test.');
        }
    );
}

function unsupported(action: () => unknown, operation: string): void {
    try { action(); throw new Error('Expected rejection'); }
    catch (error) {
        (error instanceof UnsupportedEventSequenceOperation).should.be.true;
        (error as Error).message.should.include(operation);
        (error as Error).message.should.include('Use a kernel-backed test.');
    }
}

describe('when appending against committed kernel event fixtures', () => {
    it('should include a non-vacuous empty sequence, single append, alternate schema and interleaved sources', () => {
        fixtures.map(item => item.name).should.deep.equal(['alternate.json', 'boundary.json', 'client-causation.json', 'empty.json', 'explicit-metadata.json', 'interleaved.json', 'single.json', 'source-tail-before-global.json']);
    });

    for (const { name, fixture } of fixtures) {
        it(`should match the accepted event and essential read snapshots for ${name}`, async () => {
            const scenario = makeScenario(fixture.actions[0]);
            for (const action of fixture.actions) {
                const event = action.type === 'alternate'
                    ? new AlternateRecorded(action.label!) : action.type === 'boundary'
                        ? new BoundaryRecorded(action.firstName!, action.label!) : new OracleEventRecorded(action.name!, action.active!);
                const result = await scenario.append(action.source, event);
                result.isSuccess.should.equal(true);
            }
            scenario.results.map(item => ({ success: item.isSuccess, sequenceNumber: item.sequenceNumber.value.toString(),
                violations: item.constraintViolations.length, errors: item.errors.length,
                concurrencyViolation: item.concurrencyViolation !== undefined }))
                .should.deep.equal(fixture.expected.results.map(({ waitError: _waitError, ...result }) => result));
            for (const [index, result] of scenario.results.entries()) {
                fixture.expected.results[index].waitError.should.equal('CannotWaitForObserverCompletion');
                await result.waitForCompletion().then(
                    () => { throw new Error('Observers did not run but completion succeeded'); },
                    error => { (error instanceof UnsupportedEventSequenceOperation).should.be.true; }
                );
            }
            const history = scenario.appendedEvents;
            history.length.should.equal(fixture.expected.history.length);
            for (let index = 0; index < history.length; index++) {
                const actual = history[index];
                const expected = fixture.expected.history[index];
                ({ sequenceNumber: actual.context.sequenceNumber.toString(), source: actual.context.eventSourceId,
                    sourceType: actual.context.eventSourceType, streamType: actual.context.eventStreamType,
                    streamId: actual.context.eventStreamId, subject: actual.context.subject,
                    store: actual.context.eventStore, namespace: actual.context.namespace,
                    eventType: actual.eventType.id.value, generation: actual.eventType.generation.value,
                    hash: actual.context.hash, content: actual.content }).should.deep.equal({
                    sequenceNumber: expected.sequenceNumber, source: expected.source,
                    sourceType: expected.sourceType, streamType: expected.streamType, streamId: expected.streamId,
                    subject: expected.subject, store: expected.store, namespace: expected.namespace,
                    eventType: expected.eventType, generation: expected.generation, hash: expected.hash, content: expected.content
                });
                (actual.context.occurred instanceof Date && !Number.isNaN(actual.context.occurred.getTime())).should.equal(expected.occurredValid);
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actual.context.correlationId)
                    .should.equal(expected.correlationValid);
                actual.context.tags.length.should.equal(expected.tagsCount);
                actual.context.causedBy!.name.should.equal(expected.causedByName);
                actual.context.observationState!.should.equal(expected.observationState);
                const causation = actual.context.causation.map(item => ({ type: item.type, properties: item.properties }));
                if (fixture.actions[index].clientCausation) {
                    causation.should.deep.equal(expected.causation);
                    causation.length.should.equal(expected.causationCount);
                } else {
                    // The .NET client's default root is Unknown; the TS client prepares Root + Append.
                    expected.causation.should.deep.equal([{ type: 'Unknown', properties: {} }]);
                    causation.should.deep.equal([
                        { type: 'Root', properties: {} },
                        { type: 'TypeScriptClient.Append', properties: { eventType: expected.eventType } }
                    ]);
                }
                if (expected.explicitOccurred) {
                    actual.context.occurred.toISOString().slice(0, 19).should.equal(expected.explicitOccurred.slice(0, 19));
                    actual.context.correlationId.should.equal(expected.explicitCorrelation);
                }
            }
            (await scenario.eventSequence.getNextSequenceNumber()).value.toString().should.equal(fixture.expected.next);
            (await scenario.eventSequence.getTailSequenceNumber()).value.toString().should.equal(fixture.expected.tail);
            (await scenario.eventSequence.getTailSequenceNumber('A')).value.toString().should.equal(fixture.expected.tailA);
            if (name === 'source-tail-before-global.json') {
                fixture.expected.tailA.should.not.equal(fixture.expected.tail);
            }
            (await scenario.eventSequence.hasEventsFor('A')).should.equal(fixture.expected.hasSourceA);
            const sourceEvents = await scenario.eventSequence.getFromSequenceNumber(EventSequenceNumber.first, 'A');
            sourceEvents.map(item => item.context.sequenceNumber.toString()).should.deep.equal(fixture.expected.sourceA);
            sourceEvents.map(item => item.context.observationState).should.deep.equal(
                fixture.expected.history.filter(item => item.source === 'A').map(item => item.observationState));
            (await scenario.eventSequence.getFromSequenceNumber(new EventSequenceNumber(1n)))
                .map(item => item.context.sequenceNumber.toString()).should.deep.equal(fixture.expected.fromOne);
            const byType = await scenario.eventSequence.getForEventSourceIdAndEventTypes('A', [OracleEventRecorded]);
            byType.map(item => item.context.sequenceNumber.toString()).should.deep.equal(fixture.expected.byType);
            byType.map(item => item.context.observationState).should.deep.equal(
                fixture.expected.history.filter(item => item.source === 'A' && item.eventType === 'OracleEventRecorded')
                    .map(item => item.observationState));
        });
    }

    it('should keep setup out of results, protect history, and allow a single when action', async () => {
        const scenario = makeScenario();
        const seed = new OracleEventRecorded('seed', true);
        await scenario.given.forEventSource('A').events(seed);
        seed.name = 'changed';
        (await scenario.when.forEventSource('B').event(new AlternateRecorded('act'))).isSuccess.should.be.true;
        scenario.results.length.should.equal(1);
        scenario.then.results.should.deep.equal(scenario.results);
        scenario.appendedEvents[0].content.should.deep.equal({ name: 'seed', active: true });
        (scenario.appendedEvents[0].content as { name: string }).name = 'changed again';
        scenario.appendedEvents[0].content.should.deep.equal({ name: 'seed', active: true });
        (await scenario).should.equal(scenario);
        scenario.eventLog.should.equal(scenario.eventSequence);
    });


    it('should reject unproven schemas and registrations but discover supported constraints', async () => {
        unsupported(() => new EventScenario({ artifacts: { eventTypes: [UnprovenNumber] }, constraints: 'disabled' }), 'schema');
        const constrained = new EventScenario({ artifacts: { eventTypes: [ConstrainedEvent] } });
        (await constrained.append('A', new ConstrainedEvent())).isSuccess.should.be.true;
        (await constrained.append('A', new ConstrainedEvent())).constraintViolations.length.should.equal(1);
        unsupported(() => new EventScenario({ artifacts }), 'empty constraint catalog');
        unsupported(() => new EventScenario({ artifacts, constraints: 'disabled', eventStore: 'other-store' }), 'eventStore');
        const scenario = makeScenario();
        try { await scenario.append('A', new UnknownEvent()); throw new Error('Expected rejection'); }
        catch (error) { (error instanceof UnsupportedEventSequenceOperation).should.be.true; }
        scenario.appendedEvents.length.should.equal(0);
    });

    it('should reject an act that overlaps unfinished setup without losing its result', async () => {
        const scenario = makeScenario();
        const pending = scenario.given.forEventSource('A').events(new OracleEventRecorded('seed', true));
        await scenario.append('B', new AlternateRecorded('act')).then(
            () => { throw new Error('Overlapping append succeeded'); },
            error => { (error instanceof UnsupportedEventSequenceOperation).should.be.true; }
        );
        await pending;
        scenario.results.length.should.equal(0);
        scenario.appendedEvents.length.should.equal(1);
    });

    it('should reject prototype getters and non-enumerable append metadata without mutation', async () => {
        const scenario = makeScenario();
        class OptionsWithGetters {
            get subject() { return 'different-subject'; }
            get streamId() { return 'different-stream'; }
        }
        await unsupportedAsync(() => scenario.append('A', new OracleEventRecorded('one', true), new OptionsWithGetters()), 'append.options');
        const hidden = Object.defineProperty({}, 'subject', { value: 'different-subject', enumerable: false });
        await unsupportedAsync(() => scenario.append('A', new OracleEventRecorded('one', true), hidden), 'append.options');
        scenario.appendedEvents.length.should.equal(0);
        scenario.results.length.should.equal(0);
    });

    it('should reject malformed hook and ambient correlation IDs before mutation', async () => {
        const malformed = 'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz';
        const fromHook = new EventScenario({ artifacts, constraints: 'disabled', correlationId: () => malformed });
        await unsupportedAsync(() => fromHook.append('A', new OracleEventRecorded('one', true)), 'append.correlationId');
        fromHook.appendedEvents.length.should.equal(0);
        fromHook.results.length.should.equal(0);
        const fromAmbient = makeScenario();
        await correlationIdManager.run(new CorrelationId(malformed), () =>
            unsupportedAsync(() => fromAmbient.append('A', new OracleEventRecorded('one', true)), 'append.correlationId'));
        fromAmbient.appendedEvents.length.should.equal(0);
        fromAmbient.results.length.should.equal(0);
    });

    it('should reject unproven blank and padded read source filters', async () => {
        const scenario = makeScenario();
        await scenario.append('A', new OracleEventRecorded('one', true));
        for (const source of ['', ' ', ' A ']) {
            await unsupportedAsync(() => scenario.eventSequence.hasEventsFor(source), 'hasEventsFor.source');
            await unsupportedAsync(() => scenario.eventSequence.getTailSequenceNumber(source), 'getTailSequenceNumber.source');
            await unsupportedAsync(() => scenario.eventSequence.getFromSequenceNumber(EventSequenceNumber.first, source), 'getFromSequenceNumber.source');
            await unsupportedAsync(() => scenario.eventSequence.getForEventSourceIdAndEventTypes(source, [OracleEventRecorded]), 'getForEventSourceIdAndEventTypes.source');
        }
        scenario.appendedEvents.length.should.equal(1);
        scenario.results.length.should.equal(1);
    });

    it('should record direct act-phase append calls without reporting setup results', async () => {
        const scenario = makeScenario();
        await scenario.given.forEventSource('A').events(new OracleEventRecorded('seed', true));
        await scenario.eventSequence.append('B', new AlternateRecorded('act'));
        scenario.results.length.should.equal(1);
        scenario.appendedEvents.length.should.equal(2);
    });
});
