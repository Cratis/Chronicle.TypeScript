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
    notificationHistoryLengths: number[];
    next: string; tail: string; tailA: string; tailByType: string;
    fromOneByType: string[]; byRoute: string[]; byDefaultRoute: string[]; byAllStreamType: string[];
    tailByAll: string; byCustomRoute: string[]; tailByRoute: string;
    byStreamTypeOnly: string[]; tailByStreamTypeOnly: string;
    byStreamIdOnly: string[]; tailByStreamIdOnly: string; bySourceTypeOnly: string[]; tailBySourceTypeOnly: string;
    byMixedRoute: string[]; tailByMixedRoute: string } };
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
    (await scenario.eventSequence.getForEventSourceIdAndEventTypes('A', [AlternateRecorded], 'Archive'))
        .map(item => item.context.sequenceNumber.toString()).should.deep.equal(expected.byStreamTypeOnly);
    (await scenario.eventSequence.getTailSequenceNumber('A', undefined, 'Archive'))
        .value.toString().should.equal(expected.tailByStreamTypeOnly);
    (await scenario.eventSequence.getForEventSourceIdAndEventTypes('A', [AlternateRecorded], undefined, 'stream1'))
        .map(item => item.context.sequenceNumber.toString()).should.deep.equal(expected.byStreamIdOnly);
    (await scenario.eventSequence.getTailSequenceNumber('A', undefined, undefined, 'stream1'))
        .value.toString().should.equal(expected.tailByStreamIdOnly);
    (await scenario.eventSequence.getForEventSourceIdAndEventTypes('B', [OracleEventRecorded], undefined, undefined, 'Custom'))
        .map(item => item.context.sequenceNumber.toString()).should.deep.equal(expected.bySourceTypeOnly);
    (await scenario.eventSequence.getTailSequenceNumber('B', 'Custom'))
        .value.toString().should.equal(expected.tailBySourceTypeOnly);
    (await scenario.eventSequence.getForEventSourceIdAndEventTypes('A', [AlternateRecorded], 'All', 'stream1'))
        .map(item => item.context.sequenceNumber.toString()).should.deep.equal(expected.byMixedRoute);
    (await scenario.eventSequence.getTailSequenceNumber('A', undefined, 'All', 'stream1'))
        .value.toString().should.equal(expected.tailByMixedRoute);
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
    });
}

