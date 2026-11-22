// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { vi } from 'vitest';
import type { IEventStore } from '../../../IEventStore.js';
import type { IClientArtifactsProvider } from '../../../artifacts/IClientArtifactsProvider.js';
import type { IEventLog } from '../../../eventSequences/IEventLog.js';
import type { IReadModelWatcher } from '../../IReadModelWatcher.js';
import type { ReadModelChangeset } from '../../ReadModelChangeset.js';
import { ReadModelChangeType } from '../../ReadModelChangeType.js';

export class Model { name = 'typed'; }

export function change(changeType?: ReadModelChangeType): ReadModelChangeset<Model> {
    return { readModel: new Model(), key: 'projection-key', namespace: 'tenant-change', removed: changeType === ReadModelChangeType.Removed,
        changeType, changeContext: { eventStore: 'store', namespace: 'tenant-change', sequenceNumber: 9007199254740995n, correlationId: 'correlation', occurred: new Date('2026-01-02T03:04:05Z') } };
}

export function artifacts(types: Constructor[] = []): IClientArtifactsProvider {
    return { readModelReactors: types, readModels: [Model], reactors: [], reducers: [], projections: [],
        eventTypes: [], constraints: [], seeders: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: [] };
}

export class Watcher implements IReadModelWatcher<Model> {
    readonly subscribed: Promise<void>;
    acknowledge!: () => void;
    rejectSubscription!: (error: unknown) => void;
    private wake?: () => void;
    private readonly queue: ReadModelChangeset<Model>[] = [];
    private closed = false;
    private error?: Error;
    readonly dispose = vi.fn(() => { this.closed = true; this.wake?.(); });
    readonly onResubscribed = vi.fn(() => () => {});

    constructor() {
        this.subscribed = new Promise((resolve, reject) => { this.acknowledge = resolve; this.rejectSubscription = reject; });
    }
    push(value: ReadModelChangeset<Model>): void { this.queue.push(value); this.wake?.(); }
    fail(error: Error): void { this.error = error; this.dispose(); }
    async *[Symbol.asyncIterator](): AsyncIterator<ReadModelChangeset<Model>> {
        while (!this.closed) {
            const next = this.queue.shift();
            if (next) yield next;
            else await new Promise<void>(resolve => { this.wake = resolve; });
        }
        if (this.error) throw this.error;
    }
}

export function store(watchers: Watcher[] = []) {
    const createWatcher = vi.fn(() => watchers.shift()!);
    const appendMany = vi.fn(async () => [{ isSuccess: true, errors: [], constraintViolations: [] }]);
    const eventLog = { appendMany } as unknown as IEventLog;
    const value = { readModels: { createWatcher }, eventLog } as unknown as IEventStore;
    return { value, createWatcher, appendMany, eventLog };
}

export function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
}
