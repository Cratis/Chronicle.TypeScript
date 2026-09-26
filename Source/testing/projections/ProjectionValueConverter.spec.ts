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

    for (const format of ['int32', 'uint32']) {
        it(`should reject decimal-spelled text mapped into ${format} even when the number is integral`, () => {
            (() => ProjectionValueConverter.convert('1.0', { type: 'integer', format })).should.throw(RangeError, `not supported by integer/${format}`);
            (ProjectionValueConverter.convert('1', { type: 'integer', format }) as number).should.equal(1);
        });
    }

    it('should accept numeric text in an unformatted TypeScript Number field', () => {
        (ProjectionValueConverter.convert('1.0', { type: 'number' }) as number).should.equal(1);
    });

    it('should lowercase a GUID supplied as an expression literal', () => {
        (ProjectionValueConverter.convert('ABCDEFAB-ABCD-ABCD-ABCD-ABCDEFABCDEF', { type: 'string', format: 'guid' }) as string)
            .should.equal('abcdefab-abcd-abcd-abcd-abcdefabcdef');
    });
});
