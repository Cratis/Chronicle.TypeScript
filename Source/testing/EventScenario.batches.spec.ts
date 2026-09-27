// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { causationManager, CausationType } from '../auditing/index.js';
import { Identity, identityProvider } from '../identity/index.js';
import type { AppendOptions } from '../eventSequences/AppendOptions.js';
import type { EventForEventSourceId } from '../eventSequences/EventForEventSourceId.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { Tag } from '../events/Tag.js';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber.js';
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
class UnregisteredRecorded {
    @field(String) name = 'unregistered';
}
eventType('UnregisteredRecorded')(UnregisteredRecorded);

const fixedCorrelationId = '11111111-2222-3333-4444-555555555555';
const explicitCorrelationId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

type Entry = { source: string; type?: string; name?: string; active?: boolean; label?: string;
    sourceType?: string; streamType?: string; streamId?: string; subject?: string; occurred?: string; tags?: string[] };
type Operation = { overload: string; events: Entry[]; options?: {
    sourceType?: string; streamType?: string; streamId?: string; subject?: string; occurred?: string; correlationId?: string; tags?: string[] } };
type History = { sequence: string; source: string; sourceType: string; streamType: string; streamId: string;
    store: string; namespace: string; observationState: number; causedByName: string; generation: number;
    causation: Array<{ type: string; properties: Record<string, string> }>;
    subject: string; occurredValid: boolean; explicitOccurred: string | null; correlationValid: boolean;
    explicitCorrelation: string | null; tags: string[]; hash: string; type: string; content: object };
type Fixture = { operations: Operation[]; expected: { outcomes: Array<{ success?: boolean; sequences?: string[];
    violations?: number; errors?: number; concurrencyViolation?: boolean; rejection?: string; given?: number;
    sequentialSuccess?: boolean; lastSequence?: string }>;
    history: History[]; notifications: Array<Array<{ sequence: string; source: string; type: string; success: boolean }>>;
    next: string; tail: string; tailA: string; tailByType: string;
    fromOneByType: string[]; byRoute: string[]; byDefaultRoute: string[]; byAllStreamType: string[];
    tailByAll: string; byCustomRoute: string[]; tailByRoute: string } };
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as Fixture;
const create = () => new EventScenario({ artifacts: { eventTypes: [OracleEventRecorded, AlternateRecorded] }, constraints: 'disabled' });
const value = (entry: Entry) => entry.type === 'alternate' ? new AlternateRecorded(entry.label!) : new OracleEventRecorded(entry.name!, entry.active!);
const entries = (operation: Operation) => operation.events.map(entry => ({ eventSourceId: entry.source, event: value(entry),
    eventSourceType: entry.sourceType, eventStreamType: entry.streamType, eventStreamId: entry.streamId,
    subject: entry.subject, occurred: entry.occurred ? new Date(entry.occurred) : undefined, tags: entry.tags }));
const options = (operation: Operation) => operation.options && {
    sourceType: operation.options.sourceType, streamType: operation.options.streamType, streamId: operation.options.streamId,
    subject: operation.options.subject, occurred: operation.options.occurred ? new Date(operation.options.occurred) : undefined,
    correlationId: operation.options.correlationId, tags: operation.options.tags
};

async function compareReads(scenario: EventScenario, expected: Fixture['expected']): Promise<void> {
    (await scenario.eventSequence.getNextSequenceNumber()).value.toString().should.equal(expected.next);
    (await scenario.eventSequence.getTailSequenceNumber()).value.toString().should.equal(expected.tail);
    (await scenario.eventSequence.getTailSequenceNumber('A')).value.toString().should.equal(expected.tailA);
    (await scenario.eventSequence.getTailSequenceNumber(undefined, undefined, undefined, undefined, [AlternateRecorded]))
        .value.toString().should.equal(expected.tailByType);
    (await scenario.eventSequence.getFromSequenceNumber(new EventSequenceNumber(1n), undefined, [AlternateRecorded]))
        .map(item => item.context.sequenceNumber.toString()).should.deep.equal(expected.fromOneByType);
    (await scenario.eventSequence.getForEventSourceIdAndEventTypes('A', [OracleEventRecorded], 'All', 'Default', 'Default'))
        .map(item => item.context.sequenceNumber.toString()).should.deep.equal(expected.byRoute);
    (await scenario.eventSequence.getForEventSourceIdAndEventTypes('B', [OracleEventRecorded], 'All', 'Default', 'Default'))
        .map(item => item.context.sequenceNumber.toString()).should.deep.equal(expected.byDefaultRoute);
    (await scenario.eventSequence.getForEventSourceIdAndEventTypes('A', [AlternateRecorded], 'All'))
        .map(item => item.context.sequenceNumber.toString()).should.deep.equal(expected.byAllStreamType);
    (await scenario.eventSequence.getTailSequenceNumber('A', undefined, 'All', undefined, [AlternateRecorded]))
        .value.toString().should.equal(expected.tailByAll);
    (await scenario.eventSequence.getForEventSourceIdAndEventTypes('B', [OracleEventRecorded], 'Other', 'stream2', 'Custom'))
        .map(item => item.context.sequenceNumber.toString()).should.deep.equal(expected.byCustomRoute);
    (await scenario.eventSequence.getTailSequenceNumber('B', 'Custom', 'Other', 'stream2', [OracleEventRecorded]))
        .value.toString().should.equal(expected.tailByRoute);
}

