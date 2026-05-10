// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ConstraintType, RegisterConstraintsRequest } from '@cratis/chronicle.contracts';
import { getEventTypeFor } from '@cratis/chronicle';
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
