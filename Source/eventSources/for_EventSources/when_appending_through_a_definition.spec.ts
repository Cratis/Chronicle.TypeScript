// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, vi } from 'vitest';
import type { ChronicleConnection } from '../../connection/index.js';
import { EventSequence, EventSequenceId } from '../../eventSequences/index.js';
import { eventType } from '../../events/index.js';
import type { IUnitOfWorkManager } from '../../transactions/index.js';
import {
    ConcurrencyDimensions, eventSource, eventStream, EventSources,
    EventRoutingContradictsEventSource, EventStreamDoesNotBelongToEventSource, EventStreamRequiresEventSource, UnknownEventSource
} from '../index.js';
import type { IClientArtifactsProvider } from '../../artifacts/index.js';

const should = chai.should();
class Deposited { constructor(readonly amount = 1) {} }
eventType('DepositedToAccount')(Deposited);

@eventSource({ concurrency: ConcurrencyDimensions.eventSourceId })
@eventStream('Transactions', { concurrency: ConcurrencyDimensions.eventSourceId | ConcurrencyDimensions.eventStreamType })
class AccountEventSource {}

@eventSource({ name: 'Customer' })
@eventStream('Profile')
class CustomerEventSource {}

@eventSource({ name: 'Plain' })
class PlainEventSource {}

async function create(tail = 7n) {
    const append = vi.fn().mockResolvedValue({ Response: { SequenceNumber: 0n } });
    const appendManyForEventSources = vi.fn().mockResolvedValue({ Response: { SequenceNumbers: [0n, 1n] } });
    const tailSequenceNumber = vi.fn().mockResolvedValue({ Data: { SequenceNumber: tail } });
    const connection = { eventSequences: { append, appendManyForEventSources, tailSequenceNumber } } as unknown as ChronicleConnection;
    const sources = new EventSources('store', connection, { eventSources: [AccountEventSource, CustomerEventSource, PlainEventSource] } as unknown as IClientArtifactsProvider);
    await sources.discover();
    return { sequence: new EventSequence(EventSequenceId.eventLog, 'store', 'ns', connection, {} as IUnitOfWorkManager, undefined, undefined, sources), append, appendManyForEventSources, tailSequenceNumber };
}

describe('when appending through a definition and stream', () => {
    let request: any; let tailRequest: any;
    beforeEach(async () => {
        const c = await create();
        await c.sequence.append('acc-1', new Deposited(), { eventSource: AccountEventSource, eventStream: 'Transactions', streamId: 'tx-1' });
        request = c.append.mock.calls[0][0];
        tailRequest = c.tailSequenceNumber.mock.calls[0][0];
    });
    it('should set the wire event source key and routing', () => {
        request.EventSource.should.equal('Account');
        request.EventSourceType.should.equal('Account');
        request.EventStreamType.should.equal('Transactions');
        request.EventStreamId.should.equal('tx-1');
    });
    it('should derive the scope from the stream dimensions', () => {
        request.ConcurrencyScope.SequenceNumber.should.equal(7n);
        request.ConcurrencyScope.EventSourceId.should.equal(true);
        request.ConcurrencyScope.EventStreamType.should.equal('Transactions');
        request.ConcurrencyScope.EventSourceType.should.equal('');
    });
    it('should read the tail with exactly the scoped dimensions', () => {
        tailRequest.EventSourceId.should.equal('acc-1');
        tailRequest.EventStreamType.should.equal('Transactions');
        tailRequest.EventSourceType.should.equal('');
    });
});

describe('when appending through a definition by name without a stream', () => {
    it('should use the source dimensions and leave the stream to the kernel', async () => {
        const c = await create();
        await c.sequence.append('acc-1', new Deposited(), { eventSource: 'Account' });
        const request = c.append.mock.calls[0][0];
        request.EventSource.should.equal('Account');
        should.equal(request.EventStreamType, undefined);
        request.ConcurrencyScope.EventSourceId.should.equal(true);
        request.ConcurrencyScope.EventStreamType.should.equal('');
    });
    it('should expect no matching event when the scope is empty', async () => {
        const c = await create(18446744073709551615n);
        await c.sequence.append('acc-1', new Deposited(), { eventSource: 'Account' });
        c.append.mock.calls[0][0].ConcurrencyScope.ExpectsNoMatchingEvent.should.equal(true);
    });
});

describe('when an explicit concurrency scope is given', () => {
    it('should win over the definition and not read the tail', async () => {
        const c = await create();
        await c.sequence.append('acc-1', new Deposited(), { eventSource: 'Account', concurrencyScope: { sequenceNumber: 3n } });
        c.append.mock.calls[0][0].ConcurrencyScope.SequenceNumber.should.equal(3n);
        c.tailSequenceNumber.mock.calls.length.should.equal(0);
    });
});

describe('when the definition declares no concurrency', () => {
    it('should not add a scope', async () => {
        const c = await create();
        await c.sequence.append('c-1', new Deposited(), { eventSource: 'Plain' });
        const request = c.append.mock.calls[0][0];
        request.EventSource.should.equal('Plain');
        request.ConcurrencyScope.SequenceNumber.should.equal(18446744073709551615n);
        c.tailSequenceNumber.mock.calls.length.should.equal(0);
    });
});

