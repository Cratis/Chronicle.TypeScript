// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { ProjectionValueConverter } from './ProjectionValueConverter.js';

chai.should();

describe('when converting schema-bound projection values', () => {
    for (const type of ['number', 'integer'] as const) {
        it(`should reject numeric text in a ${type} event field`, () => {
            (() => ProjectionValueConverter.eventContent({ amount: '12' }, { type: 'object', properties: {
                amount: { type, format: type === 'number' ? 'double' : 'int32' }
            } })).should.throw('must be a JSON number');
        });
    }

    it('should lowercase a GUID supplied as an expression literal', () => {
        (ProjectionValueConverter.convert('ABCDEFAB-ABCD-ABCD-ABCD-ABCDEFABCDEF', { type: 'string', format: 'guid' }) as string)
            .should.equal('abcdefab-abcd-abcd-abcd-abcdefabcdef');
    });
});
