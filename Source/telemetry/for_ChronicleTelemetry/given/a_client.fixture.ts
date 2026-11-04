// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { vi } from 'vitest';
import { ChronicleClient } from '../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../ChronicleOptions.js';
import type { IClientArtifactsProvider } from '../../../artifacts/IClientArtifactsProvider.js';
import type { ChronicleTelemetryOptions } from '../../ChronicleTelemetryOptions.js';

vi.mock('../../../connection/ChronicleConnection.js', () => ({
    ChronicleConnection: class {
        async resetChannel() {}
        async connect() {}
        disconnect() {}
        server = { getVersionInfo: async () => ({}) };
        eventStores = {
            ensureEventStore: async () => ({}),
            allEventStores: async () => ({ IsAuthorized: true, Data: [{ Name: 'store' }] })
        };
        namespaces = { allNamespaces: async () => ({ IsAuthorized: true, Data: [{ Name: 'namespace' }] }) };
        readModels = { registerMany: async () => ({}) };
        eventSequences = {
            append: async () => ({ Response: { SequenceNumber: 42n } }),
            appendManyForEventSources: async () => ({ Response: { SequenceNumbers: [42n, 43n] } }),
            tailSequenceNumber: async () => ({ IsAuthorized: true, Data: { SequenceNumber: 42n } }),
            hasEventsForEventSourceId: async (request: { EventSourceId: string }) => ({ IsAuthorized: true, Data: { HasEvents: request.EventSourceId !== 'empty' } }),
            forEventSourceIdAndEventTypes: async () => ({ IsAuthorized: true, Data: [] }),
            fromSequenceNumber: async () => ({ IsAuthorized: true, Data: [] }),
            compensate: async () => ({ Response: { SequenceNumber: 43n, ConstraintViolations: [], Errors: [] } }),
            redact: async () => ({}),
            redactForEventSource: async () => ({}),
            copyEventsForEventSource: async () => ({ Response: { lo: 1n, hi: 2n } }),
            completeStream: async () => ({ Response: { IsSuccess: true, SequenceNumber: 42n } })
        };
    }
}));
vi.mock('../../../connection/KernelKeepAlive.js', () => ({
    KernelKeepAlive: class { async start() {} }
}));

export function client(telemetry?: ChronicleTelemetryOptions) {
    const artifacts: IClientArtifactsProvider = {
        eventTypes: [], readModels: [], reactors: [], reducers: [], seeders: [], constraints: [],
        projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
    };
    return new ChronicleClient(ChronicleOptions.development({
        discoveryPatterns: [], clientArtifactsProvider: artifacts, telemetry
    }));
}
