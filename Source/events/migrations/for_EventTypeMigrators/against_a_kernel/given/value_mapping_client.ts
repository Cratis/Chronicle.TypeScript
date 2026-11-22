// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChronicleClient } from '../../../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../../../ChronicleOptions.js';
import type { IClientArtifactsProvider } from '../../../../../artifacts/IClientArtifactsProvider.js';

export const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

export function valueMappingClient(overrides: Partial<IClientArtifactsProvider>): ChronicleClient {
    return new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
        discoveryPatterns: [],
        clientArtifactsProvider: {
            eventTypes: [], readModels: [], reactors: [], reducers: [], seeders: [], constraints: [],
            projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: [], ...overrides
        }
    }));
}
