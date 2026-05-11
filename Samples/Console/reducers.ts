// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import { readModel, reducer } from '@cratis/chronicle';
import { EmployeeHired, EmployeeAddressSet, EmployeePromoted, EmployeeMoved } from './events';

const logger = diag.createComponentLogger({ namespace: 'chronicle-test-console/EmployeeStateReducer' });

/**
 * The read model produced by the {@link EmployeeStateReducer}.
 */
@readModel()
export class EmployeeState {
    id: string = '';
    firstName: string = '';
    lastName: string = '';
    title: string = '';
    address: string = '';
    city: string = '';
    zipCode: string = '';
    country: string = '';
}

/**
 * Folds employee lifecycle events into the {@link EmployeeState} read model.
 */
@reducer('', undefined, EmployeeState)
export class EmployeeStateReducer {
    async employeeHired(event: EmployeeHired): Promise<EmployeeState> {
        logger.info('Handling EmployeeHired', { firstName: event.firstName, lastName: event.lastName });
        return Object.assign(new EmployeeState(), {
            firstName: event.firstName,
            lastName: event.lastName,
            title: event.title
        });
    }

    async employeeAddressSet(event: EmployeeAddressSet, state?: EmployeeState): Promise<EmployeeState> {
        logger.info('Handling EmployeeAddressSet', { city: event.city });
        return Object.assign(new EmployeeState(), state ?? {}, {
            address: event.address,
            city: event.city,
            zipCode: event.zipCode,
            country: event.country
        });
    }

    async employeePromoted(event: EmployeePromoted, state?: EmployeeState): Promise<EmployeeState> {
        logger.info('Handling EmployeePromoted', { newTitle: event.newTitle });
        return Object.assign(new EmployeeState(), state ?? {}, { title: event.newTitle });
    }

    async employeeMoved(event: EmployeeMoved, state?: EmployeeState): Promise<EmployeeState> {
        logger.info('Handling EmployeeMoved', { city: event.city });
        return Object.assign(new EmployeeState(), state ?? {}, {
            address: event.address,
            city: event.city,
            zipCode: event.zipCode,
            country: event.country
        });
    }
}

