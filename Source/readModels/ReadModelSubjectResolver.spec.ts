// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { subject } from '../compliance/subject';
import { ReadModelSubjectResolver } from './ReadModelSubjectResolver';

// Decorators are applied as plain function calls (rather than `@decorator` syntax) so these
// fixtures don't depend on the test runner's decorator-syntax support.

describe('ReadModelSubjectResolver', () => {
    describe('when the read model has a property decorated with @subject()', () => {
        class Employee {
            id = '';
            personId = '';
        }
        subject()(Employee.prototype, 'personId');

        it('should resolve to the decorated property value', () => {
            const instance = new Employee();
            instance.id = 'employee-1';
            instance.personId = 'person-42';

            expect(ReadModelSubjectResolver.resolveFrom(Employee, instance)).toBe('person-42');
        });

        it('should take precedence over the id property', () => {
            const instance = new Employee();
            instance.id = 'employee-1';
            instance.personId = 'person-42';

            expect(ReadModelSubjectResolver.resolveFrom(Employee, instance)).not.toBe('employee-1');
        });

        it('should fall back to id when the decorated property has no value', () => {
            const instance = new Employee();
            instance.id = 'employee-1';
            instance.personId = '';

            expect(ReadModelSubjectResolver.resolveFrom(Employee, instance)).toBe('employee-1');
        });
    });

    describe('when the read model has no property decorated with @subject()', () => {
        class Customer {
            id = '';
            name = '';
        }

        it('should fall back to the id property', () => {
            const instance = new Customer();
            instance.id = 'customer-7';

            expect(ReadModelSubjectResolver.resolveFrom(Customer, instance)).toBe('customer-7');
        });
    });

    describe('when the read model has neither a decorated property nor an id property', () => {
        class Anonymous {
            name = '';
        }

        it('should not resolve a subject', () => {
            const instance = new Anonymous();

            expect(ReadModelSubjectResolver.resolveFrom(Anonymous, instance)).toBeUndefined();
        });
    });

    describe('when the instance does not exist', () => {
        class Customer {
            id = '';
        }

        it('should not resolve a subject for null', () => {
            expect(ReadModelSubjectResolver.resolveFrom(Customer, null as unknown as Customer)).toBeUndefined();
        });

        it('should not resolve a subject for undefined', () => {
            expect(ReadModelSubjectResolver.resolveFrom(Customer, undefined as unknown as Customer)).toBeUndefined();
        });
    });
});
