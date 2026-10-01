// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterAll, beforeAll, beforeEach, chai, describe, it } from 'vitest';
import { context, propagation, trace } from '@opentelemetry/api';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import type { IncomingHttpHeaders, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import type { OAuthTokenProvider } from '../../TokenProvider.js';
import { CorrelationId, correlationIdManager } from '../../../correlation/index.js';
import { telemetrySession } from '../../../telemetry/for_ChronicleTelemetry/given/a_telemetry_session.fixture.js';

const should = chai.should();
const telemetry = telemetrySession();
const correlations: Array<CorrelationId | undefined> = [];
const instrumentation = new HttpInstrumentation({
    enabled: false,
    disableIncomingRequestInstrumentation: true,
    requestHook: () => { correlations.push(correlationIdManager.scoped); }
});
let server: Server;
let Provider: typeof OAuthTokenProvider;
let endpoint: string;
let lifetime: number;
let requests: number;
let received: IncomingHttpHeaders[];

beforeAll(async () => {
    instrumentation.setTracerProvider(telemetry.traces);
    instrumentation.enable();
    // Vitest does not install the host's ESM loader hooks. Trigger the real require hook
    // and synchronize the patched built-in exports before loading the provider's transport.
    const { createServer } = createRequire(import.meta.url)('node:http') as typeof import('node:http');
    syncBuiltinESMExports();
    Provider = (await import('../../TokenProvider.js')).OAuthTokenProvider;
    server = createServer((request, response) => {
        received.push(request.headers);
        request.resume();
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ access_token: `token-${++requests}`, expires_in: lifetime }));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/connect/token`;
});

afterAll(async () => {
    instrumentation.disable();
    syncBuiltinESMExports();
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

for (const acquisition of ['initial', 'expiring', 'forced'] as const) {
    describe(`when ${acquisition} token acquisition is shared by correlated callers`, () => {
        let callerTraceIds: string[];
        let tokens: Array<string | undefined>;
        beforeEach(async () => {
            received = [];
            requests = 0;
            lifetime = acquisition === 'expiring' ? 30 : 3600;
            const provider = new Provider(endpoint, 'client', 'secret');
            if (acquisition !== 'initial') await provider.getAccessToken();
            received.length = 0;
            correlations.length = 0;
            telemetry.spans.reset();
            callerTraceIds = [];
            const pending = ['first', 'second'].map((caller, index) => {
                const correlation = new CorrelationId(`${caller}-business`);
                const span = telemetry.traces.getTracer('host').startSpan(caller);
                callerTraceIds.push(span.spanContext().traceId);
                const active = propagation.setBaggage(trace.setSpan(context.active(), span), propagation.createBaggage({
                    'cratis.correlation_id': { value: correlation.toString() },
                    email: { value: 'private@example.com' },
                    'cratis.tenant.id': { value: 'private-tenant' }
                }));
                return context.with(active, () => correlationIdManager.run(correlation, async () => {
                    try {
                        const token = await (index === 0 && acquisition === 'forced' ? provider.refresh() : provider.getAccessToken());
                        context.active().should.equal(active);
                        correlationIdManager.scoped!.should.equal(correlation);
                        return token;
                    } finally { span.end(); }
                }));
            });
            tokens = await Promise.all(pending);
        });
        it('should send one shared request without caller trace or baggage', () => {
            received.should.have.lengthOf(1);
            should.equal(received[0].baggage, undefined);
            for (const traceId of callerTraceIds) String(received[0].traceparent).should.not.contain(traceId);
            const token = acquisition === 'initial' ? 'token-1' : 'token-2';
            tokens.should.deep.equal([token, token]);
        });
        it('should let enabled HTTP instrumentation create a detached root span', () => {
            const spans = telemetry.spans.getFinishedSpans().filter(span => span.instrumentationScope.name === '@opentelemetry/instrumentation-http');
            spans.should.have.lengthOf(1);
            should.equal(spans[0].parentSpanContext, undefined);
            String(received[0].traceparent).should.contain(spans[0].spanContext().traceId);
            correlations.should.deep.equal([undefined]);
        });
    });
}
