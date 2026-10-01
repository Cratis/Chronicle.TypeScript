// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { childrenFrom } from '../../../projections/modelBound/childrenFrom.js';
import { JsonSchemaGenerator } from '../../JsonSchemaGenerator.js';

chai.should();

class ItemAdded {
    @field(String) itemId!: string;
    @field(String) name!: string;
}

class Item {
    @field(String) id!: string;
    @field(String) name!: string;
    @field(Number) quantity!: number;
}

class Order {
    @field(Array)
    @childrenFrom(ItemAdded, { childType: Item, key: 'itemId' })
    options!: Item[];

    @field(Array)
    @childrenFrom(ItemAdded, Item)
    positional!: Item[];

    @childrenFrom(ItemAdded, { childType: Item, key: 'itemId' })
    withoutField!: Item[];

    @field(Array, { genericArguments: [Item] })
    @childrenFrom(ItemAdded, 'itemId')
    fieldMetadata!: Item[];
}

class UnknownOrder {
    @field(Array)
    @childrenFrom(ItemAdded, { key: 'itemId', identifiedBy: 'id' })
    items!: Item[];
}

const schema = JsonSchemaGenerator.generate(Order);

describe('for JsonSchemaGenerator', () => {
    describe('when generating children with standard decorators', () => {
        for (const property of ['options', 'positional', 'withoutField', 'fieldMetadata']) {
            it(`should register typed items for ${property}`, () => {
                schema.properties![property].should.deep.equal({ type: 'array', items: JsonSchemaGenerator.generate(Item) });
                schema.properties![property].items!.properties!.should.deep.equal({
                    id: { type: 'string' }, name: { type: 'string' }, quantity: { type: 'number' }
                });
            });
        }

        it('should still reject an unresolved child type', () => {
            (() => JsonSchemaGenerator.generate(UnknownOrder)).should.throw(TypeError, 'Cannot determine the element type of UnknownOrder.items');
        });
    });
});
