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
        readonly firstName: string = '',
        readonly lastName: string = '',
        readonly title: string = ''
    ) {}
}

/**
 * An employee's address has been set.
 */
@eventType()
export class EmployeeAddressSet {
    constructor(
        readonly address: string = '',
        readonly city: string = '',
        readonly zipCode: string = '',
        readonly country: string = ''
    ) {}
}

/**
 * An employee has been promoted to a new title.
 */
@eventType()
export class EmployeePromoted {
    constructor(readonly newTitle: string = '') {}
}

/**
 * An employee's email address has been set.
 */
@eventType()
export class EmployeeEmailSet {
    constructor(readonly email: string = '') {}
}

/**
 * An employee has relocated to a new address.
 */
@eventType()
export class EmployeeMoved {
    constructor(
        readonly address: string = '',
        readonly city: string = '',
        readonly zipCode: string = '',
        readonly country: string = ''
    ) {}
}

/**
 * A promotion has been recorded in the HR audit trail.
 *
 * Appended by {@link HrNotificationReactor} as a side effect of an `EmployeePromoted`
 * event — not to the promoted employee's own stream, but to a separate shared
 * "hr-audit-log" event source, demonstrating that a reactor's returned side-effect
 * events can target any event source rather than only the one that triggered it.
 */
@eventType()
export class PromotionRecorded {
    constructor(
        readonly employeeId: string = '',
        readonly newTitle: string = ''
    ) {}
}
