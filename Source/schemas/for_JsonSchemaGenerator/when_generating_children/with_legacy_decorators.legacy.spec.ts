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

class UnresolvedItem {
    id!: string;
    name!: string;
}

class PartiallyResolvedItem {
    id = '';
    name!: string;
}

class MissingIdentifierItem {
    id!: string;
    name = '';
}

class CustomIdentifierItem {
    itemId = '';
    name!: string;
}

class CapitalizedIdentifierItem {
    Id = '';
    name!: string;
}

class FallbackOrder {
    @childrenFrom(ItemAdded, { childType: UnresolvedItem, key: 'itemId', identifiedBy: 'id' })
    unresolved!: UnresolvedItem[];

    @childrenFrom(ItemAdded, { childType: MissingIdentifierItem, key: 'itemId', identifiedBy: 'id' })
    missingIdentifier!: MissingIdentifierItem[];

    @childrenFrom(ItemAdded, { childType: PartiallyResolvedItem, key: 'itemId' })
    partial!: PartiallyResolvedItem[];

    @childrenFrom(ItemAdded, { childType: CustomIdentifierItem, key: 'itemId' })
    custom!: CustomIdentifierItem[];

    @childrenFrom(ItemAdded, { childType: CapitalizedIdentifierItem, key: 'itemId' })
    capitalized!: CapitalizedIdentifierItem[];

    @childrenFrom(ItemAdded, { childType: MissingIdentifierItem, key: 'itemId' })
    undiscoverableIdentifier!: MissingIdentifierItem[];
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

        it('should retain untyped items for child members declared only with definite assignment', () => {
            JsonSchemaGenerator.generate(FallbackOrder).properties!.unresolved.should.deep.equal({ type: 'array', items: { type: 'object' } });
        });

        for (const property of ['missingIdentifier', 'undiscoverableIdentifier']) {
            it(`should retain untyped items for ${property} despite a resolved non-identifier property`, () => {
                JsonSchemaGenerator.generate(FallbackOrder).properties![property].should.deep.equal({ type: 'array', items: { type: 'object' } });
            });
        }

        for (const [property, childType] of [['partial', PartiallyResolvedItem], ['custom', CustomIdentifierItem], ['capitalized', CapitalizedIdentifierItem]] as const) {
            it(`should retain typed items for ${property} with a resolved identifier`, () => {
                JsonSchemaGenerator.generate(FallbackOrder).properties![property].should.deep.equal({ type: 'array', items: JsonSchemaGenerator.generate(childType) });
            });
        }

        it('should preserve legacy array schemas outside children collections', () => {
            schema.properties!.unrelated.should.deep.equal({ type: 'array', items: { type: 'object' } });
        });
    });
});
