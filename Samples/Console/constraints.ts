// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { constraint, IConstraint, IConstraintBuilder } from '@cratis/chronicle';
import { EmployeeEmailSet, EmployeeHired } from './events';

/**
 * Prevents the same employee from being hired more than once per event source.
 *
 * Constraints are auto-discovered from classes decorated with {@link constraint} that
 * implement {@link IConstraint}. The event store calls {@link IConstraint.define} during
 * connection and registers the resulting constraint with the Chronicle Kernel, which then
 * evaluates it before an event is appended. A violated constraint prevents the append and
 * returns a constraint violation in the {@link AppendResult}, giving callers structured
 * feedback without exceptions.
 *
 * `uniqueFor` builds a unique-event-type constraint: a given event type may only appear
 * once per event source identifier, which is ideal for "created" style events.
 */
@constraint()
export class UniqueEmployeeHire implements IConstraint {
    /** @inheritdoc */
    define(builder: IConstraintBuilder): void {
        builder.uniqueFor(EmployeeHired, 'An employee can only be hired once.');
    }
}

/**
 * Ensures no two employees share the same email address.
 *
 * Unlike {@link UniqueEmployeeHire} (a unique-event-type constraint, which the Kernel
 * enforces with a query), a `unique` constraint is backed by a dedicated index collection
 * in the namespace database. The Kernel maintains the index as matching events are appended,
 * so attempting to set an email already owned by a different employee is rejected with a
 * constraint violation. `ignoreCasing` makes the comparison case-insensitive.
 */
@constraint()
export class UniqueEmployeeEmail implements IConstraint {
    /** @inheritdoc */
    define(builder: IConstraintBuilder): void {
        builder.unique(unique => unique
            .on(EmployeeEmailSet, _ => _.email)
            .ignoreCasing()
            .withMessage('That email address is already in use by another employee.'));
    }
}
