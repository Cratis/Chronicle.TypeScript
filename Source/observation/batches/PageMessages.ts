// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventsToObserve, ReduceOperationMessage } from '@cratis/chronicle.contracts';
import type { DeliveredPartition } from './DeliveredPartition.js';

/**
 * Gets whether the kernel delivered a page of partitions. A kernel that does not know page delivery sends one partition
 * in the legacy fields, and cannot take deferrals or per-partition results.
 * @param message - The delivered message.
 * @returns True when the message is a page.
 */
export function isPage(message: EventsToObserve | ReduceOperationMessage): boolean {
    return (message.Partitions?.length ?? 0) > 0;
}

/**
 * Gets the partitions of a reactor delivery, treating a single-partition delivery as a page of one.
 * @param message - The {@link EventsToObserve} delivered.
 * @returns The {@link DeliveredPartition} instances.
 */
export function partitionsOfEvents(message: EventsToObserve): DeliveredPartition[] {
    return isPage(message)
        ? message.Partitions.map(partition => ({ partition: partition.Partition, events: partition.Events, initialState: '' }))
        : [{ partition: message.Partition, events: message.Events ?? [], initialState: '' }];
}

/**
 * Gets the partitions of a reducer delivery, treating a single-partition delivery as a page of one.
 * @param message - The {@link ReduceOperationMessage} delivered.
 * @returns The {@link DeliveredPartition} instances.
 */
export function partitionsOfOperation(message: ReduceOperationMessage): DeliveredPartition[] {
    return isPage(message)
        ? message.Partitions.map(partition => ({ partition: partition.Partition, events: partition.Events, initialState: partition.InitialState }))
        : [{ partition: message.Partition, events: message.Events ?? [], initialState: message.InitialState }];
}
