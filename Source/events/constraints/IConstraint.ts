// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IConstraintBuilder } from './IConstraintBuilder';

/**
 * Defines a constraint for events.
 * Implement this interface on any class decorated with {@link constraint} to describe
 * the constraint rules that the Chronicle server should enforce.
 * Matches the C# IConstraint contract.
 */
export interface IConstraint {
    /**
     * Defines the constraint rules.
     * @param builder - The {@link IConstraintBuilder} used to configure constraint rules.
     */
    define(builder: IConstraintBuilder): void;
}
