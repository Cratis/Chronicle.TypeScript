// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { constraint, IConstraint, IConstraintBuilder } from '@cratis/chronicle';
import { EmployeeHired, EmployeeLeft } from './Events';

/**
 * Constraint that enforces unique employee names across all hire events.
 * Demonstrates the IConstraint pattern with a builder-based definition.
 */
@constraint('unique-employee-name')
export class UniqueEmployeeNameConstraint implements IConstraint {
    /** @inheritdoc */
    define(builder: IConstraintBuilder): void {
        builder
            .perEventSourceType()
            .unique(unique =>
                unique
                    .on<EmployeeHired>(e => e.firstName, e => e.lastName)
                    .ignoreCasing()
                    .removedWith(EmployeeLeft)
                    .withMessage('An employee with that name already exists.')
            );
    }
}
