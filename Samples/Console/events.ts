// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { eventType } from '@cratis/chronicle';

/**
 * An employee has been hired into the organization.
 * This event is the source of truth for all employee existence — if there is no
 * EmployeeHired event, the employee does not exist in the system.
 */
@eventType()
export class EmployeeHired {
    constructor(
        readonly firstName: string,
        readonly lastName: string,
        readonly title: string
    ) {}
}

/**
 * An employee's address has been set.
 */
@eventType()
export class EmployeeAddressSet {
    constructor(
        readonly address: string,
        readonly city: string,
        readonly zipCode: string,
        readonly country: string
    ) {}
}

/**
 * An employee has been promoted to a new title.
 */
@eventType()
export class EmployeePromoted {
    constructor(readonly newTitle: string) {}
}

/**
 * An employee has relocated to a new address.
 */
@eventType()
export class EmployeeMoved {
    constructor(
        readonly address: string,
        readonly city: string,
        readonly zipCode: string,
        readonly country: string
    ) {}
}
