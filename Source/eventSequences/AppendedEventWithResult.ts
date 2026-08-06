// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { AppendedEvent } from '../events/AppendedEvent';
import type { AppendResult } from './AppendResult';

/**
 * Represents an event that was appended to an event sequence together with the result of the
 * operation that appended it.
 */
export interface AppendedEventWithResult {
    /** The event that was appended. */
    readonly event: AppendedEvent;

    /** The result describing success, violations, or errors for the append operation. */
    readonly result: AppendResult;
}
