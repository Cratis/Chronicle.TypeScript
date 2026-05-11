// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { fromEvent, Guid, readModel, setFrom } from '@cratis/chronicle';
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

    @setFrom(EmployeeHired)
    firstName = '';

    @setFrom(EmployeeHired)
    lastName = '';

    @setFrom(EmployeeHired)
    @setFrom(EmployeePromoted, 'newTitle')
    title = '';

    @setFrom(EmployeeAddressSet)
    @setFrom(EmployeeMoved)
    address = '';

    @setFrom(EmployeeAddressSet)
    @setFrom(EmployeeMoved)
    city = '';

    @setFrom(EmployeeAddressSet)
    @setFrom(EmployeeMoved)
    zipCode = '';

    @setFrom(EmployeeAddressSet)
    @setFrom(EmployeeMoved)
    country = '';
}

