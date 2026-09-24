// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { encrypted, getEncryptedMetadata, getTypeEncryptedMetadata, hasEncryptedMetadata, isEncrypted } from './encrypted.js';
import { EncryptionScope } from './EncryptionScope.js';
import { EncryptedNotSupportedOnEventSourceId } from './EncryptedNotSupportedOnEventSourceId.js';

// Decorators are applied as plain function calls (rather than `@decorator` syntax) so these
// fixtures don't depend on the test runner's decorator-syntax support.

describe('encrypted', () => {
    describe('when applied to the eventSourceId property', () => {
        class SomeEvent {
            eventSourceId = '';
        }

        it('should throw EncryptedNotSupportedOnEventSourceId', () => {
            expect(() => encrypted()(SomeEvent.prototype, 'eventSourceId')).toThrow(EncryptedNotSupportedOnEventSourceId);
        });

        it('should describe why the property cannot be encrypted', () => {
            expect(() => encrypted()(SomeEvent.prototype, 'eventSourceId')).toThrow(/event source identifier/);
        });
    });

    describe('when applied to any other property with no explicit scope', () => {
        class SomeEvent {
            eventSourceId = '';
            apiKey = '';
        }
        encrypted()(SomeEvent.prototype, 'apiKey');

        it('should not throw', () => {
            expect(() => encrypted()(SomeEvent.prototype, 'apiKey')).not.toThrow();
        });

        it('should default the scope to Subject', () => {
            expect(getEncryptedMetadata(SomeEvent.prototype, 'apiKey')!.metadataType.value).toBe('EncryptedSubject');
        });

        it('should default details to an empty string', () => {
            expect(getEncryptedMetadata(SomeEvent.prototype, 'apiKey')!.details).toBe('');
        });

        it('should report the property as having encrypted metadata', () => {
            expect(hasEncryptedMetadata(SomeEvent.prototype, 'apiKey')).toBe(true);
        });
    });

    describe('when applied with EncryptionScope.Namespace and details', () => {
        class Configuration {
            webhookSecret = '';
        }
        encrypted(EncryptionScope.Namespace, 'Shared per namespace')(Configuration.prototype, 'webhookSecret');

        it('should resolve to EncryptedNamespace', () => {
            expect(getEncryptedMetadata(Configuration.prototype, 'webhookSecret')!.metadataType.value).toBe('EncryptedNamespace');
        });

        it('should carry the details', () => {
            expect(getEncryptedMetadata(Configuration.prototype, 'webhookSecret')!.details).toBe('Shared per namespace');
        });
    });

    describe('when applied with EncryptionScope.Global', () => {
        class License {
            token = '';
        }
        encrypted(EncryptionScope.Global)(License.prototype, 'token');

        it('should resolve to EncryptedGlobal', () => {
            expect(getEncryptedMetadata(License.prototype, 'token')!.metadataType.value).toBe('EncryptedGlobal');
        });
    });

    describe('when applied at the class level', () => {
        class PartnerCredentials {
            apiKey = '';
        }
        encrypted(EncryptionScope.Subject, 'Every field is a secret')(PartnerCredentials);

        it('should report the type as encrypted', () => {
            expect(isEncrypted(PartnerCredentials)).toBe(true);
        });

        it('should carry the scope and details on the type metadata', () => {
            const metadata = getTypeEncryptedMetadata(PartnerCredentials)!;
            expect(metadata.metadataType.value).toBe('EncryptedSubject');
            expect(metadata.details).toBe('Every field is a secret');
        });
    });

    describe('when a property has not been decorated', () => {
        class Plain {
            value = '';
        }

        it('should report no encrypted metadata', () => {
            expect(hasEncryptedMetadata(Plain.prototype, 'value')).toBe(false);
            expect(getEncryptedMetadata(Plain.prototype, 'value')).toBeUndefined();
        });
    });
});
