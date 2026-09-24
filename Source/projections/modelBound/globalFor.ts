// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { Constructor } from '@cratis/fundamentals';
import { DecoratorType, TypeDiscoverer } from '../../types/index.js';

/** Metadata stored by the globalFor class decorator. */
export interface GlobalForMetadata {
    /** The type anchoring the logical identity this shared handler applies its mappings to. */
    readonly identity: Function;
}

const METADATA_KEY = 'chronicle:projection:globalFor';

/**
 * Class decorator that declares a shared handler class whose mappings apply to every variant
 * of the given identity, without repeating them on each variant type. A mapping that targets
 * a member some variant lacks is a declaration error, not a silently skipped mapping.
 *
 * A class decorated only with globalFor is never registered as a projection on its own - it is
 * merged into every variant of its identity before those variants are registered.
 * @param identity - The type anchoring the logical identity this handler's mappings apply to.
 * @returns A class decorator.
 */
export function globalFor(identity: Function): ClassDecorator {
    return (target: object) => {
        const constructor = target as Constructor;
        Reflect.defineMetadata(METADATA_KEY, { identity }, target);
        TypeDiscoverer.default.register(DecoratorType.GlobalForHandler, constructor, constructor.name);
    };
}

/**
 * Retrieves globalFor metadata stored on the given class constructor.
 * @param target - The class constructor.
 * @returns The globalFor metadata, or undefined if the class is not a shared handler.
 */
export function getGlobalForMetadata(target: Function): GlobalForMetadata | undefined {
    return Reflect.getMetadata(METADATA_KEY, target);
}
