// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ReducerObservation } from './ReducerObservation.js';

/**
 * A {@link ReducerObservation} that is running against an open observation stream.
 */
export interface ReducerObservationSession extends ReducerObservation {
    /** Aborted when the observation is stopped. */
    readonly signal: AbortSignal;

    /** The long-lived reducer instance, or undefined when instances are activated per delivery. */
    readonly reducerInstance: Record<string, Function> | undefined;
}
