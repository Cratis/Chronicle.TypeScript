// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { PartitionRecoveryOutcome } from '@cratis/chronicle.contracts';
import { PartitionRetryOutcome } from '../PartitionRetryOutcome.js';
import { toPartitionRetryOutcome } from '../toPartitionRetryOutcome.js';

chai.should();

describe('when converting a partition recovery outcome', () => {
    const known: [PartitionRecoveryOutcome, PartitionRetryOutcome][] = [
        [PartitionRecoveryOutcome.Started, PartitionRetryOutcome.Started],
        [PartitionRecoveryOutcome.PartitionNotFound, PartitionRetryOutcome.PartitionNotFound],
        [PartitionRecoveryOutcome.ObserverQuarantined, PartitionRetryOutcome.ObserverQuarantined],
        [PartitionRecoveryOutcome.PartitionQuarantined, PartitionRetryOutcome.PartitionQuarantined]
    ];
    for (const [wire, expected] of known) {
        it(`should map ${PartitionRecoveryOutcome[wire]} to ${expected}`, () => toPartitionRetryOutcome(wire).should.equal(expected));
    }
    for (const wire of [99, -1]) {
        it(`should map the unrecognized value ${wire} to Unknown, never Started`, () =>
            toPartitionRetryOutcome(wire as PartitionRecoveryOutcome).should.equal(PartitionRetryOutcome.Unknown));
    }
});
