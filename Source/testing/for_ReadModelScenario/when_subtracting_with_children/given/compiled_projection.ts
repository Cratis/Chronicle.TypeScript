// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import type { IClientArtifactsProvider } from '../../../../artifacts/IClientArtifactsProvider.js';
import { eventType } from '../../../../events/eventTypeDecorator.js';
import type { IProjectionBuilderFor } from '../../../../projections/declarative/IProjectionBuilderFor.js';
import { projection } from '../../../../projections/declarative/projection.js';
import { ProjectionDefinitionCompiler } from '../../../../projections/ProjectionDefinitionCompiler.js';

@eventType('Subtracted')
export class Subtracted {
    @field(Number) readonly amount: number;
    constructor(amount: number) { this.amount = amount; }
}
@eventType('TotalSubtracted')
class TotalSubtracted {
    @field(Number) readonly total: number;
    constructor(total: number) { this.total = total; }
}
@eventType('UnderscoreSubtracted')
class UnderscoreSubtracted {
    @field(Number) readonly _amount: number;
    constructor(_amount: number) { this._amount = _amount; }
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

function variant<E extends object>(name: string, event: new (amount: number) => E, operand: (event: E) => number) {
    class TotalsProjection {
        define(builder: IProjectionBuilderFor<Totals>): void {
            builder.from(event, from => from.subtract(model => model.total).with(operand))
                .children<Item>(model => model.items, child => child.identifiedBy(item => item.itemId)
                    .from(ItemChanged, from => from.usingKey(value => value.itemId))
                    .removedWith(ItemRemoved, removal => removal.usingKey(value => value.itemId)))
                .removedWith(Removed);
        }
    }
    projection(name, Totals)(TotalsProjection);
    const artifacts = {
        readModels: [Totals], projections: [TotalsProjection], eventTypes: [event, ItemChanged, ItemRemoved, Removed],
        globalForHandlers: [], reducers: [], reactors: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
    } satisfies IClientArtifactsProvider;
    return { name, event, model: Totals, artifacts, compile: () => new ProjectionDefinitionCompiler(artifacts, 'test').compile([TotalsProjection], []) };
}
export const variants = [
    variant('subtract-children-lifecycle', Subtracted, event => event.amount),
    variant('subtract-children-same-property', TotalSubtracted, event => event.total),
    variant('subtract-children-leading-underscore', UnderscoreSubtracted, event => event._amount)
];
export const { artifacts, compile } = variants[0];
