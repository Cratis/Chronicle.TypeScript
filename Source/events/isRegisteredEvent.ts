// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { IEventStore } from '../IEventStore.js';
import { hasEventType } from './eventTypeDecorator.js';

/** Checks whether a value is an instance of a current event type registered in this store. */
export function isRegisteredEvent(store: Pick<IEventStore, 'eventTypes'>, value: unknown): value is object {
    return typeof value === 'object' && value !== null &&
        hasEventType(value.constructor) && store.eventTypes.all.includes(value.constructor as Constructor);
}
