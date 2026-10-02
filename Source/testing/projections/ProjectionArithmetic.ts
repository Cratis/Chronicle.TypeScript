// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { JsonSchema } from '../../schemas/JsonSchema.js';
import { ProjectionExpressionEvaluator } from './ProjectionExpressionEvaluator.js';
import { ProjectionValueConverter } from './ProjectionValueConverter.js';

/** The root arithmetic subset captured by the packaged-kernel arithmetic fixtures. */
export class ProjectionArithmetic {
    static isArithmetic(expression: string): boolean {
        return /^\$(?:add|subtract)\(/.test(expression) || ['$count', '$increment', '$decrement'].includes(expression);
    }

    /** The kernel suppresses AutoMap for a nonempty set of aggregate-only mappings. */
    static suppressesAutoMap(properties: Record<string, string>): boolean {
        const expressions = Object.values(properties);
        return expressions.length > 0 && expressions.every(expression => this.isArithmetic(expression));
    }

    static validate(expression: string, target: JsonSchema, eventSchema: JsonSchema, fail: (reason: string) => never): void {
        if (!((target.type === 'number' && (!target.format || target.format === 'double')) ||
            (target.type === 'integer' && target.format === 'int32'))) {
            fail('arithmetic targets must be number/double or integer/int32; other targets require a kernel-backed test');
        }
        if (['$count', '$increment', '$decrement'].includes(expression)) return;
        const source = /^\$(?:add|subtract)\(([A-Za-z_]\w*)\)$/.exec(expression)?.[1];
        if (!source || ['true', 'True', 'false', 'False'].includes(source)) {
            fail('arithmetic operands must be direct numeric event properties; nested paths, literals and context require a kernel-backed test');
        }
        const schema = eventSchema.properties?.[source!];
        if (!schema) fail(`arithmetic event property '${source}' is absent from the participating event schema`);
        if (schema!.compliance?.length || schema!.security?.length) fail('protected arithmetic operands require a kernel-backed test');
        if (!((schema!.type === 'number' && (!schema!.format || schema!.format === 'double')) ||
            (schema!.type === 'integer' && ['int32', 'uint32'].includes(schema!.format ?? '')))) {
            fail('arithmetic operands must have number/double, integer/int32 or integer/uint32 schemas; non-numeric and other operands require a kernel-backed test');
        }
    }

    static value(expression: string, content: unknown, target: JsonSchema, current: unknown): number {
        const operation = /^\$(add|subtract)\(([^()]+)\)$/.exec(expression);
        const operand = operation ? ProjectionExpressionEvaluator.pathValue(content, operation[2]) : 1;
        // Absent accumulators start at zero, unlike explicitly cleared (null) accumulators.
        if (current === null) throw new RangeError('Projection arithmetic cannot use a null accumulator.');
        const previous = current === undefined ? 0 : this.number(current, target);
        const amount = this.number(operand, target);
        const result = operation?.[1] === 'subtract' || expression === '$decrement' ? previous - amount : previous + amount;
        // Int32 arithmetic is unchecked in the kernel; operand conversion is checked and rounds ties to even.
        if (target.format === 'int32') return result | 0;
        ProjectionValueConverter.checkNumber(result, target);
        return result;
    }

    private static number(value: unknown, target: JsonSchema): number {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new RangeError('Projection arithmetic requires finite numeric values.');
        }
        let number = value;
        if (target.format === 'int32') {
            const lower = Math.floor(value);
            number = value - lower === 0.5 ? (lower % 2 === 0 ? lower : lower + 1) : Math.round(value);
        }
        ProjectionValueConverter.checkNumber(number, target);
        return number;
    }
}
