// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { describe, expect, it, vi } from 'vitest';
import type { ChronicleConnection } from '../connection/ChronicleConnection.js';
import type { IClientArtifactsProvider } from '../artifacts/IClientArtifactsProvider.js';
import { projection } from '../projections/declarative/projection.js';
import { reducer } from '../reducers/reducer.js';
import { ReadModels } from './ReadModels.js';
import { index } from './indexDecorator.js';

class Address {
    @field(String) @index() zipCode!: string;
}

class Line {
    @field(String) @index() productId!: string;
    @field(Number) quantity!: number;
}

class Order {
    @field(String) id!: string;
    @field(String) @index() customerId!: string;
    @field(String) @index() number!: string;
    @field(Number) total!: number;
    @field(Address) address!: Address;
    @field(Array, { genericArguments: [Line] }) lines!: Line[];
}

class ReducedOrder {
    @field(String) @index() number!: string;
}

@projection('indexed-orders', Order)
class OrderProjection {
    define(): void {}
}

@reducer('reduced-orders', undefined, ReducedOrder)
class OrderReducer {}

const artifacts = {
    eventTypes: [], readModels: [], reactors: [], reducers: [OrderReducer], seeders: [],
    constraints: [], projections: [OrderProjection], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
} as IClientArtifactsProvider;

describe('read-model index registration with legacy decorators', () => {
    it('sends the .NET-equivalent property paths for projections and reducers', async () => {
        const registerMany = vi.fn().mockResolvedValue({});
        const connection = { readModels: { registerMany } } as unknown as ChronicleConnection;
        const readModels = new ReadModels('test', 'Default', connection, artifacts, 'sink');
        await readModels.register();

        expect(registerMany).toHaveBeenCalledWith(expect.objectContaining({
            ReadModels: [
                expect.objectContaining({
                    ObserverIdentifier: 'indexed-orders',
                    Indexes: [
                        { PropertyPath: 'customerId' },
                        { PropertyPath: 'number' },
                        { PropertyPath: 'address.zipCode' },
                        { PropertyPath: 'lines.productId' }
                    ]
                }),
                expect.objectContaining({
                    ObserverIdentifier: 'reduced-orders',
                    Indexes: [{ PropertyPath: 'number' }]
                })
            ]
        }));
    });

    it('sends the same indexes when registering a single model', async () => {
        const registerMany = vi.fn().mockResolvedValue({});
        const connection = { readModels: { registerMany } } as unknown as ChronicleConnection;
        await new ReadModels('test', 'Default', connection, artifacts, 'sink').register(Order);
        expect(registerMany.mock.calls[0][0].ReadModels[0].Indexes).toEqual([
            { PropertyPath: 'customerId' }, { PropertyPath: 'number' },
            { PropertyPath: 'address.zipCode' }, { PropertyPath: 'lines.productId' }
        ]);
    });
});
