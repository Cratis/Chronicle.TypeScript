// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import type { EventContext } from '../EventContext.js';
import { NamedTag } from '../NamedTag.js';
import { toClientEventContext } from '../toClientEventContext.js';
import type { WireEventContext } from '../WireEventContext.js';

chai.should();

function wireContext(namedTags?: { Name: string; Value: string }[]): WireEventContext {
    return {
        EventSourceId: 'source', SequenceNumber: 1n, EventSourceType: 'Default', EventStreamType: 'All', EventStreamId: 'Default',
        EventType: { Id: 'type', Generation: 1, Tombstone: false }, Occurred: { Value: '2025-01-01T00:00:00.000Z' },
        CorrelationId: undefined, Causation: [], CausedBy: undefined, Tags: [], Hash: '', ObservationState: 1, Subject: 'source',
        NamedTags: namedTags
    } as unknown as WireEventContext;
}

describe('when converting a delivered context with named tags', () => {
    let context: EventContext;
    beforeEach(() => { context = toClientEventContext(wireContext([{ Name: 'batch', Value: 'b-1' }, { Name: 'batch', Value: '' }])); });
    it('should expose every named tag in delivered order', () =>
        context.namedTags!.map(tag => [tag.name, tag.value]).should.deep.equal([['batch', 'b-1'], ['batch', '']]));
    it('should expose named tag instances', () => context.namedTags![0].should.be.instanceOf(NamedTag));
});

describe('when converting a delivered context without named tags', () => {
    it('should expose an empty list', () => toClientEventContext(wireContext()).namedTags!.should.deep.equal([]));
});
