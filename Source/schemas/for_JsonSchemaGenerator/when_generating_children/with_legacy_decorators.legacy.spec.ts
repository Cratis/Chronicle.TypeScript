// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { childrenFrom } from '../../../projections/modelBound/childrenFrom.js';
import { JsonSchemaGenerator } from '../../JsonSchemaGenerator.js';

chai.should();

class ItemAdded {
    itemId = '';
    name = '';
}

class Item {
    id = '';
    name = '';
    quantity = 0;
}

class Order {
    @childrenFrom(ItemAdded, { childType: Item, key: 'itemId' })
    options: Item[] = [];

    @childrenFrom(ItemAdded, Item)
    positional: Item[] = [];

    @childrenFrom(ItemAdded, { childType: Item, key: 'itemId' })
    withoutInitializer!: Item[];

    @field(Array, { genericArguments: [Item] })
    @childrenFrom(ItemAdded, 'itemId')
    fieldMetadata: Item[] = [];

    @childrenFrom(ItemAdded, { key: 'itemId', identifiedBy: 'id' })
    unknown: Item[] = [];

    @field(Array, { genericArguments: [Item] })
    unrelated: Item[] = [];
}

class DeclaredItem {
    @field(String) id!: string;
    @field(String) name!: string;
}

class DeclaredOrder {
    @childrenFrom(ItemAdded, { childType: DeclaredItem, key: 'itemId' })
    items!: DeclaredItem[];
}

const schema = JsonSchemaGenerator.generate(Order);

describe('for JsonSchemaGenerator', () => {
    describe('when generating children with legacy decorators without design metadata', () => {
        for (const property of ['options', 'positional', 'withoutInitializer', 'fieldMetadata']) {
            it(`should register typed items for ${property}`, () => {
                chai.should().not.exist(Reflect.getMetadata('design:type', Order.prototype, property));
                schema.properties![property].should.deep.equal({ type: 'array', items: JsonSchemaGenerator.generate(Item) });
                schema.properties![property].items!.properties!.should.deep.equal({
                    id: { type: 'string' }, name: { type: 'string' }, quantity: { type: 'number' }
                });
            });
        }

        it('should resolve child properties from explicit field metadata without initializers', () => {
            JsonSchemaGenerator.generate(DeclaredOrder).properties!.items.items!.properties!.should.deep.equal({
                id: { type: 'string' }, name: { type: 'string' }
            });
        });

        it('should retain untyped items when the child type is unknown', () => {
            schema.properties!.unknown.should.deep.equal({ type: 'array', items: { type: 'object' } });
        });

        it('should preserve legacy array schemas outside children collections', () => {
            schema.properties!.unrelated.should.deep.equal({ type: 'array', items: { type: 'object' } });
        });
    });
});
