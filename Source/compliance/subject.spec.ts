// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { getSubjectPropertyName, hasSubjectMetadata, subject } from './subject';

// Decorators are applied as plain function calls (rather than `@decorator` syntax) so these
// fixtures don't depend on the test runner's decorator-syntax support.

describe('subject', () => {
    describe('when applied to a property', () => {
        class SomeReadModel {
            personId = '';
            name = '';
        }
        subject()(SomeReadModel.prototype, 'personId');

        it('should mark the decorated property with subject metadata', () => {
            expect(hasSubjectMetadata(SomeReadModel.prototype, 'personId')).toBe(true);
        });

        it('should leave other properties without subject metadata', () => {
            expect(hasSubjectMetadata(SomeReadModel.prototype, 'name')).toBe(false);
        });

        it('should record the decorated property name on the declaring type', () => {
            expect(getSubjectPropertyName(SomeReadModel)).toBe('personId');
        });
    });

    describe('when no property is decorated', () => {
        class PlainReadModel {
            id = '';
        }

        it('should not record a subject property on the declaring type', () => {
            expect(getSubjectPropertyName(PlainReadModel)).toBeUndefined();
        });

        it('should report no subject metadata for its properties', () => {
            expect(hasSubjectMetadata(PlainReadModel.prototype, 'id')).toBe(false);
        });
    });
});
