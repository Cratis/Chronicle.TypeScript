// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { JsonSchema } from '../../schemas/JsonSchema.js';
import { ProjectionArithmetic } from './ProjectionArithmetic.js';
import { ProjectionSchemaCapabilities } from './ProjectionSchemaCapabilities.js';

/** Fixture-backed expression families, in kernel validation order. */
export class ProjectionExpressionCapabilities {
    static check(expression: string, target: JsonSchema, eventSchema: JsonSchema, fail: (reason: string) => never): boolean {
        if (this.context(expression, target, fail)) return true;
        if (/^\$value\([\p{L}\p{Mn}\p{Nd}\p{Pc} ._/:*+-]*\)$/u.test(expression)) {
            this.literal(expression.slice(7, -1), target, fail);
            return true;
        }
        if (ProjectionArithmetic.isArithmetic(expression)) {
            ProjectionArithmetic.validate(expression, target, eventSchema, fail);
            return true;
        }
        return false;
    }

    private static context(expression: string, target: JsonSchema, fail: (reason: string) => never): boolean {
        if (expression === '$eventSourceId') {
            this.eventSourceId(target, fail);
            return true;
        }
        if (expression === '$null') return true;
        if (expression.startsWith('$setOnce(')) fail('set once requires a kernel-backed test');
        if (!expression.startsWith('$eventContext(')) return false;
        this.eventContext(expression, target, fail);
        return true;
    }

    private static eventSourceId(target: JsonSchema, fail: (reason: string) => never): void {
        if (target.type !== 'string' || !this.identifierFormat(target)) {
            fail('$eventSourceId requires a string or GUID target; other targets require a kernel-backed test (ChronicleKernelScenario / live kernel)');
        }
    }

    private static identifierFormat(target: JsonSchema): boolean {
        return !target.format || target.format === 'guid';
    }

    private static eventContext(expression: string, target: JsonSchema, fail: (reason: string) => never): void {
        if (expression === '$eventContext(Occurred)') fail('raw Occurred is converted inconsistently by the kernel; only its Year, Month and Day paths are supported');
        if (/^\$eventContext\(.+\(\)\)$/.test(expression)) fail('derived event-context functions require a kernel-backed test');
        const path = /^\$eventContext\(([^()]*)\)$/.exec(expression)?.[1];
        if (path && this.contextTarget(path, target)) return;
        fail('event-context path and target schema require a kernel-backed test');
    }

    private static contextTarget(path: string, target: JsonSchema): boolean {
        const strings = ['EventSourceId', 'EventStore', 'Namespace', 'EventSourceType', 'EventStreamType',
            'EventStreamId', 'Subject', 'Subject.Value', 'Hash', 'CorrelationId', 'CorrelationId.Value',
            'CausedBy.Subject', 'CausedBy.Name', 'CausedBy.UserName', 'EventType.Id.Value', 'SequenceNumber', 'SequenceNumber.Value'];
        const integers = ['Occurred.Year', 'Occurred.Month', 'Occurred.Day', 'EventType.Generation.Value'];
        if (strings.includes(path)) return this.plainString(target);
        return integers.includes(path) && this.int32(target);
    }

    private static plainString(target: JsonSchema): boolean {
        return target.type === 'string' && !target.format;
    }

    private static int32(target: JsonSchema): boolean {
        return target.type === 'integer' && target.format === 'int32';
    }

    private static literal(text: string, target: JsonSchema, fail: (reason: string) => never): void {
        if (target.format === 'date-time') fail('$value date-time literals require a kernel-backed test');
        if (ProjectionSchemaCapabilities.numeric(target)) this.numericLiteral(text, target, fail);
        else this.scalarLiteral(text, target, fail);
    }

    private static numericLiteral(text: string, target: JsonSchema, fail: (reason: string) => never): void {
        const spelling = target.type === 'integer' ? /^[+-]?\d+$/ : /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
        if (!spelling.test(text) || !this.inRange(Number(text), target)) {
            fail('$value numeric literal is outside the supported finite/integer range');
        }
    }

    private static inRange(number: number, target: JsonSchema): boolean {
        if (!Number.isFinite(number)) return false;
        return target.type !== 'integer' || !ProjectionSchemaCapabilities.outsideIntegerRange(number, target);
    }

    private static scalarLiteral(text: string, target: JsonSchema, fail: (reason: string) => never): void {
        if (target.type === 'boolean') this.booleanLiteral(text, fail);
        else if (target.format === 'guid') this.guidLiteral(text, fail);
        else if (target.type === 'object' || target.type === 'array') fail('$value object/array literals require a kernel-backed test');
    }

    private static booleanLiteral(text: string, fail: (reason: string) => never): void {
        if (!/^(?:true|false)$/i.test(text)) fail('$value boolean literal must be true or false');
    }

    private static guidLiteral(text: string, fail: (reason: string) => never): void {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) fail('$value GUID literal is not canonical');
    }
}
