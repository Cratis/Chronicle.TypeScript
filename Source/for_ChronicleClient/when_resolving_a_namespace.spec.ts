// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AsyncLocalStorage } from 'node:async_hooks';
import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { ChronicleClient } from '../ChronicleClient.js';
import { ChronicleOptions } from '../ChronicleOptions.js';
import { EventStore } from '../EventStore.js';
import { EventStoreNamespaceName } from '../EventStoreNamespaceName.js';
import type { EventStoreNamespaceResolver } from '../EventStoreNamespaceResolver.js';
import type { IClientArtifactsProvider } from '../artifacts/IClientArtifactsProvider.js';

chai.should();
const transport = vi.hoisted(() => ({
    resetChannel: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
    getVersionInfo: vi.fn(), ensureEventStore: vi.fn()
}));
vi.mock('../connection/ChronicleConnection', () => ({
    ChronicleConnection: class {
        resetChannel = transport.resetChannel;
        connect = transport.connect;
        disconnect = transport.disconnect;
        server = { getVersionInfo: transport.getVersionInfo };
        eventStores = { ensureEventStore: transport.ensureEventStore };
    }
}));
const artifacts: IClientArtifactsProvider = {
    eventTypes: [], readModels: [], reactors: [], reducers: [], seeders: [], constraints: [],
    projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
};
let client: ChronicleClient;

function create(namespaceResolver?: EventStoreNamespaceResolver) {
    client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', {
        namespaceResolver, skipKeepAlive: true, discoveryPatterns: [], clientArtifactsProvider: artifacts
    }));
    return client;
}

async function rejection(operation: Promise<unknown>): Promise<Error> {
    const [result] = await Promise.allSettled([operation]);
    result.status.should.equal('rejected');
    if (result.status !== 'rejected') throw new Error('Expected the operation to reject');
    return result.reason as Error;
}

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(complete => { resolve = complete; });
    return { promise, resolve };
}

beforeEach(() => {
    vi.clearAllMocks();
    transport.ensureEventStore.mockResolvedValue({ IsAuthorized: true });
    // Exercise real store construction and caching without registering artifacts with a kernel.
    vi.spyOn(EventStore.prototype, 'registerArtifacts').mockResolvedValue(undefined);
});
afterEach(() => { client?.dispose(); vi.restoreAllMocks(); });

describe('when resolving a namespace', () => {
    it('should preserve the default namespace when no resolver is configured', async () => {
        const store = await create().getEventStore('store');
        store.namespace.should.equal(EventStoreNamespaceName.default);
        store.should.equal(await client.getEventStore('store', EventStoreNamespaceName.default));
    });

    it('should bypass the resolver for explicit string and concept namespaces', async () => {
        const resolver = vi.fn(() => { throw new Error('Must not resolve'); });
        create(resolver);
        const store = await client.getEventStore('store', 'explicit');
        store.namespace.value.should.equal('explicit');
        store.should.equal(await client.getEventStore('store', new EventStoreNamespaceName('explicit')));
        resolver.mock.calls.should.have.lengthOf(0);
    });

    it('should accept a synchronous namespace name', async () => {
        const store = await create(() => 'tenant-a').getEventStore('store');
        store.namespace.value.should.equal('tenant-a');
    });

    it('should accept a synchronous namespace concept', async () => {
        const namespace = new EventStoreNamespaceName('tenant-a');
        const store = await create(() => namespace).getEventStore('store');
        store.namespace.should.equal(namespace);
    });

    it('should accept an asynchronous namespace name', async () => {
        const store = await create(async () => 'tenant-a').getEventStore('store');
        store.namespace.value.should.equal('tenant-a');
    });

    it('should accept an asynchronous namespace concept', async () => {
        const namespace = new EventStoreNamespaceName('tenant-a');
        const store = await create(async () => namespace).getEventStore('store');
        store.namespace.should.equal(namespace);
    });

    it('should share a cached store between resolved and explicit namespaces', async () => {
        const resolved = await create(() => 'tenant-a').getEventStore('store');
        resolved.should.equal(await client.getEventStore('store', 'tenant-a'));
        resolved.should.equal(await client.getEventStore('store', new EventStoreNamespaceName('tenant-a')));
        transport.ensureEventStore.mock.calls.should.have.lengthOf(1);
    });

    it('should resolve on every omitted-namespace call, including cache hits', async () => {
        const resolver = vi.fn().mockReturnValueOnce('tenant-a').mockReturnValueOnce('tenant-b').mockReturnValue('tenant-a');
        create(resolver);
        const first = await client.getEventStore('store');
        const second = await client.getEventStore('store');
        const third = await client.getEventStore('store');
        first.should.not.equal(second);
        first.namespace.value.should.equal('tenant-a');
        second.namespace.value.should.equal('tenant-b');
        third.should.equal(first);
        resolver.mock.calls.should.have.lengthOf(3);
        transport.ensureEventStore.mock.calls.should.have.lengthOf(2);
    });

    it('should preserve the namespace resolver in development options', () => {
        const resolver = () => 'tenant-a';
        ChronicleOptions.development({ namespaceResolver: resolver }).namespaceResolver!.should.equal(resolver);
    });
});

