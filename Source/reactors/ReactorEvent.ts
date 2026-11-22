// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventContext } from '../events/EventContext.js';

/** An event delivered to a delegate reactor. */
export interface ReactorEvent {
    readonly content: unknown;
    readonly context: EventContext;
}
