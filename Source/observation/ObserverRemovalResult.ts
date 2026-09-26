// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ObserverRemovalOutcome } from './ObserverRemovalOutcome.js';

/**
 * Represents what came back from asking an event store to remove an observer.
 */
export interface ObserverRemovalResult {
    /** What happened. */
    readonly outcome: ObserverRemovalOutcome;

    /**
     * The namespace whose observer blocked the removal, when {@link outcome} is a refusal; empty otherwise.
     * The guard runs across every namespace in the event store, so a refusal that does not say where leaves
     * nowhere to look.
     */
    readonly blockingNamespace: string;

    /** Whether the observer was actually removed. */
    readonly isRemoved: boolean;
}
