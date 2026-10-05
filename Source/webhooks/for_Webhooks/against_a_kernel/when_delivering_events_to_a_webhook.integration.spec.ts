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
import type { FailedPartition } from '../../../observation/index.js';
import type { ReceivedWebhookRequest } from './given/ReceivedWebhookRequest.fixture.js';
import { WebhookReceiver } from './given/WebhookReceiver.fixture.js';

chai.should();

// Runs against a real Chronicle kernel; skipped locally unless the connection string is set (see vitest.integration.config.ts).
// In CI it never skips, so a missing connection string or unreachable kernel fails instead of passing vacuously.
// The kernel must reach this process over HTTP; see WebhookReceiver for the address it uses.
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

@eventType()
class ParcelDelivered {
    @field(String) parcelId = '';
}

const artifacts: IClientArtifactsProvider = {
    eventTypes: [ParcelDelivered],
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

interface DeliveredEvent {
    readonly context: {
        readonly eventType: { readonly id: string; readonly generation: number };
        readonly eventSourceId: string;
        readonly sequenceNumber: number;
    };
    readonly content: { readonly parcelId: string };
}

interface DeliveredBody {
    readonly partition: string;
    readonly events: ReadonlyArray<DeliveredEvent>;
}

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

describe.skipIf(!connectionString && !process.env.CI)('when delivering events to a webhook against a kernel', () => {
    const webhookId = randomUUID();
    const eventSourceId = randomUUID();
    const parcelId = randomUUID();
    const receiver = new WebhookReceiver(200);
    let client: ChronicleClient;
    let store: IEventStore;
    let appendedSequenceNumber: bigint;
    let request: ReceivedWebhookRequest;
    let body: DeliveredBody;
    let failedPartitions: FailedPartition[];

    beforeAll(async () => {
        await receiver.start();
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [],
            clientArtifactsProvider: artifacts
        }));
        store = await client.getEventStore(`Webhooks${randomUUID().replaceAll('-', '').slice(0, 12)}`);

        await store.webhooks.register(webhookId, receiver.urlFor('/parcels'), _ => _
            .withEventType(ParcelDelivered)
            .withHeader('X-Source', 'specs'));

        const parcel = new ParcelDelivered();
        parcel.parcelId = parcelId;
        const result = await store.eventLog.append(eventSourceId, parcel);
        appendedSequenceNumber = result.sequenceNumber.value;

        request = (await receiver.waitForRequests(1))[0];
        body = JSON.parse(request.body) as DeliveredBody;

        // Once the kernel records the event as handled it has acted on the receiver's answer.
        await eventually(
            () => store.observers.getAll(),
            _ => _.some(observer => observer.id === webhookId && observer.lastHandledEventSequenceNumber.value === appendedSequenceNumber));
        failedPartitions = await store.failedPartitions.getFailedPartitionsFor(webhookId);
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

    it('should post to the target path', () => `${request.method} ${request.path}`.should.equal('POST /parcels'));
    it('should send json', () => request.headers['content-type']!.should.match(/^application\/json/));
    // Kernels up to at least 19.30.0 drop basic, bearer and OAuth authorization for webhooks outside the System event store
    // while reporting the registration as successful, so no Authorization header is ever sent (Cratis/Chronicle#4567).
    it.todo('should authorize with the configured credentials once Cratis/Chronicle#4567 is fixed');
    it('should send the configured header', () => request.headers['x-source']!.should.equal('specs'));
    it('should deliver the event source as the partition', () => body.partition.should.equal(eventSourceId));
    it('should deliver the appended event only', () => body.events.length.should.equal(1));
    it('should deliver the event content', () => body.events[0].content.parcelId.should.equal(parcelId));
    it('should deliver the event type', () => body.events[0].context.eventType.id.should.equal('ParcelDelivered'));
    it('should deliver the event source id', () => body.events[0].context.eventSourceId.should.equal(eventSourceId));
    it('should deliver the sequence number', () => BigInt(body.events[0].context.sequenceNumber).should.equal(appendedSequenceNumber));
    it('should not report the webhook as failed', () => failedPartitions.should.be.empty);
});
