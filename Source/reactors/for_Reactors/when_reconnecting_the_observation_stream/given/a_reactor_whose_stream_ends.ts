// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { vi } from 'vitest';
import type { EventsToObserve } from '@cratis/chronicle.contracts';
import { Reactors } from '../../../Reactors.js';
import { reactor } from '../../../reactor.js';
import { eventType } from '../../../../events/eventTypeDecorator.js';
import { ConnectionLifecycle } from '../../../../connection/ConnectionLifecycle.js';
import type { ChronicleConnection } from '../../../../connection/ChronicleConnection.js';
import type { IClientArtifactsProvider } from '../../../../artifacts/IClientArtifactsProvider.js';
import type { IEventLog } from '../../../../eventSequences/IEventLog.js';
import type { IEventStore } from '../../../../IEventStore.js';
import { a_scripted_stream, type StreamScript } from '../../../../observation/for_ObservationReconnectBackoff/given/a_scripted_stream.js';

@eventType('reconnecting-reactor-item')
class Item {}

@reactor('reconnecting-reactor')
class Observer { item() {} }

export type { StreamScript };

/**
 * A reactor whose observation streams follow a script, on fake timers and a jitter of zero, so every wait is
 * exactly half of its ceiling.
 */
export class a_reactor_whose_stream_ends {
    readonly lifecycle = new ConnectionLifecycle();
    readonly reconnectRequests: string[] = [];
    readonly stream = new a_scripted_stream<EventsToObserve>();
    readonly reactors: Reactors;

    constructor() {
        vi.useFakeTimers();
        this.lifecycle.onReconnectRequested(reason => this.reconnectRequests.push(reason));
        const artifacts = { eventTypes: [Item], reactors: [Observer], reducers: [], readModels: [], seeders: [], constraints: [],
            projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: [] } as IClientArtifactsProvider;
        this.reactors = new Reactors(artifacts, { reactors: { observe: this.stream.observe } } as unknown as ChronicleConnection,
            'store', 'Default', this.lifecycle, {} as IEventLog, undefined, { readModels: {} } as IEventStore, undefined, false,
            { now: () => Date.now(), nextJitter: () => 0 });
    }

    /** Gets the scripts the next streams follow. */
    get scripts(): StreamScript<EventsToObserve>[] {
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
        await this.reactors.register();
    }

    dispose(): void {
        this.reactors.dispose();
        vi.useRealTimers();
    }
}
