// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, expect, it } from 'vitest';
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

    it('should reject invalid boolean text rather than materialize it as a string', () => {
        (() => ProjectionValueConverter.convert('not-boolean', { type: 'boolean' })).should.throw(RangeError, 'requires a kernel-backed test');
        (() => ProjectionValueConverter.eventContent({ flag: 'not-boolean' }, { type: 'object', properties: {
            flag: { type: 'boolean' }
        } })).should.throw(RangeError, 'requires a kernel-backed test');
    });

    it('should reject invalid GUID text at the expression boundary', () => {
        (() => ProjectionValueConverter.convert('not-a-guid', { type: 'string', format: 'guid' })).should.throw(RangeError, 'requires a kernel-backed test');
    });

    it('should prefer exact-case event properties over case-insensitive fallbacks', () => {
        const schema = { type: 'object', properties: { name: { type: 'string' }, Name: { type: 'string' } } };
        const content = { Name: 'uppercase', name: 'lowercase' };
        expect(ProjectionValueConverter.eventContent(content, schema)).toEqual({ name: 'lowercase', Name: 'uppercase' });
        expect(ProjectionValueConverter.convert(content, schema)).toEqual({ name: 'lowercase', Name: 'uppercase' });
        expect(ProjectionValueConverter.eventContent({ NAME: 'fallback' }, schema)).toEqual({ name: 'fallback', Name: 'fallback' });
        expect(ProjectionValueConverter.eventContent({ Name: 'uppercase', name: null }, schema)).toEqual({ name: 'uppercase', Name: 'uppercase' });
        expect(ProjectionValueConverter.eventContent({ name: null, Name: 'uppercase' }, schema)).toEqual({ Name: 'uppercase' });
    });

    for (const [field, property] of [
        ['text', { type: 'string' }], ['nullableText', { type: ['string', 'null'] }],
        ['identifier', { type: 'string', format: 'guid' }]
    ] as const) {
        for (const value of [5, { value: 'text' }]) {
            it(`should reject a non-string ${field} event field`, () => {
                (() => ProjectionValueConverter.eventContent({ [field]: value }, { type: 'object', properties: {
                    [field]: property
                } })).should.throw(RangeError, 'must be a JSON string');
            });
        }
    }

    it('should retain string coercion for expression values', () => {
        (ProjectionValueConverter.convert(5n, { type: 'string' }) as string).should.equal('5');
    });

    it('should admit UTC date-time boundaries and reject years or calendar dates outside DateTime', () => {
        const schema = { type: 'string', format: 'date-time' };
        (ProjectionValueConverter.convert('0001-01-01T00:00:00Z', schema) as string).should.equal('0001-01-01T00:00:00Z');
        (ProjectionValueConverter.convert('9999-12-31T23:59:59.999Z', schema) as string).should.equal('9999-12-31T23:59:59.999Z');
        for (const value of ['+010000-01-01T00:00:00.000Z', '0000-01-01T00:00:00Z',
            '2025-02-30T00:00:00Z', '9999-12-31T24:00:00Z', '2025-01-01T00:00:00+01:00']) {
            (() => ProjectionValueConverter.convert(value, schema)).should.throw(RangeError, 'outside the supported DateTime range or UTC ISO format');
        }
    });

    it('should accept numeric text in an unformatted TypeScript Number field', () => {
        (ProjectionValueConverter.convert('1.0', { type: 'number' }) as number).should.equal(1);
    });

    it('should lowercase a GUID supplied as an expression literal', () => {
        (ProjectionValueConverter.convert('ABCDEFAB-ABCD-ABCD-ABCD-ABCDEFABCDEF', { type: 'string', format: 'guid' }) as string)
            .should.equal('abcdefab-abcd-abcd-abcd-abcdefabcdef');
    });
});