describe('when appending without a definition', () => {
    it('should keep legacy behavior and send no event source key', async () => {
        const c = await create();
        await c.sequence.append('acc-1', new Deposited(), { sourceType: 'Legacy' });
        const request = c.append.mock.calls[0][0];
        should.equal(request.EventSource, undefined);
        request.EventSourceType.should.equal('Legacy');
    });
});

describe('when routing is invalid', () => {
    it('should reject an unknown source', async () => {
        const c = await create();
        let error: unknown; await c.sequence.append('a', new Deposited(), { eventSource: 'Ghost' }).catch(e => error = e);
        (error as Error).should.be.instanceOf(UnknownEventSource);
        c.append.mock.calls.length.should.equal(0);
    });
    it('should reject an undeclared stream', async () => {
        const c = await create();
        let error: unknown; await c.sequence.append('a', new Deposited(), { eventSource: 'Account', eventStream: 'Profile' }).catch(e => error = e);
        (error as Error).should.be.instanceOf(EventStreamDoesNotBelongToEventSource);
    });
    it('should reject a stream without a source', async () => {
        const c = await create();
        let error: unknown; await c.sequence.append('a', new Deposited(), { eventStream: 'Transactions' }).catch(e => error = e);
        (error as Error).should.be.instanceOf(EventStreamRequiresEventSource);
    });
    it('should reject a contradicting explicit source type or stream type', async () => {
        const c = await create();
        const errors: unknown[] = [];
        await c.sequence.append('a', new Deposited(), { eventSource: 'Account', sourceType: 'Other' }).catch(e => errors.push(e));
        await c.sequence.append('a', new Deposited(), { eventSource: 'Account', eventStream: 'Transactions', streamType: 'Other' }).catch(e => errors.push(e));
        errors.every(e => e instanceof EventRoutingContradictsEventSource).should.equal(true);
        errors.should.have.length(2);
    });
    it('should accept explicit values that agree', async () => {
        const c = await create();
        await c.sequence.append('a', new Deposited(), { eventSource: 'Account', eventStream: 'Transactions', sourceType: 'Account', streamType: 'Transactions' });
        c.append.mock.calls.length.should.equal(1);
    });
});

describe('when appending many through a definition', () => {
    it('should route every event and derive one scope per event source id', async () => {
        const c = await create();
        await c.sequence.appendMany('acc-1', [new Deposited(), new Deposited()], { eventSource: 'Account', eventStream: 'Transactions' });
        const request = c.appendManyForEventSources.mock.calls[0][0];
        request.Events.map((e: any) => e.EventSource).should.deep.equal(['Account', 'Account']);
        request.Events.map((e: any) => e.EventStreamType).should.deep.equal(['Transactions', 'Transactions']);
        request.ConcurrencyScopes.should.have.length(1);
        request.ConcurrencyScopes[0].EventSourceId.should.equal('acc-1');
        request.ConcurrencyScopes[0].Scope.SequenceNumber.should.equal(7n);
    });
    it('should let per-event routing override shared options in a mixed batch without inheriting the stream', async () => {
        const c = await create();
        await c.sequence.appendMany([
            { eventSourceId: 'acc-1', event: new Deposited() },
            { eventSourceId: 'cust-1', event: new Deposited(), eventSource: CustomerEventSource },
            { eventSourceId: 'cust-2', event: new Deposited(), eventSource: 'Customer', eventStream: 'Profile' },
            { eventSourceId: 'old-1', event: new Deposited(), eventSource: 'Plain' }
        ], { eventSource: 'Account', eventStream: 'Transactions' });
        const events = c.appendManyForEventSources.mock.calls[0][0].Events;
        events.map((e: any) => e.EventSource).should.deep.equal(['Account', 'Customer', 'Customer', 'Plain']);
        events.map((e: any) => e.EventStreamType).should.deep.equal(['Transactions', undefined, 'Profile', undefined]);
        events.map((e: any) => e.EventSourceType).should.deep.equal(['Account', 'Customer', 'Customer', 'Plain']);
    });
    it('should let an explicit per-id scope win and a shared scope win over derivation', async () => {
        const c = await create();
        await c.sequence.appendMany([
            { eventSourceId: 'acc-1', event: new Deposited() },
            { eventSourceId: 'acc-2', event: new Deposited() }
        ], { eventSource: 'Account', concurrencyScopes: { 'acc-1': { sequenceNumber: 1n } } });
        const scopes = c.appendManyForEventSources.mock.calls[0][0].ConcurrencyScopes;
        scopes.find((s: any) => s.EventSourceId === 'acc-1').Scope.SequenceNumber.should.equal(1n);
        scopes.find((s: any) => s.EventSourceId === 'acc-2').Scope.SequenceNumber.should.equal(7n);
    });
    it('should send nothing when any event routing is invalid (atomic)', async () => {
        const c = await create();
        let error: unknown;
        await c.sequence.appendMany([
            { eventSourceId: 'a', event: new Deposited() },
            { eventSourceId: 'b', event: new Deposited(), eventSource: 'Ghost' }
        ], { eventSource: 'Account' }).catch(e => error = e);
        (error as Error).should.be.instanceOf(UnknownEventSource);
        c.appendManyForEventSources.mock.calls.length.should.equal(0);
    });
});
