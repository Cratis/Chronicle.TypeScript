// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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
}
