// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { vi } from 'vitest';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import { ConnectionLifecycle } from '../../../connection/ConnectionLifecycle.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import { fromEvent } from '../../../projections/index.js';
import { ReadModels } from '../../ReadModels.js';
import { a_kernel_stream } from './a_kernel_stream.js';

export class a_watched_read_model {
    readonly model = class Model { id = ''; };
    readonly lifecycle = new ConnectionLifecycle();
    readonly streams: a_kernel_stream[] = [];
    readonly watch = vi.fn((_request: unknown, options?: { signal: AbortSignal }) => {
        const stream = new a_kernel_stream();
        if (options) {
            stream.signal = options.signal;
            options.signal.addEventListener('abort', () => stream.end(), { once: true });
        }
        this.streams.push(stream);
        return stream;
    });
    readonly readModels: ReadModels;

    constructor() {
        fromEvent(class Changed {})(this.model);
        const artifacts = { readModels: [this.model], projections: [], reducers: [] } as unknown as IClientArtifactsProvider;
        const connection = { readModels: { watch: this.watch } } as unknown as ChronicleConnection;
        this.readModels = new ReadModels('store', 'tenant', connection, artifacts, 'sink', undefined, undefined, this.lifecycle);
    }

    async connect() { await this.lifecycle.connected(error => { throw error; }); }
    async disconnect() { await this.lifecycle.disconnected(error => { throw error; }); }
    async flush() { await new Promise<void>(resolve => setImmediate(resolve)); }
}
