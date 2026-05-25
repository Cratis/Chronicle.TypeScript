// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents an event paired with the event source identifier it belongs to.
 */
export interface EventForEventSourceId {
    /** The event source identifier for the event. */
    readonly eventSourceId: string;

    /** The event payload to append. */
    readonly event: object;
}
