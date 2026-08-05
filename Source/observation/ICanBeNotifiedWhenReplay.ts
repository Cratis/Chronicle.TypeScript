// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Defines an optional contract a `@reactor`/`@reducer`-decorated class instance can implement to
 * receive notifications when a full replay of its observation begins and ends.
 */
export interface ICanBeNotifiedWhenReplay {
    /**
     * Called when a replay begins.
     * @returns A promise that resolves when the callback has completed.
     */
    beginReplay(): Promise<void>;

    /**
     * Called when a replay ends.
     * @returns A promise that resolves when the callback has completed.
     */
    endReplay(): Promise<void>;
}
