// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readModel } from '@cratis/chronicle';

/** Read model representing the current state of an employee, used by the declarative projection. */
@readModel('employee-read-model')
export class EmployeeReadModel {
    constructor(
        readonly firstName: string,
        readonly lastName: string,
        readonly title: string,
        readonly city: string,
        readonly promotionCount: number
    ) {}
}

/** Read model representing the current on-call status of an employee, used by the model-bound projection. */
@readModel('employee-on-call-read-model')
export class EmployeeOnCallReadModel {
    constructor(
        readonly firstName: string,
        readonly lastName: string,
        readonly onCallSince: string
    ) {}
}
