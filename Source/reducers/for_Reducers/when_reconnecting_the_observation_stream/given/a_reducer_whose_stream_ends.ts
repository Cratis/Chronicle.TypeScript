// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { vi } from 'vitest';
import type { ReduceOperationMessage } from '@cratis/chronicle.contracts';
import { Reducers } from '../../../Reducers.js';
import { reducer } from '../../../reducer.js';
import { eventType } from '../../../../events/eventTypeDecorator.js';
import { ConnectionLifecycle } from '../../../../connection/ConnectionLifecycle.js';
import type { ChronicleConnection } from '../../../../connection/ChronicleConnection.js';
import type { IClientArtifactsProvider } from '../../../../artifacts/IClientArtifactsProvider.js';
import { a_scripted_stream, type StreamScript } from '../../../../observation/for_ObservationReconnectBackoff/given/a_scripted_stream.js';

@eventType('reconnecting-reducer-item')
class Item {}
class Model {}

@reducer('reconnecting-reducer', undefined, Model)
class Observer { item() { return new Model(); } }

/**
 * A reducer whose observation streams follow a script, on fake timers and a jitter of zero, so every wait is
 * exactly half of its ceiling.
 */
export class a_reducer_whose_stream_ends {
    readonly lifecycle = new ConnectionLifecycle();
    readonly reconnectRequests: string[] = [];
    readonly stream = new a_scripted_stream<ReduceOperationMessage>();
    readonly reducers: Reducers;

    constructor() {
        vi.useFakeTimers();
        this.lifecycle.onReconnectRequested(reason => this.reconnectRequests.push(reason));
        const artifacts = { eventTypes: [Item], reducers: [Observer], reactors: [], readModels: [Model], seeders: [], constraints: [],
            projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: [] } as IClientArtifactsProvider;
        const connection = {
            reducers: { observe: this.stream.observe },
            readModels: { registerMany: vi.fn().mockResolvedValue({}) }
        } as unknown as ChronicleConnection;
        this.reducers = new Reducers(artifacts, connection, 'store', 'Default', this.lifecycle, 'sink',
            undefined, undefined, undefined, false, { now: () => Date.now(), nextJitter: () => 0 });
    }

    /** Gets the scripts the next streams follow. */
    get scripts(): StreamScript<ReduceOperationMessage>[] {
        return this.stream.scripts;
    }

    /** Gets when each stream was opened. */
    get openedAt(): number[] {
        return this.stream.openedAt;
    }

    /** Gets the wait before each stream after the first was opened. */
    get waits(): number[] {
        return this.stream.waits;
    }

    /** Drops the session and registers again, as a client reconnect does. */
    async reconnect(): Promise<void> {
        await this.lifecycle.disconnected(() => undefined);
        await this.reducers.register();
    }

    dispose(): void {
        this.reducers.dispose();
        vi.useRealTimers();
    }
}
