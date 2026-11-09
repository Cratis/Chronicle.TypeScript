// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Error thrown when a dictionary key does not resolve to a property path on the event. */
export class InvalidDictionaryKey extends Error {
    /**
     * Creates an error for an unusable dictionary key path.
     * @param path - The path the key accessor resolved to.
     */
    constructor(readonly path: string) {
        super(`Invalid dictionary key '${path}'. The key accessor has to select a property on the event, for example 'e => e.category'.`);
        this.name = 'InvalidDictionaryKey';
    }
}
