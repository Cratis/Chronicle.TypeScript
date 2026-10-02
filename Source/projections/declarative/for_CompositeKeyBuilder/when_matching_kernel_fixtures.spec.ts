// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { beforeEach, chai, describe, it } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { ProjectionBuilderFor, type ICompositeKeyBuilder } from '../index.js';
import type { ChildrenDefinitionLike } from '../ProjectionBuilderCore.js';

chai.should();

class RecordChanged { orderId!: string; title!: string; }
class OrderCreated { orderId!: string; title!: string; }
class ItemChanged { orderId!: string; itemId!: string; name!: string; }
class OrderPlaced { customerId!: string; }
class CustomerNamed { customerId!: string; name!: string; }
class ItemAdded { itemId!: string; title!: string; name!: string; }
class ItemNamed { itemId!: string; name!: string; }
for (const event of [RecordChanged, OrderCreated, ItemChanged, OrderPlaced, CustomerNamed, ItemAdded, ItemNamed]) eventType(event.name)(event);

class Key { orderId!: string; customerId!: string; itemId!: string; subject!: string; sourceId!: string; category!: string; }
class Item { id!: string; name!: string; }
class CompositeItem { id!: Key; name!: string; }
class Model { id!: Key; title!: string; items!: Item[]; }
class ChildJoinModel { id!: Key; title!: string; items!: CompositeItem[]; }
class JoinModel { id!: string; customerId!: string; customerName!: string; }

type Definition = ReturnType<ProjectionBuilderFor<Model>['build']>;

function contextParts<TEvent>(key: ICompositeKeyBuilder<Key, TEvent>): ICompositeKeyBuilder<Key, TEvent> {
    return key.set(target => target.subject).toEventContextProperty('subject')
        .set(target => target.sourceId).toEventSourceId();
}

function childKey<TEvent extends { itemId: string }>(key: ICompositeKeyBuilder<Key, TEvent>): void {
    contextParts(key.set(target => target.itemId, event => event.itemId)).set(target => target.category).toValue('items');
}

function buildRoot(): Definition {
    return new ProjectionBuilderFor<Model>().noAutoMap()
        .from(RecordChanged, from => from
            .usingCompositeKey<Key>(key => contextParts(key.set(target => target.orderId, event => event.orderId))
                .set(target => target.category).toValue('orders'))
            .set(model => model.title).to(event => event.title))
        .build('oracle-composite-expression-parts', 'OracleReadModel');
}

function buildParent(withConstant: boolean): Definition {
    const parentKey = <TEvent extends { orderId: string }>(key: ICompositeKeyBuilder<Key, TEvent>): void => {
        if (!withConstant) key.set(target => target.orderId, event => event.orderId);
        contextParts(key);
        if (withConstant) key.set(target => target.category).toValue('orders');
    };
    return new ProjectionBuilderFor<Model>().noAutoMap()
        .from(OrderCreated, from => from.usingCompositeKey<Key>(parentKey).set(model => model.title).to(event => event.title))
        .children<Item>(model => model.items, children => children.noAutoMap().identifiedBy(item => item.id)
            .from(ItemChanged, from => from.usingKey(event => event.itemId).usingParentCompositeKey<Key>(parentKey)
                .set(item => item.id).to(event => event.itemId).set(item => item.name).to(event => event.name)))
        .build(withConstant ? 'oracle-composite-parent-expression-parts' : 'oracle-composite-parent-without-constant', 'OracleReadModel');
}

function buildRootJoin(): Definition {
    return new ProjectionBuilderFor<JoinModel>().noAutoMap()
        .from(OrderPlaced, from => from.set(model => model.customerId).to(event => event.customerId))
        .join(CustomerNamed, join => join.on(model => model.customerId)
            .usingCompositeKey<Key>(key => contextParts(key.set(target => target.customerId, event => event.customerId))
                .set(target => target.category).toValue('customers'))
            .set(model => model.customerName).to(event => event.name))
        .build('oracle-composite-join-expression-parts', 'OracleReadModel');
}

function buildChildJoin(): Definition {
    return new ProjectionBuilderFor<ChildJoinModel>().noAutoMap()
        .from(ItemAdded, from => from.usingCompositeKey<Key>(childKey).set(model => model.title).to(event => event.title))
        .children<CompositeItem>(model => model.items, children => children.noAutoMap().identifiedBy(item => item.id)
            .from(ItemAdded, from => from.usingCompositeKey<Key>(childKey).usingParentCompositeKey<Key>(childKey)
                .set(item => item.name).to(event => event.name))
            .join(ItemNamed, join => join.on(item => item.id).usingCompositeKey<Key>(childKey)
                .set(item => item.name).to(event => event.name)))
        .build('oracle-composite-child-join-expression-parts', 'OracleReadModel');
}

// Compare every event's Key/ParentKey and mappings, including child joins; do not derive
// builder configuration from the fixture expressions being asserted.
function expressions(definition: Pick<ChildrenDefinitionLike, 'From' | 'Join' | 'Children'>): object {
    return {
        From: definition.From.map(entry => ({ Event: entry.Key.Id, ...entry.Value })),
        Join: definition.Join.map(entry => ({ Event: entry.Key.Id, Key: entry.Value.Key, On: entry.Value.On, Properties: entry.Value.Properties })),
        Children: Object.fromEntries(Object.entries(definition.Children).map(([name, child]) => [name, expressions(child)]))
    };
}

for (const [name, build] of [
    ['composite-key-expression-parts', buildRoot],
    ['composite-parent-key-expression-parts', () => buildParent(true)],
    ['composite-parent-key-without-constant', () => buildParent(false)],
    ['composite-join-key-expression-parts', buildRootJoin],
    ['composite-child-join-key-expression-parts', buildChildJoin]
] as const) {
    describe(`when matching the composite expressions in ${name}`, () => {
        const fixture = JSON.parse(readFileSync(new URL(`../../../testing/projections/fixtures/${name}.json`, import.meta.url), 'utf8')) as { wireDefinition: Definition };
        let definition: Definition;
        beforeEach(() => { definition = build(); });
        it('should emit the instance, parent and join keys executed by the packaged kernel', () => {
            expressions(definition).should.deep.equal(expressions(fixture.wireDefinition));
        });
    });
}
