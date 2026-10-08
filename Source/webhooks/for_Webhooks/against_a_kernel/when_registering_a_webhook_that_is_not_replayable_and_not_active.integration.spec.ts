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
class ParcelReturned {
    @field(String) parcelId = '';
}

const artifacts: IClientArtifactsProvider = {
    eventTypes: [ParcelReturned],
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

describe.skipIf(!connectionString && !process.env.CI)('when registering a webhook that is not replayable and not active against a kernel', () => {
    const defaultWebhookId = randomUUID();
    const restrictedWebhookId = randomUUID();
    const targetUrl = 'http://localhost:9/parcels';
    let client: ChronicleClient;
    let store: IEventStore;
    let defaultWebhook: WebhookDefinition;
    let restrictedWebhook: WebhookDefinition;

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [],
            clientArtifactsProvider: artifacts
        }));
        store = await client.getEventStore(`Webhooks${randomUUID().replaceAll('-', '').slice(0, 12)}`);

        // A webhook with the defaults proves the read-back distinguishes true from false, so a false
        // below cannot be an artifact of how an absent field decodes.
        await store.webhooks.register(defaultWebhookId, targetUrl, _ => _.withEventType(ParcelReturned));
        await store.webhooks.register(restrictedWebhookId, targetUrl, _ => _
            .withEventType(ParcelReturned)
            .notReplayable()
            .notActive());

        const webhooks = await eventually(
            () => store.webhooks.getWebhooks(),
            _ => [defaultWebhookId, restrictedWebhookId].every(id => _.some(webhook => webhook.Identifier === id)));
        defaultWebhook = webhooks.find(_ => _.Identifier === defaultWebhookId)!;
        restrictedWebhook = webhooks.find(_ => _.Identifier === restrictedWebhookId)!;
    });

    afterAll(async () => {
        const failures: unknown[] = [];
        for (const id of [defaultWebhookId, restrictedWebhookId]) {
            try {
                await store?.webhooks.remove(id);
            } catch (error) {
                failures.push(error);
            }
        }
        client?.dispose();
        if (failures.length > 0) throw failures[0];
    });

    it('should keep a default webhook replayable', () => defaultWebhook.IsReplayable.should.be.true);
    it('should keep a default webhook active', () => defaultWebhook.IsActive.should.be.true);
    it('should keep the webhook not replayable', () => restrictedWebhook.IsReplayable.should.be.false);
    // The kernel records IsActive=false in WebhookAdded, but its MongoDB storage converter drops IsActive when reading
    // definitions back (Storage.MongoDB/Observation/Webhooks/WebhookDefinitionConverters.cs, ToKernel), so every
    // kernel up to at least 19.30.0 lists the webhook as active (Cratis/Chronicle#4581). The client sending
    // IsActive=false is covered by the unit spec when_registering_a_webhook_that_is_not_replayable_and_not_active.spec.ts.
    it.todo('should keep the webhook not active once the kernel reads IsActive back from storage');
});
