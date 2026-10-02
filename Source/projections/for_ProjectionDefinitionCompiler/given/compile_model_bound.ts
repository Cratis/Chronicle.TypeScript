// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { IClientArtifactsProvider } from '../../../artifacts/IClientArtifactsProvider.js';
import { ProjectionDefinitionCompiler } from '../../ProjectionDefinitionCompiler.js';

export function compileModelBound(model: Constructor) {
    const artifacts: IClientArtifactsProvider = {
        readModels: [model], projections: [], eventTypes: [], globalForHandlers: [], reducers: [],
        reactors: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
    };
    const compiled = new ProjectionDefinitionCompiler(artifacts, 'test-sink').compile([], [model]);
    return { compiled, definition: compiled.definitions[0] };
}