describe('when namespace resolution fails', () => {
    for (const asynchronous of [false, true]) {
        it(`should propagate a ${asynchronous ? 'rejection' : 'throw'} without connecting or caching a default store`, async () => {
            const failure = new Error('Missing tenant');
            const resolver = vi.fn(() => {
                if (asynchronous) return Promise.reject(failure);
                throw failure;
            });
            create(resolver);
            (await rejection(client.getEventStore('store'))).should.equal(failure);
            transport.resetChannel.mock.calls.should.have.lengthOf(0);
            transport.ensureEventStore.mock.calls.should.have.lengthOf(0);
            const explicit = await client.getEventStore('store', 'explicit');
            explicit.namespace.value.should.equal('explicit');
            (await rejection(client.getEventStore('store'))).should.equal(failure);
            resolver.mock.calls.should.have.lengthOf(2);
            transport.ensureEventStore.mock.calls.should.have.lengthOf(1);
        });
    }

    const invalid: readonly unknown[] = ['', ' \t\n', undefined, null, 42, {}, { value: 'tenant-a' }, new EventStoreNamespaceName('')];
    for (const [index, result] of invalid.entries()) {
        it(`should reject invalid resolver result ${index} without falling back to the default namespace`, async () => {
            const resolver = (() => result) as EventStoreNamespaceResolver;
            create(resolver);
            const error = await rejection(client.getEventStore('store'));
            error.should.be.instanceOf(TypeError);
            error.message.should.equal('namespaceResolver must return a non-empty namespace name.');
            transport.resetChannel.mock.calls.should.have.lengthOf(0);
            transport.ensureEventStore.mock.calls.should.have.lengthOf(0);
        });
    }
});

describe('when resolving concurrent request namespaces', () => {
    it('should isolate interleaved asynchronous application contexts on a shared client', async () => {
        const context = new AsyncLocalStorage<string>();
        const enteredA = deferred();
        const enteredB = deferred();
        const releaseA = deferred();
        const releaseB = deferred();
        create(async () => {
            const tenant = context.getStore();
            if (tenant === 'tenant-a') {
                enteredA.resolve();
                await releaseA.promise;
            } else {
                enteredB.resolve();
                await releaseB.promise;
            }
            // Read after the interleave to prove the caller's context is retained across awaits.
            const current = context.getStore();
            if (!current) throw new Error('Missing tenant');
            return current;
        });
        const requestA = context.run('tenant-a', () => client.getEventStore('store'));
        await enteredA.promise;
        const requestB = context.run('tenant-b', () => client.getEventStore('store'));
        await enteredB.promise;
        releaseB.resolve();
        const storeB = await requestB;
        releaseA.resolve();
        const storeA = await requestA;
        storeA.namespace.value.should.equal('tenant-a');
        storeB.namespace.value.should.equal('tenant-b');
        storeA.should.not.equal(storeB);
        storeA.should.equal(await client.getEventStore('store', 'tenant-a'));
        storeB.should.equal(await client.getEventStore('store', 'tenant-b'));
        // No request context remains; a previous tenant must not become a client default.
        (await rejection(client.getEventStore('store'))).message.should.equal('Missing tenant');
        transport.ensureEventStore.mock.calls.should.have.lengthOf(2);
    });
});
