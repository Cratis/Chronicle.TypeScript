// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { ProjectionValueConverter } from '../ProjectionValueConverter.js';
import type { JsonSchema } from '../../../schemas/JsonSchema.js';

chai.should();

describe('when converting structured and scalar values', () => {
    it('should unwrap concepts only at expression boundaries', () => {
        (ProjectionValueConverter.convert({ value: { value: '12' } }, { type: 'integer' }) as number).should.equal(12);
        (() => ProjectionValueConverter.convert({ value: 12 }, { type: 'integer' }, true, false))
            .should.throw(RangeError, "Projection event numeric value '[object Object]' must be a JSON number.");
        (() => ProjectionValueConverter.convert([{ value: 12 }], { type: 'array', items: { type: 'integer' } }))
            .should.throw(RangeError, "Projection numeric value '[object Object]' is not supported by integer/double.");
    });

    it('should apply defaults to missing object members and omit null defaults', () => {
        const schema: JsonSchema = { type: 'object', properties: {
            amount: { type: 'integer' }, flag: { type: 'boolean' }, text: { type: 'string' },
            nullable: { type: ['string', 'null'] }, identifier: { type: 'string', format: 'guid' },
            date: { type: 'string', format: 'date-time' }
        } };
        const expected = { amount: 0, flag: false, identifier: '00000000-0000-0000-0000-000000000000', date: '0001-01-01T00:00:00' };
        ({ ...ProjectionValueConverter.convert({ amount: null }, schema) as object }).should.deep.equal(expected);
        ({ ...ProjectionValueConverter.eventContent([], schema) }).should.deep.equal(expected);
        (ProjectionValueConverter.convert(undefined, schema) === null).should.equal(true);
    });

    it('should clone open objects and untyped array items without coercing them', () => {
        const input = { nested: { value: '12' } };
        const result = ProjectionValueConverter.convert(input, { type: 'object', additionalProperties: true }) as typeof input;
        result.should.deep.equal(input);
        result.nested.should.not.equal(input.nested);
        (ProjectionValueConverter.convert([input], { type: 'array' }) as object[]).should.deep.equal([input]);
        (ProjectionValueConverter.convert(['12'], { type: 'array', items: { type: 'integer' } }) as number[]).should.deep.equal([12]);
    });

    it('should distinguish boolean expression text from event JSON', () => {
        (ProjectionValueConverter.convert('TrUe', { type: 'boolean' }) as boolean).should.equal(true);
        (ProjectionValueConverter.convert(false, { type: 'boolean' }, true) as boolean).should.equal(false);
        (() => ProjectionValueConverter.convert('false', { type: 'boolean' }, true))
            .should.throw(RangeError, "Projection boolean value 'false' requires a kernel-backed test (ChronicleKernelScenario / live kernel).");
    });

    for (const [value, schema] of [
        [Infinity, { type: 'number' }], [1.5, { type: 'integer' }],
        [2147483648, { type: 'integer', format: 'int32' }], [-1, { type: 'integer', format: 'uint32' }],
        [4294967296, { type: 'integer', format: 'uint32' }], [9007199254740992, { type: 'integer' }]
    ] satisfies [number, JsonSchema][]) {
        it(`should reject ${value} outside ${schema.type}/${schema.format ?? 'double'}`, () => {
            (() => ProjectionValueConverter.convert(value, schema)).should.throw(RangeError,
                `Projection numeric value '${value}' is outside the supported ${schema.type}/${schema.format ?? 'double'} range.`);
        });
    }

    it('should preserve the precedence of formats and scalar types', () => {
        (ProjectionValueConverter.convert('0001-01-01T00:00:00', { type: 'string', format: 'date-time' }) as string)
            .should.equal('0001-01-01T00:00:00');
        (ProjectionValueConverter.convert('12', { type: 'number', format: 'guid' }) as number).should.equal(12);
        (ProjectionValueConverter.convert(5, { type: ['string', 'null'] }) as number).should.equal(5);
    });
});
