// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it } from 'vitest';
import { eventType, getEventTypeMetadata } from '../../../events/eventTypeDecorator.js';
import type { JsonSchema } from '../../../schemas/JsonSchema.js';
import { EventScenario, UnsupportedEventSequenceOperation } from '../../index.js';

chai.should();

const invalid: Array<{ schema: JsonSchema; value: unknown }> = [
    { schema: { type: 'integer' }, value: 1.5 },
    { schema: { type: 'integer' }, value: Number.MAX_SAFE_INTEGER + 1 }
];
for (const format of ['guid', 'uuid']) {
    for (const value of ['not-a-guid', 'abcdef01abcdabcdabcdabcdef012345', 'abcdef01-abcd-abcd-abcd-abcdef01234g', '"', '\\', '\n', 'é']) {
        invalid.push({ schema: { type: 'string', format }, value });
    }
}
for (const value of ['01/02/2025', '2025-02-29', '2024-02-30', '2025-13-01', '0000-01-01', '+010000-01-01', '2025-01-02T00:00:00.000Z']) {
    invalid.push({ schema: { type: 'string', format: 'date' }, value });
}
for (const value of ['January 2, 2025', '2025-01-02', '2025-02-29T00:00:00.000Z', '2024-02-30T00:00:00.000Z',
    '2025-01-02T24:00:00.000Z', '2025-01-02T00:60:00.000Z', '2025-01-02T00:00:60.000Z',
    '0000-01-01T00:00:00.000Z', '+010000-01-01T00:00:00.000Z', '2025-01-02T00:00:00', '2025-01-02T00:00:00+01:00']) {
    invalid.push({ schema: { type: 'string', format: 'date-time' }, value });
}
const ranges: Array<[string, number, number]> = [
    ['int8', -128, 127], ['uint8', 0, 255], ['int16', -32768, 32767], ['uint16', 0, 65535],
    ['int32', -2147483648, 2147483647], ['uint32', 0, 4294967295],
    ['int64', Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER], ['uint64', 0, Number.MAX_SAFE_INTEGER]
];
for (const [format, minimum, maximum] of ranges) {
    for (const type of ['integer', 'number'] as const) {
        for (const value of [minimum - 1, maximum + 1, 1.5]) invalid.push({ schema: { type, format }, value });
    }
}
for (const [format, value] of [['int64', 2 ** 63], ['uint64', 2 ** 64], ['float', 3.5e38], ['decimal', 8e28]] as const) {
    invalid.push({ schema: { type: 'number', format }, value });
}

for (const { schema, value } of invalid) {
    describe(`when appending invalid ${schema.type}/${schema.format} content ${JSON.stringify(value)}`, () => {
        for (const operation of ['single', 'batch', 'setup']) {
            let scenario: EventScenario;
            let failure: unknown;
            beforeEach(async () => {
                class Recorded { @field(Object) value: unknown = value; }
                eventType('InvalidFormattedContent')(Recorded);
                getEventTypeMetadata(Recorded)!.schema.properties!.value = schema;
                scenario = new EventScenario({ artifacts: { eventTypes: [Recorded] }, constraints: 'disabled' });
                const valid = new Recorded();
                valid.value = schema.type === 'string'
                    ? schema.format === 'date' ? '2024-02-29' : schema.format === 'date-time' ? '2024-02-29T00:00:00.000Z' : '00000000-0000-0000-0000-000000000000'
                    : 1;
                await scenario.given.forEventSource('existing').events(valid);
                const append = operation === 'single' ? scenario.append('A', new Recorded())
                    : operation === 'batch' ? scenario.appendMany('A', [valid, new Recorded()])
                    : scenario.given.forEventSource('A').events(valid, new Recorded());
                failure = await append.then(() => undefined, error => error);
            });
            it(`should reject the ${operation} without changing history results or the next sequence`, async () => {
                (failure as Error).should.be.instanceOf(UnsupportedEventSequenceOperation);
                scenario.appendedEvents.should.have.lengthOf(1);
                scenario.results.should.have.lengthOf(0);
                (await scenario.eventSequence.getNextSequenceNumber()).value.should.equal(1n);
            });
        }
    });
}

for (const property of [
    ...['date', 'date-time', 'guid', 'uuid'].map(format => ({ type: 'string' as const, format })),
    { type: 'integer', format: 'int32' }
] satisfies JsonSchema[]) {
    for (const container of ['properties', 'additionalProperties']) {
        describe(`when a nested ${container} schema contains an invalid ${property.format}`, () => {
            it('should validate the nested field before accepting content', async () => {
                class Recorded { @field(Object) payload = { nested: property.type === 'integer' ? 2147483648 : 'invalid' }; }
                eventType('InvalidNestedFormattedContent')(Recorded);
                getEventTypeMetadata(Recorded)!.schema.properties!.payload = container === 'properties'
                    ? { type: 'object', properties: { nested: property } } : { type: 'object', additionalProperties: property };
                const scenario = new EventScenario({ artifacts: { eventTypes: [Recorded] }, constraints: 'disabled' });
                const failure = await scenario.append('A', new Recorded()).then(() => undefined, error => error);
                failure.should.be.instanceOf(UnsupportedEventSequenceOperation);
                scenario.appendedEvents.should.have.lengthOf(0);
            });
        });
    }
}

const valid: Array<{ schema: JsonSchema; values: unknown[] }> = [
    { schema: { type: 'string', format: 'date' }, values: ['0001-01-01', '2024-02-29', '9999-12-31'] },
    { schema: { type: 'string', format: 'date-time' }, values: ['0001-01-01T00:00:00.000Z', '2024-02-29T12:34:56Z', '9999-12-31T23:59:59.999Z'] },
    { schema: { type: 'string', format: 'guid' }, values: ['ABCDEF01-ABCD-ABCD-ABCD-ABCDEF012345'] },
    ...ranges.map(([format, minimum, maximum]) => ({ schema: { type: 'integer' as const, format }, values: [minimum, maximum] }))
];
for (const { schema, values } of valid) {
    describe(`when appending supported ${schema.type}/${schema.format} boundaries`, () => {
        it('should retain the serialized values without kernel normalization', async () => {
            class Recorded { @field(Object) value: unknown; }
            eventType('ValidFormattedContent')(Recorded);
            getEventTypeMetadata(Recorded)!.schema.properties!.value = schema;
            const scenario = new EventScenario({ artifacts: { eventTypes: [Recorded] }, constraints: 'disabled' });
            await scenario.appendMany('A', values.map(value => Object.assign(new Recorded(), { value })));
            scenario.appendedEvents.map(event => event.content.value).should.deep.equal(values);
        });
    });
}

for (const format of ['unknown', 'int128']) {
    describe(`when registering an unsupported numeric format ${format}`, () => {
        it('should reject the schema rather than ignoring its format', () => {
            class Recorded { @field(Number) value = 1; }
            eventType('UnsupportedNumericFormat')(Recorded);
            getEventTypeMetadata(Recorded)!.schema.properties!.value.format = format;
            (() => new EventScenario({ artifacts: { eventTypes: [Recorded] }, constraints: 'disabled' }))
                .should.throw(UnsupportedEventSequenceOperation, 'artifacts.eventTypes.schema');
        });
    });
}
