// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';
import { chai, describe, it, vi } from 'vitest';
import type { ChronicleConnection } from '../../connection/index.js';
import { EventSequence, EventSequenceId } from '../../eventSequences/index.js';
import { eventType } from '../../events/index.js';
import { UnitOfWork } from '../../transactions/UnitOfWork.js';
import type { IUnitOfWorkManager } from '../../transactions/index.js';
import { ConcurrencyDimensions, eventSource, eventStream, EventSources } from '../index.js';
import type { IClientArtifactsProvider } from '../../artifacts/index.js';
import type { IEventStore } from '../../IEventStore.js';

chai.should();
class Booked { constructor(readonly amount = 1) {} }
eventType('BookedToLedger')(Booked);

const sourceAndStreamId = ConcurrencyDimensions.eventSourceId | ConcurrencyDimensions.eventStreamType | ConcurrencyDimensions.eventStreamId;

@eventSource({ name: 'Ledger' })
@eventStream('Monthly', { concurrency: sourceAndStreamId })
class LedgerEventSource {}

@eventSource({ name: 'Archive', concurrency: ConcurrencyDimensions.eventSourceId })
class ArchiveEventSource {}

@eventSource({ name: 'Mirror' })
@eventStream('Monthly', { concurrency: sourceAndStreamId })
class MirrorEventSource {}

@eventSource({ name: 'Open' })
class OpenEventSource {}

@eventSource({ name: 'Routed', concurrency: ConcurrencyDimensions.eventSourceId })
class RoutedEventSource {}

async function create() {
    const appendManyForEventSources = vi.fn().mockResolvedValue({ Response: { SequenceNumbers: [0n, 1n] } });
    const tailSequenceNumber = vi.fn().mockResolvedValue({ Data: { SequenceNumber: 5n } });
    const connection = { eventSequences: { appendManyForEventSources, tailSequenceNumber } } as unknown as ChronicleConnection;
    const sources = new EventSources('store', connection, {
        eventSources: [LedgerEventSource, ArchiveEventSource, MirrorEventSource, OpenEventSource, RoutedEventSource]
    } as unknown as IClientArtifactsProvider);
    await sources.discover();
    const sequence = new EventSequence(EventSequenceId.eventLog, 'store', 'ns', connection, {} as IUnitOfWorkManager, undefined, undefined, sources);
    return { sequence, appendManyForEventSources, tailSequenceNumber, sources };
}

const ledger = (streamId: string, eventSourceId = 'a-1') =>
    ({ eventSourceId, event: new Booked(), eventSource: LedgerEventSource, eventStream: 'Monthly', eventStreamId: streamId });

describe('when a batch needs differing stream id guards for one event source id', () => {
    it('should throw before any wire write', async () => {
        const c = await create();
        let error: Error | undefined;
        try { await c.sequence.appendMany([ledger('2026-01'), ledger('2026-02')]); } catch (e) { error = e as Error; }
        (error?.message ?? '').should.contain("'a-1'").and.contain('separate batches');
        c.appendManyForEventSources.mock.calls.length.should.equal(0);
        c.tailSequenceNumber.mock.calls.length.should.equal(0);
    });
});

describe('when a batch has the same stream id guard repeated', () => {
    it('should send one shared scope for the id', async () => {
        const c = await create();
        await c.sequence.appendMany([ledger('2026-01'), ledger('2026-01')]);
        const scopes = c.appendManyForEventSources.mock.calls[0][0].ConcurrencyScopes;
        scopes.length.should.equal(1);
        scopes[0].Scope.EventStreamId.should.equal('2026-01');
    });
});

describe('when a batch needs differing guards from different definitions for one id', () => {
    it('should throw before any wire write', async () => {
        const c = await create();
        let error: Error | undefined;
        try {
            await c.sequence.appendMany([ledger('2026-01'), { eventSourceId: 'a-1', event: new Booked(), eventSource: ArchiveEventSource }]);
        } catch (e) { error = e as Error; }
        (error?.message ?? '').should.contain('differing concurrency guards');
        c.appendManyForEventSources.mock.calls.length.should.equal(0);
    });
});

describe('when equivalent guards differ only in values the dimensions do not select', () => {
    it('should share one conservative scope', async () => {
        const c = await create();
        await c.sequence.appendMany([
            { eventSourceId: 'a-1', event: new Booked(), eventSource: ArchiveEventSource, eventStreamId: 'x' },
            { eventSourceId: 'a-1', event: new Booked(), eventSource: ArchiveEventSource, eventStreamId: 'y' }
        ]);
        const scopes = c.appendManyForEventSources.mock.calls[0][0].ConcurrencyScopes;
        scopes.length.should.equal(1);
        scopes[0].Scope.EventSourceId.should.equal(true);
    });
});

describe('when an unguarded definition event precedes a guarded one for the same id', () => {
    it('should still guard the id', async () => {
        const c = await create();
        await c.sequence.appendMany([
            { eventSourceId: 'a-1', event: new Booked(), eventSource: OpenEventSource },
            { eventSourceId: 'a-1', event: new Booked(), eventSource: ArchiveEventSource }
        ]);
        const scopes = c.appendManyForEventSources.mock.calls[0][0].ConcurrencyScopes;
        scopes[0].Scope.EventSourceId.should.equal(true);
        scopes[0].Scope.SequenceNumber.should.equal(5n);
    });
});

describe('when an explicit broader scope exists for the id', () => {
    it('should send it and not require agreement between the derived guards', async () => {
        const c = await create();
        await c.sequence.appendMany([ledger('2026-01'), ledger('2026-02')],
            { concurrencyScopes: { 'a-1': { sequenceNumber: 3n, eventSourceId: true } } });
        const scopes = c.appendManyForEventSources.mock.calls[0][0].ConcurrencyScopes;
        scopes.length.should.equal(1);
        scopes[0].Scope.SequenceNumber.should.equal(3n);
        c.tailSequenceNumber.mock.calls.length.should.equal(0);
    });
});

describe('when a unit of work holds a conflicting group after a valid group', () => {
    it('should reject on commit before any group is written', async () => {
        const c = await create();
        const appendMany = vi.fn().mockResolvedValue([]);
        const store = { eventSources: c.sources, getEventSequence: () => ({ appendMany }) } as unknown as IEventStore;
        const unitOfWork = new UnitOfWork(Guid.create(), () => {}, store);
        unitOfWork.addEvent(EventSequenceId.eventLog, 'ok-1', new Booked(), { eventSource: ArchiveEventSource });
        const other = new EventSequenceId('other');
        unitOfWork.addEvent(other, 'a-1', new Booked(), { eventSource: LedgerEventSource, eventStream: 'Monthly' });
        unitOfWork.addEvent(other, 'a-1', new Booked(), { eventSource: ArchiveEventSource });
        let error: Error | undefined;
        try { await unitOfWork.commit(); } catch (e) { error = e as Error; }
        (error?.message ?? '').should.contain('differing concurrency guards');
        appendMany.mock.calls.length.should.equal(0);
    });
});
