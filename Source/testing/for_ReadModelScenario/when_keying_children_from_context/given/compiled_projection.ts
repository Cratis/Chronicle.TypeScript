// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field, type Constructor } from '@cratis/fundamentals';
import { eventType } from '../../../../events/eventTypeDecorator.js';
import { projection } from '../../../../projections/declarative/projection.js';
import type { IProjectionBuilderFor } from '../../../../projections/declarative/IProjectionBuilderFor.js';
import { ProjectionDefinitionCompiler } from '../../../../projections/ProjectionDefinitionCompiler.js';

@eventType('ContextParentCreated')
export class Created {
    @field(String) title: string;
    constructor(title: string) { this.title = title; }
}
@eventType('ContextChildChanged')
export class Changed {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}
@eventType('ContextChildRemoved')
export class ChildRemoved {}
@eventType('ContextParentRemoved')
export class Removed {}
export class Item {
    @field(String) itemId!: string;
    @field(String) name!: string;
}
export class Model {
    @field(String) id!: string;
    @field(String) name!: string;
    @field(Array, { genericArguments: [Item] }) items!: Item[];
}
@projection('context-child-keys-fluent', Model)
class ModelProjection {
    define(builder: IProjectionBuilderFor<Model>): void {
        builder.from(Created, from => from.set(model => model.name).to(event => event.title))
            .children<Item>(model => model.items, child => child.identifiedBy(item => item.itemId)
                .from(Changed, from => from.usingKeyFromContext('eventSourceId'))
                .removedWith(ChildRemoved, removal => removal.usingKeyFromContext('eventSourceId')))
            .removedWith(Removed);
    }
}
export function candidateFor(name: string, model: typeof Model, projections: Constructor[]) {
    const artifacts = {
        readModels: [model], projections, eventTypes: [Created, Changed, ChildRemoved, Removed],
        globalForHandlers: [], reducers: [], reactors: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
    };
    return { name, model, artifacts, compile: () => new ProjectionDefinitionCompiler(artifacts, 'test').compile(projections, projections.length ? [] : [model]) };
}
export const fluent = candidateFor('context-child-keys-fluent', Model, [ModelProjection]);
export function history() {
    return [
        { source: 'A', event: new Created('first') },
        { source: 'A', event: new Changed('initial') },
        { source: 'A', event: new Changed('updated') },
        { source: 'B', event: new Created('independent') },
        { source: 'B', event: new Changed('other') },
        { source: 'A', event: new ChildRemoved() },
        { source: 'A', event: new ChildRemoved() },
        { source: 'A', event: new Changed('re-added') },
        { source: 'A', event: new Removed() },
        { source: 'A', event: new Created('recreated') },
        { source: 'A', event: new Changed('after') },
        { source: 'B', event: new Changed('other-updated') }
    ];
}
