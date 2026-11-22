// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import { ObserverInformation, ObserverRunningState as ContractRunningState } from '@cratis/chronicle.contracts';
import { ObserverRunningState } from '../../../observation/ObserverRunningState.js';
import type { ReactorState } from '../../ReactorState.js';
import { Registered, runtime_reactors } from '../given/runtime_reactors.fixture.js';
import { request } from './given/managed_reactors.js';

chai.should();

describe('when getting the state of a runtime reactor on a custom sequence', () => {
    let context: runtime_reactors;
    let state: ReactorState;
    beforeEach(async () => {
        context = new runtime_reactors();
        await context.reactors.register('runtime', builder => builder.on(Registered, () => {}).onEventSequence('custom'));
        context.information.mockResolvedValue(ObserverInformation.fromPartial({
            Id: 'runtime', RunningState: ContractRunningState.Active, IsSubscribed: true
        }));
        state = await context.reactors.getStateFor('runtime');
    });
    afterEach(() => context.reactors.dispose());
    it('should target the registered sequence in the store and namespace', () =>
        (context.information.mock.calls.at(-1)![0] as object).should.deep.equal(request('runtime', 'custom')));
    it('should report the kernel state for that sequence', () => {
        state.isSubscribed.should.be.true;
        state.runningState.should.equal(ObserverRunningState.Active);
        state.eventSequenceId.value.should.equal('custom');
    });
});
