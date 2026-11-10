// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** An event an import rejected. */
export interface ImportRejection {
    /** The position of the event in the import, counted from zero across every chunk. */
    readonly index: number;

    /** The identifier of the event's type. */
    readonly eventType: string;

    /** Why the event was rejected. */
    readonly reasons: readonly string[];
}
