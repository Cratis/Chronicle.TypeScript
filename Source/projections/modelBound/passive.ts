// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

const METADATA_KEY = 'chronicle:projection:passive';

/**
 * Class decorator that marks a model-bound projection as passive.
 * A passive projection does not actively observe events and never writes to a materialized sink;
 * its read model is resolved on demand via immediate projection.
 * @param target - The class constructor.
 */
export function passive(target: Function): void {
    Reflect.defineMetadata(METADATA_KEY, true, target);
}

/**
 * Checks whether the given class is marked as passive.
 * @param target - The class constructor.
 * @returns True if the class is marked as passive; false otherwise.
 */
export function isPassive(target: Function): boolean {
    return Reflect.hasMetadata(METADATA_KEY, target);
}
