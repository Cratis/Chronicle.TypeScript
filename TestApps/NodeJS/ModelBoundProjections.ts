// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import {
    modelBound,
    fromEvent,
    setFrom,
    setFromContext,
    increment,
    notRewindable,
    removedWith
} from '@cratis/chronicle';
import { EmployeeHired, EmployeeLeft, EmployeeMoved, EmployeePromoted } from './Events';

/**
 * Model-bound projection that maps employee domain events directly onto properties via decorators.
 * Uses property-level decorators to keep projection logic co-located with the read model shape.
 */
@modelBound('employees-model-bound')
@notRewindable
@removedWith(EmployeeLeft)
export class EmployeesModelBoundProjection {
    @setFrom(EmployeeHired)
    firstName: string = '';

    @setFrom(EmployeeHired)
    lastName: string = '';

    @setFrom(EmployeeHired)
    @setFrom(EmployeePromoted, 'newTitle')
    title: string = '';

    @setFrom(EmployeeMoved, 'newCity')
    city: string = '';

    @increment(EmployeePromoted)
    promotionCount: number = 0;

    @setFromContext(EmployeeHired, 'occurred')
    lastUpdated: string = '';
}

/**
 * Model-bound projection that maps employee on-call status from hire events.
 * Demonstrates a second, distinct model-bound projection with its own read model shape.
 */
@fromEvent(EmployeeHired)
@modelBound('employees-on-call-model-bound')
export class EmployeesOnCallModelBoundProjection {
    @setFrom(EmployeeHired)
    firstName: string = '';

    @setFrom(EmployeeHired)
    lastName: string = '';

    @setFromContext(EmployeeHired, 'occurred')
    onCallSince: string = '';
}
