// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import { reducer } from '@cratis/chronicle';
import { EmployeeHired, EmployeePromoted, EmployeeMoved } from './events';

const logger = diag.createComponentLogger({ namespace: 'chronicle-test-console/EmployeeStateReducer' });

/**
 * The read model produced by the {@link EmployeeStateReducer}.
 */
export interface EmployeeState {
    readonly employeeId: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly title: string;
    readonly city: string;
}

/**
 * Folds employee lifecycle events into the {@link EmployeeState} read model.
 *
 * Reducers are the event-sourcing mechanism for building per-entity read models.
 * Each handler method receives the event and the current state (or undefined for the
 * first event), and returns the next state. The runtime invokes handlers in event
 * sequence order, so the final state reflects the full history.
 *
 * Key rules:
 * - Return a new state object rather than mutating the existing one.
 * - The state parameter is undefined for the very first event for a given event source.
 * - Reducers are invoked on the client side; they receive events via streaming from the Kernel.
 */
@reducer()
export class EmployeeStateReducer {
    /**
     * Establishes the initial state for an employee from their hire event.
     * @param event - The EmployeeHired event.
     * @returns The initial employee state.
     */
    async employeeHired(event: EmployeeHired): Promise<EmployeeState> {
        logger.info('Handling EmployeeHired', { firstName: event.firstName, lastName: event.lastName });
        return {
            employeeId: '',
            firstName: event.firstName,
            lastName: event.lastName,
            title: event.title,
            city: ''
        };
    }

    /**
     * Updates the employee's title after a promotion.
     * @param event - The EmployeePromoted event.
     * @param state - The current employee state.
     * @returns The updated employee state.
     */
    async employeePromoted(event: EmployeePromoted, state?: EmployeeState): Promise<EmployeeState> {
        logger.info('Handling EmployeePromoted', { newTitle: event.newTitle, currentState: state });
        return { ...(state ?? {} as EmployeeState), title: event.newTitle };
    }

    /**
     * Updates the employee's city after a relocation.
     * @param event - The EmployeeMoved event.
     * @param state - The current employee state.
     * @returns The updated employee state.
     */
    async employeeMoved(event: EmployeeMoved, state?: EmployeeState): Promise<EmployeeState> {
        logger.info('Handling EmployeeMoved', { newCity: event.newCity, currentState: state });
        return { ...(state ?? {} as EmployeeState), city: event.newCity };
    }
}

