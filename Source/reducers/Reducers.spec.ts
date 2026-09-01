// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import type { Constructor } from '@cratis/fundamentals';
import type { IClientArtifactsProvider } from '../artifacts';
import type { ChronicleConnection } from '../connection';
import { ConnectionLifecycle } from '../connection/ConnectionLifecycle';
import { eventType, getEventTypeFor } from '../events/eventTypeDecorator';
import type { EventContext } from '../events/EventContext';
import { filterEventsByTag } from '../events/filterEventsByTagDecorator';
import { tag } from '../events/tagDecorator';
import { reducer } from './reducer';
import { Reducers } from './Reducers';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

class ReducersSomeEventHappened {
    constructor(readonly value: string = '') {}
}
eventType('d2b2b2b2-2222-4a3c-9d3f-6f2f4a3c9d3f')(ReducersSomeEventHappened);

class SomeTaggedReducerState {
    count = 0;
}

class SomeTaggedReducer {
    reducersSomeEventHappened(): SomeTaggedReducerState {
        return { count: 1 };
    }
}
reducer('some-tagged-reducer', undefined, SomeTaggedReducerState)(SomeTaggedReducer);
tag('Analytics', 'Reporting')(SomeTaggedReducer);
filterEventsByTag('vip')(SomeTaggedReducer);
filterEventsByTag('priority')(SomeTaggedReducer);

const receivedContexts: EventContext[] = [];

class CapturingReducerState {
    count = 0;
}

class CapturingReducer {
    reducersSomeEventHappened(_event: ReducersSomeEventHappened, current: CapturingReducerState | undefined, context: EventContext): CapturingReducerState {
        receivedContexts.push(context);
        return { count: (current?.count ?? 0) + 1 };
    }
}
reducer('capturing-reducer', undefined, CapturingReducerState)(CapturingReducer);

/**
 * A minimal client artifacts provider exposing only the reducer types under test —
 * Reducers.ts only reads .reducers and .eventTypes off this during discovery.
 */
function createArtifacts(reducers: Constructor[]): IClientArtifactsProvider {
    return {
        eventTypes: [],
        readModels: [],
        reactors: [],
        reducers,
        seeders: [],
        constraints: [],
        projections: [],
        webhooks: [],
        eventTypeMigrations: []
    };
}

/**
 * Captures the first message a reducer observation pushes onto its queue (the registration
 * message), by having the mocked `observe` call itself consume the queue's async iterator.
 */
function createConnection() {
    const registrationMessages: unknown[] = [];
    const observe = vi.fn().mockImplementation(async function* (queue: AsyncIterable<unknown>) {
        for await (const message of queue) {
            registrationMessages.push(message);
            break;
        }
    });
    const registerMany = vi.fn().mockResolvedValue({});
    const connection = {
        reducers: { observe },
        readModels: { registerMany }
    } as unknown as ChronicleConnection;

    return { connection, registrationMessages };
}

describe('Reducers', () => {
    describe('when registering an active reducer (the default)', () => {
        class SomeReducer {}
        reducer('some-active-reducer')(SomeReducer);

        it('should send a registration message with IsActive true', async () => {
            const { connection, registrationMessages } = createConnection();
            const reducers = new Reducers(createArtifacts([SomeReducer]), connection, 'my-event-store', 'my-namespace', new ConnectionLifecycle(), 'default-sink');

            await reducers.register();
            await flush();

            expect(registrationMessages).toHaveLength(1);
            const message = registrationMessages[0] as { Content: { Value0: { Reducer: { IsActive: boolean } } } };
            expect(message.Content.Value0.Reducer.IsActive).toBe(true);
        });
    });

    describe('when registering a passive (isActive: false) reducer', () => {
        class SomePassiveReducer {}
        reducer('some-passive-reducer', undefined, undefined, false)(SomePassiveReducer);

        it('should send a registration message with IsActive false', async () => {
            const { connection, registrationMessages } = createConnection();
            const reducers = new Reducers(createArtifacts([SomePassiveReducer]), connection, 'my-event-store', 'my-namespace', new ConnectionLifecycle(), 'default-sink');

            await reducers.register();
            await flush();

            expect(registrationMessages).toHaveLength(1);
            const message = registrationMessages[0] as { Content: { Value0: { Reducer: { IsActive: boolean } } } };
            expect(message.Content.Value0.Reducer.IsActive).toBe(false);
        });
    });
});
