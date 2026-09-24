// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, vi } from 'vitest';
import { AppendRequest, AppendManyForEventSourcesRequest } from '@cratis/chronicle.contracts';
import { EventSequence, EventSequenceId, EventSequenceNumber } from '../../index.js';
import { eventType } from '../../../events/index.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import type { IUnitOfWorkManager } from '../../../transactions/index.js';

const should = chai.should();
class MetadataRecorded { constructor(readonly value = 'payload') {} }
eventType('MetadataRecorded')(MetadataRecorded);

function createSequence() {
    const append = vi.fn().mockResolvedValue({ Response: { SequenceNumber: 0n } });
    const appendManyForEventSources = vi.fn().mockResolvedValue({ Response: { SequenceNumbers: [0n, 1n, 2n] } });
    const connection = { eventSequences: { append, appendManyForEventSources } } as unknown as ChronicleConnection;
    return {
        sequence: new EventSequence(EventSequenceId.eventLog, 'store', 'tenant', connection, {} as IUnitOfWorkManager),
        append,
        appendManyForEventSources
    };
}

const occurred = new Date('2025-02-03T04:05:06.000Z');

describe('when appending without route options', () => {
    let request: AppendRequest;
    beforeEach(async () => {
        const { sequence, append } = createSequence();
        await sequence.append('source', new MetadataRecorded(), { eventSourceId: 'unused' });
        request = append.mock.calls[0][0];
    });
    it('should leave every route dimension and occurrence time omitted', () => {
        should.equal(request.EventSourceType, undefined);
        should.equal(request.EventStreamType, undefined);
        should.equal(request.EventStreamId, undefined);
        should.equal(request.Occurred, undefined);
    });
    it('should retain subject policy and ignore the unused eventSourceId option', () => {
        request.Subject.should.equal('source');
        request.EventSourceId.should.equal('source');
    });
    it('should encode JSON content as the published contract string', () => {
        const decoded = AppendRequest.decode(AppendRequest.encode(AppendRequest.fromPartial(request)).finish());
        JSON.parse(decoded.Content).should.deep.equal({ value: 'payload' });
        decoded.EventStreamType.should.equal('');
        decoded.EventStreamId.should.equal('');
    });
});

describe('when appending with explicit legacy routing and metadata', () => {
    let request: AppendRequest;
    beforeEach(async () => {
        const { sequence, append } = createSequence();
        await sequence.append('source', new MetadataRecorded(), {
            sourceType: 'Default', streamType: 'Default', streamId: 'source', subject: '', occurred
        });
        request = append.mock.calls[0][0];
    });
    it('should preserve all explicit values exactly', () => {
        request.EventSourceType.should.equal('Default');
        request.EventStreamType.should.equal('Default');
        request.EventStreamId.should.equal('source');
        request.Subject.should.equal('');
        request.Occurred!.Value.should.equal(occurred.toISOString());
    });
    it('should not derive concurrency scope from the route', () => {
        request.ConcurrencyScope!.should.deep.equal({
            SequenceNumber: EventSequenceNumber.unset.value, EventSourceId: false,
            EventStreamType: '', EventStreamId: '', EventSourceType: '', EventTypes: []
        });
    });
});

describe('when appending a mixed batch with per-entry and shared metadata', () => {
    let request: AppendManyForEventSourcesRequest;
    beforeEach(async () => {
        const { sequence, appendManyForEventSources } = createSequence();
        await sequence.appendMany([
            { eventSourceId: 'one', event: new MetadataRecorded(), eventSourceType: 'Exact', eventStreamType: 'Default', eventStreamId: 'one', subject: 'entry', occurred },
            { eventSourceId: 'two', event: new MetadataRecorded() },
            { eventSourceId: 'three', event: new MetadataRecorded(), eventSourceType: '', eventStreamType: '', eventStreamId: '', subject: '' }
        ], {
            sourceType: 'shared-source', streamType: 'shared-type', streamId: 'shared-id', subject: 'shared-subject',
            occurred: new Date('2024-01-01T00:00:00Z'),
            concurrencyScope: { sequenceNumber: 42n, eventStreamType: 'separate-scope' },
            concurrencyScopes: { one: { sequenceNumber: 9n, eventSourceId: true } }
        });
        request = appendManyForEventSources.mock.calls[0][0];
    });
    it('should prefer entry values over shared values and preserve explicit empty values', () => {
        request.Events.map(event => [event.EventSourceType, event.EventStreamType, event.EventStreamId, event.Subject]).should.deep.equal([
            ['Exact', 'Default', 'one', 'entry'],
            ['shared-source', 'shared-type', 'shared-id', 'shared-subject'],
            ['', '', '', '']
        ]);
    });
    it('should prefer entry occurrence time and fall back to the shared occurrence time', () => {
        request.Events.map(event => event.Occurred!.Value).should.deep.equal([
            occurred.toISOString(), '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'
        ]);
    });
    it('should serialize per-source and shared scopes independently of routing', () => {
        request.ConcurrencyScopes.map(entry => [entry.EventSourceId, entry.Scope!.SequenceNumber, entry.Scope!.EventStreamType]).should.deep.equal([
            ['one', 9n, ''], ['two', 42n, 'separate-scope'], ['three', 42n, 'separate-scope']
        ]);
    });
    it('should encode all batch contents with the published contract', () => {
        const decoded = AppendManyForEventSourcesRequest.decode(AppendManyForEventSourcesRequest.encode(AppendManyForEventSourcesRequest.fromPartial(request)).finish());
        decoded.Events.map(event => JSON.parse(event.Content)).should.deep.equal([{ value: 'payload' }, { value: 'payload' }, { value: 'payload' }]);
    });
});

describe('when appending a plain batch without metadata', () => {
    let request: AppendManyForEventSourcesRequest;
    beforeEach(async () => {
        const { sequence, appendManyForEventSources } = createSequence();
        await sequence.appendMany('source', [new MetadataRecorded()]);
        request = appendManyForEventSources.mock.calls[0][0];
    });
    it('should omit route and occurrence while retaining the event-source subject', () => {
        const event = request.Events[0];
        should.equal(event.EventSourceType, undefined);
        should.equal(event.EventStreamType, undefined);
        should.equal(event.EventStreamId, undefined);
        should.equal(event.Occurred, undefined);
        event.Subject.should.equal('source');
    });
});
