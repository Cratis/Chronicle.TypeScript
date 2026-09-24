// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { CompleteStreamError } from './CompleteStreamError.js';
import { EventSequenceNumber } from './EventSequenceNumber.js';

/**
 * Represents the outcome of completing a stream on an {@link IEventSequence}: either the tail
 * sequence number at the moment of completion, or a typed error describing why it was rejected.
 */
export type CompleteStreamResult =
    | { readonly isSuccess: true; readonly sequenceNumber: EventSequenceNumber }
    | { readonly isSuccess: false; readonly error: CompleteStreamError };
