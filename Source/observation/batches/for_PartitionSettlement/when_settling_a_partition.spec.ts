// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { ObservationState } from '@cratis/chronicle.contracts';
import { failedAt, settlePartition, SEQUENCE_NUMBER_UNAVAILABLE } from '../PartitionSettlement.js';

chai.should();

describe('when settling a partition', () => {
    const sequenceNumbers = [3n, 5n, 8n];

    it('should succeed at its last event when nothing was reported for it', () => {
        const outcome = settlePartition('a', sequenceNumbers, [failedAt('b', 1n, new Error('other'))]);
        outcome.state.should.equal(ObservationState.Success);
        outcome.lastSuccessfulObservation.should.equal(8n);
    });

    it('should settle at the earliest problem, counting the events before it as observed', () => {
        const outcome = settlePartition('a', sequenceNumbers, [
            failedAt('a', 8n, new Error('late')),
            { ...failedAt('a', 5n, new Error('early')), state: ObservationState.Deferred, retryAfterMilliseconds: 20 }
        ]);
        outcome.state.should.equal(ObservationState.Deferred);
        outcome.lastSuccessfulObservation.should.equal(3n);
        outcome.retryAfterMilliseconds.should.equal(20);
    });

    it('should report no observed event when it fails at its first event', () =>
        settlePartition('a', sequenceNumbers, [failedAt('a', 3n, new Error('first'))]).lastSuccessfulObservation.should.equal(SEQUENCE_NUMBER_UNAVAILABLE));
});
