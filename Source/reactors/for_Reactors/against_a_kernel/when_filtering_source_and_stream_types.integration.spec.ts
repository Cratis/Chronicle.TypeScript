// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { ObserverRunningState } from '@cratis/chronicle.contracts';
import { ChronicleClient, ChronicleOptions, eventType, eventSourceType, eventStreamType, filterEventsByTag,
    reactor, reducer, tag, type IEventStore, type IClientArtifactsProvider } from '../../../index.js';
import type { ChronicleConnection } from '../../../connection/index.js';

chai.should();
function should(value: unknown): ReturnType<typeof chai.expect> {
    return (value as { should: ReturnType<typeof chai.expect> }).should;
}
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

@eventType()
class FilteredOrderPlaced {
    @field(String) name = '';
}

const reactorCalls = new Map<string, string[]>();
const reducerCalls = new Map<string, string[]>();
class Totals { count = 0; lastName = ''; }
class SourceTotals extends Totals {}
class StreamTotals extends Totals {}
class CombinedTotals extends Totals {}

@reactor()
class AllOrders {
    filteredOrderPlaced(event: FilteredOrderPlaced) {
        const name = this.constructor.name;
        reactorCalls.set(name, [...reactorCalls.get(name) ?? [], event.name]);
    }
}
@reactor()
@eventSourceType('Customers')
class CustomerOrders extends AllOrders {}
@reactor()
@eventStreamType('Orders')
class OrdersStream extends AllOrders {}
@reactor()
@eventSourceType('Customers')
@eventStreamType('Orders')
@filterEventsByTag('vip')
@filterEventsByTag('priority')
@tag('Analytics')
class PriorityCustomerOrders extends AllOrders {}

@reducer('AllOrderTotals', undefined, Totals)
class AllOrderTotals {
    filteredOrderPlaced(event: FilteredOrderPlaced, current: Totals | undefined): Totals {
        const name = this.constructor.name;
        reducerCalls.set(name, [...reducerCalls.get(name) ?? [], event.name]);
        return { count: (current?.count ?? 0) + 1, lastName: event.name };
    }
}
@reducer('CustomerOrderTotals', undefined, SourceTotals)
@eventSourceType('Customers')
class CustomerOrderTotals extends AllOrderTotals {}
@reducer('OrdersStreamTotals', undefined, StreamTotals)
@eventStreamType('Orders')
class OrdersStreamTotals extends AllOrderTotals {}
@reducer('PriorityCustomerOrderTotals', undefined, CombinedTotals)
@eventSourceType('Customers')
@eventStreamType('Orders')
@filterEventsByTag('vip')
@filterEventsByTag('priority')
@tag('Analytics')
class PriorityCustomerOrderTotals extends AllOrderTotals {}

const artifacts: IClientArtifactsProvider = {
    eventTypes: [FilteredOrderPlaced], reactors: [AllOrders, CustomerOrders, OrdersStream, PriorityCustomerOrders],
    reducers: [AllOrderTotals, CustomerOrderTotals, OrdersStreamTotals, PriorityCustomerOrderTotals],
    readModels: [Totals, SourceTotals, StreamTotals, CombinedTotals], seeders: [], constraints: [], projections: [],
    webhooks: [], eventTypeMigrations: [], globalForHandlers: []
};

async function eventually(accept: () => boolean | Promise<boolean>, timeoutMs = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!await accept()) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for filtered observers');
        await new Promise(resolve => setTimeout(resolve, 250));
    }
}

// A final matching event is an ordered barrier in every observer's shared source partition.
// The unrestricted observers also prove all excluded input was actually committed and delivered.
const expected = [
    ['wrong-source', 'wrong-stream', 'wrong-tag', 'no-tag', 'priority', 'barrier'],
    ['wrong-stream', 'wrong-tag', 'no-tag', 'priority', 'barrier'],
    ['wrong-source', 'wrong-tag', 'no-tag', 'priority', 'barrier'],
    ['priority', 'barrier']
];

describe.skipIf(!connectionString && !process.env.CI)('when filtering reactor and reducer delivery against a kernel', () => {
    const storeName = `Filters${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const sourceId = randomUUID();
    let client: ChronicleClient;
    let store: IEventStore;

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [], clientArtifactsProvider: artifacts
        }));
        store = await client.getEventStore(storeName);
        const connection = (store as unknown as { _connection: ChronicleConnection })._connection;
        await eventually(async () => {
            const observers = await Promise.all([...artifacts.reactors, ...artifacts.reducers].map(type =>
                connection.observers.getObserverInformation({ EventStore: storeName, Namespace: 'Default',
                    ObserverId: type.name, EventSequenceId: 'event-log' })));
            return observers.every(observer => observer.IsSubscribed && observer.RunningState === ObserverRunningState.Active);
        });
        const input = [
            { name: 'wrong-source', source: 'Other', stream: 'Orders', tags: ['vip'] },
            { name: 'wrong-stream', source: 'Customers', stream: 'Other', tags: ['vip'] },
            { name: 'wrong-tag', source: 'Customers', stream: 'Orders', tags: ['regular'] },
            { name: 'no-tag', source: 'Customers', stream: 'Orders', tags: [] },
            { name: 'priority', source: 'Customers', stream: 'Orders', tags: ['priority'] },
            { name: 'barrier', source: 'Customers', stream: 'Orders', tags: ['vip'] }
        ];
        const results = await store.eventLog.appendMany(input.map(item => ({ eventSourceId: sourceId,
            event: Object.assign(new FilteredOrderPlaced(), { name: item.name }), eventSourceType: item.source,
            eventStreamType: item.stream, eventStreamId: 'Default', tags: item.tags })));
        should(results).have.lengthOf(input.length);
        should(results.every(result => result.isSuccess)).be.true;
        await eventually(() => [...artifacts.reactors].every(type => reactorCalls.get(type.name)?.at(-1) === 'barrier') &&
            [...artifacts.reducers].every(type => reducerCalls.get(type.name)?.at(-1) === 'barrier'));
        await eventually(async () => {
            const states = await Promise.all(artifacts.readModels.map(type => store.readModels.findInstanceById(type, sourceId)));
            return states.every(state => (state as Totals | null)?.lastName === 'barrier');
        });
    });
    afterAll(() => client?.dispose());

    for (let index = 0; index < expected.length; index++) {
        it(`should deliver only the selected events to reactor ${artifacts.reactors[index].name}`, () => {
            should(reactorCalls.get(artifacts.reactors[index].name)).deep.equal(expected[index]);
        });
        it(`should deliver only the selected events to reducer ${artifacts.reducers[index].name}`, async () => {
            should(reducerCalls.get(artifacts.reducers[index].name)).deep.equal(expected[index]);
            const state = await store.readModels.getInstanceById(artifacts.readModels[index], sourceId) as Totals;
            should(state.count).equal(expected[index].length);
        });
    }
});
