// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { constantValueExpression } from './constantValueExpression.js';

describe('constantValueExpression', () => {
    it.each([
        [true, '$value(true)'],
        [false, '$value(false)'],
        [42, '$value(42)'],
        [-1.5, '$value(-1.5)'],
        ['on-loan', '$value(on-loan)'],
        ['', '$value()'],
        [new Date('2025-01-02T03:04:05.006Z'), '$value(2025-01-02T03:04:05.006Z)'],
        [null, '$null'],
        [undefined, '$null'],
        [{ value: 'wrapped' }, '$value(wrapped)'],
        [{ value: { value: 17 } }, '$value(17)'],
        [{ value: null }, '$null']
    ])('should encode %s as %s', (value, expression) => {
        expect(constantValueExpression(value)).toBe(expression);
    });
});
