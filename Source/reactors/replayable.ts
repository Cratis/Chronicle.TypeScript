// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

const METADATA_KEY = 'chronicle:reactor:replayable';

/**
 * Opts a reactor into kernel replays. Unlike .NET, TypeScript reactors have
 * historically registered as non-replayable, so replay requires an explicit opt-in.
 * @returns A class decorator for legacy and standard TypeScript decorators.
 */
export function replayable(): ClassDecorator & ((value: Function, context: ClassDecoratorContext) => void) {
    return (target: object) => {
        Reflect.defineMetadata(METADATA_KEY, true, target);
    };
}

/** Whether this reactor explicitly opts into replay. */
export function isReplayable(target: Function): boolean {
    return Reflect.getOwnMetadata(METADATA_KEY, target) === true;
}
