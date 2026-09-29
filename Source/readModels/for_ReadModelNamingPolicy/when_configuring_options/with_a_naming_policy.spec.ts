// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, vi } from 'vitest';
import { ChronicleClient } from '../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../ChronicleOptions.js';
import { EventStore } from '../../../EventStore.js';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import { AccountBalance, AccountOpened, upperCasePolicy } from '../given/registered_read_models.js';

chai.should();

const transport = vi.hoisted(() => ({
    connect: vi.fn(),
    getVersionInfo: vi.fn(),
    ensureEventStore: vi.fn(),
    registerMany: vi.fn()
}));

vi.mock('../../../connection/ChronicleConnection', () => ({
    ChronicleConnection: class {
        resetChannel = vi.fn().mockResolvedValue(undefined);
        connect = transport.connect;
        disconnect = vi.fn();
        server = { getVersionInfo: transport.getVersionInfo };
        eventStores = { ensureEventStore: transport.ensureEventStore };
        readModels = { registerMany: transport.registerMany };
    }
}));

vi.mock('../../../connection/KernelKeepAlive', () => ({
    KernelKeepAlive: class {
        async start() {}
    }
}));

const artifacts: IClientArtifactsProvider = {
    eventTypes: [AccountOpened],
    readModels: [AccountBalance],
    reactors: [],
    reducers: [],
    seeders: [],
    constraints: [],
    projections: [],
    webhooks: [],
    eventTypeMigrations: [],
    globalForHandlers: []
};

const connectionString = 'chronicle://localhost:35000';

describe('when configuring options without a read model naming policy', () => {
    it('should not carry a naming policy', () => {
        (ChronicleOptions.fromConnectionString(connectionString).readModelNamingPolicy === undefined).should.be.true;
    });
});

describe('when configuring options with a read model naming policy', () => {
    it('should carry the policy from the connection string factory', () => {
        ChronicleOptions.fromConnectionString(connectionString, { readModelNamingPolicy: upperCasePolicy })
            .readModelNamingPolicy!.should.equal(upperCasePolicy);
    });

    it('should carry the policy from the development factory', () => {
        ChronicleOptions.development({ readModelNamingPolicy: upperCasePolicy })
            .readModelNamingPolicy!.should.equal(upperCasePolicy);
    });
});

describe('when an event store registers read models for a client configured with a naming policy', () => {
    let containerName: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Registration of every artifact kind is covered elsewhere; only the store's read-model wiring matters here.
        vi.spyOn(EventStore.prototype, 'registerArtifacts').mockResolvedValue(undefined);
        transport.connect.mockResolvedValue(undefined);
        transport.getVersionInfo.mockResolvedValue({});
        transport.ensureEventStore.mockResolvedValue({ IsSuccess: true });
        transport.registerMany.mockResolvedValue(undefined);
        const client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString, {
            discoveryPatterns: [],
            clientArtifactsProvider: artifacts,
            readModelNamingPolicy: upperCasePolicy
        }));
        try {
            const store = await client.getEventStore('store');
            await store.readModels.register(AccountBalance);
            containerName = transport.registerMany.mock.calls[0][0].ReadModels[0].ContainerName;
        } finally {
            client.dispose();
        }
    });

    it('should name the container with the policy result', () => containerName.should.equal('ACCOUNTBALANCE'));
});
