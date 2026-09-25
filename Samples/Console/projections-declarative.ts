// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { EmployeeHired, EmployeeAddressSet, EmployeePromoted, EmployeeMoved } from './events.js';

/** Read model shape for the declarative employee list projection artifact. */
export class Employee {
    id: Guid = Guid.empty;
    firstName: string = '';
    lastName: string = '';
    title: string = '';
    address: string = '';
    city: string = '';
    zipCode: string = '';
    country: string = '';
}

/**
 * Declarative projection artifact discovered by the TypeScript client.
 */
@projection('', Employee)
export class EmployeeListProjection implements IProjectionFor<Employee> {
    /** @inheritdoc */
    define(builder: IProjectionBuilderFor<Employee>): void {
        builder
            .from(EmployeeHired)
            .from(EmployeeAddressSet)
            .from(EmployeePromoted, fb => fb
                .set(m => m.title).to(e => e.newTitle)
            )
            .from(EmployeeMoved);
    }
}

