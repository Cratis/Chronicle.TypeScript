// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field, type Constructor } from '@cratis/fundamentals';
import { eventType } from '../../../../events/eventTypeDecorator.js';
import { projection } from '../../../../projections/declarative/projection.js';
import type { IProjectionBuilderFor } from '../../../../projections/declarative/IProjectionBuilderFor.js';
import { ProjectionDefinitionCompiler } from '../../../../projections/ProjectionDefinitionCompiler.js';

@eventType('JoinChildrenPlaced')
export class Placed {
    @field(String) customerId: string;
    constructor(customerId: string) { this.customerId = customerId; }
}
@eventType('JoinChildrenNamed')
export class Named {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}
@eventType('JoinChildrenItemChanged')
export class ItemChanged {
    @field(String) itemId: string;
    @field(String) name: string;
    constructor(itemId: string, name: string) { this.itemId = itemId; this.name = name; }
}
@eventType('JoinChildrenItemRemoved')
export class ItemRemoved {
    @field(String) itemId: string;
    constructor(itemId: string) { this.itemId = itemId; }
}
@eventType('JoinChildrenRemoved')
export class Removed {}
export class Item {
    @field(String) itemId!: string;
    @field(String) name!: string;
}
export class Model {
    @field(String) id!: string;
    @field(String) customerId!: string;
    @field(String) customerName!: string;
    @field(Array, { genericArguments: [Item] }) items!: Item[];
}
@projection('joins-children-fluent', Model)
class ModelProjection {
    define(builder: IProjectionBuilderFor<Model>): void {
        builder.from(Placed, from => from.set(model => model.customerId).to(event => event.customerId))
            .join(Named, join => join.on(model => model.customerId).set(model => model.customerName).to(event => event.name))
            .children<Item>(model => model.items, child => child.identifiedBy(item => item.itemId)
                .from(ItemChanged, from => from.usingKey(event => event.itemId))
                .removedWith(ItemRemoved, removal => removal.usingKey(event => event.itemId)))
            .removedWith(Removed);
    }
}
export function candidateFor(name: string, model: Constructor<Model>, projections: Constructor[]) {
    const artifacts = {
        readModels: [model], projections, eventTypes: [Placed, Named, ItemChanged, ItemRemoved, Removed],
        globalForHandlers: [], reducers: [], reactors: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
    };
    return { name, model, artifacts, compile: () => new ProjectionDefinitionCompiler(artifacts, 'test').compile(projections, projections.length ? [] : [model]) };
}
export const fluent = candidateFor('joins-children-fluent', Model, [ModelProjection]);

/** Parent-first children, with join history on both sides of creation, removal and recreation. */
export function history() {
    return [
        { source: 'customer', event: new Named('prior') },
        { source: 'A', event: new Placed('customer') },
        { source: 'A', event: new ItemChanged('one', 'first') },
        { source: 'B', event: new Placed('customer') },
        { source: 'B', event: new ItemChanged('one', 'independent') },
        { source: 'customer', event: new Named('updated') },
        { source: 'A', event: new ItemChanged('one', 'changed') },
        { source: 'A', event: new ItemChanged('two', 'second') },
        { source: 'A', event: new ItemRemoved('one') },
        { source: 'A', event: new ItemRemoved('unknown') },
        { source: 'A', event: new Removed() },
        { source: 'customer', event: new Named('after removal') },
        { source: 'A', event: new Placed('customer') },
        { source: 'A', event: new ItemChanged('new', 'recreated') },
        { source: 'customer', event: new Named('latest') }
    ];
}
