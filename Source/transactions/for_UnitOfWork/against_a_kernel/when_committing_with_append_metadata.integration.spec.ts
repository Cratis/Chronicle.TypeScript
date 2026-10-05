// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { ChronicleClient, ChronicleOptions, EventSequenceNumber, eventType, type AppendedEvent,
    type IClientArtifactsProvider, type IEventStore } from '../../../index.js';

chai.should();
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

@eventType()
class ItemAdded { @field(Number) order = 0; }

const artifacts: IClientArtifactsProvider = {
    eventTypes: [ItemAdded], eventSources: [], readModels: [], reactors: [], reducers: [],
    seeders: [], constraints: [], projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
};

const item = (order: number) => Object.assign(new ItemAdded(), { order });

describe.skipIf(!connectionString && !process.env.CI)('when committing a unit of work with append metadata against a kernel', () => {
    const storeName = `UnitOfWork${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const occurred = new Date('2026-03-04T05:06:07.000Z');
    let client: ChronicleClient;
    let store: IEventStore;
    let id: string;
    let events: AppendedEvent[];
    let committed: boolean;
    let staleSucceeded: boolean;
    let eventsAfterStale: number;

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, { discoveryPatterns: [], clientArtifactsProvider: artifacts }));
        store = await client.getEventStore(storeName);
        id = randomUUID();
        const seeded = await store.eventLog.append(id, item(-1));
        const tail = { sequenceNumber: seeded.sequenceNumber.value, eventSourceId: true };

        const unitOfWork = store.unitOfWorkManager.begin();
        await store.eventLog.transactional.append(id, item(0), {
            eventStreamType: 'Orders', eventStreamId: 'order-1', eventSourceType: 'Customer',
            subject: 'subject-1', occurred, tags: ['priority'], concurrencyScope: tail
        });
        await store.eventLog.transactional.append(id, item(1));
        await unitOfWork.commit();
        committed = unitOfWork.isSuccess;
        events = (await store.eventLog.getFromSequenceNumber(EventSequenceNumber.first, id, [ItemAdded])).slice(1);

        const stale = store.unitOfWorkManager.begin();
        await store.eventLog.transactional.append(id, item(2), { concurrencyScope: tail });
        await stale.commit();
        staleSucceeded = stale.isSuccess;
        eventsAfterStale = (await store.eventLog.getFromSequenceNumber(EventSequenceNumber.first, id, [ItemAdded])).length;
    });
    afterAll(() => client?.dispose());

    it('should accept a current concurrency scope', () => committed.should.be.true);
    it('should append both events in input order', () => events.map(_ => (_.content as { order: number }).order).should.deep.equal([0, 1]));
    it('should keep the stream type', () => events[0].context.eventStreamType!.should.equal('Orders'));
    it('should keep the stream id', () => events[0].context.eventStreamId!.should.equal('order-1'));
    it('should keep the source type', () => events[0].context.eventSourceType!.should.equal('Customer'));
    it('should keep the subject', () => events[0].context.subject!.should.equal('subject-1'));
    it('should keep the occurrence time', () => events[0].context.occurred.toISOString().should.equal(occurred.toISOString()));
    it('should keep the tags', () => events[0].context.tags.map(String).should.contain('priority'));
    it('should default the subject of the event without options to its event source id', () => events[1].context.subject!.should.equal(id));
    it('should reject a stale concurrency scope', () => staleSucceeded.should.be.false);
    it('should not write the event rejected by the stale scope', () => eventsAfterStale.should.equal(3));
});
