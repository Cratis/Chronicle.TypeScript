// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { eventType } from '@cratis/chronicle';

/** Represents an employee being hired into the organization. */
@eventType('aa7faa25-afc1-48d1-8558-716581c0e916', 1)
export class EmployeeHired {
    constructor(
        readonly firstName: string,
        readonly lastName: string,
        readonly title: string
    ) {}
}

/** Represents an employee receiving a promotion to a new title. */
@eventType('bb8fbb36-bfd2-49e5-b669-827692d1f027', 1)
export class EmployeePromoted {
    constructor(readonly newTitle: string) {}
}

/** Represents an employee relocating to a new city. */
@eventType('cc9fcc47-cfe3-4af6-c77a-938703e2f138', 1)
export class EmployeeMoved {
    constructor(readonly newCity: string) {}
}

/** Represents an employee leaving the organization. */
@eventType('dd0fdd58-dfe4-4bf7-d88b-049814f3f249', 1)
export class EmployeeLeft {
    constructor(readonly reason: string) {}
}
