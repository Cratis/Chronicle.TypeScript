// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { observer_operations } from './given/observer_operations.js';

chai.should();

describe('when replaying an observer', () => {
    let context: observer_operations;
    beforeEach(() => { context = new observer_operations(); });
    it('should send the exact request', async () => {
        await context.operations.replay('obs', 'custom');
        context.replay.mock.calls[0][0].should.deep.equal({ EventStore: 'store', Namespace: 'tenant', ObserverId: 'obs', EventSequenceId: 'custom' });
    });
    it('should report a started job with its id', async () => {
        context.replay.mockResolvedValue({ JobId: 'b6cd0b44-5ad3-4b3d-9f17-5a8b2f0a6e11' });
        const result = await context.operations.replay('obs', 'custom');
        result.started.should.be.true;
        result.jobId!.toString().should.equal('b6cd0b44-5ad3-4b3d-9f17-5a8b2f0a6e11');
    });
    it('should not report a start when the kernel returned no job', async () => {
        const result = await context.operations.replay('obs', 'custom');
        result.started.should.be.false;
    });
});
