// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { observer_operations } from './given/observer_operations.js';

chai.should();

describe('when the kernel rejects an observer management call', () => {
    const failure = new Error('kernel said no');
    let context: observer_operations;
    beforeEach(() => {
        context = new observer_operations();
        context.information.mockRejectedValue(failure);
        context.replay.mockRejectedValue(failure);
        context.retryPartition.mockRejectedValue(failure);
        context.failedPartitions.mockRejectedValue(failure);
    });
    const calls: [string, (c: observer_operations) => Promise<unknown>][] = [
        ['getting state', c => c.operations.getState('o', 's')],
        ['replaying', c => c.operations.replay('o', 's')],
        ['retrying a partition', c => c.operations.retryPartition('o', 's', 'p')],
        ['getting failed partitions', c => c.operations.getFailedPartitions('o')]
    ];
    for (const [name, call] of calls) {
        it(`should reject ${name} with the same error`, async () => {
            let caught: unknown;
            await call(context).catch(error => { caught = error; });
            (caught === failure).should.be.true;
        });
    }
});
