// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ConceptAs, field, Guid } from '@cratis/fundamentals';
import { describe, expect, it } from 'vitest';
import { eventType, getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import { JsonSchemaGenerator } from './JsonSchemaGenerator.js';
import { expectedProperties } from './decorators.expected.fixture.js';
import { getProjectionMetadata, projection } from '../projections/declarative/projection.js';
import { getReducerMetadata, reducer } from '../reducers/reducer.js';
import { getReactorMetadata, reactor } from '../reactors/reactor.js';

class Code extends ConceptAs<string> {
    static readonly valueType = String;
}

class Quantity extends ConceptAs<number> {
    static readonly valueType = Number;
}

class Address {
    @field(String) city!: string;
}

@eventType('legacy-fixture')
class LegacyEvent {
    @field(String) name!: string;
    @field(Number) age!: number;
    @field(Boolean) active!: boolean;
    @field(Guid) id!: Guid;
    @field(Date) occurred!: Date;
    @field(Array, { genericArguments: [Code] }) codes!: Code[];
    @field(Address) address!: Address;
    @field(Code) code!: Code;
    @field(Quantity) quantity!: Quantity;
}

class LegacyModel {
    @field(Number) count!: number;
}

@projection('legacy-projection', LegacyModel)
class LegacyProjection {}

@reducer('legacy-reducer', undefined, LegacyModel)
class LegacyReducer {}

@reactor('legacy-reactor')
class LegacyReactor {}

describe('legacy decorator syntax', () => {
    it('registers the same schemas as standard decorators', () => {
        expect(getEventTypeMetadata(LegacyEvent)?.eventType.id.value).toBe('legacy-fixture');
        expect(JsonSchemaGenerator.generate(LegacyModel).properties?.count.type).toBe('number');
        expect(getEventTypeMetadata(LegacyEvent)?.schema.properties).toEqual(expectedProperties);
        expect(getEventTypeMetadata(LegacyEvent)?.schema.required).toEqual(Object.keys(expectedProperties));
        expect(getProjectionMetadata(LegacyProjection)?.id.value).toBe('legacy-projection');
        expect(getReducerMetadata(LegacyReducer)?.id.value).toBe('legacy-reducer');
        expect(getReactorMetadata(LegacyReactor)?.id.value).toBe('legacy-reactor');
    });
});
