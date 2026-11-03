// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { runConcurrently } from '../runConcurrently.js';

chai.should();

describe('when running items concurrently', () => {
    it('should keep the results in item order and never exceed the limit', async () => {
        let running = 0;
        let highest = 0;
        const results = await runConcurrently([30, 10, 20, 5], 2, async delay => {
            highest = Math.max(highest, ++running);
            await new Promise(resolve => setTimeout(resolve, delay));
            running--;
            return delay * 2;
        });
        results.should.deep.equal([60, 20, 40, 10]);
        highest.should.equal(2);
    });
});