describe('when appending batches against committed kernel fixtures', () => {
    it('should resolve omitted routes like the pinned kernel batch path', async () => {
        const { routeCases, expected } = JSON.parse(readFileSync(new URL('./fixtures/batch-omitted-routes.json', import.meta.url), 'utf8')) as {
            routeCases: Array<{ source: string; name: string; active: boolean; sourceType?: string; streamType?: string; streamId?: string }>;
            expected: { sequences: string[]; routes: Array<{ source: string; sourceType: string; streamType: string; streamId: string }> };
        };
        const scenario = create();
        // Scoped wire fixtures additionally prove ts-proto omission of explicit empty routes.
        const supported = routeCases;
        const results = await scenario.appendMany(supported.map(item => ({ eventSourceId: item.source,
            event: new OracleEventRecorded(item.name, item.active), eventSourceType: item.sourceType,
            eventStreamType: item.streamType, eventStreamId: item.streamId })));
        results.map(result => result.sequenceNumber.value.toString()).should.deep.equal(expected.sequences.slice(0, supported.length));
        scenario.appendedEvents.map(item => ({ source: item.context.eventSourceId,
            sourceType: item.context.eventSourceType, streamType: item.context.eventStreamType,
            streamId: item.context.eventStreamId })).should.deep.equal(
            expected.routes.filter(item => supported.some(entry => entry.source === item.source)));
        expected.routes.length.should.equal(routeCases.length);
    });

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
            scenario.appendedEvents.length.should.equal(expected.notificationHistoryLengths[notificationIndex]);
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
        const seedCount = expected.outcomes.reduce((count, outcome) => count + (outcome.given ?? 0), 0);
        const historyAtNotification: number[] = [];
        const observing = (async () => {
            for await (const notification of scenario.eventSequence.appendOperations) {
                const index = historyAtNotification.length;
                historyAtNotification.push(scenario.appendedEvents.length);
                notification.map(item => ({ sequence: item.result.sequenceNumber.value.toString(),
                    source: item.event.context.eventSourceId, type: item.event.eventType.id.value,
                    success: item.result.isSuccess })).should.deep.equal(expected.notifications[index]);
                if (historyAtNotification.length === seedCount) break;
            }
        })();
        for (const [index, operation] of operations.entries()) {
            if (operation.overload === 'given') {
                await scenario.given.forEventSource('A').events(...operation.events.map(value));
                scenario.appendedEvents.length.should.equal(expected.outcomes[index].given);
            } else {
                const result = await scenario.when.forEventSource('A').events(...operation.events.map(value));
                const last = BigInt(expected.outcomes[index].lastSequence!);
                result.map(item => item.sequenceNumber.value.toString()).should.deep.equal(
                    operation.events.map((_, offset) => (last - BigInt(operation.events.length - offset - 1)).toString()));
                result.every(item => item.isSuccess).should.equal(expected.outcomes[index].sequentialSuccess);
            }
        }
        await observing;
        historyAtNotification.should.deep.equal(expected.notificationHistoryLengths.slice(0, seedCount));
        scenario.results.length.should.equal(2);
        compareHistory(scenario, expected.history);
        scenario.appendedEvents.forEach((event, index) => {
            const type = index < seedCount ? 'TypeScriptClient.Append' : 'TypeScriptClient.AppendMany';
            const properties = index < seedCount ? { eventType: expected.history[index].type }
                : { count: String(operations.find(operation => operation.overload === 'whenSequential')!.events.length) };
            event.context.causation.map(item => ({ type: item.type, properties: item.properties }))
                .should.deep.equal([{ type: 'Root', properties: {} }, { type, properties }]);
        });
        await compareReads(scenario, expected);
    });

    it('should discard blank tags through production preparation on both batch overloads', async () => {
        const scenario = create();
        const blanks = ['', ' ', '\u00a0'];
        await scenario.appendMany('A', [new OracleEventRecorded('same', true)], { tags: [...blanks, 'shared'] });
        await scenario.appendMany([{ eventSourceId: 'B', event: new OracleEventRecorded('mixed', true),
            tags: [...blanks, 'local'] }], { tags: [...blanks, 'shared'] });
        scenario.appendedEvents.map(item => item.context.tags.map(tag => tag.value))
            .should.deep.equal([['shared'], ['local', 'shared']]);
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
        for (const options of [{ subject: 42 as unknown as string }, { tags: ['invalid|tag'] },
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

    it('should retain getter and non-enumerable shared options with the correlation hook on both batch overloads', async () => {
        for (const overload of ['same', 'mixed'] as const) {
            for (const shape of ['getter', 'non-enumerable'] as const) {
                const scenario = new EventScenario({ artifacts: { eventTypes: [OracleEventRecorded] },
                    constraints: 'disabled', correlationId: () => fixedCorrelationId });
                const metadata: AppendOptions = { sourceType: 'Group', streamType: 'Archive', streamId: 'stream1',
                    subject: 'shared', occurred: new Date('2025-01-02T03:04:05.000Z'), tags: ['shared'] };
                const shared: AppendOptions = shape === 'getter'
                    ? Object.create(Object.defineProperties({}, Object.fromEntries(Object.entries(metadata).map(([key, value]) =>
                        [key, { get: () => value, configurable: true }])))) as AppendOptions
                    : Object.defineProperties({}, Object.fromEntries(Object.entries(metadata).map(([key, value]) =>
                        [key, { value, configurable: true, writable: true, enumerable: false }]))) as AppendOptions;
                const event = new OracleEventRecorded(`${overload}-${shape}`, true);
                const results = overload === 'same' ? await scenario.appendMany('A', [event], shared)
                    : await scenario.appendMany([{ eventSourceId: 'A', event }], shared);
                results[0].isSuccess.should.be.true;
                const context = scenario.appendedEvents[0].context;
                context.eventSourceType.should.equal('Group');
                context.eventStreamType.should.equal('Archive');
                context.eventStreamId.should.equal('stream1');
                context.subject.should.equal('shared');
                context.occurred.toISOString().should.equal('2025-01-02T03:04:05.000Z');
                context.tags.map(tag => tag.value).should.deep.equal(['shared']);
                context.correlationId.should.equal(fixedCorrelationId);
            }
        }
    });

    it('should wrap a throwing correlation hook for single, both batch overloads and plural actions', async () => {
        const scenario = new EventScenario({ artifacts: { eventTypes: [OracleEventRecorded] },
            constraints: 'disabled', correlationId: () => { throw new Error('hook boom'); } });
        for (const [operation, action] of [
            ['append.serialization', () => scenario.append('A', new OracleEventRecorded('single', true))],
            ['appendMany.serialization', () => scenario.appendMany('A', [new OracleEventRecorded('same', true)])],
            ['appendMany.serialization', () => scenario.appendMany([
                { eventSourceId: 'A', event: new OracleEventRecorded('mixed', true) }])],
            ['appendMany.serialization', () => scenario.when.forEventSource('A').events(new OracleEventRecorded('plural', true))]
        ] as const) {
            await action().then(() => { throw new Error('Throwing hook accepted'); }, error => {
                (error instanceof UnsupportedEventSequenceOperation).should.be.true;
                (error as Error).message.should.include(operation);
                (error as Error).message.should.include('hook boom');
            });
        }
        scenario.appendedEvents.length.should.equal(0);
        scenario.results.length.should.equal(0);
        (await scenario.eventSequence.getNextSequenceNumber()).value.should.equal(0n);
        await scenario.appendMany('A', [new OracleEventRecorded('override', true)], { correlationId: explicitCorrelationId });
        scenario.appendedEvents[0].context.correlationId.should.equal(explicitCorrelationId);
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

    it('should expose only committed seed history to each setup notification', async () => {
        const scenario = create();
        const lengths: number[] = [];
        const observed = (async () => {
            for await (const notification of scenario.eventSequence.appendOperations) {
                lengths.push(scenario.appendedEvents.length);
                notification[0].event.context.sequenceNumber.should.equal(BigInt(lengths.length - 1));
                if (lengths.length === 2) break;
            }
        })();
        await scenario.given.forEventSource('A').events(new OracleEventRecorded('first', true),
            new AlternateRecorded('second'));
        await observed;
        lengths.should.deep.equal([1, 2]);
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
            ['appendMany.subject', () => scenario.appendMany([entry({ subject: 42 })], { subject: 'shared' })],
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

    it('should sample the clock once per defaulted batch entry and stage failures atomically', async () => {
        let ticks = 0;
        const scenario = new EventScenario({ artifacts: { eventTypes: [OracleEventRecorded] }, constraints: 'disabled',
            clock: () => new Date(Date.UTC(2025, 0, 1, 0, 0, ++ticks)) });
        await scenario.appendMany('A', [new OracleEventRecorded('first', true), new OracleEventRecorded('second', true)]);
        await scenario.appendMany([
            { eventSourceId: 'A', event: new OracleEventRecorded('third', true), occurred: new Date('2025-04-01T00:00:00.000Z') },
            { eventSourceId: 'A', event: new OracleEventRecorded('fourth', true) }
        ]);
        scenario.appendedEvents.map(item => item.context.occurred.toISOString()).should.deep.equal([
            '2025-01-01T00:00:01.000Z', '2025-01-01T00:00:02.000Z',
            '2025-04-01T00:00:00.000Z', '2025-01-01T00:00:03.000Z']);
        ticks.should.equal(3);
        let invalidTicks = 0;
        const invalidClock = new EventScenario({ artifacts: { eventTypes: [OracleEventRecorded] }, constraints: 'disabled',
            clock: () => ++invalidTicks === 2 ? new Date(NaN) : new Date('2025-01-01T00:00:00.000Z') });
        await invalidClock.appendMany('A', [new OracleEventRecorded('valid', true),
            new OracleEventRecorded('invalid clock', true)]).then(() => { throw new Error('Invalid clock accepted'); }, error => {
            (error instanceof UnsupportedEventSequenceOperation).should.be.true;
            (error as Error).message.should.include('appendMany.clock');
        });
        invalidClock.appendedEvents.length.should.equal(0);
        invalidClock.results.length.should.equal(0);
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
