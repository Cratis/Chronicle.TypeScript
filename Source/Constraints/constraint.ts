// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { Constructor } from '@cratis/fundamentals';
import { ConstraintId } from './ConstraintId';
import { DecoratorType, TypeDiscoverer } from '../types';

/** Metadata key used to store constraint information on a class. */
const CONSTRAINT_METADATA_KEY = 'chronicle:constraint';

/**
 * Metadata stored on a constraint class.
 */
export interface ConstraintMetadata {
    /** The unique identifier for the constraint. */
    readonly id: ConstraintId;
}

/**
 * TypeScript decorator that marks a class as an event constraint.
 * @param id - The unique identifier for the constraint. Defaults to the class name if omitted.
 * @returns A class decorator.
 */
export function constraint(id: string = ''): ClassDecorator {
    return (target: object) => {
        const constructor = target as Function;
        const constraintId = new ConstraintId(id || constructor.name);
        const metadata: ConstraintMetadata = { id: constraintId };
        Reflect.defineMetadata(CONSTRAINT_METADATA_KEY, metadata, target);
        TypeDiscoverer.default.register(
            DecoratorType.Constraint,
            constructor as Constructor,
            constraintId.value
        );
    };
}

/**
 * Gets the {@link ConstraintMetadata} associated with a class decorated with {@link constraint}.
 * @param target - The class constructor to retrieve metadata for.
 * @returns The associated metadata, or undefined if not decorated.
 */
export function getConstraintMetadata(target: Function): ConstraintMetadata | undefined {
    return Reflect.getMetadata(CONSTRAINT_METADATA_KEY, target);
}

/**
 * Checks whether a class has been decorated with {@link constraint}.
 * @param target - The class constructor to check.
 * @returns True if the class has a constraint decorator; false otherwise.
 */
export function isConstraint(target: Function): boolean {
    return Reflect.hasMetadata(CONSTRAINT_METADATA_KEY, target);
}
