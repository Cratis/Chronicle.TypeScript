// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { ReactorId } from './ReactorId';

/** Metadata key used to store reactor information on a class. */
const REACTOR_METADATA_KEY = 'chronicle:reactor';

/**
 * Metadata stored on a reactor class.
 */
export interface ReactorMetadata {
    /** The unique identifier for the reactor. */
    readonly id: ReactorId;

    /** The optional explicit event sequence identifier. */
    readonly eventSequenceId: string | undefined;
}

/**
 * TypeScript decorator that marks a class as a reactor and associates it with a unique
 * identifier. This is the TypeScript equivalent of the C# `[Reactor]` attribute.
 *
 * Reactors observe events from an event sequence and produce side effects.
 * Method dispatch is by convention: the type of the first parameter of each public method
 * determines which events it handles.
 *
 * @param id - The unique identifier for the reactor. Defaults to the class name if omitted.
 * @param eventSequenceId - Optional explicit event sequence identifier.
 * @returns A class decorator.
 *
 * @example
 * ```typescript
 * @reactor('my-notifier')
 * class ProjectRegisteredNotifier implements IReactor {
 *     async projectRegistered(event: ProjectRegistered, context: EventContext): Promise<void> {
 *         console.log(`Project '${event.name}' was registered.`);
 *     }
 * }
 * ```
 */
export function reactor(id: string = '', eventSequenceId?: string): ClassDecorator {
    return (target: object) => {
        const constructor = target as Function;
        const reactorId = new ReactorId(id || constructor.name);
        const metadata: ReactorMetadata = { id: reactorId, eventSequenceId };
        Reflect.defineMetadata(REACTOR_METADATA_KEY, metadata, target);
    };
}

/**
 * Gets the {@link ReactorMetadata} associated with a class decorated with {@link reactor}.
 * @param target - The class constructor to retrieve the metadata for.
 * @returns The associated ReactorMetadata, or undefined if not decorated.
 */
export function getReactorMetadata(target: Function): ReactorMetadata | undefined {
    return Reflect.getMetadata(REACTOR_METADATA_KEY, target);
}

/**
 * Checks whether a class has been decorated with {@link reactor}.
 * @param target - The class constructor to check.
 * @returns True if the class has a reactor decorator; false otherwise.
 */
export function isReactor(target: Function): boolean {
    return Reflect.hasMetadata(REACTOR_METADATA_KEY, target);
}
