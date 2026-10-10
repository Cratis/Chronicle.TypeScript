// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
import { ReducerEventDispatcher } from './ReducerEventDispatcher.js';

/**
 * Identifies a single reducer observation: the reducer, where it observes and how its events are dispatched.
 */
export interface ReducerObservation {
    /** The reducer identifier. */
    readonly id: string;

    /** The reducer type. */
    readonly reducerType: Constructor;

    /** The event sequence the reducer observes. */
    readonly eventSequenceId: string;

    /** The identifier of the read model the reducer produces. */
    readonly readModelName: string;

    /** The dispatcher routing events to the reducer's handlers. */
    readonly dispatcher: ReducerEventDispatcher;
}
