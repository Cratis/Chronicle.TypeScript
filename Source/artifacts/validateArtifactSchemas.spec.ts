// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { describe, expect, it, vi } from 'vitest';
import { eventType } from '../events/eventTypeDecorator.js';
import { readModel } from '../readModels/readModel.js';
import { IClientArtifactsProvider } from './IClientArtifactsProvider.js';
import { validateArtifactSchemas } from './validateArtifactSchemas.js';
import { EventStore } from '../EventStore.js';
import { EventStoreName } from '../EventStoreName.js';
import { EventStoreNamespaceName } from '../EventStoreNamespaceName.js';
import { ChronicleConnection } from '../connection/ChronicleConnection.js';
import { ConnectionLifecycle } from '../connection/ConnectionLifecycle.js';

@eventType('bad-event')
class BadEvent {
    @field(Array) items!: string[];
}

@readModel('bad-read-model')
class BadReadModel {
    constructor(readonly name: string) {}
}

@eventType('good-event')
class GoodEvent {}

const artifacts = {
    eventTypes: [BadEvent, GoodEvent],
    readModels: [BadReadModel]
} as unknown as IClientArtifactsProvider;

describe('artifact schema preflight', () => {
    it('blocks every Kernel registration when preflight fails', async () => {
        const register = vi.fn();
        const connection = new Proxy({}, {
            get: () => new Proxy({}, { get: () => register })
        }) as ChronicleConnection;
        const lifecycle = { onDisconnected: vi.fn(), onConnected: vi.fn() } as unknown as ConnectionLifecycle;
        const store = new EventStore(new EventStoreName('Test'), EventStoreNamespaceName.default, connection, lifecycle, 'sink');

        await expect(store.registerArtifacts()).rejects.toBeInstanceOf(AggregateError);
        expect(register).not.toHaveBeenCalled();
    });

    it('collects all schema failures before registration', () => {
        try {
            validateArtifactSchemas(artifacts);
            throw new Error('Expected schema validation to fail');
        } catch (error) {
            expect(error).toBeInstanceOf(AggregateError);
            const aggregate = error as AggregateError;
            expect(aggregate.errors).toHaveLength(2);
            expect(aggregate.errors.map((failure: Error) => failure.message)).toEqual([
                expect.stringContaining('Event type BadEvent:'),
                expect.stringContaining('Read model BadReadModel:')
            ]);
        }
    });
});
