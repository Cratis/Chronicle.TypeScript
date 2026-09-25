// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents what happened when an event store was asked to remove an observer.
 */
export enum ObserverRemovalOutcome {
    /** The observer and everything keyed to it was removed. */
    Removed = 'Removed',

    /** No observer with that identifier is registered in the event store, so there was nothing to remove. */
    ObserverNotFound = 'ObserverNotFound',

    /** The observer is running in at least one namespace, so it is still a live observer and cannot be removed. */
    ObserverActive = 'ObserverActive',

    /** A client is still subscribed to the observer in at least one namespace, so its declaring code is still present. */
    ObserverSubscribed = 'ObserverSubscribed'
}
