// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventsToObserve, ReduceOperationMessage } from '@cratis/chronicle.contracts';
import { BatchContext } from './BatchContext.js';
import type { BatchContextObserver } from './BatchContextObserver.js';
import type { DeliveredPartition } from './DeliveredPartition.js';
import { toObservationOrigin } from './ObservationOrigin.js';
import { isPage } from './PageMessages.js';

/**
 * Creates the {@link BatchContext} describing a delivered page.
 * @param observer - The observer the page is delivered to.
 * @param message - The delivered message.
 * @param partitions - The partitions of the delivery.
 * @returns The {@link BatchContext}.
 */
export function createBatchContext(observer: BatchContextObserver, message: EventsToObserve | ReduceOperationMessage,
    partitions: readonly DeliveredPartition[]): BatchContext {
    const sequenceNumbers = partitions.flatMap(partition => partition.events.map(event => event.Context!.SequenceNumber));
    const deliverWithin = Number(message.DeliverWithinMilliseconds ?? 0n);
    return new BatchContext({
        ...observer,
        origin: toObservationOrigin(message.Origin),
        partitions: partitions.map(partition => partition.partition),
        eventCount: sequenceNumbers.length,
        firstSequenceNumber: sequenceNumbers.length > 0 ? sequenceNumbers.reduce((min, value) => value < min ? value : min) : undefined,
        lastSequenceNumber: sequenceNumbers.length > 0 ? sequenceNumbers.reduce((max, value) => value > max ? value : max) : undefined,
        deadline: deliverWithin > 0 ? new Date(Date.now() + deliverWithin) : undefined,
        canDefer: isPage(message)
    });
}
