// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { context, propagation } from '@opentelemetry/api';
import { Metadata, type ClientMiddleware } from 'nice-grpc-common';
import { correlationIdManager } from '../correlation/index.js';
import { WellKnownTelemetryNames } from '../WellKnownTelemetryNames.js';

/** Injects host-configured propagation for every RPC without mutating caller metadata or baggage. */
export const traceContextMiddleware: ClientMiddleware = async function* (call, options) {
    const metadata = options.metadata ? Metadata(options.metadata) : Metadata();
    // These headers belong to the active context, never to a stale caller-supplied carrier.
    for (const field of new Set(['traceparent', 'tracestate', 'baggage', ...propagation.fields()])) metadata.delete(field);
    const active = context.active();
    const key = WellKnownTelemetryNames.attributes.correlationId;
    const correlation = correlationIdManager.scoped?.toString() ?? propagation.getBaggage(active)?.getEntry(key)?.value;
    const filtered = propagation.setBaggage(active, propagation.createBaggage(correlation ? { [key]: { value: correlation } } : {}));
    propagation.inject(filtered, metadata, { set: (carrier, name, value) => carrier.set(name, value) });
    return yield* call.next(call.request, { ...options, metadata });
};
