// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import { context, propagation, trace } from '@opentelemetry/api';
import { createServer, type ServiceImplementation } from 'nice-grpc';
import { Metadata } from 'nice-grpc-common';
import { ConnectionServiceDefinition, EventStoresDefinition, ReactorsDefinition } from '@cratis/chronicle.contracts';
import { ChronicleConnection } from '../../ChronicleConnection.js';
import { telemetrySession } from '../../../telemetry/for_ChronicleTelemetry/given/a_telemetry_session.fixture.js';

const should = chai.should();
const telemetry = telemetrySession();
const correlation = 'f5a978af-cd69-4a98-9f1e-7f656cc8ba2a';
let server: ReturnType<typeof createServer>;
let connection: ChronicleConnection;
let received: Metadata[];
let original: Metadata;
let traceparent: string;

beforeEach(async () => {
    received = [];
    server = createServer().use(async function* (call, callContext) {
        received.push(Metadata(callContext.metadata));
        return yield* call.next(call.request, callContext);
    });
    const unused = async () => { throw new Error('Unexpected RPC'); };
    server.add(ConnectionServiceDefinition, {
        ...Object.fromEntries(Object.keys(ConnectionServiceDefinition.methods).map(name => [name, unused])),
        checkCompatibility: async () => ({ IsCompatible: true, Incompatibilities: [], ServerVersion: 'test' }),
        connectionKeepAlive: async () => ({})
    } as ServiceImplementation<typeof ConnectionServiceDefinition>);
    server.add(EventStoresDefinition, {
        allEventStores: async () => ({ IsAuthorized: true, Data: [] }),
        ensureEventStore: unused,
        observeEventStores: async function* () { yield { IsAuthorized: true, Data: [] }; }
    } as ServiceImplementation<typeof EventStoresDefinition>);
    server.add(ReactorsDefinition, {
        ...Object.fromEntries(Object.keys(ReactorsDefinition.methods).map(name => [name, unused])),
        observe: async function* (requests) {
            for await (const _request of requests) {
                yield { Events: [], Partition: '', ReplayState: 0 };
                return;
            }
        }
    } as ServiceImplementation<typeof ReactorsDefinition>);
    const port = await server.listen('127.0.0.1:0');
    connection = new ChronicleConnection({ connectionString: `chronicle://127.0.0.1:${port}?disableTls=true&apiKey=api-secret` });
    original = Metadata({ authorization: 'Bearer caller-token', 'x-custom': 'preserved',
        'custom-bin': new Uint8Array([1, 2, 3]), baggage: 'email=private', traceparent: 'stale' });
});

afterEach(async () => {
    connection?.dispose();
    await server?.shutdown();
});

async function inContext(action: () => Promise<void>) {
    const span = telemetry.traces.getTracer('host').startSpan('host');
    const spanContext = span.spanContext();
    traceparent = `00-${spanContext.traceId}-${spanContext.spanId}-01`;
    const active = propagation.setBaggage(trace.setSpan(context.active(), span), propagation.createBaggage({
        'cratis.correlation_id': { value: correlation }, email: { value: 'private@example.com' },
        'cratis.event_source.id': { value: 'private-source' }, 'cratis.tenant.id': { value: 'private-tenant' }
    }));
    try {
        await context.with(active, async () => {
            await Promise.resolve();
            await action();
            propagation.getBaggage(context.active())!.getEntry('email')!.value.should.equal('private@example.com');
        });
    } finally { span.end(); }
}

describe('when calling unary RPCs with active trace context and sensitive baggage', () => {
    beforeEach(async () => {
        await inContext(async () => {
            await connection.connect();
            await connection.eventStores.allEventStores({}, { metadata: original });
            await connection.connections.connectionKeepAlive({ ConnectionId: 'test' });
            await connection.reconnect();
            await connection.eventStores.allEventStores({}, { metadata: original });
        });
    });
    it('should inject trace context and only correlation baggage on every factory including reconnect and keep-alive', () => {
        received.should.have.lengthOf(5);
        for (const metadata of received) {
            should.equal(metadata.get('traceparent'), traceparent);
            should.equal(metadata.get('baggage'), `cratis.correlation_id=${correlation}`);
            should.equal(metadata.get('api-key'), 'api-secret');
        }
    });
    it('should preserve authentication and unrelated string and binary metadata', () => {
        const metadata = received[1];
        should.equal(metadata.get('authorization'), 'Bearer caller-token');
        should.equal(metadata.get('x-custom'), 'preserved');
        Array.from(metadata.get('custom-bin')!).should.deep.equal([1, 2, 3]);
    });
    it('should not mutate the caller carrier', () => {
        should.equal(original.get('traceparent'), 'stale');
        should.equal(original.get('baggage'), 'email=private');
        should.equal(original.get('api-key'), undefined);
    });
});

describe('when opening server and bidirectional streams', () => {
    beforeEach(async () => {
        await connection.connect();
        received.length = 0;
        await inContext(async () => {
            for await (const _response of connection.eventStores.observeEventStores({}, { metadata: original })) { break; }
            async function* requests() { yield { Content: undefined }; }
            for await (const _response of connection.reactors.observe(requests(), { metadata: original })) { break; }
        });
    });
    it('should propagate the stream-opening context and preserve authentication', () => {
        received.should.have.lengthOf(2);
        for (const metadata of received) {
            should.equal(metadata.get('traceparent'), traceparent);
            should.equal(metadata.get('baggage'), `cratis.correlation_id=${correlation}`);
            should.equal(metadata.get('authorization'), 'Bearer caller-token');
        }
    });
});

describe('when calling without an active span or baggage', () => {
    beforeEach(async () => {
        await connection.connect();
        received.length = 0;
        await connection.eventStores.allEventStores({}, { metadata: original });
    });
    it('should remove stale propagation without losing other metadata', () => {
        should.equal(received[0].get('traceparent'), undefined);
        should.equal(received[0].get('baggage'), undefined);
        should.equal(received[0].get('authorization'), 'Bearer caller-token');
    });
});
