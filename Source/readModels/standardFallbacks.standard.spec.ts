// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { describe, expect, it, vi } from 'vitest';
import { IClientArtifactsProvider } from '../artifacts/IClientArtifactsProvider.js';
import { ChronicleConnection } from '../connection/ChronicleConnection.js';
import { reducer } from '../reducers/reducer.js';
import { MaterializedReadModels } from './MaterializedReadModels.js';
import { ReadModels } from './ReadModels.js';

class UndecoratedModel {
    @field(Array) items!: string[];
}

@reducer('undecorated-model', undefined, UndecoratedModel)
class ModelReducer {}

const artifacts = {
    eventTypes: [], readModels: [], reactors: [], reducers: [ModelReducer], seeders: [],
    constraints: [], projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
} as IClientArtifactsProvider;

describe('inferred read models with standard decorators', () => {
    it('rejects an untyped array before registering a reducer read model', async () => {
        const registerMany = vi.fn();
        const connection = { readModels: { registerMany } } as unknown as ChronicleConnection;
        const readModels = new ReadModels('test', 'Default', connection, artifacts, 'sink');
        await expect(readModels.register(UndecoratedModel)).rejects.toThrow(/Cannot determine the element type of UndecoratedModel.items/);
        expect(registerMany).not.toHaveBeenCalled();
    });

    it('rejects an untyped array instead of releasing an incomplete materialized schema', async () => {
        const getInstances = vi.fn().mockResolvedValue({ Instances: [] });
        const connection = { materializedReadModels: { getInstances } } as unknown as ChronicleConnection;
        const materialized = new MaterializedReadModels('test', 'Default', connection);
        await expect(materialized.getInstances(UndecoratedModel)).rejects.toThrow(/Cannot determine the element type of UndecoratedModel.items/);
    });
});
