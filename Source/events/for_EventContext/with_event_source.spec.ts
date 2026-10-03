// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, it, chai } from 'vitest';
import { toClientEventContext } from '../toClientEventContext.js';
import type { WireEventContext } from '../WireEventContext.js';

const should = chai.should();
const wire = (extra: Partial<WireEventContext>): WireEventContext => ({
    EventSourceId: 's', SequenceNumber: 1n, ObservationState: 0, Tags: [], Causation: [],
    EventType: { Id: 't', Generation: 1, Tombstone: false }, Occurred: { Value: '2025-01-01T00:00:00.000Z' }, ...extra
} as unknown as WireEventContext);

describe('when converting a kernel event context', () => {
    it('should carry the registered event source', () => {
        toClientEventContext(wire({ EventSource: 'Account' })).eventSource!.should.equal('Account');
    });
    it('should leave the source unset when the event was not appended through a definition', () => {
        should.equal(toClientEventContext(wire({ EventSource: '' })).eventSource, undefined);
        should.equal(toClientEventContext(wire({})).eventSource, undefined);
    });
});
