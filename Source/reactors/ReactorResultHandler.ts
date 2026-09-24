// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventContext } from '../events/EventContext.js';

/** Optional application hook for a reactor's returned result. Return true only when fully handled; throw on failure. */
export type ReactorResultHandler = (result: unknown, context: EventContext, reactorType: Function,
    eventStore: string, namespace: string) => boolean | Promise<boolean>;
