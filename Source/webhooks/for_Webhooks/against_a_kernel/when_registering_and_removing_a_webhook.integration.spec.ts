// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import type { WebhookDefinition } from '@cratis/chronicle.contracts';
import { field } from '@cratis/fundamentals';
import { ChronicleClient } from '../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../ChronicleOptions.js';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import { eventType } from '../../../events/index.js';
import type { IEventStore } from '../../../IEventStore.js';

chai.should();

// Runs against a real Chronicle kernel; skipped locally unless the connection string is set (see vitest.integration.config.ts).
// In CI it never skips, so a missing connection string or unreachable kernel fails instead of passing vacuously.
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

@eventType()
class OrderShipped {
    @field(String) orderId = '';
}

const artifacts: IClientArtifactsProvider = {
    eventTypes: [OrderShipped],
    readModels: [],
    reactors: [],
    reducers: [],
    seeders: [],
    constraints: [],
    projections: [],
    webhooks: [],
    eventTypeMigrations: [],
    globalForHandlers: []
};

async function eventually<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeoutMs = 20_000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let value = await read();
    while (!accept(value)) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for the kernel');
        await new Promise(resolve => setTimeout(resolve, 100));
        value = await read();
    }
    return value;
}

describe.skipIf(!connectionString && !process.env.CI)('when registering and removing a webhook against a kernel', () => {
    const webhookId = randomUUID();
    const targetUrl = 'http://localhost:9/orders';
    let client: ChronicleClient;
    let store: IEventStore;
    let registered: WebhookDefinition | undefined;
    let afterRemove: WebhookDefinition[];
    let registerWithoutIdentifier: unknown;

    const findRegistered = async () => (await store.webhooks.getWebhooks()).find(_ => _.Identifier === webhookId);

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [],
            clientArtifactsProvider: artifacts
        }));
        store = await client.getEventStore(`Webhooks${randomUUID().replaceAll('-', '').slice(0, 12)}`);

        await store.webhooks.register(webhookId, targetUrl, _ => _
            .withEventType(OrderShipped)
            .withHeader('X-Source', 'specs'));

        // The kernel records the registration as events and builds its webhook list from them, so it shows up eventually.
        registered = await eventually(findRegistered, _ => _ !== undefined);

        await store.webhooks.remove(webhookId);
        afterRemove = await eventually(() => store.webhooks.getWebhooks(), _ => !_.some(webhook => webhook.Identifier === webhookId));

        registerWithoutIdentifier = await store.webhooks.register('', targetUrl, _ => _.withEventType(OrderShipped)).catch((error: unknown) => error);
    });

    afterAll(() => client?.dispose());

    it('should list the webhook', () => registered!.Identifier.should.equal(webhookId));
    it('should keep the target url', () => registered!.Target!.Url.should.equal(targetUrl));
    it('should keep the header', () => registered!.Target!.Headers['X-Source'].should.equal('specs'));
    it('should keep the event type', () => registered!.EventTypes.map(_ => _.Id).should.deep.equal(['OrderShipped']));
    it('should no longer list the removed webhook', () => afterRemove.some(_ => _.Identifier === webhookId).should.be.false);
    it('should report a registration the kernel rejects', () => registerWithoutIdentifier.should.be.instanceOf(Error));
});
