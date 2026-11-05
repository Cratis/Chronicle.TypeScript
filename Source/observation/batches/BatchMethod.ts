// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ObservedEventType } from './ObservedEventType.js';

/** A method of an observer that takes an {@link EventBatch}. */
export interface BatchMethod {
    /** The name of the method. */
    readonly methodName: string;

    /** The event types the method observes, by event type identifier. */
    readonly eventTypes: ReadonlyMap<string, ObservedEventType>;
}
