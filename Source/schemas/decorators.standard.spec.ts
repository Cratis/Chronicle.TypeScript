// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ConceptAs, field, Guid, typeKey } from '@cratis/fundamentals';
import { describe, expect, it } from 'vitest';
import { eventType, getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import { getReadModelMetadata, readModel } from '../readModels/readModel.js';
import { getSetFromMetadata, setFrom } from '../projections/modelBound/setFrom.js';
import { getProjectionMetadata, projection } from '../projections/declarative/projection.js';
import { getReducerMetadata, reducer } from '../reducers/reducer.js';
import { getReactorMetadata, reactor } from '../reactors/reactor.js';
import { DecoratorType, TypeDiscoverer } from '../types/index.js';
import { pii } from '../compliance/pii.js';
import { subject, getSubjectPropertyName } from '../compliance/subject.js';
import { encrypted } from '../confidentiality/encrypted.js';

class Code extends ConceptAs<string> {
    static readonly valueType = String;
}

class Quantity extends ConceptAs<number> {
    static readonly valueType = Number;
}

class Address {
    @field(String) city!: string;
}

@eventType('standard-fixture')
class StandardEvent {
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

@readModel('standard-model')
class StandardModel {
    @field(Number)
    @setFrom(StandardEvent)
    count!: number;

    @field(String)
    @subject()
    ownerId!: string;

    @field(String)
    @pii('personal')
    contact!: string;

    @field(String)
    @encrypted()
    secret!: string;
}

class ParentMapping {
    @setFrom(StandardEvent) value!: string;
}

class ChildMapping extends ParentMapping {
    @setFrom(StandardEvent, 'name') value = '';
}

@eventType('empty-schema')
class MissingMembers {}

@eventType('missing-field')
class MissingField {
    constructor(readonly value: string) {}
}

class UnspecifiedQuantity extends ConceptAs<number> {}

@eventType('untyped-concept')
class UntypedConceptEvent {
    @field(UnspecifiedQuantity) quantity!: UnspecifiedQuantity;
}

class ForeignConcept {
    static readonly [typeKey] = 'ConceptAs';
    static readonly valueType = Number;
}

class ForeignGuid {
    static readonly [typeKey] = 'Guid';
}

@eventType('foreign-types')
class ForeignTypes {
    @field(ForeignConcept) amount!: ForeignConcept;
    @field(ForeignGuid) id!: ForeignGuid;
}

@projection('standard-projection', StandardModel)
class StandardProjection {}

@reducer('standard-reducer', undefined, StandardModel)
class StandardReducer {}

@reactor('standard-reactor')
class StandardReactor {}

export const standardSchema = getEventTypeMetadata(StandardEvent)!.schema;

// No instance is constructed: @field's standard metadata must be available after class evaluation.
describe('standard decorator syntax', () => {
    it('registers the event and read model with their declared member types', () => {
        expect(getEventTypeMetadata(StandardEvent)?.eventType.id.value).toBe('standard-fixture');
        expect(getReadModelMetadata(StandardModel)?.schema.properties?.count.type).toBe('number');
        expect(getSetFromMetadata(StandardModel.prototype, 'count')).toEqual([{ eventType: StandardEvent, eventPropertyName: undefined }]);
        expect(getSubjectPropertyName(StandardModel)).toBe('ownerId');
        expect(getReadModelMetadata(StandardModel)?.schema.properties?.contact.compliance).toEqual([{ metadataType: 'PII', details: 'personal' }]);
        expect(getReadModelMetadata(StandardModel)?.schema.properties?.secret.security).toEqual([{ metadataType: 'EncryptedSubject', details: '' }]);
        expect(standardSchema.properties).toMatchObject({
            name: { type: 'string' },
            age: { type: 'number' },
            active: { type: 'boolean' },
            id: { type: 'string', format: 'guid' },
            occurred: { type: 'string', format: 'date-time' },
            codes: { type: 'array', items: { type: 'string' } },
            address: { type: 'object', properties: { city: { type: 'string' } } },
            code: { type: 'string' },
            quantity: { type: 'number' }
        });
    });

    it('keeps inherited property metadata copy-on-write', () => {
        expect(getSetFromMetadata(ParentMapping.prototype, 'value')).toHaveLength(1);
        expect(getSetFromMetadata(ChildMapping.prototype, 'value')).toHaveLength(2);
        expect(getSetFromMetadata(ParentMapping.prototype, 'value')).toHaveLength(1);
    });

    it('registers projections, reducers, and reactors', () => {
        expect(getProjectionMetadata(StandardProjection)?.id.value).toBe('standard-projection');
        expect(getReducerMetadata(StandardReducer)?.id.value).toBe('standard-reducer');
        expect(getReactorMetadata(StandardReactor)?.id.value).toBe('standard-reactor');
        expect(TypeDiscoverer.default.getTypeByDecoratorTypeAndName(DecoratorType.Projection, 'standard-projection')).toBe(StandardProjection);
        expect(TypeDiscoverer.default.getTypeByDecoratorTypeAndName(DecoratorType.Reducer, 'standard-reducer')).toBe(StandardReducer);
        expect(TypeDiscoverer.default.getTypeByDecoratorTypeAndName(DecoratorType.Reactor, 'standard-reactor')).toBe(StandardReactor);
    });

    it('rejects protected event source identifiers in standard mode', () => {
        expect(() => {
            class BadPII {
                @pii() eventSourceId!: string;
            }
            void BadPII;
        }).toThrow(/cannot be applied to 'eventSourceId'/);
        expect(() => {
            class BadEncrypted {
                @encrypted() eventSourceId!: string;
            }
            void BadEncrypted;
        }).toThrow(/cannot be applied to 'eventSourceId'/);
    });

    it('rejects missing member metadata instead of registering an empty schema', () => {
        expect(() => getEventTypeMetadata(MissingMembers)!.schema).toThrow(/Cannot determine the members of MissingMembers/);
        expect(() => getEventTypeMetadata(MissingField)!.schema).toThrow(/Cannot determine the type of MissingField.value/);
    });

    it('rejects a concept without a declared primitive in standard mode', () => {
        expect(() => getEventTypeMetadata(UntypedConceptEvent)!.schema).toThrow(/Cannot determine the primitive type of concept UnspecifiedQuantity/);
    });

    it('recognizes Fundamentals types from another package copy by their type key', () => {
        expect(getEventTypeMetadata(ForeignTypes)!.schema.properties).toMatchObject({
            amount: { type: 'number' },
            id: { type: 'string', format: 'guid' }
        });
    });
});
