// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { Constructor } from '@cratis/fundamentals';
import { ReducerId } from './ReducerId';
import { DecoratorType, TypeDiscoverer } from '../types';

/** Metadata key used to store reducer information on a class. */
const REDUCER_METADATA_KEY = 'chronicle:reducer';

/**
 * Metadata stored on a reducer class.
 */
export interface ReducerMetadata {
    /** The unique identifier for the reducer. */
    readonly id: ReducerId;

    /** The optional explicit event sequence identifier. */
    readonly eventSequenceId: string | undefined;
}

/**
 * TypeScript decorator that marks a class as a reducer and associates it with a unique
 * identifier. This is the TypeScript equivalent of the C# `[Reducer]` attribute.
 *
 * Reducers observe events from an event sequence and fold them into a read model.
 * Each handler method receives the event, the current state (or undefined), and an
 * optional context, and returns the new state.
 *
 * @param id - The unique identifier for the reducer. Defaults to the class name if omitted.
 * @param eventSequenceId - Optional explicit event sequence identifier.
 * @returns A class decorator.
 *
 * @example
 * ```typescript
 * @reducer('employee-state')
 * class EmployeeReducer {
 *     async employeeHired(event: EmployeeHired, state?: EmployeeState): Promise<EmployeeState> {
 *         return { ...state, name: `${event.firstName} ${event.lastName}` };
 *     }
 * }
 * ```
 */
export function reducer(id: string = '', eventSequenceId?: string): ClassDecorator {
    return (target: object) => {
        const constructor = target as Function;
        const reducerId = new ReducerId(id || constructor.name);
        const metadata: ReducerMetadata = { id: reducerId, eventSequenceId };
        Reflect.defineMetadata(REDUCER_METADATA_KEY, metadata, target);
        TypeDiscoverer.default.register(
            DecoratorType.Reducer,
            constructor as Constructor,
            reducerId.value
        );
    };
}

/**
 * Gets the {@link ReducerMetadata} associated with a class decorated with {@link reducer}.
 * @param target - The class constructor to retrieve the metadata for.
 * @returns The associated ReducerMetadata, or undefined if not decorated.
 */
export function getReducerMetadata(target: Function): ReducerMetadata | undefined {
    return Reflect.getMetadata(REDUCER_METADATA_KEY, target);
}

/**
 * Checks whether a class has been decorated with {@link reducer}.
 * @param target - The class constructor to check.
 * @returns True if the class has a reducer decorator; false otherwise.
 */
export function isReducer(target: Function): boolean {
    return Reflect.hasMetadata(REDUCER_METADATA_KEY, target);
}
