// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import type { Constructor } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it, vi, type Assertion } from 'vitest';
import { getEventTypeMetadata } from '../../../events/eventTypeDecorator.js';
import { EventScenario, UnsupportedEventSequenceOperation } from '../../index.js';
import { InProcessConstraints } from '../../InProcessConstraints.js';

chai.should();
const should = (value: unknown): Assertion => (value as { should: Assertion }).should;

type Input = { source: string; type: 'number' | 'string'; value: number | string };
type WireViolation = { SequenceNumber: string; ConstraintName: string; Message: string; Details: Record<string, string> };
type Fixture = {
    fieldCombinationCases: Array<{ isolatedConstraintOperations: Array<{ mode: string; events: Input[] }> }>;
    expected: { cases: Array<{ name: string; outcomes: Array<{
        success: boolean; sequences: string[]; wireViolations: WireViolation[]; next: string;
    }> }> };
};

export function fractionalCollisions(fixtures: { number: Constructor<{ key: number }>; text: Constructor<{ key: string }>;
    constraint: Constructor; scoped: Constructor }): void {
    const fixture = JSON.parse(readFileSync(new URL('../../fixtures/constraints-fractional-collisions.json', import.meta.url), 'utf8')) as Fixture;
    const operations = fixture.fieldCombinationCases[0].isolatedConstraintOperations;
    const outcomes = fixture.expected.cases[0].outcomes;
    const eventTypes = [fixtures.number, fixtures.text];

    describe('when replaying unscoped string and fractional key collisions', () => {
        it('should match the kernel violations and atomic ownership transitions after every request', async () => {
            should(fixture.expected.cases[0].name).equal('fractional-0');
            should(operations.length).equal(outcomes.length);
            should(getEventTypeMetadata(fixtures.number)!.eventType.id.value).equal('OracleCombinedNumber');
            should(getEventTypeMetadata(fixtures.text)!.eventType.id.value).equal('OracleCombinedText');
            const scenario = new EventScenario({ artifacts: { eventTypes, constraints: [fixtures.constraint] } });
            const validate = vi.spyOn(InProcessConstraints.prototype, 'validate');
            try {
                for (const [index, operation] of operations.entries()) {
                    const expected = outcomes[index];
                    const entries = operation.events.map(input => ({ eventSourceId: input.source,
                        event: Object.assign(new (input.type === 'number' ? fixtures.number : fixtures.text)(), { key: input.value }) }));
                    const before = [...scenario.appendedEvents];
                    const results = operation.mode === 'single'
                        ? [await scenario.append(entries[0].eventSourceId, entries[0].event)] : await scenario.appendMany(entries);
                    should(results.every(result => result.isSuccess === expected.success)).equal(true);
                    should(results.map(result => result.sequenceNumber.value.toString())).deep.equal(
                        expected.success ? expected.sequences : results.map(() => '0'));
                    const raw = validate.mock.results.at(-1)!.value as ReturnType<InProcessConstraints['validate']>;
                    should(raw.map(violation => ({ ...violation, SequenceNumber: violation.SequenceNumber.toString() }))).deep.equal(expected.wireViolations);
                    for (const result of results) {
                        should(result.constraintViolations.map(item => ({ id: item.constraintId, message: item.message, details: item.details })))
                            .deep.equal(expected.wireViolations.map(item => ({ id: item.ConstraintName,
                                message: `Taken: ${item.Details.PropertyName}=${item.Details.PropertyValue}`, details: item.Details })));
                    }
                    if (!expected.success) should(scenario.appendedEvents).deep.equal(before);
                    else should(scenario.appendedEvents.slice(before.length).map(entry => entry.context.eventSourceId))
                        .deep.equal(operation.events.map(entry => entry.source));
                    should((await scenario.eventSequence.getNextSequenceNumber()).value.toString()).equal(expected.next);
                }
            } finally { validate.mockRestore(); }
        });
    });

    describe('when a scoped number attempts to use the new unscoped fractional domain', () => {
        let scenario: EventScenario;
        let error: unknown;
        beforeEach(async () => {
            scenario = new EventScenario({ artifacts: { eventTypes, constraints: [fixtures.scoped] } });
            const invalid = Object.assign(new fixtures.number(), { key: 1.5 });
            error = await scenario.appendMany('A', [new fixtures.number(), invalid]).then(() => undefined, error => error);
        });
        it('should reject before recording history, results or advancing sequence', async () => {
            should(error instanceof UnsupportedEventSequenceOperation).equal(true);
            should(scenario.appendedEvents).have.lengthOf(0);
            should(scenario.results).have.lengthOf(0);
            should((await scenario.eventSequence.getNextSequenceNumber()).value).equal(0n);
        });
    });
}
