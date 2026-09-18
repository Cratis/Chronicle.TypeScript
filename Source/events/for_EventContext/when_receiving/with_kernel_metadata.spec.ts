// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { EventContext as ContractsEventContext, EventType as ContractsEventType } from '@cratis/chronicle.contracts';
import type { IClientArtifactsProvider } from '../../../artifacts';
import type { ChronicleConnection } from '../../../connection';
import { ConnectionLifecycle } from '../../../connection/ConnectionLifecycle';
import { toContractsGuid } from '../../../connection/Guid';
import { EventSequence, EventSequenceId, EventSequenceNumber } from '../../../eventSequences';
import type { IEventLog } from '../../../eventSequences';
import { Reactors, reactor } from '../../../reactors';
import { Reducers, reducer } from '../../../reducers';
import type { IUnitOfWorkManager } from '../../../transactions';
import { eventType } from '../../eventTypeDecorator';
import type { EventContext } from '../../EventContext';
import { Guid } from '@cratis/fundamentals';

chai.should();
class CanonicalMetadataRecorded {}
eventType('CanonicalMetadataRecorded')(CanonicalMetadataRecorded);
const correlationId = '12345678-1234-5678-9abc-123456789abc';
const occurred = '2025-06-07T08:09:10.123Z';
function wireEvent() {
    return {
        Context: ContractsEventContext.fromPartial({
            EventType: ContractsEventType.fromPartial({ Id: 'CanonicalMetadataRecorded', Generation: 2, Tombstone: true }),
            EventStore: 'store', Namespace: 'tenant',
            SequenceNumber: 9007199254740993n, EventSourceId: 'source', EventSourceType: 'Source',
            EventStreamType: 'Stream', EventStreamId: 'stream-id', Subject: 'subject', Hash: 'persisted-hash',
            Occurred: { Value: occurred }, CorrelationId: toContractsGuid(Guid.as(correlationId)),
            Tags: ['one', 'two'], ObservationState: 1,
            Causation: [{ Type: 'command', Occurred: { Value: occurred }, Properties: { key: 'value' } }],
            CausedBy: { Subject: 'actor', Name: 'Actor', UserName: 'actor-name', OnBehalfOf: { Subject: 'delegate', Name: 'Delegate' } }
        }),
        Content: '{}'
    };
}

async function receiveContext(kind: string): Promise<EventContext> {
    if (kind === 'read') {
        const connection = { eventSequences: { fromSequenceNumber: async () => ({ Data: [wireEvent()] }) } } as unknown as ChronicleConnection;
        const sequence = new EventSequence(EventSequenceId.eventLog, 'store', 'tenant', connection, {} as IUnitOfWorkManager);
        return (await sequence.getFromSequenceNumber(EventSequenceNumber.first))[0].context;
    }

    let received: EventContext | undefined;
    class CapturingReactor { canonicalMetadataRecorded(_event: object, context: EventContext) { received = context; } }
    class State { count = 0; }
    class CapturingReducer {
        canonicalMetadataRecorded(_event: object, _state: State | undefined, context: EventContext) {
            received = context;
            return { count: 1 };
        }
    }
    reactor('metadata-reactor')(CapturingReactor);
    reducer('metadata-reducer', undefined, State)(CapturingReducer);
    const lifecycle = new ConnectionLifecycle();
    let finish!: () => void;
    const finished = new Promise<void>(resolve => { finish = resolve; });
    async function* observe(queue: AsyncIterable<unknown>) {
        const messages = queue[Symbol.asyncIterator]();
        await messages.next();
        yield { Events: [wireEvent()], Partition: 'source', ReplayState: 0, InitialState: '' };
        await messages.next();
        await lifecycle.disconnected(error => { throw error; });
        finish();
    }
    const connection = { reactors: { observe }, reducers: { observe }, readModels: { registerMany: async () => ({}) } } as unknown as ChronicleConnection;
    const artifacts = {
        eventTypes: [CanonicalMetadataRecorded], reactors: [CapturingReactor], reducers: [CapturingReducer],
        readModels: [], seeders: [], constraints: [], projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
    } as IClientArtifactsProvider;
    const runtime = kind === 'reactor'
        ? new Reactors(artifacts, connection, 'store', 'tenant', lifecycle, {} as IEventLog)
        : new Reducers(artifacts, connection, 'store', 'tenant', lifecycle, 'default-sink');
    await runtime.register();
    await finished;
    if (!received) throw new Error(`No context delivered to ${kind}`);
    return received;
}

for (const kind of ['read', 'reactor', 'reducer']) {
    describe(`when receiving kernel metadata through a ${kind}`, () => {
        let context: EventContext;
        beforeEach(async () => { context = await receiveContext(kind); });
        it('should retain the exact route and subject', () => {
            [context.eventSourceType, context.eventSourceId, context.eventStreamType, context.eventStreamId, context.subject]
                .should.deep.equal(['Source', 'source', 'Stream', 'stream-id', 'subject']);
            context.eventStore!.should.equal('store');
            context.namespace!.should.equal('tenant');
        });
        it('should retain timestamp, sequence number, event type, and canonical correlation id', () => {
            context.occurred.toISOString().should.equal(occurred);
            context.sequenceNumber.should.equal(9007199254740993n);
            context.eventType.generation.value.should.equal(2);
            context.eventType.tombstone.should.equal(true);
            context.correlationId.should.equal(correlationId);
        });
        it('should retain tags, causation, identity, hash, and observation state', () => {
            context.tags.map(tag => tag.value).should.deep.equal(['one', 'two']);
            context.causation.should.deep.equal([{ type: 'command', occurred: new Date(occurred), properties: { key: 'value' } }]);
            context.causedBy!.subject.should.equal('actor');
            context.causedBy!.onBehalfOf!.subject.should.equal('delegate');
            context.hash!.should.equal('persisted-hash');
            context.observationState!.should.equal(1);
        });
    });
}
