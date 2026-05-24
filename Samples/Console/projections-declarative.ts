// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';
import { EmployeeHired, EmployeeAddressSet, EmployeePromoted, EmployeeMoved } from './events';

/** Read model shape for the declarative employee list projection artifact. */
@readModel()
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
            .from(EmployeeHired, fb => fb
                .set(m => m.firstName).to(e => e.firstName)
                .set(m => m.lastName).to(e => e.lastName)
                .set(m => m.title).to(e => e.title)
            )
            .from(EmployeeAddressSet, fb => fb
                .set(m => m.address).to(e => e.address)
                .set(m => m.city).to(e => e.city)
                .set(m => m.zipCode).to(e => e.zipCode)
                .set(m => m.country).to(e => e.country)
            )
            .from(EmployeePromoted, fb => fb
                .set(m => m.title).to(e => e.newTitle)
            )
            .from(EmployeeMoved, fb => fb
                .set(m => m.address).to(e => e.address)
                .set(m => m.city).to(e => e.city)
                .set(m => m.zipCode).to(e => e.zipCode)
                .set(m => m.country).to(e => e.country)
            );
    }
}

