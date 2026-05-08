// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { Constructor } from '@cratis/fundamentals';
import { ProjectionId } from './ProjectionId';
import { DecoratorType, TypeDiscoverer } from '../types';

/** Metadata key used to store model-bound projection information on a class. */
const MODEL_BOUND_PROJECTION_METADATA_KEY = 'chronicle:modelBoundProjection';

/**
 * Metadata stored on a model-bound projection class.
 */
export interface ModelBoundProjectionMetadata {
    /** The unique identifier for the projection. */
    readonly id: ProjectionId;

    /** The optional explicit event sequence identifier. */
    readonly eventSequenceId: string | undefined;
}

/**
 * TypeScript decorator that marks a class as a model-bound projection.
 * @param id - The unique identifier for the projection. Defaults to the class name if omitted.
 * @param eventSequenceId - Optional explicit event sequence identifier.
 * @returns A class decorator.
 */
export function modelBoundProjection(id: string = '', eventSequenceId?: string): ClassDecorator {
    return (target: object) => {
        const constructor = target as Function;
        const projectionId = new ProjectionId(id || constructor.name);
        const metadata: ModelBoundProjectionMetadata = { id: projectionId, eventSequenceId };
        Reflect.defineMetadata(MODEL_BOUND_PROJECTION_METADATA_KEY, metadata, target);
        TypeDiscoverer.default.register(
            DecoratorType.ModelBoundProjection,
            constructor as Constructor,
            projectionId.value
        );
    };
}

/**
 * Gets the {@link ModelBoundProjectionMetadata} associated with a class decorated with {@link modelBoundProjection}.
 * @param target - The class constructor to retrieve metadata for.
 * @returns The associated metadata, or undefined if not decorated.
 */
export function getModelBoundProjectionMetadata(target: Function): ModelBoundProjectionMetadata | undefined {
    return Reflect.getMetadata(MODEL_BOUND_PROJECTION_METADATA_KEY, target);
}

/**
 * Checks whether a class has been decorated with {@link modelBoundProjection}.
 * @param target - The class constructor to check.
 * @returns True if the class has a model-bound projection decorator; false otherwise.
 */
export function isModelBoundProjection(target: Function): boolean {
    return Reflect.hasMetadata(MODEL_BOUND_PROJECTION_METADATA_KEY, target);
}
