// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { ChronicleOptions } from '../../ChronicleOptions.js';

chai.should();

describe('when configuring the connect timeout', () => {
    it('should wait 10 seconds by default', () =>
        ChronicleOptions.fromConnectionString('chronicle://localhost:35000').connectTimeout.should.equal(10_000));

    it('should use the configured timeout', () =>
        ChronicleOptions.development({ connectTimeout: 2_500 }).connectTimeout.should.equal(2_500));

    for (const connectTimeout of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        it(`should reject ${connectTimeout}`, () =>
            (() => ChronicleOptions.development({ connectTimeout })).should.throw(TypeError, 'connectTimeout'));
    }
});
