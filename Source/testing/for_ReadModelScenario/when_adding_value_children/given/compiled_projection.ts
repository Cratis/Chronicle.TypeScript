// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { eventType } from '../../../../events/eventTypeDecorator.js';
import type { IProjectionBuilderFor } from '../../../../projections/declarative/IProjectionBuilderFor.js';
import { projection } from '../../../../projections/declarative/projection.js';
import { ProjectionDefinitionCompiler } from '../../../../projections/ProjectionDefinitionCompiler.js';

@eventType('ValueParentCreated')
export class Created {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}
@eventType('ValueAdded')
export class Added {
    @field(String) value: string;
    constructor(value: string) { this.value = value; }
}
@eventType('ValueParentRemoved')
export class Removed {}
export class Model {
    @field(String) id!: string;
    @field(String) name!: string;
    @field(Array, { genericArguments: [String] }) values!: string[];
}
@projection('value-children-fluent', Model)
export class ModelProjection {
    define(builder: IProjectionBuilderFor<Model>): void {
        builder.from(Created, from => from.set(model => model.name).to(event => event.name))
            .from(Added, from => from.addChild<string>(model => model.values, event => event.value))
            .removedWith(Removed);
    }
}
export const artifacts = {
    readModels: [Model], projections: [ModelProjection], eventTypes: [Created, Added, Removed],
    globalForHandlers: [], reducers: [], reactors: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
};
export const candidate = {
    name: 'value-children-fluent', model: Model, artifacts,
    compile: () => new ProjectionDefinitionCompiler(artifacts, 'test').compile([ModelProjection], [])
};

export function history() {
    return [
        { source: 'A', event: new Created('first') },
        { source: 'A', event: new Added('one') },
        { source: 'A', event: new Added('two') },
        { source: 'A', event: new Added('one') },
        { source: 'B', event: new Created('independent') },
        { source: 'B', event: new Added('other') },
        { source: 'A', event: new Removed() },
        { source: 'A', event: new Created('recreated') },
        { source: 'A', event: new Added('after') }
    ];
}