function compareHistory(scenario: EventScenario, expected: History[]): void {
    scenario.appendedEvents.length.should.equal(expected.length);
    scenario.appendedEvents.forEach((event, index) => {
        const entry = expected[index];
        ({ sequence: event.context.sequenceNumber.toString(), source: event.context.eventSourceId,
            store: event.context.eventStore, namespace: event.context.namespace,
            observationState: event.context.observationState, causedByName: event.context.causedBy?.name,
            generation: event.eventType.generation.value,
            sourceType: event.context.eventSourceType, streamType: event.context.eventStreamType,
            streamId: event.context.eventStreamId, subject: event.context.subject,
            hash: event.context.hash, type: event.eventType.id.value, content: event.content,
            tags: event.context.tags.map(tag => tag.value) }).should.deep.equal({ sequence: entry.sequence,
            source: entry.source, sourceType: entry.sourceType, streamType: entry.streamType, streamId: entry.streamId,
            store: entry.store, namespace: entry.namespace, observationState: entry.observationState,
            causedByName: entry.causedByName, generation: entry.generation,
            subject: entry.subject, hash: entry.hash, type: entry.type, content: entry.content, tags: entry.tags });
        (!Number.isNaN(event.context.occurred.getTime()) && event.context.occurred.getUTCFullYear() > 2020)
            .should.equal(entry.occurredValid);
        /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(event.context.correlationId)
            .should.equal(entry.correlationValid);
        if (entry.explicitOccurred) event.context.occurred.toISOString().should.equal(entry.explicitOccurred);
        if (entry.explicitCorrelation) event.context.correlationId.should.equal(entry.explicitCorrelation);
        const causation = event.context.causation.map(item => ({ type: item.type, properties: item.properties }));
        if (entry.causation[0].type === 'Root') causation.should.deep.equal(entry.causation);
        else entry.causation.should.deep.equal([{ type: 'Unknown', properties: {} }]);
    });
}

