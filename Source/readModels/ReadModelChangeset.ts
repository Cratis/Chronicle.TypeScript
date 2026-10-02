// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ReadModelChangeType } from './ReadModelChangeType.js';
import type { ReadModelChangeContext } from './ReadModelChangeContext.js';

/**
 * Represents a change observed for a read model.
 */
export interface ReadModelChangeset<TReadModel> {
    /** The namespace the change belongs to. */
    readonly namespace: string;

    /** The read model key. */
    readonly key: string;

    /** The current read model state. */
    readonly readModel: TReadModel;

    /** Whether the read model was removed. */
    readonly removed: boolean;

    /** The kind of change. Optional for compatibility with user-created changesets. */
    readonly changeType?: ReadModelChangeType;

    /** Triggering event metadata supplied by the kernel, not a complete event context. */
    readonly changeContext?: ReadModelChangeContext;
}
