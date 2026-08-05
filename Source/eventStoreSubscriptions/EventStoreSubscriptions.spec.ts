// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import type { ChronicleConnection } from '../connection';
import type { IEventTypes } from '../events';
import { EventStoreSubscriptions } from './EventStoreSubscriptions';

function createEventStoreSubscriptions(getSubscriptionsResult?: unknown) {
    const getSubscriptions = vi.fn().mockResolvedValue(getSubscriptionsResult ?? { items: [] });
    const connection = { eventStoreSubscriptions: { getSubscriptions } } as unknown as ChronicleConnection;
    const eventTypes = {} as IEventTypes;
    const subscriptions = new EventStoreSubscriptions(eventTypes, 'my-event-store', connection);
    return { subscriptions, getSubscriptions };
}

describe('EventStoreSubscriptions', () => {
    describe('when getting all subscriptions', () => {
        const { subscriptions, getSubscriptions } = createEventStoreSubscriptions({
            items: [{
                Identifier: 'my-subscription',
                SourceEventStore: 'source-event-store',
                EventTypes: [{ Id: 'a3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3f', Generation: 1, Tombstone: false }]
            }]
        });

        it('should call the RPC with the target event store and map the response', async () => {
            const result = await subscriptions.getAll();

            expect(getSubscriptions).toHaveBeenCalledTimes(1);
            const request = getSubscriptions.mock.calls[0][0];
            expect(request.TargetEventStore).toEqual('my-event-store');

            expect(result).toHaveLength(1);
            expect(result[0].id.value).toEqual('my-subscription');
            expect(result[0].sourceEventStore).toEqual('source-event-store');
            expect(result[0].eventTypes).toHaveLength(1);
            expect(result[0].eventTypes[0].id.value).toEqual('a3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3f');
            expect(result[0].eventTypes[0].generation.value).toEqual(1);
        });
    });

    describe('when there are no subscriptions', () => {
        const { subscriptions } = createEventStoreSubscriptions({ items: [] });

        it('should return an empty array', async () => {
            const result = await subscriptions.getAll();

            expect(result).toEqual([]);
        });
    });
});
