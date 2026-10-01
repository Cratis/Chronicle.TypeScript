// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterAll, beforeAll, beforeEach, chai, describe, it } from 'vitest';
import { context, propagation, trace } from '@opentelemetry/api';
import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';
import type { ServiceImplementation } from 'nice-grpc';
import { Metadata } from 'nice-grpc-common';
import type { ChronicleConnection } from '../../ChronicleConnection.js';
import { telemetrySession } from '../../../telemetry/for_ChronicleTelemetry/given/a_telemetry_session.fixture.js';

const should = chai.should();
const telemetry = telemetrySession();
const instrumentation = new GrpcInstrumentation({ enabled: false });
const correlation = 'f5a978af-cd69-4a98-9f1e-7f656cc8ba2a';
let server: ReturnType<typeof import('nice-grpc').createServer>;
let connection: ChronicleConnection;
const received: Metadata[] = [];
let hostTraceId: string;

beforeAll(async () => {
    instrumentation.setTracerProvider(telemetry.traces);
    instrumentation.enable();
    // Load grpc-js only after the real instrumentation's require hooks are installed.
    const { createServer } = await import('nice-grpc');
    const { ConnectionServiceDefinition, EventStoresDefinition, ReactorsDefinition } = await import('@cratis/chronicle.contracts');
    const { ChronicleConnection } = await import('../../ChronicleConnection.js');
    server = createServer().use(async function* (call, callContext) {
        received.push(Metadata(callContext.metadata));
        return yield* call.next(call.request, callContext);
    });
    const unused = async () => { throw new Error('Unexpected RPC'); };
    server.add(ConnectionServiceDefinition, {
        ...Object.fromEntries(Object.keys(ConnectionServiceDefinition.methods).map(name => [name, unused])),
        checkCompatibility: async () => ({ IsCompatible: true, Incompatibilities: [], ServerVersion: 'test' })
    } as ServiceImplementation<typeof ConnectionServiceDefinition>);
    server.add(EventStoresDefinition, {
        allEventStores: async () => ({ IsAuthorized: true, Data: [] }),
        ensureEventStore: unused,
        observeEventStores: async function* () {
            yield { IsAuthorized: true, Data: [] };
            yield { IsAuthorized: true, Data: [] };
        }
    } as ServiceImplementation<typeof EventStoresDefinition>);
    server.add(ReactorsDefinition, {
        ...Object.fromEntries(Object.keys(ReactorsDefinition.methods).map(name => [name, unused])),
        observe: async function* (requests) {
            for await (const _request of requests) {
                yield { Events: [], Partition: '', ReplayState: 0 };
            }
        }
    } as ServiceImplementation<typeof ReactorsDefinition>);
    const port = await server.listen('127.0.0.1:0');
    connection = new ChronicleConnection({ connectionString: `chronicle://127.0.0.1:${port}?disableTls=true&apiKey=test` });
    await connection.connect();
});

afterAll(async () => {
    connection?.dispose();
    await server?.shutdown();
    instrumentation.disable();
});

describe('when gRPC auto-instrumentation reinjects active context for unary and streaming calls', () => {
    beforeEach(async () => {
        received.length = 0;
        const span = telemetry.traces.getTracer('host').startSpan('host');
        hostTraceId = span.spanContext().traceId;
        const active = propagation.setBaggage(trace.setSpan(context.active(), span), propagation.createBaggage({
            'cratis.correlation_id': { value: correlation },
            email: { value: 'private@example.com' },
            'cratis.event_source.id': { value: 'private-source' },
            'cratis.tenant.id': { value: 'private-tenant' }
        }));
        try {
            await context.with(active, async () => {
                await connection.eventStores.allEventStores({});
                for await (const _response of connection.eventStores.observeEventStores({})) {
                    context.active().should.equal(active);
                    await Promise.resolve();
                }
                async function* requests() { yield { Content: undefined }; yield { Content: undefined }; }
                for await (const _response of connection.reactors.observe(requests())) {
                    context.active().should.equal(active);
                    await Promise.resolve();
                }
                propagation.getBaggage(context.active())!.getEntry('email')!.value.should.equal('private@example.com');
            });
        } finally { span.end(); }
    });
    it('should never let auto-instrumentation restore forbidden baggage on the wire', () => {
        received.should.have.lengthOf(3);
        for (const metadata of received) {
            should.equal(metadata.get('baggage'), `cratis.correlation_id=${correlation}`);
            metadata.get('traceparent')!.should.contain(hostTraceId);
        }
    });
    it('should actually execute the enabled gRPC instrumentation', () => {
        telemetry.spans.getFinishedSpans().filter(span => span.instrumentationScope.name === '@opentelemetry/instrumentation-grpc')
            .length.should.be.greaterThan(0);
    });
});
