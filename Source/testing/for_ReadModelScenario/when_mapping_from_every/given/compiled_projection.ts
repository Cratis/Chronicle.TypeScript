// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import type { IClientArtifactsProvider } from '../../../../artifacts/IClientArtifactsProvider.js';
import { eventType } from '../../../../events/eventTypeDecorator.js';
import type { IProjectionBuilderFor } from '../../../../projections/declarative/IProjectionBuilderFor.js';
import { projection } from '../../../../projections/declarative/projection.js';
import { ProjectionDefinitionCompiler } from '../../../../projections/ProjectionDefinitionCompiler.js';

@eventType('Created')
export class Created {
    @field(String) readonly name: string;
    constructor(name: string) { this.name = name; }
}
@eventType('Renamed')
export class Renamed {
    @field(String) readonly name: string;
    constructor(name: string) { this.name = name; }
}
@eventType('Removed')
export class Removed {}
@eventType('Unhandled')
export class Unhandled {
    @field(String) readonly name: string;
    constructor(name: string) { this.name = name; }
}
export class Model {
    @field(String) id!: string;
    @field(String) name!: string;
    @field(String) lastSequence!: string;
}
@projection('from-every-fluent', Model)
export class ModelProjection {
    define(builder: IProjectionBuilderFor<Model>): void {
        builder.from(Created, from => from.set(model => model.name).to(event => event.name))
            .from(Renamed, from => from.set(model => model.name).to(event => event.name))
            .fromEvery(every => every.set(model => model.lastSequence).toEventContextProperty('sequenceNumber'))
            .removedWith(Removed);
    }
}
export const artifacts = {
    readModels: [Model], projections: [ModelProjection], eventTypes: [Created, Renamed, Removed, Unhandled],
    globalForHandlers: [], reducers: [], reactors: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
} satisfies IClientArtifactsProvider;
export const candidate = {
    name: 'from-every-fluent', model: Model, artifacts,
    compile: () => new ProjectionDefinitionCompiler(artifacts, 'test').compile([ModelProjection], [])
};
export type Candidate = Pick<typeof candidate, 'name' | 'compile'>;

// The oracle converts even unhandled event payloads using their real compiler schema.
@projection('unhandled-schema-only', Model)
class UnhandledSchemaProjection {
    define(builder: IProjectionBuilderFor<Model>): void { builder.from(Unhandled); }
}
export function unhandledSchema() {
    const compiled = new ProjectionDefinitionCompiler(artifacts, 'test').compile([UnhandledSchemaProjection], []);
    return [...compiled.eventSchemas.get(compiled.definitions[0])!.values()];
}

export function history() {
    return [
        { source: 'C', event: new Unhandled('ignored before creation') },
        { source: 'A', event: new Created('first') },
        { source: 'A', event: new Renamed('updated') },
        { source: 'A', event: new Unhandled('ignored update') },
        { source: 'B', event: new Created('independent') },
        { source: 'B', event: new Renamed('other') },
        { source: 'A', event: new Created('created again') },
        { source: 'A', event: new Removed() },
        { source: 'A', event: new Unhandled('ignored after removal') },
        { source: 'A', event: new Renamed('recreated') },
        { source: 'A', event: new Created('final') },
        { source: 'C', event: new Removed() }
    ];
}
