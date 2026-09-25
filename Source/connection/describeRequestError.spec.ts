// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { describeRequestError } from './fetchOAuthAccessToken.js';

describe('when describing a token request error', () => {
    it('should include the inner errors of an aggregate error with an empty message', () => {
        const refused = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:35999'), { code: 'ECONNREFUSED' });
        const refusedIpv6 = Object.assign(new Error('connect ECONNREFUSED ::1:35999'), { code: 'ECONNREFUSED' });
        const error = Object.assign(new AggregateError([refusedIpv6, refused], ''), { code: 'ECONNREFUSED' });
        expect(describeRequestError(error)).toBe('connect ECONNREFUSED ::1:35999; connect ECONNREFUSED 127.0.0.1:35999');
    });

    it('should keep the message of an ordinary error', () => {
        expect(describeRequestError(new Error('socket hang up'))).toBe('socket hang up');
    });

    it('should name the code when there is no message', () => {
        expect(describeRequestError(Object.assign(new Error(''), { code: 'ETIMEDOUT' }))).toBe('ETIMEDOUT');
    });
});
