// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import type { IClientArtifactsProvider } from '../../../../artifacts/IClientArtifactsProvider.js';
import { eventType } from '../../../../events/eventTypeDecorator.js';
import type { IProjectionBuilderFor } from '../../../../projections/declarative/IProjectionBuilderFor.js';
import { projection } from '../../../../projections/declarative/projection.js';
import { ProjectionDefinitionCompiler } from '../../../../projections/ProjectionDefinitionCompiler.js';

@eventType('Counted')
export class Counted {
    @field(Number) readonly total: number;
    constructor(total: number) { this.total = total; }
}
@eventType('ItemChanged')
export class ItemChanged {
    @field(String) readonly itemId: string;
    @field(String) readonly name: string;
    constructor(itemId: string, name: string) { this.itemId = itemId; this.name = name; }
}
@eventType('ItemRemoved')
export class ItemRemoved {
    @field(String) readonly itemId: string;
    constructor(itemId: string) { this.itemId = itemId; }
}
@eventType('Removed')
export class Removed {}
export class Item {
    @field(String) itemId!: string;
    @field(String) name!: string;
}
export class Totals {
    @field(String) id!: string;
    @field(Number) total!: number;
    @field(Array, { genericArguments: [Item] }) items!: Item[];
}
@projection('count-children', Totals)
export class TotalsProjection {
    define(builder: IProjectionBuilderFor<Totals>): void {
        builder.from(Counted, from => from.count(model => model.total))
            .children<Item>(model => model.items, child => child.identifiedBy(item => item.itemId)
                .from(ItemChanged, from => from.usingKey(event => event.itemId))
                .removedWith(ItemRemoved, removal => removal.usingKey(event => event.itemId)))
            .removedWith(Removed);
    }
}
export const artifacts = {
    readModels: [Totals], projections: [TotalsProjection], eventTypes: [Counted, ItemChanged, ItemRemoved, Removed],
    globalForHandlers: [], reducers: [], reactors: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
} satisfies IClientArtifactsProvider;

export function compile() {
    return new ProjectionDefinitionCompiler(artifacts, 'test').compile([TotalsProjection], []);
}
