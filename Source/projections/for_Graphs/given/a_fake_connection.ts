// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ChronicleConnection } from '../../../connection/index.js';

/**
 * Creates a connection that records what is registered.
 * @returns The connection and what was registered with it.
 */
export function aFakeConnection() {
    const readModelRequests: Array<{ EventStore: string; Owner: number; ReadModels: Array<{ Type: { Identifier: string } }>; Source: number }> = [];
    const projectionRequests: Array<{ EventStore: string; Owner: number; Projections: any[] }> = [];
    const connection = {
        logger: undefined,
        readModels: { registerMany: async (request: (typeof readModelRequests)[number]) => { readModelRequests.push(request); return {}; } },
        projections: { register: async (request: (typeof projectionRequests)[number]) => { projectionRequests.push(request); return {}; } }
    } as unknown as ChronicleConnection;
    return { connection, readModelRequests, projectionRequests };
}
