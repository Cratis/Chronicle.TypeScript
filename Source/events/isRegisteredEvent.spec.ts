// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import type { IEventStore } from '../IEventStore.js';
import { eventType } from './eventTypeDecorator.js';
import { isRegisteredEvent } from './isRegisteredEvent.js';

class CurrentEvent {}
class UnregisteredEvent {}
eventType('c00f9f33-0ccb-4319-9def-b19ef26f0351')(CurrentEvent);
eventType('c00f9f33-0ccb-4319-9def-b19ef26f0352')(UnregisteredEvent);

const store = { eventTypes: { all: [CurrentEvent] } } as IEventStore;

describe('when classifying a command return value against a store', () => {
    it('should accept an instance of the registered event', () => {
        expect(isRegisteredEvent(store, new CurrentEvent())).toBe(true);
    });

    it('should reject decorated but unregistered types and ordinary payloads', () => {
        expect(isRegisteredEvent(store, new UnregisteredEvent())).toBe(false);
        expect(isRegisteredEvent(store, { event: new CurrentEvent() })).toBe(false);
        expect(isRegisteredEvent(store, null)).toBe(false);
    });
});
