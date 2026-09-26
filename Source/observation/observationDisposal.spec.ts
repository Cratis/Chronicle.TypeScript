// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import type { Constructor } from '@cratis/fundamentals';
import type { IClientArtifactsProvider } from '../artifacts/index.js';
import { ChronicleClient } from '../ChronicleClient.js';
import { ChronicleOptions } from '../ChronicleOptions.js';
import type { ChronicleConnection } from '../connection/index.js';
import { ConnectionLifecycle } from '../connection/ConnectionLifecycle.js';
import type { EventStore } from '../EventStore.js';
import type { IEventLog } from '../eventSequences/IEventLog.js';
import { Reactors } from '../reactors/Reactors.js';
import { reactor } from '../reactors/reactor.js';
import { Reducers } from '../reducers/Reducers.js';
import { reducer } from '../reducers/reducer.js';

class ExampleReactor {}
reactor('disposal-reactor')(ExampleReactor);
class ExampleReducer {}
reducer('disposal-reducer')(ExampleReducer);

const artifacts = {
    reactors: [ExampleReactor as Constructor], reducers: [ExampleReducer as Constructor],
    eventTypes: [], readModels: []
} as unknown as IClientArtifactsProvider;

function stream() {
    const signals: AbortSignal[] = [];
    const observe = vi.fn((_queue: AsyncIterable<unknown>, options: { signal: AbortSignal }) => {
        signals.push(options.signal);
        return {
            async *[Symbol.asyncIterator]() {
                await new Promise<void>(resolve => options.signal.addEventListener('abort', () => resolve(), { once: true }));
            }
        };
    });
    return { observe, signals };
}

describe('observation disposal', () => {
    it('aborts reactor and reducer streams even without a connected lifecycle and prevents re-observation', async () => {
        const reactorStream = stream();
        const reducerStream = stream();
        const connection = {
            reactors: { observe: reactorStream.observe }, reducers: { observe: reducerStream.observe },
            readModels: { registerMany: vi.fn().mockResolvedValue({}) }
        } as unknown as ChronicleConnection;
        const lifecycle = new ConnectionLifecycle();
        const reactors = new Reactors(artifacts, connection, 'store', 'Default', lifecycle, {} as IEventLog);
        const reducers = new Reducers(artifacts, connection, 'store', 'Default', lifecycle, 'sink');
        await reactors.register();
        await reducers.register();
        expect(reactorStream.observe).toHaveBeenCalledOnce();
        expect(reducerStream.observe).toHaveBeenCalledOnce();

        reactors.dispose();
        reducers.dispose();
        expect(reactorStream.signals[0].aborted).toBe(true);
        expect(reducerStream.signals[0].aborted).toBe(true);
        await reactors.register();
        await reducers.register();
        expect(reactorStream.observe).toHaveBeenCalledOnce();
        expect(reducerStream.observe).toHaveBeenCalledOnce();
    });

    it('disposes cached store observations even when the lifecycle is not connected', () => {
        const client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { discoveryPatterns: [] }));
        const disposeObservations = vi.fn();
        (client as unknown as { _stores: Map<string, EventStore> })._stores.set('store/Default', { disposeObservations } as unknown as EventStore);
        client.dispose();
        expect(disposeObservations).toHaveBeenCalledOnce();
    });
});
