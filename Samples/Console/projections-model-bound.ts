// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { count, fromEvent, Guid, readModel, setFrom } from '@cratis/chronicle';
import { EmployeeHired, EmployeeAddressSet, EmployeePromoted, EmployeeMoved } from './events';

/**
 * Model-bound projection artifact discovered by the TypeScript client.
 */
@readModel()
@fromEvent(EmployeeHired)
@fromEvent(EmployeeAddressSet)
@fromEvent(EmployeePromoted)
@fromEvent(EmployeeMoved)
export class EmployeeDetails {
    id: Guid = Guid.empty;

    firstName = '';
    lastName = '';

    @setFrom(EmployeePromoted, 'newTitle')
    title = '';

    /**
     * Counts how many times this employee has been promoted.
     *
     * `@count` is a model-bound arithmetic decorator: it increments this property by one
     * every time an `EmployeePromoted` event is projected for this employee, translated
     * to the Kernel's `$count` wire expression — the same mechanism `@increment`/
     * `@decrement`/`@addFrom`/`@subtractFrom` use for their own operators.
     */
    @count(EmployeePromoted)
    promotionCount = 0;

    address = '';
    city = '';
    zipCode = '';
    country = '';
}

