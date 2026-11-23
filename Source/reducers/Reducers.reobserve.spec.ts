// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import type { ReducerMessage } from '@cratis/chronicle.contracts';
import type { IClientArtifactsProvider } from '../artifacts/index.js';
import type { ChronicleConnection } from '../connection/index.js';
import { ConnectionLifecycle } from '../connection/ConnectionLifecycle.js';
import { reducer } from './reducer.js';
import { Reducers } from './Reducers.js';

class ReobservedState {
    count = 0;
}

class ReobservedReducer {}
reducer('reobserved-reducer', undefined, ReobservedState)(ReobservedReducer);

describe('when the observation stream of a reducer ends', () => {
    it('should open one stream per reducer and register again on a fresh stream after the backoff', async () => {
        const registrations: string[] = [];
        let opened = 0;
        let reopened!: () => void;
        const secondStream = new Promise<void>(resolve => { reopened = resolve; });
        const observe = vi.fn().mockImplementation(async function* (queue: AsyncIterable<ReducerMessage>) {
            opened++;
            const first = (await queue[Symbol.asyncIterator]().next()).value!;
            registrations.push(first.Content!.Value0!.Reducer!.ReducerId);
            if (opened === 2) {
                reopened();
                await new Promise(() => {});
            }
        });
        const connection = { reducers: { observe }, readModels: { registerMany: vi.fn().mockResolvedValue({}) } } as unknown as ChronicleConnection;
        const artifacts = { eventTypes: [], readModels: [], reactors: [], reducers: [ReobservedReducer], seeders: [], constraints: [],
            projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: [] } as IClientArtifactsProvider;
        const reducers = new Reducers(artifacts, connection, 'store', 'default', new ConnectionLifecycle(), 'sink',
            undefined, undefined, undefined, false, { baseDelayMs: 0, maxDelayMs: 0 });
        try {
            await reducers.register();
            await secondStream;
        } finally {
            reducers.dispose();
        }
        expect(observe).toHaveBeenCalledTimes(2);
        expect(registrations).toEqual(['reobserved-reducer', 'reobserved-reducer']);
    });
});
