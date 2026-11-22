// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { eventType } from '../../events/eventTypeDecorator.js';
import { ProjectionBuilderFor } from './ProjectionBuilderFor.js';
import type { ChildrenDefinitionLike } from './ProjectionBuilderCore.js';

chai.should();

@eventType('ValueAdded')
class ValueAdded { value!: string; }
@eventType('ItemAdded')
class ItemAdded { itemId!: string; }
class Item { itemId!: string; }
class Model { values!: string[]; items!: Item[]; }

function definition() {
    const builder = new ProjectionBuilderFor<Model>();
    builder.from(ValueAdded, from => from.addChild<string>(model => model.values, event => event.value))
        .from(ItemAdded, from => from.addChild<Item>(model => model.items, child => child
            .identifiedBy(item => item.itemId).usingKey(event => event.itemId)));
    return builder.build('value-children', 'Model').Children as Record<string, ChildrenDefinitionLike>;
}

describe('when adding value children alongside keyed object children', () => {
    it('should emit only FromEventProperty for the value-child event', () => {
        const values = definition().values;
        values.FromEventProperty!.should.deep.equal({
            Event: { Id: 'ValueAdded', Generation: 1, Tombstone: false }, PropertyExpression: 'value'
        });
        values.From.should.deep.equal([]);
    });

    it('should preserve the ordinary From for keyed object children', () => {
        const items = definition().items;
        items.IdentifiedBy.should.equal('itemId');
        (items.FromEventProperty === undefined).should.be.true;
        items.From.should.deep.equal([{
            Key: { Id: 'ItemAdded', Generation: 1, Tombstone: false },
            Value: { Key: 'itemId', ParentKey: '$eventSourceId', Properties: {} }
        }]);
    });
});
