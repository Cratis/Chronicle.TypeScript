// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
import type { IClientArtifactsProvider } from '../../../../artifacts/index.js';
import { IProjectionBuilderFor } from '../../../../projections/declarative/IProjectionBuilderFor.js';
import { IProjectionFor } from '../../../../projections/declarative/IProjectionFor.js';
import { projection } from '../../../../projections/declarative/projection.js';
import { fromEvent } from '../../../../projections/modelBound/fromEvent.js';
import { ProjectionDefinitionCompiler } from '../../../../projections/ProjectionDefinitionCompiler.js';
import { Changed } from './Changed.js';
import { Model } from './Model.js';
import { Removed } from './Removed.js';

function artifacts(model: Constructor, projections: Constructor[], eventTypes: Constructor[]): IClientArtifactsProvider {
    return {
        readModels: [model], projections, eventTypes: [Changed, Removed, ...eventTypes],
        globalForHandlers: [], reducers: [], reactors: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
    };
}

export function compileModelBound(configure: (model: typeof Model) => void = () => {}, eventTypes: Constructor[] = []) {
    class Candidate extends Model {}
    fromEvent(Changed)(Candidate);
    configure(Candidate);
    const compiled = new ProjectionDefinitionCompiler(artifacts(Candidate, [], eventTypes), 'test-sink').compile([], [Candidate]);
    return { compiled, definition: compiled.definitions[0] };
}

export function compileDeclarative(define: (builder: IProjectionBuilderFor<Model>) => void, eventTypes: Constructor[] = []) {
    class Candidate extends Model {}
    class CandidateProjection implements IProjectionFor<Model> {
        define(builder: IProjectionBuilderFor<Model>): void { define(builder); }
    }
    projection('capability-projection', Candidate)(CandidateProjection);
    const compiled = new ProjectionDefinitionCompiler(artifacts(Candidate, [CandidateProjection], eventTypes), 'test-sink')
        .compile([CandidateProjection], []);
    return { compiled, definition: compiled.definitions[0] };
}
