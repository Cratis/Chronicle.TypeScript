// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { toObserverReplayResult } from '../toObserverReplayResult.js';

chai.should();

describe('when converting a replay job identifier', () => {
    const none: [string, string | undefined][] = [['missing', undefined], ['empty', ''], ['all zero', '00000000-0000-0000-0000-000000000000']];
    for (const [name, jobId] of none) {
        it(`should not report a start for a ${name} identifier`, () => {
            const result = toObserverReplayResult(jobId);
            result.started.should.be.false;
            (result.jobId === undefined).should.be.true;
        });
    }
    it('should report a start with the job id for a real identifier', () => {
        const result = toObserverReplayResult('b6cd0b44-5ad3-4b3d-9f17-5a8b2f0a6e11');
        result.started.should.be.true;
        result.jobId!.toString().should.equal('b6cd0b44-5ad3-4b3d-9f17-5a8b2f0a6e11');
    });
});
