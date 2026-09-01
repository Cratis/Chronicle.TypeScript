// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { ConceptAs, field } from '@cratis/fundamentals';
import { describe, expect, it } from 'vitest';
import { pii } from '../compliance/pii';
import { eventType, getEventTypeJsonSchemaFor } from '../events/eventTypeDecorator';
import { getReadModelMetadata, readModel } from '../readModels/readModel';
import { JsonSchema } from './JsonSchema';

// Decorators are applied as plain function calls (rather than `@decorator` syntax) so these
// fixtures don't depend on the test runner's decorator-syntax support - they exercise exactly
// the same decorator functions and metadata storage that `@decorator` syntax would invoke.
//
// Order matters here in a way it would not for a real `@decorator` stack: class decorators
// apply bottom-to-top, so `pii()` must run - and therefore be called - before `readModel()`/
// `eventType()` so the compliance metadata already exists when the schema is generated.

function schemaFor(target: Function): JsonSchema {
    return getReadModelMetadata(target)!.schema;
}

describe('JsonSchemaGenerator', () => {
    describe('when a class is marked @pii() at the class level', () => {
        class PersonProfile {
            name = '';
            email = '';
        }
        pii()(PersonProfile);
        readModel()(PersonProfile);

        const schema = schemaFor(PersonProfile);

        it('should mark every one of its own properties as PII', () => {
            expect(schema.properties!.name.compliance).toEqual([{ metadataType: 'PII', details: '' }]);
            expect(schema.properties!.email.compliance).toEqual([{ metadataType: 'PII', details: '' }]);
        });
    });

    describe('when only a single property is marked @pii()', () => {
        class Contact {
            name = '';
            ssn = '';
        }
        pii('Social security number')(Contact.prototype, 'ssn');
        readModel()(Contact);

        const schema = schemaFor(Contact);

        it('should mark the decorated property as PII', () => {
            expect(schema.properties!.ssn.compliance).toEqual([{ metadataType: 'PII', details: 'Social security number' }]);
        });

        it('should leave the other property without compliance metadata', () => {
            expect(schema.properties!.name.compliance).toBeUndefined();
        });
    });

    describe('when a property is typed as a ConceptAs<T> marked @pii()', () => {
        class EmailAddress extends ConceptAs<string> {
            constructor(value: string) {
                super(value);
            }
        }
        pii('Email address')(EmailAddress);

        describe('on a read model', () => {
            class Customer {
                email: EmailAddress = new EmailAddress('');
            }
            readModel()(Customer);

            const schema = schemaFor(Customer);

            it('should mark the concept-typed property as PII', () => {
                expect(schema.properties!.email.compliance).toEqual([{ metadataType: 'PII', details: 'Email address' }]);
            });

            it('should describe the concept as its underlying primitive type', () => {
                expect(schema.properties!.email.type).toBe('string');
            });
        });

        describe('on an event', () => {
            class CustomerRegistered {
                email: EmailAddress = new EmailAddress('');
            }
            eventType()(CustomerRegistered);

            const schema = getEventTypeJsonSchemaFor(CustomerRegistered);

            it('should mark the concept-typed property as PII', () => {
                expect(schema.properties!.email.compliance).toEqual([{ metadataType: 'PII', details: 'Email address' }]);
            });
        });
    });

    describe('when a property-level @pii() combines with a class-level @pii()', () => {
        class Employee {
            name = '';
            email = '';
        }
        pii()(Employee.prototype, 'name');
        pii('Every field on this record is personal')(Employee);
        readModel()(Employee);

        const schema = schemaFor(Employee);

        it('should not duplicate the compliance entry on the property carrying both markers', () => {
            expect(schema.properties!.name.compliance).toHaveLength(1);
        });

        it('should keep the property-level details when both sources apply', () => {
            expect(schema.properties!.name.compliance).toEqual([{ metadataType: 'PII', details: '' }]);
        });

        it('should still mark the property that only carries the class-level marker', () => {
            expect(schema.properties!.email.compliance).toEqual([{ metadataType: 'PII', details: 'Every field on this record is personal' }]);
        });
    });

    describe('when a property typed as a nested composite value object is marked @pii()', () => {
        class ContactDetails {
            phone = '';
            fax = '';
        }
        class Vendor {
            contact: ContactDetails = new ContactDetails();
        }
        pii('Vendor contact information')(Vendor.prototype, 'contact');
        readModel()(Vendor);

        const schema = schemaFor(Vendor);

        it('should push the compliance metadata down onto every leaf property', () => {
            expect(schema.properties!.contact.properties!.phone.compliance).toEqual([{ metadataType: 'PII', details: 'Vendor contact information' }]);
            expect(schema.properties!.contact.properties!.fax.compliance).toEqual([{ metadataType: 'PII', details: 'Vendor contact information' }]);
        });

        it('should not leave compliance metadata on the container node itself', () => {
            expect(schema.properties!.contact.compliance).toBeUndefined();
        });
    });

    describe('when an array element is a ConceptAs<T> marked @pii()', () => {
        class RequirementCode extends ConceptAs<string> {
            constructor(value: string) {
                super(value);
            }
        }
        pii('Sensitive requirement code')(RequirementCode);

        class Contract {
            codes: RequirementCode[] = [];
        }
        field(Array, { enumerable: true, genericArguments: [RequirementCode] })(Contract.prototype, 'codes');
        readModel()(Contract);

        const schema = schemaFor(Contract);

        it('should describe the property as an array', () => {
            expect(schema.properties!.codes.type).toBe('array');
        });

        it('should carry the element concept compliance metadata onto the item schema', () => {
            expect(schema.properties!.codes.items!.compliance).toEqual([{ metadataType: 'PII', details: 'Sensitive requirement code' }]);
        });

        it('should describe the item as the concept underlying primitive type', () => {
            expect(schema.properties!.codes.items!.type).toBe('string');
        });

        it('should not leave coarse compliance metadata on the array container itself', () => {
            expect(schema.properties!.codes.compliance).toBeUndefined();
        });
    });

    describe('when an array element is not a ConceptAs<T>', () => {
        class PlainItem {
            value = '';
        }
        class Basket {
            items: PlainItem[] = [];
        }
        field(Array, { enumerable: true, genericArguments: [PlainItem] })(Basket.prototype, 'items');
        readModel()(Basket);

        const schema = schemaFor(Basket);

        it('should fall back to an opaque object item schema', () => {
            expect(schema.properties!.items.items).toEqual({ type: 'object' });
        });
    });
});
