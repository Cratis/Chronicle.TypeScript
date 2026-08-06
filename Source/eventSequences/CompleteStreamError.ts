// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents the errors that can occur when completing a stream on an {@link IEventSequence}.
 */
export enum CompleteStreamError {
    /**
     * The stream was already completed previously. Completing a stream is idempotent at the storage
     * level, but the caller is informed via this error so it can distinguish a freshly completed
     * stream from one that was already in the completed state.
     */
    AlreadyCompleted = 'AlreadyCompleted',

    /**
     * The default stream (the default event stream type paired with the default event stream identifier)
     * cannot be completed, since doing so would block all future appends to the event sequence.
     */
    DefaultStreamCannotBeCompleted = 'DefaultStreamCannotBeCompleted'
}
