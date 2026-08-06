// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Defines an optional contract a `@reactor`/`@reducer`-decorated class instance can implement to
 * receive notifications when replay of a specific partition begins and ends.
 */
export interface ICanBeNotifiedWhenPartitionReplayed {
    /**
     * Called when replay of a partition begins.
     * @param partition - The partition being replayed.
     * @returns A promise that resolves when the callback has completed.
     */
    beginReplayPartition(partition: string): Promise<void>;

    /**
     * Called when replay of a partition ends.
     * @param partition - The partition that was replayed.
     * @returns A promise that resolves when the callback has completed.
     */
    endReplayPartition(partition: string): Promise<void>;
}
