// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import type { IProjectionBuilderFor } from '../../../../projections/declarative/IProjectionBuilderFor.js';
import { projection } from '../../../../projections/declarative/projection.js';
import { ProjectionDefinitionCompiler } from '../../../../projections/ProjectionDefinitionCompiler.js';
import { Created, Renamed, Removed, Unhandled, artifacts as sharedArtifacts } from '../../when_mapping_from_every/given/compiled_projection.js';

export { Created, Renamed, Removed, Unhandled };
export class Model {
    @field(String) id!: string;
    @field(String) name!: string;
    @field(String) lastSequence!: string;
}
@projection('from-all-fluent', Model)
export class ModelProjection {
    define(builder: IProjectionBuilderFor<Model>): void {
        builder.from(Created, from => from.set(model => model.name).to(event => event.name))
            .from(Renamed, from => from.set(model => model.name).to(event => event.name))
            .fromAll(all => all.set(model => model.lastSequence).toEventContextProperty('sequenceNumber'))
            .removedWith(Removed);
    }
}
export const artifacts = { ...sharedArtifacts, readModels: [Model], projections: [ModelProjection] };
export const candidate = {
    name: 'from-all-fluent', model: Model, artifacts,
    compile: () => new ProjectionDefinitionCompiler(artifacts, 'test').compile([ModelProjection], [])
};

export function history() {
    return [
        { source: 'C', event: new Unhandled('before creation') },
        { source: 'A', event: new Created('first') },
        { source: 'A', event: new Renamed('updated') },
        { source: 'A', event: new Unhandled('undeclared update') },
        { source: 'B', event: new Created('independent') },
        { source: 'B', event: new Renamed('other') },
        { source: 'A', event: new Created('created again') },
        { source: 'A', event: new Removed() },
        { source: 'A', event: new Unhandled('after removal') },
        { source: 'A', event: new Renamed('recreated') },
        { source: 'A', event: new Created('final') },
        { source: 'C', event: new Removed() }
    ];
}
