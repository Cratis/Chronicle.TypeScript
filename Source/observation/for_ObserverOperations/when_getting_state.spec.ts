// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { ObserverInformation, ObserverRunningState as ContractRunningState } from '@cratis/chronicle.contracts';
import { ObserverRunningState } from '../ObserverRunningState.js';
import type { ObserverState } from '../ObserverState.js';
import { observer_operations } from './given/observer_operations.js';

chai.should();

describe('when getting the state of an observer', () => {
    let context: observer_operations;
    let state: ObserverState;
    beforeEach(async () => {
        context = new observer_operations();
        context.information.mockResolvedValue(ObserverInformation.fromPartial({
            Id: 'obs', RunningState: ContractRunningState.Active, IsSubscribed: true,
            NextEventSequenceNumber: 5n, LastHandledEventSequenceNumber: 4n, TailEventSequenceNumber: 9n
        }));
        state = await context.operations.getState('obs', 'custom');
    });
    it('should target the store namespace observer and sequence', () =>
        context.information.mock.calls[0][0].should.deep.equal({ EventStore: 'store', Namespace: 'tenant', ObserverId: 'obs', EventSequenceId: 'custom' }));
    it('should report what the kernel reports', () => {
        state.id.should.equal('obs');
        state.eventSequenceId.value.should.equal('custom');
        state.runningState.should.equal(ObserverRunningState.Active);
        state.isSubscribed.should.be.true;
        state.nextEventSequenceNumber.value.should.equal(5n);
        state.lastHandledEventSequenceNumber.value.should.equal(4n);
        state.tailEventSequenceNumber.value.should.equal(9n);
    });
});
