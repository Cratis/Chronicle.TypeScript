// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { Constructor } from '@cratis/fundamentals';
import { describe, expect, it, vi } from 'vitest';
import type { IClientArtifactsProvider } from '../artifacts';
import type { ChronicleConnection } from '../connection';
import { subject } from '../compliance/subject';
import { fromEvent } from '../projections/modelBound/fromEvent';
import { readModel } from './readModel';
import { ReadModels } from './ReadModels';

// Decorators are applied as plain function calls (rather than `@decorator` syntax) so these
// fixtures don't depend on the test runner's decorator-syntax support.

class SomeEvent {
    value = '';
}

function createReadModels(readModelType: Constructor, releaseResponse: Record<string, unknown> = { HasError: false, Payload: '{}' }) {
    const release = vi.fn().mockResolvedValue(releaseResponse);
    const connection = {
        compliance: { release }
    } as unknown as ChronicleConnection;

    const clientArtifacts = {
        eventTypes: [],
        readModels: [readModelType],
        reactors: [],
        reducers: [],
        seeders: [],
        constraints: [],
        projections: [],
        webhooks: [],
        eventTypeMigrations: []
    } as IClientArtifactsProvider;

    const readModels = new ReadModels('test-store', 'test-namespace', connection, clientArtifacts, 'default-sink');
    return { readModels, release };
}

describe('ReadModels', () => {
    describe('when releasing a read model with a property decorated with @subject()', () => {
        class Employee {
            id = '';
            personId = '';
        }
        subject()(Employee.prototype, 'personId');
        fromEvent(SomeEvent)(Employee);
        readModel('EmployeeWithSubject')(Employee);

        it('should release using the decorated property as the subject', async () => {
            const { readModels, release } = createReadModels(Employee);
            const instance = new Employee();
            instance.id = 'employee-1';
            instance.personId = 'person-42';

            await readModels.release(Employee, instance);

            expect(release).toHaveBeenCalledWith(expect.objectContaining({ Subject: 'person-42' }));
        });
    });

    describe('when releasing a read model without @subject() but with an id property', () => {
        class Customer {
            id = '';
        }
        fromEvent(SomeEvent)(Customer);
        readModel('CustomerWithIdOnly')(Customer);

        it('should fall back to the id property as the subject, unchanged from today', async () => {
            const { readModels, release } = createReadModels(Customer);
            const instance = new Customer();
            instance.id = 'customer-7';

            await readModels.release(Customer, instance);

            expect(release).toHaveBeenCalledWith(expect.objectContaining({ Subject: 'customer-7' }));
        });
    });

    describe('when releasing a read model with neither @subject() nor an id property', () => {
        class Anonymous {
            name = '';
        }
        fromEvent(SomeEvent)(Anonymous);
        readModel('AnonymousReadModel')(Anonymous);

        it('should throw, same as today', async () => {
            const { readModels } = createReadModels(Anonymous);
            const instance = new Anonymous();

            await expect(readModels.release(Anonymous, instance)).rejects.toThrow(/subject/);
        });
    });

    describe('when releasing many read model instances', () => {
        class Customer {
            id = '';
        }
        fromEvent(SomeEvent)(Customer);
        readModel('CustomerForReleaseMany')(Customer);

        it('should release each instance using its own resolved subject', async () => {
            const { readModels, release } = createReadModels(Customer);
            const first = new Customer();
            first.id = 'customer-1';
            const second = new Customer();
            second.id = 'customer-2';

            await readModels.releaseMany(Customer, [first, second]);

            expect(release).toHaveBeenCalledWith(expect.objectContaining({ Subject: 'customer-1' }));
            expect(release).toHaveBeenCalledWith(expect.objectContaining({ Subject: 'customer-2' }));
        });
    });
});
