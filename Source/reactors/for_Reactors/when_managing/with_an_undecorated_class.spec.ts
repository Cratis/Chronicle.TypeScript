// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import { runtime_reactors } from '../given/runtime_reactors.fixture.js';
import { NotAReactor } from './given/managed_reactors.js';

chai.should();

describe('when managing a reactor with an undecorated class', () => {
    let context: runtime_reactors;
    let failures: unknown[];
    beforeEach(async () => {
        context = new runtime_reactors();
        failures = [];
        const calls = [
            () => context.reactors.getStateFor(NotAReactor), () => context.reactors.replay(NotAReactor),
            () => context.reactors.retryFailedPartition(NotAReactor, 'p'), () => context.reactors.getFailedPartitionsFor(NotAReactor)
        ];
        for (const call of calls) {
            try { await call(); } catch (error) { failures.push(error); }
        }
    });
    afterEach(() => context.reactors.dispose());
    it('should reject every call naming the class', () => {
        failures.length.should.equal(4);
        for (const failure of failures) (failure as Error).message.should.equal("'NotAReactor' is not a reactor.");
    });
    it('should send no request', () => {
        context.information.mock.calls.length.should.equal(0);
        context.replay.mock.calls.length.should.equal(0);
        context.retryPartition.mock.calls.length.should.equal(0);
        context.failedPartitions.mock.calls.length.should.equal(0);
    });
});
