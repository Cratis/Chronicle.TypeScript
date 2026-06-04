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

    firstName = '';
    lastName = '';

    @setFrom(EmployeePromoted, 'newTitle')
    title = '';

    address = '';
    city = '';
    zipCode = '';
    country = '';
}

