// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Converts a constant to the projection expression understood by the Chronicle kernel. */
export function constantValueExpression(value: unknown): string {
    if (value === null || value === undefined) {
        return '$null';
    }

    if (value instanceof Date) {
        return `$value(${value.toISOString()})`;
    }

    if (typeof value === 'object' && 'value' in value) {
        return constantValueExpression(value.value);
    }

    const text = String(value);
    if (text === '$null') return text;
    const wrapped = text.startsWith('$value(');
    const content = wrapped && text.endsWith(')') ? text.slice(7, -1) : text;
    // ValueExpressionResolver accepts only word characters, spaces, and ._/:*+-.
    // .NET's \w also accepts Unicode letters, non-spacing marks, decimal digits and connector punctuation.
    if ((wrapped && !text.endsWith(')')) || !/^[\p{L}\p{Mn}\p{Nd}\p{Pc} ._/:*+-]*$/u.test(content)) {
        throw new Error(`Constant value '${text}' contains characters unsupported by the kernel's $value expression.`);
    }
    return wrapped ? text : `$value(${text})`;
}
