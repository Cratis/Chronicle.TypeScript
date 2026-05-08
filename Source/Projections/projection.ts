// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { Constructor } from '@cratis/fundamentals';
import { ProjectionId } from './ProjectionId';
import { DecoratorType, TypeDiscoverer } from '../types';

/** Metadata key used to store declarative projection information on a class. */
const PROJECTION_METADATA_KEY = 'chronicle:projection';

/**
 * Metadata stored on a declarative projection class.
 */
export interface ProjectionMetadata {
    /** The unique identifier for the projection. */
    readonly id: ProjectionId;

    /** The optional explicit event sequence identifier. */
    readonly eventSequenceId: string | undefined;
}

/**
 * TypeScript decorator that marks a class as a declarative projection.
 * @param id - The unique identifier for the projection. Defaults to the class name if omitted.
 * @param eventSequenceId - Optional explicit event sequence identifier.
 * @returns A class decorator.
 */
export function projection(id: string = '', eventSequenceId?: string): ClassDecorator {
    return (target: object) => {
        const constructor = target as Function;
        const projectionId = new ProjectionId(id || constructor.name);
        const metadata: ProjectionMetadata = { id: projectionId, eventSequenceId };
        Reflect.defineMetadata(PROJECTION_METADATA_KEY, metadata, target);
        TypeDiscoverer.default.register(
            DecoratorType.Projection,
            constructor as Constructor,
            projectionId.value
        );
    };
}

/**
 * Gets the {@link ProjectionMetadata} associated with a class decorated with {@link projection}.
 * @param target - The class constructor to retrieve metadata for.
 * @returns The associated metadata, or undefined if not decorated.
 */
export function getProjectionMetadata(target: Function): ProjectionMetadata | undefined {
    return Reflect.getMetadata(PROJECTION_METADATA_KEY, target);
}

/**
 * Checks whether a class has been decorated with {@link projection}.
 * @param target - The class constructor to check.
 * @returns True if the class has a projection decorator; false otherwise.
 */
export function isProjection(target: Function): boolean {
    return Reflect.hasMetadata(PROJECTION_METADATA_KEY, target);
}
