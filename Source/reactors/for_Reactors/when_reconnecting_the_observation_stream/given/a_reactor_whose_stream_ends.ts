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

@eventType('reconnecting-reactor-item')
class Item {}

@reactor('reconnecting-reactor')
class Observer { item() {} }

/** How one observation stream behaves: what it delivers before it ends, and the error it ends with, if any. */
export interface StreamScript {
    deliver?: EventsToObserve[];
    error?: unknown;
}

/**
 * A reactor whose observation streams follow a script, on fake timers and a jitter of zero, so every wait is
 * exactly half of its ceiling.
 */
export class a_reactor_whose_stream_ends {
    readonly lifecycle = new ConnectionLifecycle();
    readonly openedAt: number[] = [];
    readonly reconnectRequests: string[] = [];
    readonly scripts: StreamScript[] = [];
    readonly reactors: Reactors;

    constructor() {
        vi.useFakeTimers();
        const self = this;
        async function* observe(): AsyncGenerator<EventsToObserve> {
            self.openedAt.push(Date.now());
            const script = self.scripts.shift() ?? {};
            for (const delivery of script.deliver ?? []) yield delivery;
            if (script.error) throw script.error;
        }

        this.lifecycle.onReconnectRequested(reason => this.reconnectRequests.push(reason));
        const artifacts = { eventTypes: [Item], reactors: [Observer], reducers: [], readModels: [], seeders: [], constraints: [],
            projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: [] } as IClientArtifactsProvider;
        this.reactors = new Reactors(artifacts, { reactors: { observe } } as unknown as ChronicleConnection, 'store', 'Default',
            this.lifecycle, {} as IEventLog, undefined, { readModels: {} } as IEventStore, undefined, false,
            { now: () => Date.now(), nextJitter: () => 0 });
    }

    /** Gets the wait before each stream after the first was opened. */
    get waits(): number[] {
        return this.openedAt.slice(1).map((at, index) => at - this.openedAt[index]);
    }

    dispose(): void {
        this.reactors.dispose();
        vi.useRealTimers();
    }
}
