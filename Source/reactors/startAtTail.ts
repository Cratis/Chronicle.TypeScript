// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

const METADATA_KEY = 'chronicle:reactor:startAtTail';

/**
 * A new reactor normally catches up from the beginning of the event sequence, so one whose handlers have side
 * effects acts on every historical event the moment it is deployed. `@onceOnly()` does not prevent that, because it
 * only excludes replay.
 *
 * Marks a reactor class so that the first time Chronicle sees it, it begins at the tail of the event sequence and
 * observes only what is appended from then on. A reactor that already has a position keeps it, so the marker is safe
 * to leave in place. Renaming the reactor or moving it changes its default id and makes it a new reactor, which
 * starts at the tail again, unless an explicit id is given to `@reactor()`. An explicit replay still replays from the
 * beginning. Both the Chronicle server and the client must support it; a server that predates it ignores the request.
 * The marker is not inherited by subclasses.
 * @returns A class decorator for legacy and standard TypeScript decorators.
 */
export function startAtTail(): ClassDecorator & ((value: Function, context: ClassDecoratorContext) => void) {
    return (target: object, context?: ClassDecoratorContext) => {
        if (typeof context === 'object' && context.kind !== 'class') {
            throw new TypeError('Start-at-tail can only decorate a reactor class.');
        }
        Reflect.defineMetadata(METADATA_KEY, true, target);
    };
}

/** Whether this reactor class is marked to start at the tail (without inheriting the marker). */
export function isStartAtTail(target: Function): boolean {
    return Reflect.getOwnMetadata(METADATA_KEY, target) === true;
}
