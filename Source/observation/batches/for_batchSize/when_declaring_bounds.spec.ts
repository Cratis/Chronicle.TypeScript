// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { availableParallelism } from 'node:os';
import { chai, describe, it } from 'vitest';
import { batchSize, getMaxConcurrency, toPageDelivery } from '../batchSize.js';

chai.should();

@batchSize({ maxEvents: 1000, maxBytes: 4096, maxDelayMilliseconds: 50, maxConcurrency: 2 })
class Bounded {}

class Unbounded {}

describe('when declaring the bounds of pages', () => {
    it('should opt in to pages with the declared bounds', () =>
        toPageDelivery(Bounded).should.deep.equal({ Enabled: true, MaxEventsPerPage: 1000, MaxBytesPerPage: 4096, MaxDelayMilliseconds: 50 }));
    it('should opt in to pages with the kernel defaults when nothing is declared', () =>
        toPageDelivery(Unbounded).should.deep.equal({ Enabled: true, MaxEventsPerPage: 0, MaxBytesPerPage: 0, MaxDelayMilliseconds: 0 }));
    it('should use the declared concurrency', () => getMaxConcurrency(Bounded).should.equal(2));
    it('should default the concurrency to the number of processors', () => getMaxConcurrency(Unbounded).should.equal(availableParallelism()));
    it('should refuse a concurrency below one', () => (() => batchSize({ maxConcurrency: 0 })).should.throw(RangeError));
});
