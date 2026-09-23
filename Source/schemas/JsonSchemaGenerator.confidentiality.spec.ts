// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { ConceptAs, field } from '@cratis/fundamentals';
import { describe, expect, it } from 'vitest';
import { pii } from '../compliance/pii';
import { encrypted } from '../confidentiality/encrypted';
import { EncryptionScope } from '../confidentiality/EncryptionScope';
import { PIIAndEncryptedCombinedNotSupported } from '../confidentiality/PIIAndEncryptedCombinedNotSupported';
import { getReadModelMetadata, readModel } from '../readModels/readModel';
import { JsonSchema } from './JsonSchema';

// See JsonSchemaGenerator.spec.ts for why decorators are applied as plain function calls here
// rather than `@decorator` syntax, and why order matters.

function schemaFor(target: Function): JsonSchema {
    return getReadModelMetadata(target)!.schema;
}

describe('JsonSchemaGenerator - security metadata', () => {
    describe('when a class is marked @encrypted() at the class level', () => {
        class PartnerCredentials {
            apiKey = '';
            webhookSecret = '';
        }
        encrypted()(PartnerCredentials);

        readModel()(PartnerCredentials);
        const schema = schemaFor(PartnerCredentials);

        it('should mark every one of its own properties as EncryptedSubject', () => {
            expect(schema.properties!.apiKey.security).toEqual([{ metadataType: 'EncryptedSubject', details: '' }]);
            expect(schema.properties!.webhookSecret.security).toEqual([{ metadataType: 'EncryptedSubject', details: '' }]);
        });

        it('should not write anything to the compliance key', () => {
            expect(schema.properties!.apiKey.compliance).toBeUndefined();
            expect(schema.properties!.webhookSecret.compliance).toBeUndefined();
        });
    });

    describe('when only a single property is marked @encrypted()', () => {
        class Integration {
            apiKey = '';
            name = '';
        }
        encrypted(EncryptionScope.Subject, 'Partner API key')(Integration.prototype, 'apiKey');
        readModel()(Integration);
        const schema = schemaFor(Integration);

        it('should mark the decorated property as EncryptedSubject', () => {
            expect(schema.properties!.apiKey.security).toEqual([{ metadataType: 'EncryptedSubject', details: 'Partner API key' }]);
        });

        it('should leave the other property without security metadata', () => {
            expect(schema.properties!.name.security).toBeUndefined();
        });
    });

    describe.each([
        [EncryptionScope.Subject, 'EncryptedSubject'],
        [EncryptionScope.Namespace, 'EncryptedNamespace'],
        [EncryptionScope.Global, 'EncryptedGlobal']
    ])('when a property is marked @encrypted() with scope %s', (scope, expectedMetadataType) => {
        class Secret {
            value = '';
        }
        encrypted(scope)(Secret.prototype, 'value');
        readModel()(Secret);
        const schema = schemaFor(Secret);

        it(`should resolve to metadataType ${expectedMetadataType}`, () => {
            expect(schema.properties!.value.security).toEqual([{ metadataType: expectedMetadataType, details: '' }]);
        });
    });

    describe('when a property is typed as a ConceptAs<T> marked @encrypted()', () => {
        class ApiKey extends ConceptAs<string> {
            constructor(value: string) {
                super(value);
            }
        }
        encrypted(EncryptionScope.Namespace, 'Shared namespace key')(ApiKey);

        class Configuration {
            key: ApiKey = new ApiKey('');
        }
        readModel()(Configuration);
        const schema = schemaFor(Configuration);

        it('should mark the concept-typed property as EncryptedNamespace', () => {
            expect(schema.properties!.key.security).toEqual([{ metadataType: 'EncryptedNamespace', details: 'Shared namespace key' }]);
        });
    });

    describe('when a property typed as a nested composite value object is marked @encrypted()', () => {
        class ContactDetails {
            phone = '';
            fax = '';
        }
        class Vendor {
            contact: ContactDetails = new ContactDetails();
        }
        encrypted(EncryptionScope.Subject, 'Vendor contact information')(Vendor.prototype, 'contact');
        readModel()(Vendor);
        const schema = schemaFor(Vendor);

        it('should push the security metadata down onto every leaf property', () => {
            expect(schema.properties!.contact.properties!.phone.security).toEqual([{ metadataType: 'EncryptedSubject', details: 'Vendor contact information' }]);
            expect(schema.properties!.contact.properties!.fax.security).toEqual([{ metadataType: 'EncryptedSubject', details: 'Vendor contact information' }]);
        });

        it('should not leave security metadata on the container node itself', () => {
            expect(schema.properties!.contact.security).toBeUndefined();
        });
    });

    describe('when an array element is a ConceptAs<T> marked @encrypted()', () => {
        class Token extends ConceptAs<string> {
            constructor(value: string) {
                super(value);
            }
        }
        encrypted(EncryptionScope.Subject, 'Rotating token')(Token);

        class Session {
            tokens: Token[] = [];
        }
        field(Array, { enumerable: true, genericArguments: [Token] })(Session.prototype, 'tokens');
        readModel()(Session);
        const schema = schemaFor(Session);

        it('should carry the element concept security metadata onto the item schema', () => {
            expect(schema.properties!.tokens.items!.security).toEqual([{ metadataType: 'EncryptedSubject', details: 'Rotating token' }]);
        });

        it('should not leave coarse security metadata on the array container itself', () => {
            expect(schema.properties!.tokens.security).toBeUndefined();
        });
    });

    describe('when a property is marked both @pii() and @encrypted()', () => {
        class ConflictedValue {
            value = '';
        }
        pii()(ConflictedValue.prototype, 'value');
        encrypted()(ConflictedValue.prototype, 'value');

        it('should throw PIIAndEncryptedCombinedNotSupported when generating the schema', () => {
            expect(() => { readModel()(ConflictedValue); }).toThrow(PIIAndEncryptedCombinedNotSupported);
        });
    });

    describe('when a class-level @pii() combines with a property-level @encrypted() on the same property', () => {
        class MixedClass {
            value = '';
        }
        pii()(MixedClass);
        encrypted()(MixedClass.prototype, 'value');

        it('should throw PIIAndEncryptedCombinedNotSupported when generating the schema', () => {
            expect(() => { readModel()(MixedClass); }).toThrow(PIIAndEncryptedCombinedNotSupported);
        });
    });

    describe('when a class carries only @pii() properties alongside a class that carries only @encrypted() properties', () => {
        class OnlyPii {
            ssn = '';
        }
        pii()(OnlyPii.prototype, 'ssn');
        readModel()(OnlyPii);

        class OnlyEncrypted {
            apiKey = '';
        }
        encrypted()(OnlyEncrypted.prototype, 'apiKey');
        readModel()(OnlyEncrypted);

        it('should not throw for either type', () => {
            expect(() => schemaFor(OnlyPii)).not.toThrow();
            expect(() => schemaFor(OnlyEncrypted)).not.toThrow();
        });

        it('should keep compliance and security metadata on separate schema keys', () => {
            const piiSchema = schemaFor(OnlyPii);
            const encryptedSchema = schemaFor(OnlyEncrypted);
            expect(piiSchema.properties!.ssn.compliance).toEqual([{ metadataType: 'PII', details: '' }]);
            expect(piiSchema.properties!.ssn.security).toBeUndefined();
            expect(encryptedSchema.properties!.apiKey.security).toEqual([{ metadataType: 'EncryptedSubject', details: '' }]);
            expect(encryptedSchema.properties!.apiKey.compliance).toBeUndefined();
        });
    });
});
