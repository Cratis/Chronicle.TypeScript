// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { FastForwardOutcome as ContractFastForwardOutcome } from '@cratis/chronicle.contracts';
import { FastForwardOutcome } from '../FastForwardOutcome.js';
import { toFastForwardOutcome } from '../toFastForwardResult.js';

chai.should();

describe('when converting a fast forward outcome', () => {
    const known: [ContractFastForwardOutcome, FastForwardOutcome][] = [
        [ContractFastForwardOutcome.FastForwarded, FastForwardOutcome.FastForwarded],
        [ContractFastForwardOutcome.AlreadyAtTail, FastForwardOutcome.AlreadyAtTail],
        [ContractFastForwardOutcome.ObserverReplaying, FastForwardOutcome.Replaying],
        [ContractFastForwardOutcome.NotAvailable, FastForwardOutcome.NotAvailable],
        [ContractFastForwardOutcome.FAST_FORWARD_OUTCOME_Accepted, FastForwardOutcome.Accepted]
    ];
    for (const [wire, expected] of known) {
        it(`should map wire value ${wire} to ${expected}`, () => toFastForwardOutcome(wire).should.equal(expected));
    }
    for (const wire of [99, -1]) {
        it(`should map the unrecognized value ${wire} to Unknown without throwing`, () =>
            toFastForwardOutcome(wire as ContractFastForwardOutcome).should.equal(FastForwardOutcome.Unknown));
    }
});
