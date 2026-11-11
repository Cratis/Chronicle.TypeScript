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

@eventType('reconnecting-reducer-item')
class Item {}
class Model {}

@reducer('reconnecting-reducer', undefined, Model)
class Observer { item() { return new Model(); } }

/**
 * A reducer whose observation streams end with the errors the spec queues, on fake timers and a jitter of zero, so
 * every wait is exactly half of its ceiling.
 */
export class a_reducer_whose_stream_ends {
    readonly lifecycle = new ConnectionLifecycle();
    readonly openedAt: number[] = [];
    readonly reconnectRequests: string[] = [];
    readonly endings: unknown[] = [];
    readonly reducers: Reducers;

    constructor() {
        vi.useFakeTimers();
        const self = this;
        async function* observe(): AsyncGenerator<ReduceOperationMessage> {
            self.openedAt.push(Date.now());
            const error = self.endings.shift();
            if (error) throw error;
        }

        this.lifecycle.onReconnectRequested(reason => this.reconnectRequests.push(reason));
        const artifacts = { eventTypes: [Item], reducers: [Observer], reactors: [], readModels: [Model], seeders: [], constraints: [],
            projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: [] } as IClientArtifactsProvider;
        const connection = { reducers: { observe }, readModels: { registerMany: vi.fn().mockResolvedValue({}) } } as unknown as ChronicleConnection;
        this.reducers = new Reducers(artifacts, connection, 'store', 'Default', this.lifecycle, 'sink',
            undefined, undefined, undefined, false, { now: () => Date.now(), nextJitter: () => 0 });
    }

    /** Gets the wait before each stream after the first was opened. */
    get waits(): number[] {
        return this.openedAt.slice(1).map((at, index) => at - this.openedAt[index]);
    }

    dispose(): void {
        this.reducers.dispose();
        vi.useRealTimers();
    }
}
