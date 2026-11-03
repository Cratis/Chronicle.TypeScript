// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** The observer a {@link BatchContext} is created for. */
export type BatchContextObserver = {
    /** The identifier of the observer. */
    readonly observerId: string;
    /** The event store the observer is registered with. */
    readonly eventStore: string;
    /** The namespace the observer is registered in. */
    readonly namespace: string;
    /** The event sequence the observer observes. */
    readonly eventSequenceId: string;
    /** Aborted when the observation stops. */
    readonly signal: AbortSignal;
};
