// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import { context, propagation, trace } from '@opentelemetry/api';
import { createServer, ServerError, Status, type ServiceImplementation } from 'nice-grpc';
import { Metadata } from 'nice-grpc-common';
import { ConnectionServiceDefinition, EventStoresDefinition, ServerDefinition, ReactorsDefinition, ReducersDefinition, ReadModelsDefinition } from '@cratis/chronicle.contracts';
import { ChronicleClient } from '../../ChronicleClient.js';
import { ChronicleOptions } from '../../ChronicleOptions.js';
import type { IClientArtifactsProvider } from '../../artifacts/IClientArtifactsProvider.js';
import { CorrelationId, correlationIdManager } from '../../correlation/index.js';
import type { ChronicleLogEntry } from '../../logging/ChronicleLogEntry.js';
import { reactor } from '../../reactors/reactor.js';
import { reducer } from '../../reducers/reducer.js';
import { telemetrySession } from '../../telemetry/for_ChronicleTelemetry/given/a_telemetry_session.fixture.js';

const should = chai.should();
const telemetry = telemetrySession();
class BackgroundReactor {}
reactor('background-reactor')(BackgroundReactor);
class BackgroundReducer {}
reducer('background-reducer')(BackgroundReducer);
const artifacts: IClientArtifactsProvider = {
    eventTypes: [], readModels: [], reactors: [BackgroundReactor], reducers: [BackgroundReducer],
    seeders: [], constraints: [], projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
};
let server: ReturnType<typeof createServer>;
let client: ChronicleClient;
let received: { method: string; metadata: Metadata }[];
let logs: ChronicleLogEntry[];
let hostTraceId: string;
const correlation = new CorrelationId('a4450131-7cd4-40ba-9438-69c680efc1f3');

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(complete => { resolve = complete; });
    return { promise, resolve };
}

beforeEach(async () => {
    received = [];
    logs = [];
    const reobserved = deferred();
    const reconnected = deferred();
    const endKeepAlive = deferred();
    const counts = new Map<string, number>();
    server = createServer().use(async function* (call, callContext) {
        const method = call.method.path;
        received.push({ method, metadata: Metadata(callContext.metadata) });
        const count = (counts.get(method) ?? 0) + 1;
        counts.set(method, count);
        const observations = [...counts].filter(([path]) => path.endsWith('/Observe'));
        if (observations.length === 2 && observations.every(([, total]) => total >= 2)) reobserved.resolve();
        if (observations.length === 2 && observations.every(([, total]) => total >= 3)) reconnected.resolve();
        return yield* call.next(call.request, callContext);
    });
    const unused = async () => { throw new Error('Unexpected RPC'); };
    const success = async () => ({ IsAuthorized: true, ValidationResults: [], ExceptionMessages: [] });
    let connections = 0;
    server.add(ConnectionServiceDefinition, {
        ...Object.fromEntries(Object.keys(ConnectionServiceDefinition.methods).map(name => [name, unused])),
        checkCompatibility: async () => ({ IsCompatible: true, Incompatibilities: [], ServerVersion: 'test' }),
        connectionKeepAlive: async () => ({}),
        connect: async function* (request, callContext) {
            const first = ++connections === 1;
            yield { ConnectionId: request.ConnectionId };
            if (first) await endKeepAlive.promise;
            else await new Promise<void>(resolve => callContext.signal.addEventListener('abort', () => resolve(), { once: true }));
        }
    } as ServiceImplementation<typeof ConnectionServiceDefinition>);
    server.add(ServerDefinition, {
        ...Object.fromEntries(Object.keys(ServerDefinition.methods).map(name => [name, unused])),
        getVersionInfo: async () => ({})
    } as ServiceImplementation<typeof ServerDefinition>);
    server.add(EventStoresDefinition, {
        allEventStores: unused, ensureEventStore: success, observeEventStores: unused
    } as ServiceImplementation<typeof EventStoresDefinition>);
    server.add(ReadModelsDefinition, {
        ...Object.fromEntries(Object.keys(ReadModelsDefinition.methods).map(name => [name, unused])),
        registerMany: success
    } as ServiceImplementation<typeof ReadModelsDefinition>);
    server.add(ReactorsDefinition, {
        ...Object.fromEntries(Object.keys(ReactorsDefinition.methods).map(name => [name, unused])),
        observe: async function* (requests) {
            for await (const _request of requests) {
                yield { Events: [], Partition: '', ReplayState: 0 };
                throw new ServerError(Status.UNAVAILABLE, 'End stream to exercise re-observation');
            }
        }
    } as ServiceImplementation<typeof ReactorsDefinition>);
    server.add(ReducersDefinition, {
        ...Object.fromEntries(Object.keys(ReducersDefinition.methods).map(name => [name, unused])),
        observe: async function* (requests) {
            for await (const _request of requests) {
                yield { Events: [], Partition: '', ReplayState: 0 };
                throw new ServerError(Status.UNAVAILABLE, 'End stream to exercise re-observation');
            }
        }
    } as ServiceImplementation<typeof ReducersDefinition>);
    const port = await server.listen('127.0.0.1:0');
    const span = telemetry.traces.getTracer('host').startSpan('host');
    hostTraceId = span.spanContext().traceId;
    const active = propagation.setBaggage(trace.setSpan(context.active(), span), propagation.createBaggage({
        'cratis.correlation_id': { value: correlation.toString() }, email: { value: 'private@example.com' }
    }));
    try {
        await context.with(active, () => correlationIdManager.run(correlation, async () => {
            client = new ChronicleClient(ChronicleOptions.fromConnectionString(`chronicle://127.0.0.1:${port}?disableTls=true&apiKey=test`, {
                discoveryPatterns: [], clientArtifactsProvider: artifacts, logger: { log: entry => logs.push(entry) }
            }));
            await client.getEventStore('store');
            context.active().should.equal(active);
            correlationIdManager.scoped!.should.equal(correlation);
        }));
        await reobserved.promise;
        endKeepAlive.resolve();
        await reconnected.promise;
    } finally { span.end(); endKeepAlive.resolve(); }
});

afterEach(async () => {
    client?.dispose();
    await server?.shutdown();
});

describe('when a correlated getEventStore starts background streams and their recovery loops', () => {
    it('should not propagate the caller trace or baggage on observations or keep-alive RPCs', () => {
        const background = received.filter(({ method }) => /\/(Observe|Connect|ConnectionKeepAlive)$/.test(method));
        background.length.should.be.greaterThanOrEqual(10);
        for (const { metadata } of background) {
            should.equal(metadata.get('traceparent'), undefined);
            should.equal(metadata.get('baggage'), undefined);
        }
    });
    it('should retain the caller context on the foreground operation', () => {
        const foreground = received.find(({ method }) => method.endsWith('/EnsureEventStore'))!;
        foreground.metadata.get('traceparent')!.should.contain(hostTraceId);
        should.equal(foreground.metadata.get('baggage'), `cratis.correlation_id=${correlation}`);
    });
    it('should not label background-loop diagnostics with the initiating business correlation or trace', () => {
        const background = logs.filter(entry => /observation|keep-alive|Reconnect/.test(entry.message));
        background.length.should.be.greaterThan(0);
        for (const entry of background) {
            entry.attributes.should.not.have.property('cratis.correlation_id');
            entry.attributes.should.not.have.property('trace_id');
            entry.attributes.should.not.have.property('span_id');
        }
    });
});
