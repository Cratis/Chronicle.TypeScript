// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IEventStore } from '@cratis/chronicle';
import { EmployeeHired, EmployeePromoted, EmployeeMoved } from './events';

/**
 * The detailed read model produced by the model-bound employee projection.
 */
export interface EmployeeDetail {
    readonly employeeId: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly title: string;
    readonly city: string;
    readonly hireDate: Date;
}

/**
 * Model-bound projection that builds an {@link EmployeeDetail} read model per employee.
 *
 * Model-bound projections are class-based: each method maps one event type to changes
 * on the read model. The method's first parameter type determines which events it
 * handles — the same convention used by reactors and reducers.
 *
 * Unlike declarative projections (which run server-side), model-bound projections are
 * evaluated client-side, giving full TypeScript control over the mapping logic.
 *
 * Note: The @projection decorator and client-side registration API are not yet available
 * in the TypeScript client. This sample previews the intended API shape.
 *
 * @example Future API usage:
 * ```typescript
 * @projection()
 * class EmployeeDetailProjection { ... }
 *
 * await store.projections.get(EmployeeDetailProjection, employeeId);
 * ```
 */
// @projection()   <-- decorator coming in a future release
export class EmployeeDetailProjection {
    /**
     * Creates the initial employee record when an employee is hired.
     * @param event - The EmployeeHired event.
     * @param context - The model being built; undefined for the first event.
     * @returns The initial {@link EmployeeDetail}.
     */
    employeeHired(event: EmployeeHired, context?: EmployeeDetail): EmployeeDetail {
        return {
            ...(context ?? {} as EmployeeDetail),
            firstName: event.firstName,
            lastName: event.lastName,
            title: event.title,
            hireDate: new Date()
        };
    }

    /**
     * Updates the employee's title when they are promoted.
     * @param event - The EmployeePromoted event.
     * @param context - The current read model state.
     * @returns The updated {@link EmployeeDetail}.
     */
    employeePromoted(event: EmployeePromoted, context?: EmployeeDetail): EmployeeDetail {
        return { ...(context ?? {} as EmployeeDetail), title: event.newTitle };
    }

    /**
     * Updates the employee's city when they relocate.
     * @param event - The EmployeeMoved event.
     * @param context - The current read model state.
     * @returns The updated {@link EmployeeDetail}.
     */
    employeeMoved(event: EmployeeMoved, context?: EmployeeDetail): EmployeeDetail {
        return { ...(context ?? {} as EmployeeDetail), city: event.newCity };
    }
}

/**
 * Demonstrates the model-bound projection pattern by applying events locally.
 *
 * When the client-side projection API is available, the Kernel will stream events
 * to this projection and maintain the read model automatically.
 *
 * @param store - The event store.
 */
export async function demonstrateModelBoundProjection(store: IEventStore): Promise<void> {
    console.log('  Demonstrating model-bound projection (local evaluation)...');

    const projection = new EmployeeDetailProjection();
    let state: EmployeeDetail | undefined;

    state = projection.employeeHired(new EmployeeHired('Alice', 'Johnson', 'Engineer'), state);
    state = projection.employeePromoted(new EmployeePromoted('Senior Engineer'), state);
    state = projection.employeeMoved(new EmployeeMoved('Oslo'), state);

    console.log(`  [Projection] Name    : ${state.firstName} ${state.lastName}`);
    console.log(`  [Projection] Title   : ${state.title}`);
    console.log(`  [Projection] City    : ${state.city}`);
    console.log(`  [Projection] Hired   : ${state.hireDate.toISOString()}`);
    void store;
}
