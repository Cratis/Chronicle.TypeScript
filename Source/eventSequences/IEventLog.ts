// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IEventSequence } from './IEventSequence';

/**
 * Defines the API surface for the event log, which is the default event sequence.
 * The event log is the primary event sequence where all domain events are appended.
 */
export interface IEventLog extends IEventSequence {}
