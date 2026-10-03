// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { ChronicleClient, ChronicleOptions, EventSequenceNumber, ConcurrencyDimensions, eventSource, eventStream, eventType,
    type IClientArtifactsProvider, type IEventStore } from '../../../index.js';

const should = chai.should();
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

@eventType()
class FundsDeposited { @field(Number) amount = 0; }

@eventSource({ name: 'Account', description: 'A bank account', concurrency: ConcurrencyDimensions.eventSourceId })
@eventStream('Transactions', { description: 'Money movements' })
class AccountEventSource {}

@eventSource({ name: 'Customer' })
class CustomerEventSource {}

const artifacts: IClientArtifactsProvider = {
    eventTypes: [FundsDeposited], eventSources: [AccountEventSource, CustomerEventSource], readModels: [], reactors: [], reducers: [],
    seeders: [], constraints: [], projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
};

const sequenceStart = EventSequenceNumber.first;
const deposit = (amount: number) => Object.assign(new FundsDeposited(), { amount });

describe.skipIf(!connectionString && !process.env.CI)('when appending through registered event sources against a kernel', () => {
    const storeName = `Sources${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    let client: ChronicleClient;
    let store: IEventStore;

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, { discoveryPatterns: [], clientArtifactsProvider: artifacts }));
        store = await client.getEventStore(storeName);
    });
    afterAll(() => client?.dispose());

    // The sequence-number read does not narrow by route, so it also returns events routed through a definition.
    const eventsFor = (id: string) => store.eventLog.getFromSequenceNumber(sequenceStart, id, [FundsDeposited]);

    it('should register the definitions with the kernel', async () => {
        const connection = (store as unknown as { _connection: { eventSources: { allEventSources(request: unknown): Promise<{ Data: Array<{ Name: string; Streams: Array<{ Name: string }> }> }> } } })._connection;
        const response = await connection.eventSources.allEventSources({ EventStore: storeName });
        const account = response.Data.find(_ => _.Name === 'Account');
        should.exist(account);
        account!.Streams.map(_ => _.Name).should.deep.equal(['Transactions']);
        response.Data.some(_ => _.Name === 'Customer').should.equal(true);
    });

    it('should round-trip the event source and stream on appended events', async () => {
        const id = randomUUID();
        const result = await store.eventLog.append(id, deposit(10), { eventSource: AccountEventSource, eventStream: 'Transactions', streamId: 'tx-1' });
        result.isSuccess.should.equal(true);
        const [event] = await eventsFor(id);
        event.context.eventSource!.should.equal('Account');
        event.context.eventSourceType!.should.equal('Account');
        event.context.eventStreamType!.should.equal('Transactions');
    });

    it('should leave the source unset for legacy appends', async () => {
        const id = randomUUID();
        await store.eventLog.append(id, deposit(1));
        const [event] = await eventsFor(id);
        should.equal(event.context.eventSource, undefined);
    });

    it('should reject a stale explicit scope on append-many and keep the batch atomic', async () => {
        const id = randomUUID();
        await store.eventLog.appendMany(id, [deposit(1), deposit(2)], { eventSource: 'Account' });
        const stale = { sequenceNumber: 0n, eventSourceId: true };
        const result = await store.eventLog.appendMany(id, [deposit(3)], { eventSource: 'Account', concurrencyScope: stale }).catch(error => error);
        const events = await eventsFor(id);
        events.should.have.length(2);
        (result instanceof Error || result.some((appended: { isSuccess: boolean }) => !appended.isSuccess)).should.equal(true);
    });

    it('should route a mixed-source batch per event', async () => {
        const account = randomUUID(); const customer = randomUUID();
        await store.eventLog.appendMany([
            { eventSourceId: account, event: deposit(1) },
            { eventSourceId: customer, event: deposit(2), eventSource: CustomerEventSource }
        ], { eventSource: AccountEventSource });
        const [accountEvent] = await eventsFor(account);
        const [customerEvent] = await eventsFor(customer);
        accountEvent.context.eventSource!.should.equal('Account');
        customerEvent.context.eventSource!.should.equal('Customer');
    });
});
