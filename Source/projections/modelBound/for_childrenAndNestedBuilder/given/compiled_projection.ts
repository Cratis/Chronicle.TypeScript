// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import type { IClientArtifactsProvider } from '../../../../artifacts/IClientArtifactsProvider.js';
import { eventType } from '../../../../events/eventTypeDecorator.js';
import { CompositeKeyBuilder } from '../../../declarative/CompositeKeyBuilder.js';
import type { ICompositeKeyBuilder } from '../../../declarative/ICompositeKeyBuilder.js';
import type { IProjectionBuilderFor } from '../../../declarative/IProjectionBuilderFor.js';
import { projection } from '../../../declarative/projection.js';
import { ProjectionDefinitionCompiler } from '../../../ProjectionDefinitionCompiler.js';

export class ChildKey {
    @field(String) left!: string;
    @field(String) right!: string;
}
@eventType('CompositeParentOpened')
export class Opened {
    @field(String) readonly caption: string;
    constructor(caption: string) { this.caption = caption; }
}
@eventType('CompositeItemChanged')
export class ItemChanged {
    @field(String) readonly left: string;
    @field(String) readonly right: string;
    @field(String) readonly name: string;
    constructor(left: string, right: string, name: string) { this.left = left; this.right = right; this.name = name; }
}
@eventType('CompositeItemReordered')
export class ReorderedItemChanged {
    @field(String) readonly left: string;
    @field(String) readonly right: string;
    @field(String) readonly name: string;
    constructor(left: string, right: string, name: string) { this.left = left; this.right = right; this.name = name; }
}
export class Item {
    @field(ChildKey) id!: ChildKey;
    @field(String) name!: string;
}
export class Parent {
    @field(String) id!: string;
    @field(String) caption!: string;
    @field(Array, { genericArguments: [Item] }) items!: Item[];
}
function configureKey(builder: ICompositeKeyBuilder<ChildKey, ItemChanged>, reverse = false) {
    if (reverse) return builder.set(key => key.right, event => event.right).set(key => key.left, event => event.left);
    return builder.set(key => key.left, event => event.left).set(key => key.right, event => event.right);
}
export function keyExpression(reverse = false): string {
    return configureKey(new CompositeKeyBuilder<ChildKey, ItemChanged>(), reverse).build();
}
@projection('composite-child-creation-fluent', Parent)
class ParentProjection {
    define(builder: IProjectionBuilderFor<Parent>): void {
        builder.from(Opened).children<Item>(model => model.items, child => child.identifiedBy(item => item.id)
            .from(ItemChanged, from => from.usingCompositeKey<ChildKey>(key => configureKey(key)))
            .from(ReorderedItemChanged, from => from.usingCompositeKey<ChildKey>(key => configureKey(key, true))));
    }
}
export const artifacts = {
    readModels: [Parent], projections: [ParentProjection], eventTypes: [Opened, ItemChanged, ReorderedItemChanged],
    globalForHandlers: [], reducers: [], reactors: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
} satisfies IClientArtifactsProvider;
export const fluent = {
    name: 'composite-child-creation-fluent', model: Parent, artifacts,
    compile: () => new ProjectionDefinitionCompiler(artifacts, 'test').compile([ParentProjection], [])
};
export function history() {
    return [
        { source: 'A', event: new Opened('A') },
        { source: 'A', event: new ItemChanged('a', 'x', 'first') },
        { source: 'A', event: new ItemChanged('a', 'y', 'second') },
        { source: 'A', event: new ItemChanged('b', 'x', 'third') },
        { source: 'A', event: new ItemChanged('a', 'x', 'updated') },
        { source: 'A', event: new ReorderedItemChanged('a', 'x', 'reordered') },
        { source: 'A', event: new ItemChanged('a_b', 'c', 'delimiter-one') },
        { source: 'A', event: new ItemChanged('a', 'b_c', 'delimiter-two') },
        { source: 'B', event: new Opened('B') },
        { source: 'B', event: new ItemChanged('a', 'x', 'independent') },
        { source: 'A', event: new ItemChanged('a', 'x', 'final') }
    ];
}
