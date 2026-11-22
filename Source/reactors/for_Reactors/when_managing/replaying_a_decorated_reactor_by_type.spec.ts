// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import type { ObserverReplayResult } from '../../../observation/ObserverReplayResult.js';
import { runtime_reactors } from '../given/runtime_reactors.fixture.js';
import { OnCustomSequence, request } from './given/managed_reactors.js';

chai.should();

describe('when replaying a decorated reactor by type', () => {
    let context: runtime_reactors;
    let result: ObserverReplayResult;
    beforeEach(async () => {
        context = new runtime_reactors();
        context.replay.mockResolvedValue({ JobId: 'b6cd0b44-5ad3-4b3d-9f17-5a8b2f0a6e11' });
        result = await context.reactors.replay(OnCustomSequence);
    });
    afterEach(() => context.reactors.dispose());
    it('should target the declared id and sequence', () => context.replay.mock.calls[0][0].should.deep.equal(request('on-custom', 'custom')));
    it('should report the started job', () => {
        result.started.should.be.true;
        result.jobId!.toString().should.equal('b6cd0b44-5ad3-4b3d-9f17-5a8b2f0a6e11');
    });
});

describe('when replaying an unknown reactor', () => {
    let context: runtime_reactors;
    let result: ObserverReplayResult;
    beforeEach(async () => {
        context = new runtime_reactors();
        result = await context.reactors.replay('nobody');
    });
    afterEach(() => context.reactors.dispose());
    it('should target the event log', () => context.replay.mock.calls[0][0].should.deep.equal(request('nobody', 'event-log')));
    it('should not report a started replay', () => result.started.should.be.false);
});
