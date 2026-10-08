// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { vi } from 'vitest';
import type { Constraint, RegisterConstraintsRequest } from '@cratis/chronicle.contracts';
import type { IClientArtifactsProvider } from '../../../../../artifacts/index.js';
import type { ChronicleConnection } from '../../../../../connection/index.js';
import { Constraints } from '../../../Constraints.js';

/**
 * Registers the given constraint classes and decorated event types and returns the registered wire definitions by name.
 * @param constraints - The constraint classes.
 * @param eventTypes - The event types whose decorators contribute constraints.
 * @returns The registered constraints keyed by name.
 */
export async function registeredConstraints(constraints: Function[], eventTypes: Function[] = []): Promise<Map<string, Constraint>> {
    const register = vi.fn().mockResolvedValue({});
    const connection = { constraints: { register } } as unknown as ChronicleConnection;
    const artifacts = {
        eventTypes, readModels: [], reactors: [], reducers: [], seeders: [], constraints,
        projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
    } as unknown as IClientArtifactsProvider;
    await new Constraints('store', connection, artifacts).register();
    const request = register.mock.calls[0][0] as RegisterConstraintsRequest;
    return new Map(request.Constraints.map(registered => [registered.Name, registered]));
}
