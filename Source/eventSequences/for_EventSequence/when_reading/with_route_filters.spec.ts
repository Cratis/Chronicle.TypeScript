// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, vi } from 'vitest';
import { EventSequence, EventSequenceId } from '../../index';
import { eventType } from '../../../events';
import type { ChronicleConnection } from '../../../connection';
import type { IUnitOfWorkManager } from '../../../transactions';

chai.should();

// The kernel resolves an append that carried no route to source type 'Default', stream type 'All' and
// stream identifier 'Default', and treats an empty dimension on a read as "do not narrow". A client that
// defaulted a read to the legacy 'Default' route would therefore return none of those events.
class RouteReadRecorded {}
eventType('RouteReadRecorded')(RouteReadRecorded);

class RouteReadObserver {
    routeReadRecorded(_event: RouteReadRecorded) {}
}

function createSequence() {
    const tailSequenceNumber = vi.fn().mockResolvedValue({ Data: { SequenceNumber: 7n } });
    const forEventSourceIdAndEventTypes = vi.fn().mockResolvedValue({ Data: [] });
    const connection = { eventSequences: { tailSequenceNumber, forEventSourceIdAndEventTypes } } as unknown as ChronicleConnection;
    return {
        sequence: new EventSequence(EventSequenceId.eventLog, 'store', 'tenant', connection, {} as IUnitOfWorkManager),
        tailSequenceNumber,
        forEventSourceIdAndEventTypes
    };
}

describe('when reading the tail sequence number without explicit routes', () => {
    let request: { EventSourceType: string; EventStreamType: string; EventStreamId: string };
    beforeEach(async () => {
        const { sequence, tailSequenceNumber } = createSequence();
        await sequence.getNextSequenceNumber();
        request = tailSequenceNumber.mock.calls[0][0];
    });
    it('should not narrow the read to the legacy route', () => {
        [request.EventSourceType, request.EventStreamType, request.EventStreamId].should.deep.equal(['', '', '']);
    });
});

describe('when reading the tail sequence number with explicit routes', () => {
    let request: { EventSourceType: string; EventStreamType: string; EventStreamId: string };
    beforeEach(async () => {
        const { sequence, tailSequenceNumber } = createSequence();
        await sequence.getTailSequenceNumber(undefined, 'Default', 'Default', 'source');
        request = tailSequenceNumber.mock.calls[0][0];
    });
    it('should send every supplied dimension unchanged', () => {
        [request.EventSourceType, request.EventStreamType, request.EventStreamId].should.deep.equal(['Default', 'Default', 'source']);
    });
});

describe('when reading the tail sequence number for an observer', () => {
    let request: { EventSourceType: string; EventStreamType: string; EventStreamId: string; EventTypeIds: string };
    beforeEach(async () => {
        const { sequence, tailSequenceNumber } = createSequence();
        await sequence.getTailSequenceNumberForObserver(RouteReadObserver);
        request = tailSequenceNumber.mock.calls[0][0];
    });
    it('should not narrow the read to the legacy route', () => {
        [request.EventSourceType, request.EventStreamType, request.EventStreamId].should.deep.equal(['', '', '']);
    });
    it('should still narrow to the event types the observer handles', () => {
        request.EventTypeIds.should.equal('RouteReadRecorded');
    });
});

describe('when reading events for an event source without an explicit stream type', () => {
    let request: { EventStreamType: string; EventStreamId: string };
    beforeEach(async () => {
        const { sequence, forEventSourceIdAndEventTypes } = createSequence();
        await sequence.getForEventSourceIdAndEventTypes('source', [RouteReadRecorded]);
        request = forEventSourceIdAndEventTypes.mock.calls[0][0];
    });
    it('should not hide events the kernel routed for an unrouted append', () => {
        [request.EventStreamType, request.EventStreamId].should.deep.equal(['', '']);
    });
});

describe('when reading events for an event source with an explicit stream type', () => {
    let request: { EventStreamType: string; EventStreamId: string };
    beforeEach(async () => {
        const { sequence, forEventSourceIdAndEventTypes } = createSequence();
        await sequence.getForEventSourceIdAndEventTypes('source', [RouteReadRecorded], 'Default', 'source');
        request = forEventSourceIdAndEventTypes.mock.calls[0][0];
    });
    it('should send the supplied stream scope unchanged', () => {
        [request.EventStreamType, request.EventStreamId].should.deep.equal(['Default', 'source']);
    });
});
