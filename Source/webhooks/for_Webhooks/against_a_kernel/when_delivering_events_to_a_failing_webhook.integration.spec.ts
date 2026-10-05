// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { ChronicleClient } from '../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../ChronicleOptions.js';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import { eventType } from '../../../events/index.js';
import type { IEventStore } from '../../../IEventStore.js';
import type { FailedPartition, ObserverInformation } from '../../../observation/index.js';
import { WebhookReceiver } from './given/WebhookReceiver.fixture.js';

chai.should();

// Runs against a real Chronicle kernel; skipped locally unless the connection string is set (see vitest.integration.config.ts).
// In CI it never skips, so a missing connection string or unreachable kernel fails instead of passing vacuously.
// The kernel must reach this process over HTTP; see WebhookReceiver for the address it uses.
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

@eventType()
class ParcelLost {
    @field(String) parcelId = '';
}

const artifacts: IClientArtifactsProvider = {
    eventTypes: [ParcelLost],
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

async function eventually<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeoutMs = 30_000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let value = await read();
    while (!accept(value)) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for the kernel');
        await new Promise(resolve => setTimeout(resolve, 100));
        value = await read();
    }
    return value;
}

describe.skipIf(!connectionString && !process.env.CI)('when delivering events to a failing webhook against a kernel', () => {
    const webhookId = randomUUID();
    const eventSourceId = randomUUID();
    const receiver = new WebhookReceiver(500);
    let client: ChronicleClient;
    let store: IEventStore;
    let appendedSequenceNumber: bigint;
    let failedPartition: FailedPartition;
    let observer: ObserverInformation | undefined;

    beforeAll(async () => {
        await receiver.start();
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [],
            clientArtifactsProvider: artifacts
        }));
        store = await client.getEventStore(`Webhooks${randomUUID().replaceAll('-', '').slice(0, 12)}`);

        await store.webhooks.register(webhookId, receiver.urlFor('/parcels'), _ => _.withEventType(ParcelLost));

        const parcel = new ParcelLost();
        parcel.parcelId = randomUUID();
        appendedSequenceNumber = (await store.eventLog.append(eventSourceId, parcel)).sequenceNumber.value;

        await receiver.waitForRequests(1);
        const failed = await eventually(
            () => store.failedPartitions.getFailedPartitionsFor(webhookId),
            _ => _.some(partition => partition.partition === eventSourceId));
        failedPartition = failed.find(_ => _.partition === eventSourceId)!;
        observer = (await store.observers.getAll()).find(_ => _.id === webhookId);
    });

    afterAll(async () => {
        try {
            await store?.webhooks.remove(webhookId);
        } finally {
            try {
                await receiver.stop();
            } finally {
                client?.dispose();
            }
        }
    });

    it('should have attempted the delivery', () => receiver.requests.length.should.be.greaterThan(0));
    it('should record the attempt for the appended event', () => failedPartition.attempts[0].sequenceNumber.value.should.equal(appendedSequenceNumber));
    // The kernel retries the failing status with backoff inside the delivery, so the recorded reason is usually the
    // subscriber timeout rather than the status code; either way it must carry a reason.
    it('should record why the attempt failed', () => failedPartition.attempts[0].messages.should.not.be.empty);
    it('should not record the event as handled', () => observer!.lastHandledEventSequenceNumber.value.should.not.equal(appendedSequenceNumber));
});
