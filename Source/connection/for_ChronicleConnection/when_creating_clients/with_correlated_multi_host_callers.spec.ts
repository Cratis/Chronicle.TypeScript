// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { context, propagation, trace, type Context } from '@opentelemetry/api';
import { createServer, type ServiceImplementation } from 'nice-grpc';
import { ConnectionServiceDefinition } from '@cratis/chronicle.contracts';
import { ChronicleConnection } from '../../ChronicleConnection.js';
import { CorrelationId, correlationIdManager } from '../../../correlation/index.js';
import { telemetrySession } from '../../../telemetry/for_ChronicleTelemetry/given/a_telemetry_session.fixture.js';

const should = chai.should();
const telemetry = telemetrySession();
let server: ReturnType<typeof createServer>;
let connection: ChronicleConnection;
let probes: { url: string; method: string; active: Context; correlation: CorrelationId | undefined; headers: Record<string, string> }[];

beforeEach(async () => {
    probes = [];
    server = createServer();
    const unused = async () => { throw new Error('Unexpected RPC'); };
    server.add(ConnectionServiceDefinition, {
        ...Object.fromEntries(Object.keys(ConnectionServiceDefinition.methods).map(name => [name, unused])),
        checkCompatibility: async () => ({ IsCompatible: true, Incompatibilities: [], ServerVersion: 'test' })
    } as ServiceImplementation<typeof ConnectionServiceDefinition>);
    const port = await server.listen('127.0.0.1:0');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, options) => {
        await Promise.resolve();
        const active = context.active();
        const headers: Record<string, string> = {};
        propagation.inject(active, headers);
        const url = String(input);
        probes.push({ url, method: options?.method ?? 'GET', active, correlation: correlationIdManager.scoped, headers });
        return new Response(url.includes(`:${port}/`) ? '0' : '1');
    });
    const correlation = new CorrelationId('constructing-business');
    const span = telemetry.traces.getTracer('host').startSpan('constructing-caller');
    const active = propagation.setBaggage(trace.setSpan(context.active(), span), propagation.createBaggage({
        'cratis.correlation_id': { value: correlation.toString() }, email: { value: 'private@example.com' }
    }));
    try {
        await context.with(active, () => correlationIdManager.run(correlation, async () => {
            connection = new ChronicleConnection({
                connectionString: `chronicle://127.0.0.1:${port},127.0.0.1:1?disableTls=true&apiKey=test`
            });
            await connection.connect();
            await connection.resetChannel();
            context.active().should.equal(active);
            correlationIdManager.scoped!.should.equal(correlation);
        }));
    } finally { span.end(); }
});

afterEach(async () => {
    connection?.dispose();
    await server?.shutdown();
    vi.restoreAllMocks();
});

describe('when constructing and resetting a multi-host connection inside a business context', () => {
    it('should detach both count probes and reservation on every client creation', () => {
        probes.should.have.lengthOf(6);
        probes.map(probe => probe.method).should.deep.equal(['GET', 'GET', 'POST', 'GET', 'GET', 'POST']);
        probes.filter(probe => probe.url.endsWith('/connections/count')).should.have.lengthOf(4);
        probes.filter(probe => probe.url.endsWith('/connections/reserve')).should.have.lengthOf(2);
        for (const probe of probes) {
            should.equal(trace.getSpanContext(probe.active), undefined);
            should.equal(propagation.getBaggage(probe.active), undefined);
            should.equal(probe.correlation, undefined);
            probe.headers.should.deep.equal({});
        }
    });
});
