// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { vi, type Mock } from 'vitest';
import type { IEventStore } from '../../../IEventStore.js';
import { EventStore } from '../../../EventStore.js';
import { EventStoreName } from '../../../EventStoreName.js';
import { EventStoreNamespaceName } from '../../../EventStoreNamespaceName.js';
import type { ChronicleConnection } from '../../../connection/ChronicleConnection.js';
import { ConnectionLifecycle } from '../../../connection/ConnectionLifecycle.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { fromEvent } from '../../../projections/modelBound/fromEvent.js';
import { reactor } from '../../../reactors/reactor.js';
import { reducer } from '../../../reducers/reducer.js';

@eventType('registration-item')
class Item {}
@fromEvent(Item)
class First { static readonly readModelId = 'first'; }
@fromEvent(Item)
class Second { static readonly readModelId = 'second'; }
@fromEvent(Item)
class Third { static readonly readModelId = 'third'; }
class State { total = 0; }
@reactor('observer-reactor')
class ObserverReactor {}
@reducer('observer-reducer', undefined, State)
class ObserverReducer {}

/** A real event store and the kernel operations recorded during registration. */
export interface RegistrationContext {
    readonly store: EventStore;
    readonly publicStore: IEventStore;
    readonly registerProjection: Mock;
    readonly observe: Mock;
}

/** A real event store using in-memory kernel acknowledgments, with three declared projections. */
export function an_event_store(withObservers = false): RegistrationContext {
    const observe = vi.fn((_requests: unknown, options: { signal: AbortSignal }) => (async function* () {
        await new Promise<void>(resolve => options.signal.addEventListener('abort', () => resolve(), { once: true }));
    })());
    const registerProjection = vi.fn().mockResolvedValue({});
    const register = vi.fn().mockResolvedValue({});
    const connection = new Proxy({}, {
        get: (_target, service) => {
            if (service === 'logger') return undefined;
            if (service === 'projections') return { register: registerProjection };
            if (service === 'reactors' || service === 'reducers') return { observe };
            return new Proxy({}, { get: () => register });
        }
    }) as ChronicleConnection;
    const store = new EventStore(new EventStoreName('store'), EventStoreNamespaceName.default, connection, new ConnectionLifecycle(), 'sink', {
        eventTypes: [Item], readModels: [First, Second, Third], projections: [],
        reactors: withObservers ? [ObserverReactor] : [], reducers: withObservers ? [ObserverReducer] : [],
        seeders: [], constraints: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
    });
    return { store, publicStore: store, registerProjection, observe };
}
