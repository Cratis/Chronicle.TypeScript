// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { context, propagation } from '@opentelemetry/api';
import { Metadata, type ClientMiddleware, type ClientMiddlewareCall, type CallOptions } from 'nice-grpc-common';
import { correlationIdManager } from '../correlation/index.js';
import { WellKnownTelemetryNames } from '../WellKnownTelemetryNames.js';

/** Injects host-configured propagation for every RPC without mutating caller metadata or baggage. */
export const traceContextMiddleware: ClientMiddleware = async function* <Request, Response>(call: ClientMiddlewareCall<Request, Response>, options: CallOptions) {
    const metadata = options.metadata ? Metadata(options.metadata) : Metadata();
    // These headers belong to the active context, never to a stale caller-supplied carrier.
    for (const field of new Set(['traceparent', 'tracestate', 'baggage', ...propagation.fields()])) metadata.delete(field);
    const active = context.active();
    const key = WellKnownTelemetryNames.attributes.correlationId;
    const correlation = correlationIdManager.scoped?.toString() ?? propagation.getBaggage(active)?.getEntry(key)?.value;
    const filtered = propagation.setBaggage(active, propagation.createBaggage(correlation ? { [key]: { value: correlation } } : {}));
    propagation.inject(filtered, metadata, { set: (carrier, name, value) => carrier.set(name, value) });
    const iterator: AsyncGenerator<Response, Response | void, undefined> = context.with(filtered, () => call.next(call.request, { ...options, metadata }));
    // Async generators execute on each advance, not at creation. Bind all advances,
    // including cancellation/error cleanup, so gRPC instrumentation cannot restore
    // the caller's forbidden baggage. context.with restores the consumer's scope.
    const downstream: AsyncIterableIterator<Response, Response | void, undefined> = {
        [Symbol.asyncIterator]() { return this; },
        next: value => context.with(filtered, () => iterator.next(value)),
        return: value => context.with(filtered, () => iterator.return(value)),
        throw: error => context.with(filtered, () => iterator.throw(error))
    };
    return yield* downstream;
};
