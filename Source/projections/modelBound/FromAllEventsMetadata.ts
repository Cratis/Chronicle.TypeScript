// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Metadata stored by the fromAllEvents property decorator. */
export interface FromAllEventsMetadata {
    /** The event property name to read the value from. */
    readonly property?: string;
    /** The event context property name to read the value from. */
    readonly contextProperty?: string;
}
