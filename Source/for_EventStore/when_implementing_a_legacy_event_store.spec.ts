// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import type { IEventStore } from '../IEventStore.js';

const should = chai.should();

/** An implementation written before event sources existed: it has no `eventSources` member. */
type LegacyEventStore = Omit<IEventStore, 'eventSources'>;

describe('when implementing an event store written before event sources', () => {
    it('should still satisfy the IEventStore contract', () => {
        // Compile-time regression: assigning would fail type-checking if `eventSources` became required.
        const legacy = {} as LegacyEventStore;
        const store: IEventStore = legacy;
        should.not.exist(store.eventSources);
    });
});