describe('when appending batches against committed kernel fixtures', () => {
    it('should match both overloads, entry-over-shared metadata, empty rejection and remaining reads', async () => {
        const { operations, expected } = fixture('batches');
        const scenario = create();
        const iterator = scenario.eventSequence.appendOperations[Symbol.asyncIterator]();
        let notificationIndex = 0;
        for (const [index, operation] of operations.entries()) {
            if (expected.outcomes[index].rejection) {
                await scenario.appendMany('A', []).then(
                    () => { throw new Error('Expected the kernel-proven empty batch rejection'); },
                    error => { (error instanceof UnsupportedEventSequenceOperation).should.be.true; }
                );
                continue;
            }
            const next = iterator.next();
            const results = operation.overload === 'same'
                ? await scenario.appendMany(operation.events[0].source, operation.events.map(value), options(operation))
                : await scenario.eventSequence.appendMany(entries(operation), options(operation));
            const notified = (await next).value!;
            notified.every(item => item.event.context.occurred === notified[0].event.context.occurred).should.be.true;
            notified.map(item => ({ sequence: item.result.sequenceNumber.value.toString(),
                source: item.event.context.eventSourceId, type: item.event.eventType.id.value,
                success: item.result.isSuccess })).should.deep.equal(expected.notifications[notificationIndex++]);
            results.map(result => result.sequenceNumber.value.toString()).should.deep.equal(expected.outcomes[index].sequences);
            results.map(result => ({ success: result.isSuccess, violations: result.constraintViolations.length,
                errors: result.errors.length, concurrencyViolation: result.concurrencyViolation !== undefined }))
                .should.deep.equal(results.map(() => ({ success: expected.outcomes[index].success,
                    violations: expected.outcomes[index].violations, errors: expected.outcomes[index].errors,
                    concurrencyViolation: expected.outcomes[index].concurrencyViolation })));
            for (const result of results) {
                await result.waitForCompletion().then(
                    () => { throw new Error('Observers did not run but completion succeeded'); },
                    error => { (error instanceof UnsupportedEventSequenceOperation).should.be.true; });
            }
        }
        notificationIndex.should.equal(expected.notifications.length);
        await iterator.return?.();
        scenario.results.map(result => result.sequenceNumber.value.toString()).should.deep.equal(['0', '1', '2', '3', '4']);
        scenario.then.results.should.deep.equal(scenario.results);
        compareHistory(scenario, expected.history);
        await compareReads(scenario, expected);
    });

    it('should seed multiple given events sequentially; TypeScript plural when remains an atomic batch', async () => {
        const { operations, expected } = fixture('builders');
        const scenario = create();
        for (const [index, operation] of operations.entries()) {
            if (operation.overload === 'given') {
                await scenario.given.forEventSource('A').events(...operation.events.map(value));
                expected.outcomes[index].given.should.equal(operation.events.length);
            } else {
                const result = await scenario.when.forEventSource('A').events(...operation.events.map(value));
                result.map(item => item.sequenceNumber.value.toString()).should.deep.equal(['2', '3']);
            }
        }
        scenario.results.length.should.equal(2);
        compareHistory(scenario, expected.history);
        await compareReads(scenario, expected);
    });

    it('should reject concurrency scopes before committing a batch', async () => {
        const scenario = create();
        // A concurrency scope has no in-process kernel validation and must be rejected.
        await scenario.appendMany('A', [new OracleEventRecorded('would rollback', true)],
            { concurrencyScopes: { A: {} as never } }).then(
            () => { throw new Error('Unproven constraint scope accepted'); },
            error => { (error instanceof UnsupportedEventSequenceOperation).should.be.true; }
        );
        scenario.appendedEvents.length.should.equal(0);
        scenario.results.length.should.equal(0);
    });

    it('should reject overlapping batches and unsupported metadata before mutation', async () => {
        const scenario = create();
        const first = scenario.appendMany('A', [new OracleEventRecorded('first', true)]);
        await scenario.appendMany('B', [new OracleEventRecorded('second', false)]).then(
            () => { throw new Error('Overlapping batch accepted'); },
            error => { (error instanceof UnsupportedEventSequenceOperation).should.be.true; }
        );
        await first;
        for (const options of [{ subject: 'bad subject' }, { tags: ['invalid|tag'] },
            { concurrencyScope: {} as never }]) {
            await scenario.appendMany('B', [new OracleEventRecorded('second', false)], options).then(
                () => { throw new Error('Unproven metadata accepted'); },
                error => { (error instanceof UnsupportedEventSequenceOperation).should.be.true; }
            );
        }
        scenario.appendedEvents.length.should.equal(1);
        scenario.results.length.should.equal(1);
    });

    it('should reject a malformed entry before committing any of the batch or recording results', async () => {
        const scenario = create();
        await scenario.appendMany('A', [new OracleEventRecorded('valid', true), new OracleEventRecorded('"', true)]).then(
            () => { throw new Error('Unsupported content was accepted'); },
            error => { (error instanceof UnsupportedEventSequenceOperation).should.be.true; (error as Error).message.should.include('appendMany.content'); }
        );
        scenario.appendedEvents.length.should.equal(0);
        scenario.results.length.should.equal(0);
        (await scenario.eventSequence.getNextSequenceNumber()).value.should.equal(0n);
    });

    it('should use batch semantics for a one-event plural action', async () => {
        const scenario = create();
        const result = await scenario.when.forEventSource('A').events(new OracleEventRecorded('one', true));
        result.map(item => item.sequenceNumber.value.toString()).should.deep.equal(['0']);
        scenario.results.length.should.equal(1);
    });

    it('should honor the scenario correlation hook for single and plural actions and both batch overloads', async () => {
        const scenario = new EventScenario({ artifacts: { eventTypes: [OracleEventRecorded, AlternateRecorded] },
            constraints: 'disabled', correlationId: () => fixedCorrelationId });
        await scenario.when.forEventSource('A').event(new OracleEventRecorded('single', true));
        await scenario.when.forEventSource('A').events(new OracleEventRecorded('plural', true));
        await scenario.appendMany('A', [new OracleEventRecorded('same source', true)]);
        await scenario.appendMany([{ eventSourceId: 'B', event: new AlternateRecorded('separate source') }]);
        scenario.appendedEvents.map(item => item.context.correlationId).should.deep.equal(Array(4).fill(fixedCorrelationId));
        await scenario.appendMany('A', [new OracleEventRecorded('explicit same', true)], { correlationId: explicitCorrelationId });
        await scenario.appendMany([{ eventSourceId: 'B', event: new AlternateRecorded('explicit entries') }],
            { correlationId: explicitCorrelationId });
        scenario.appendedEvents.slice(4).map(item => item.context.correlationId)
            .should.deep.equal([explicitCorrelationId, explicitCorrelationId]);
    });

    it('should reject an invalid correlation hook without changing batch history', async () => {
        const scenario = new EventScenario({ artifacts: { eventTypes: [OracleEventRecorded] },
            constraints: 'disabled', correlationId: () => 'not-a-guid' });
        for (const action of [() => scenario.appendMany('A', [new OracleEventRecorded('same', true)]),
            () => scenario.appendMany([{ eventSourceId: 'A', event: new OracleEventRecorded('entries', true) }]),
            () => scenario.when.forEventSource('A').events(new OracleEventRecorded('plural', true))]) {
            await action().then(() => { throw new Error('Invalid hook accepted'); }, error => {
                (error instanceof UnsupportedEventSequenceOperation).should.be.true;
                (error as Error).message.should.include('appendMany.correlationId');
            });
        }
        scenario.appendedEvents.length.should.equal(0);
        scenario.results.length.should.equal(0);
        (await scenario.eventSequence.getNextSequenceNumber()).value.should.equal(0n);
        await scenario.appendMany('A', [new OracleEventRecorded('override', true)], { correlationId: explicitCorrelationId });
        scenario.appendedEvents[0].context.correlationId.should.equal(explicitCorrelationId);
    });

    it('should reject an unregistered later given event without partially committing or notifying', async () => {
        const scenario = create();
        const iterator = scenario.eventSequence.appendOperations[Symbol.asyncIterator]();
        const notification = iterator.next();
        await scenario.given.forEventSource('A').events(new OracleEventRecorded('first', true),
            new OracleEventRecorded('second', true), new UnregisteredRecorded()).then(
            () => { throw new Error('Unregistered seed accepted'); }, error => {
                (error instanceof UnsupportedEventSequenceOperation).should.be.true;
                (error as Error).message.should.include('append.event');
            });
        scenario.appendedEvents.length.should.equal(0);
        scenario.results.length.should.equal(0);
        (await scenario.eventSequence.getNextSequenceNumber()).value.should.equal(0n);
        await iterator.return?.();
        (await notification).done.should.be.true;
        await scenario.given.forEventSource('A').events(new OracleEventRecorded('recovered', true));
        scenario.appendedEvents[0].context.sequenceNumber.should.equal(0n);
    });

    it('should hold setup ownership between seeds against act and competing setup calls', async () => {
        const scenario = create();
        const setup = scenario.given.forEventSource('A').events(new OracleEventRecorded('first', true),
            new OracleEventRecorded('second', true), new OracleEventRecorded('third', true));
        await Promise.resolve();
        await Promise.resolve();
        const attempts = [
            [scenario.appendMany('B', [new AlternateRecorded('act')]), 'appendMany'],
            [scenario.append('B', new AlternateRecorded('act')), 'append'],
            [scenario.given.forEventSource('B').events(new AlternateRecorded('setup')), 'given.events']
        ] as const;
        for (const [attempt, operation] of attempts) {
            await attempt.then(() => { throw new Error('Overlapping operation accepted'); }, error => {
                (error instanceof UnsupportedEventSequenceOperation).should.be.true;
                (error as Error).message.should.include(operation);
            });
        }
        await setup;
        scenario.appendedEvents.map(item => item.content).should.deep.equal([
            { name: 'first', active: true }, { name: 'second', active: true }, { name: 'third', active: true }]);
        scenario.results.length.should.equal(0);
        (await scenario.eventSequence.getNextSequenceNumber()).value.should.equal(3n);
    });

    it('should reject every unproven batch input before changing history, results or the next sequence', async () => {
        const scenario = create();
        await scenario.append('A', new OracleEventRecorded('baseline', true));
        const event = () => new OracleEventRecorded('valid', true);
        const entry = (extra: object): EventForEventSourceId => ({ eventSourceId: 'B', event: event(), ...extra });
        const invalid = (extra: object): AppendOptions => extra as AppendOptions;
        const cases: Array<[string, () => Promise<unknown>]> = [
            ['appendMany.arguments', () => scenario.appendMany('B', undefined as unknown as object[])],
            ['appendMany.occurred', () => scenario.appendMany('B', [event()], { occurred: new Date(NaN) })],
            ['appendMany.occurred', () => scenario.appendMany([entry({ occurred: new Date('+010000-01-01T00:00:00.000Z') })])],
            ['appendMany.correlationId', () => scenario.appendMany('B', [event()], { correlationId: 'bad-guid' })],
            ['appendMany.entry', () => scenario.appendMany([entry({ unknown: 'value' })])],
            ['appendMany.sourceType', () => scenario.appendMany([entry({ eventSourceType: 'bad source' })])],
            ['appendMany.streamType', () => scenario.appendMany([entry({ eventStreamType: 'bad stream' })])],
            ['appendMany.streamId', () => scenario.appendMany([entry({ eventStreamId: 'bad stream' })])],
            ['appendMany.event', () => scenario.appendMany('B', [new UnregisteredRecorded()])],
            ['appendMany.source', () => scenario.appendMany([entry({ eventSourceId: 'bad source' })])],
            ['appendMany.tags', () => scenario.appendMany('B', [event()], { tags: [new Tag('tag')] })],
            ['appendMany.tags', () => scenario.appendMany([entry({ tags: [new Tag('tag')] })])],
            ['appendMany.options', () => scenario.appendMany('B', [event()], invalid({ concurrencyScopes: { B: {} } }))]
        ];
        const history = scenario.appendedEvents;
        const results = scenario.results;
        const next = (await scenario.eventSequence.getNextSequenceNumber()).value;
        for (const [operation, action] of cases) {
            await action().then(() => { throw new Error(`Expected ${operation} rejection`); }, error => {
                (error instanceof UnsupportedEventSequenceOperation).should.be.true;
                (error as Error).message.should.include(operation);
            });
            scenario.appendedEvents.should.deep.equal(history);
            scenario.results.should.deep.equal(results);
            (await scenario.eventSequence.getNextSequenceNumber()).value.should.equal(next);
        }
        for (const context of [
            () => identityProvider.run(new Identity('user', 'User'), () => scenario.appendMany('B', [event()])),
            () => causationManager.run(new CausationType('Command'), { value: 'test' }, () => scenario.appendMany('B', [event()]))
        ]) {
            await context().then(() => { throw new Error('Ambient context accepted'); }, error => {
                (error instanceof UnsupportedEventSequenceOperation).should.be.true;
                (error as Error).message.should.include('appendMany.context');
            });
            scenario.appendedEvents.should.deep.equal(history);
            scenario.results.should.deep.equal(results);
            (await scenario.eventSequence.getNextSequenceNumber()).value.should.equal(next);
        }
    });

    it('should expose hot append notifications with the production client shape', async () => {
        const scenario = create();
        const iterator = scenario.eventSequence.appendOperations[Symbol.asyncIterator]();
        const first = iterator.next();
        await scenario.given.forEventSource('A').events(new OracleEventRecorded('seed', true));
        const setup = (await first).value!;
        setup.length.should.equal(1);
        setup[0].event.content.should.be.instanceOf(OracleEventRecorded);
        setup[0].event.context.eventSourceId.should.equal('A');
        const next = iterator.next();
        const results = await scenario.when.forEventSource('B').events(new OracleEventRecorded('act', true), new AlternateRecorded('second'));
        const batch = (await next).value!;
        batch.length.should.equal(2);
        batch.map(item => item.result).should.deep.equal(results);
        batch.map(item => item.event.context.sequenceNumber).should.deep.equal([1n, 2n]);
        batch.map(item => item.event.context.eventSourceId).should.deep.equal(['B', 'B']);
        // Production EventSequence.appendMany also uses one occurredAt for its entire notification array.
        (batch[0].event.context.occurred === batch[1].event.context.occurred).should.be.true;
        await iterator.return?.();
        scenario.results.length.should.equal(2);
    });
});
