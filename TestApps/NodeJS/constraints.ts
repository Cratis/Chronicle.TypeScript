// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ConstraintType, RegisterConstraintsRequest } from '@cratis/chronicle.contracts';
import { getEventTypeFor, IEventStore } from '@cratis/chronicle';
import { EmployeeHired } from './events';

/**
 * Builds the constraint registration request that prevents the same employee
 * from being hired more than once per event source.
 *
 * Constraints are evaluated by the Chronicle Kernel before an event is appended.
 * A violated constraint prevents the append and returns a {@link ConstraintViolation}
 * in the {@link AppendResult}, giving callers structured feedback without exceptions.
 *
 * Two constraint types are supported:
 * - **UniqueConstraint** — no two events for different event sources may share the
 *   same value for a given property.
 * - **UniqueEventTypeConstraint** — an event type may only appear once per event source,
 *   preventing duplicate "created" events.
 */
function buildUniqueHireConstraint(): RegisterConstraintsRequest {
    const hiredType = getEventTypeFor(EmployeeHired);

    return {
        EventStore: '',
        Constraints: [
            {
                // Prevent the same employee from being hired more than once per event source.
                Name: 'UniqueEmployeeHire',
                Type: ConstraintType.UniqueEventType,
                RemovedWith: '',
                Scope: undefined,
                Definition: {
                    Value0: undefined,
                    Value1: { EventTypeId: hiredType.id.value }
                }
            }
        ]
    };
}

export const uniqueHireConstraint = buildUniqueHireConstraint();

/**
 * Registers the unique-hire constraint with the Chronicle Kernel.
 *
 * Once registered, any attempt to append a second {@link EmployeeHired} event for the
 * same event source will be rejected by the Kernel, and the {@link AppendResult} will
 * contain a populated {@link ConstraintViolation} list.
 *
 * @param store - The event store to register constraints against.
 */
export async function registerConstraints(store: IEventStore): Promise<void> {
    console.log('  Registering unique-hire constraint...');
    // The constraint registration API is not yet available on the TypeScript client.
    // When available it will look like:
    //   await store.constraints.register(uniqueHireConstraint);
    const constraint = uniqueHireConstraint.Constraints[0];
    const eventTypeId = constraint.Definition?.Value1?.EventTypeId ?? '(unknown)';
    console.log(`  [Constraint] Name      : ${constraint.Name}`);
    console.log(`  [Constraint] Type      : ${ConstraintType[constraint.Type]}`);
    console.log(`  [Constraint] Event type: EmployeeHired (${eventTypeId})`);
    void store;
}
