// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { ChronicleClient } from '../../ChronicleClient.js';
import { ChronicleOptions } from '../../ChronicleOptions.js';
import { EventStore } from '../../EventStore.js';
import type { IEventStore } from '../../IEventStore.js';
import { IncompatibleChronicleServer } from '../../connection/IncompatibleChronicleServer.js';
import { RejectedChronicleCredentials } from '../../connection/RejectedChronicleCredentials.js';
import { projection } from '../../projections/declarative/projection.js';
import type { IReadModelWatcher } from '../../readModels/IReadModelWatcher.js';
import { a_kernel_stream } from '../../readModels/for_ReadModelWatcher/given/a_kernel_stream.js';

chai.should();

const transport = vi.hoisted(() => ({
    resetChannel: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), getVersionInfo: vi.fn(),
    ensureEventStore: vi.fn(), watch: vi.fn(),
    lost: undefined as ((reason: string, error: unknown) => void) | undefined
}));
vi.mock('../../connection/ChronicleConnection', () => ({
    ChronicleConnection: class {
        resetChannel = transport.resetChannel;
        connect = transport.connect;
        disconnect = transport.disconnect;
        server = { getVersionInfo: transport.getVersionInfo };
        eventStores = { ensureEventStore: transport.ensureEventStore };
        readModels = { watch: transport.watch };
    }
}));
vi.mock('../../connection/KernelKeepAlive', () => ({
    KernelKeepAlive: class {
        constructor(_connections: unknown, onLost: (reason: string, error: unknown) => void) { transport.lost = onLost; }
        async start() {}
    }
}));

class Model { id = ''; }
class ModelProjection { define() {} }
projection('model', Model)(ModelProjection);

describe('when reconnecting with waiting read model watchers', () => {
    let client: ChronicleClient;
    let store: IEventStore;
    let watcher: IReadModelWatcher<Model>;
    let stream: a_kernel_stream;
    let rejectReconnect: (error: Error) => void;

    beforeEach(async () => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        // Registration is outside this connection-lifetime specification; retain the real store and watchers.
        vi.spyOn(EventStore.prototype, 'registerArtifacts').mockResolvedValue(undefined);
        transport.resetChannel.mockResolvedValue(undefined);
        transport.connect.mockResolvedValue(undefined);
        transport.getVersionInfo.mockResolvedValue({});
        transport.ensureEventStore.mockResolvedValue({ IsSuccess: true, IsAuthorized: true });
        stream = new a_kernel_stream();
        transport.watch.mockImplementation((_request, options: { signal: AbortSignal }) => {
            stream.signal = options.signal;
            options.signal.addEventListener('abort', () => stream.end(), { once: true });
            return stream;
        });
        client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', {
            discoveryPatterns: [],
            clientArtifactsProvider: {
                readModels: [Model], projections: [ModelProjection], eventTypes: [], reactors: [], reducers: [],
                seeders: [], constraints: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
            }
        }));
        store = await client.getEventStore('store');
        watcher = store.readModels.createWatcher(Model, { resume: true });
        stream.send({ Subscribed: true });
        await watcher.subscribed;
        transport.connect.mockImplementation(() => new Promise<void>((_resolve, reject) => { rejectReconnect = reject; }));
        transport.lost!('keep-alive-ended', { code: 14 });
        await vi.advanceTimersByTimeAsync(0);
        stream.signal.aborted.should.be.true;
    });
    afterEach(() => {
        client.dispose();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it.each([
        ['incompatible server', IncompatibleChronicleServer],
        ['rejected credentials', RejectedChronicleCredentials]
    ] as const)('should reject readiness and iteration on terminal %s', async (_reason, Failure) => {
        const failure = new Failure('Replacement connection rejected');
        const readiness = watcher.subscribed.catch(error => error);
        const next = watcher[Symbol.asyncIterator]().next().catch(error => error);
        rejectReconnect(failure);
        (await readiness).should.equal(failure);
        (await next).should.equal(failure);
        await vi.advanceTimersByTimeAsync(15000);
        transport.watch.mock.calls.should.have.lengthOf(1);
        transport.connect.mock.calls.should.have.lengthOf(2);
        // A cached store cannot create a watcher that waits forever after the terminal verdict.
        const later = store.readModels.createWatcher(Model);
        (await later.subscribed.catch(error => error)).should.equal(failure);
        (await later[Symbol.asyncIterator]().next().catch(error => error)).should.equal(failure);
    });

    it('should reject pending readiness but complete iteration cleanly if disposed during recovery', async () => {
        const readiness = watcher.subscribed.catch(error => error);
        const next = watcher[Symbol.asyncIterator]().next();
        client.dispose();
        (await readiness).name.should.equal('AbortError');
        (await next).done!.should.be.true;
        rejectReconnect(new IncompatibleChronicleServer('Late reconnect failure'));
        await vi.advanceTimersByTimeAsync(15000);
        (await watcher[Symbol.asyncIterator]().next()).done!.should.be.true;
        transport.watch.mock.calls.should.have.lengthOf(1);
    });
});
