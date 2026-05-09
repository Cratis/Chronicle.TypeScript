// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents a single entry in the causation chain of an event.
 */
export interface CausationEntry {
    /** The type identifier of the causing operation. */
    readonly type: string;

    /** The properties associated with the causation entry. */
    readonly properties: Readonly<Record<string, string>>;
}
