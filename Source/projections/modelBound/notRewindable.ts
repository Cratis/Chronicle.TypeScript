// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

const METADATA_KEY = 'chronicle:projection:notRewindable';

/**
 * Class decorator that marks a model-bound projection as not rewindable.
 * A not-rewindable projection only processes new events; it cannot replay history.
 * @param target - The class constructor.
 */
export function notRewindable(target: Function): void {
    Reflect.defineMetadata(METADATA_KEY, true, target);
}

/**
 * Checks whether the given class is marked as not rewindable.
 * @param target - The class constructor.
 * @returns True if the class is marked as not rewindable; false otherwise.
 */
export function isNotRewindable(target: Function): boolean {
    return Reflect.hasMetadata(METADATA_KEY, target);
}
