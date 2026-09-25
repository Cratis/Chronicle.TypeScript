// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { ConceptAs, Guid, field } from '@cratis/fundamentals';
import { describe, expect, it } from 'vitest';
import { TypeIntrospector } from '../types/TypeIntrospector.js';
import { deserializeReadModel } from './deserializeReadModel.js';

class Identity extends ConceptAs<Guid> {}
Reflect.defineMetadata('design:paramtypes', [Guid], Identity);
class Model {
    date!: Date;
    id!: Guid;
    identity!: Identity;
    enabled!: boolean;
    get computed(): string { return 'computed'; }
}
for (const name of ['date', 'id', 'identity', 'enabled', 'computed']) TypeIntrospector.trackProperty(Model, name);
Reflect.defineMetadata('design:type', Date, Model.prototype, 'date');
Reflect.defineMetadata('design:type', Guid, Model.prototype, 'id');
Reflect.defineMetadata('design:type', Identity, Model.prototype, 'identity');
Reflect.defineMetadata('design:type', Boolean, Model.prototype, 'enabled');

class Inferred {
    date = new Date(0);
    id = Guid.empty;
}

class Address { street = ''; city = ''; }
class DecoratedAddress { street = ''; city = ''; }
field(String)(DecoratedAddress.prototype, 'street');
class Person { address = new Address(); decorated = new DecoratedAddress(); children: Address[] = []; }
field(Array, { genericArguments: [Address] })(Person.prototype, 'children');

const guid = 'f417bba6-5737-488a-a225-37da46b96221';

describe('deserializeReadModel', () => {
    it('restores declared values, concepts and false strings while skipping read-only accessors', () => {
        const model = deserializeReadModel(Model, JSON.stringify({
            date: '2025-01-02T00:00:00.000Z', id: guid, identity: guid, enabled: 'false', computed: 'stored'
        }));
        expect(model.date).toBeInstanceOf(Date);
        expect(model.id).toBeInstanceOf(Guid);
        expect(model.identity.value).toBeInstanceOf(Guid);
        expect(model.enabled).toBe(false);
        expect(model.computed).toBe('computed');
    });

    it('uses inferred member types without legacy design metadata', () => {
        const model = deserializeReadModel(Inferred, JSON.stringify({ date: '2025-01-02T00:00:00.000Z', id: guid }));
        expect(model.date).toBeInstanceOf(Date);
        expect(model.id).toBeInstanceOf(Guid);
    });

    it('restores nested plain members, mixed decorated members and typed child arrays', () => {
        const person = deserializeReadModel(Person, JSON.stringify({
            address: { street: 'Main', city: 'Oslo' },
            decorated: { street: 'Oak', city: 'Rome' },
            children: [{ street: 'First', city: 'Paris' }, { street: 'Second', city: 'Berlin' }]
        }));
        expect(person.address).toBeInstanceOf(Address);
        expect(person.address).toEqual({ street: 'Main', city: 'Oslo' });
        expect(person.decorated).toBeInstanceOf(DecoratedAddress);
        expect(person.decorated).toEqual({ street: 'Oak', city: 'Rome' });
        expect(person.children).toHaveLength(2);
        expect(person.children[0]).toBeInstanceOf(Address);
        expect(person.children[1]).toEqual({ street: 'Second', city: 'Berlin' });
    });

    it('introspects members only once for multiple rows', () => {
        const getMembers = TypeIntrospector.getMembers;
        let calls = 0;
        TypeIntrospector.getMembers = function (...args) { calls++; return getMembers.apply(this, args); };
        try {
            class Rows { enabled = false; }
            deserializeReadModel(Rows, '{"enabled":false}');
            deserializeReadModel(Rows, '{"enabled":false}');
            expect(calls).toBe(1);
        } finally {
            TypeIntrospector.getMembers = getMembers;
        }
    });
});
