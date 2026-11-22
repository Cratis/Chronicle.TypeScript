// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field, type Constructor } from '@cratis/fundamentals';
import { eventType } from '../../../../events/eventTypeDecorator.js';
import { projection } from '../../../../projections/declarative/projection.js';
import type { IProjectionBuilderFor } from '../../../../projections/declarative/IProjectionBuilderFor.js';
import { ProjectionDefinitionCompiler } from '../../../../projections/ProjectionDefinitionCompiler.js';

@eventType('RoutedNameChanged')
export class Changed {
    @field(String) targetId: string;
    @field(String) title: string;
    constructor(targetId: string, title: string) { this.targetId = targetId; this.title = title; }
}
export class Model {
    @field(String) id!: string;
    @field(String) name!: string;
}
@projection('routed-root-fluent', Model)
class ModelProjection {
    define(builder: IProjectionBuilderFor<Model>): void {
        builder.from(Changed, from => from.usingKey(event => event.targetId).set(model => model.name).to(event => event.title));
    }
}
export function candidateFor(name: string, model: typeof Model, projections: Constructor[], eventTypes: Constructor[] = [Changed]) {
    const artifacts = {
        readModels: [model], projections, eventTypes,
        globalForHandlers: [], reducers: [], reactors: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
    };
    return { name, model, artifacts, compile: () => new ProjectionDefinitionCompiler(artifacts, 'test').compile(projections, projections.length ? [] : [model]) };
}
export const fluent = candidateFor('routed-root-fluent', Model, [ModelProjection]);
export function history() {
    return [
        { source: 'source-1', event: new Changed('A', 'first') },
        { source: 'source-1', event: new Changed('B', 'independent') },
        { source: 'source-2', event: new Changed('A', 'updated') },
        { source: 'source-2', event: new Changed('B', 'other-updated') },
        { source: 'A', event: new Changed('B', 'source-is-another-key') },
        { source: 'B', event: new Changed('A', 'key-is-another-source') },
        { source: 'source-1', event: new Changed('A', 'last') }
    ];
}
