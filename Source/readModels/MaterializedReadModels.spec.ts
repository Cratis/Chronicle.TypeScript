// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { describe, expect, it, vi } from 'vitest';
import type { ChronicleConnection } from '../connection';
import { pii } from '../compliance/pii';
import { subject } from '../compliance/subject';
import { readModel } from './readModel';
import { MaterializedReadModels } from './MaterializedReadModels';

// Decorators are applied as plain function calls (rather than `@decorator` syntax) so these
// fixtures don't depend on the test runner's decorator-syntax support.

function createMaterializedReadModels(instancesJson: string[], releaseResponse: Record<string, unknown> = { HasError: false, Payload: '{}' }) {
    const release = vi.fn().mockResolvedValue(releaseResponse);
    const getInstances = vi.fn().mockResolvedValue({ Instances: instancesJson });
    const connection = {
        compliance: { release },
        materializedReadModels: { getInstances }
    } as unknown as ChronicleConnection;

    const readModels = new MaterializedReadModels('test-store', 'test-namespace', connection);
    return { readModels, release };
}

describe('MaterializedReadModels', () => {
    describe('when a read model has a property decorated with @subject()', () => {
        class Employee {
            id = '';
            personId = '';
            ssn = '';
        }
        field(String)(Employee.prototype, 'id');
        field(String)(Employee.prototype, 'personId');
        field(String)(Employee.prototype, 'ssn');
        pii()(Employee.prototype, 'ssn');
        subject()(Employee.prototype, 'personId');
        readModel('EmployeeWithSubjectMaterialized')(Employee);

        it('should release using the decorated property as the subject', async () => {
            const json = JSON.stringify({ id: 'employee-1', personId: 'person-42', ssn: '123-45-6789' });
            const { readModels, release } = createMaterializedReadModels([json]);

            await readModels.getInstances(Employee);

            expect(release).toHaveBeenCalledWith(expect.objectContaining({ Subject: 'person-42' }));
        });
    });

    describe('when a read model has no property decorated with @subject() but has an id property', () => {
        class Customer {
            id = '';
            ssn = '';
        }
        field(String)(Customer.prototype, 'id');
        field(String)(Customer.prototype, 'ssn');
        pii()(Customer.prototype, 'ssn');
        readModel('CustomerWithIdOnlyMaterialized')(Customer);

        it('should fall back to the id property as the subject, unchanged from today', async () => {
            const json = JSON.stringify({ id: 'customer-7', ssn: '987-65-4321' });
            const { readModels, release } = createMaterializedReadModels([json]);

            await readModels.getInstances(Customer);

            expect(release).toHaveBeenCalledWith(expect.objectContaining({ Subject: 'customer-7' }));
        });
    });

    describe('when a read model has neither a decorated property nor an id property', () => {
        class Anonymous {
            ssn = '';
        }
        field(String)(Anonymous.prototype, 'ssn');
        pii()(Anonymous.prototype, 'ssn');
        readModel('AnonymousMaterialized')(Anonymous);

        it('should not call release, unchanged from today', async () => {
            const json = JSON.stringify({ ssn: '000-00-0000' });
            const { readModels, release } = createMaterializedReadModels([json]);

            await readModels.getInstances(Anonymous);

            expect(release).not.toHaveBeenCalled();
        });

        it('should return the instance unreleased', async () => {
            const json = JSON.stringify({ ssn: '000-00-0000' });
            const { readModels } = createMaterializedReadModels([json]);

            const [instance] = await readModels.getInstances(Anonymous);

            expect(instance.ssn).toBe('000-00-0000');
        });
    });
});
