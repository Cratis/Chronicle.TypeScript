// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { compensationFor, getCompensatedTypeFor } from './compensationForDecorator.js';
import { eventType, getEventTypeJsonSchemaFor } from './eventTypeDecorator.js';
import { toClientEventContext } from './toClientEventContext.js';
import type { WireEventContext } from './WireEventContext.js';

class LedgerEntryPosted {
    constructor(readonly amount: number = 0) {}
}
eventType('ledger-entry-posted')(LedgerEntryPosted);

class LedgerEntryReversed {
    constructor(readonly reason: string = '') {}
}
// Applied in the opposite order to the documented usage to prove that order does not matter.
compensationFor(LedgerEntryPosted)(LedgerEntryReversed);
eventType('ledger-entry-reversed')(LedgerEntryReversed);

class LedgerEntryNoted {
    constructor(readonly note: string = '') {}
}
eventType('ledger-entry-noted')(LedgerEntryNoted);

function wireContext(eventTypeId: string, compensationForValue: bigint): WireEventContext {
    return {
        EventType: { Id: eventTypeId, Generation: 1, Tombstone: false },
        SequenceNumber: 10n,
        EventSourceId: 'source',
        Occurred: { Value: '2024-01-15T12:30:00.0000000+00:00' },
        Causation: [],
        Tags: [],
        NamedTags: [],
        ObservationState: 0,
        CompensationFor: compensationForValue
    } as unknown as WireEventContext;
}

describe('compensationFor', () => {
    describe('when a class is declared as a compensation', () => {
        it('should expose the compensated class', () => {
            expect(getCompensatedTypeFor(LedgerEntryReversed)).toBe(LedgerEntryPosted);
        });

        it('should register the compensated event type id in the schema', () => {
            expect(getEventTypeJsonSchemaFor(LedgerEntryReversed).compensationFor).toEqual('ledger-entry-posted');
        });
    });

    describe('when a class is not a compensation', () => {
        it('should not add compensation to the schema', () => {
            expect(getEventTypeJsonSchemaFor(LedgerEntryNoted).compensationFor).toBeUndefined();
        });
    });

    describe('when converting the context of a compensation', () => {
        it('should carry the compensated sequence number', () => {
            expect(toClientEventContext(wireContext('ledger-entry-reversed', 4n)).compensationFor).toEqual(4n);
        });

        it('should keep a compensation of the first event', () => {
            expect(toClientEventContext(wireContext('ledger-entry-reversed', 0n)).compensationFor).toEqual(0n);
        });
    });

    describe('when converting the context of an event that is not a compensation', () => {
        it('should leave the compensation undefined for an unset wire value', () => {
            expect(toClientEventContext(wireContext('ledger-entry-noted', 0n)).compensationFor).toBeUndefined();
        });
    });
});
