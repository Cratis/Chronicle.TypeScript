// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { BatchContextObserver } from './BatchContextObserver.js';
import type { ObservationOrigin } from './ObservationOrigin.js';

/** The values a {@link BatchContext} is created from. See {@link BatchContext} for what each value means. */
export type BatchContextValues = BatchContextObserver & {
    readonly origin: ObservationOrigin;
    readonly partitions: readonly string[];
    readonly eventCount: number;
    readonly firstSequenceNumber: bigint | undefined;
    readonly lastSequenceNumber: bigint | undefined;
    readonly deadline: Date | undefined;
    readonly canDefer: boolean;
};
