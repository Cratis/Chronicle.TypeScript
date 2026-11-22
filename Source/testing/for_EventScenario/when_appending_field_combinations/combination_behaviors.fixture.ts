// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { chai, describe, it, vi, type Assertion } from 'vitest';
import { constraint } from '../../../events/constraints/constraint.js';
import type { IConstraint } from '../../../events/constraints/IConstraint.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import { getEventTypeMetadata } from '../../../events/eventTypeDecorator.js';
import { EventScenario } from '../../EventScenario.js';
import { InProcessConstraints } from '../../InProcessConstraints.js';
import { UnsupportedEventSequenceOperation } from '../../UnsupportedEventSequenceOperation.js';

chai.should();
const should = (value: unknown): Assertion => (value as { should: Assertion }).should;
type Constructor = new () => object;
type Alias = 'number' | 'guid' | 'string' | 'removed';
type Entry = { source: string; type: Alias; value?: string; values?: Record<string, unknown> };
type Operation = { mode: string; overload?: string; options?: { sourceType: string; streamType: string; streamId: string }; events: Entry[] };
type Definition = { events: { type: Alias; properties: string[] }[]; name: string; message: string };
interface Fixture {
    fieldCombinationCases: { name: string; eventSchemas: Record<Alias, { eventTypeId: string; properties: Record<string, string> }>;
        constraintDefinitions: Definition[]; isolatedConstraintOperations: Operation[] }[];
    expected: { cases: { name: string; outcomes: { success: boolean; sequences: string[]; wireViolations: unknown[]; next: string }[] }[] };
}
const fixture = JSON.parse(readFileSync(new URL('../../fixtures/constraints-field-combinations.json', import.meta.url), 'utf8')) as Fixture;

function definition(types: Record<Alias, Constructor>, declaration: Definition, mask: number, ignoreCasing = false): Constructor {
    class Key implements IConstraint {
        define(builder: IConstraintBuilder) {
            if (mask & 1) builder.perEventSourceType();
            if (mask & 2) builder.perEventStreamType();
            if (mask & 4) builder.perEventStreamId();
            builder.unique(key => {
                key.withMessage(declaration.message);
                for (const event of declaration.events) {
                    key.on(types[event.type], ...event.properties.map(property => (value: object) => (value as Record<string, unknown>)[property]));
                }
                key.removedWith(types.removed);
                if (ignoreCasing) key.ignoreCasing();
                return key;
            });
        }
    }
    constraint(declaration.name)(Key);
    return Key;
}

function eventFor(entry: Entry, types: Record<Alias, Constructor>): object {
    return Object.assign(new types[entry.type](), entry.values ?? { [entry.type === 'removed' ? 'label' : 'key']: entry.value });
}

async function append(scenario: EventScenario, operation: Operation, types: Record<Alias, Constructor>) {
    const events = operation.events.map(entry => ({ eventSourceId: entry.source, event: eventFor(entry, types) }));
    if (operation.mode === 'single') return [await scenario.append(events[0].eventSourceId, events[0].event, operation.options)];
    if (operation.overload === 'source') return scenario.appendMany(events[0].eventSourceId, events.map(entry => entry.event), operation.options);
    return scenario.appendMany(events, operation.options);
}

export function combinationBehaviors(types: Record<Alias, Constructor>): void {
    it('should replay a nonempty, uniquely named oracle matrix', () => {
        should(fixture.fieldCombinationCases.length).equal(3);
        should(fixture.expected.cases.length).equal(24);
        should(new Set(fixture.expected.cases.map(test => test.name)).size).equal(24);
    });
    for (const template of fixture.fieldCombinationCases) {
        for (let mask = 0; mask < 8; mask++) {
            describe(`when replaying ${template.name} Guid/numeric keys under scope mask ${mask}`, () => {
                const constraints = [definition(types, template.constraintDefinitions[0], mask)];
                const artifacts = { eventTypes: Object.values(types), constraints };
                it('should match raw violations, sequences, history and failed-batch atomicity', async () => {
                    const expected = fixture.expected.cases.find(test => test.name === `${template.name}-${mask}`)!;
                    should(expected.outcomes.length).equal(template.isolatedConstraintOperations.length);
                    for (const alias of Object.keys(types) as Alias[]) {
                        const schema = getEventTypeMetadata(types[alias])!;
                        should(schema.eventType.id.value).equal(template.eventSchemas[alias].eventTypeId);
                        should(Object.keys(schema.schema.properties!).sort()).deep.equal(Object.keys(template.eventSchemas[alias].properties).sort());
                    }
                    const scenario = new EventScenario({ artifacts });
                    const validate = vi.spyOn(InProcessConstraints.prototype, 'validate');
                    try {
                        for (const [index, operation] of template.isolatedConstraintOperations.entries()) {
                            const before = [...scenario.appendedEvents];
                            const results = await append(scenario, operation, types);
                            const outcome = expected.outcomes[index];
                            should(results.every(result => result.isSuccess === outcome.success)).equal(true);
                            should(results.map(result => result.sequenceNumber.value.toString())).deep.equal(
                                outcome.success ? outcome.sequences : results.map(() => '0'));
                            const raw = validate.mock.results.at(-1)!.value as ReturnType<InProcessConstraints['validate']>;
                            should(raw.map(({ SequenceNumber, ...violation }) => ({ ...violation, SequenceNumber: SequenceNumber.toString() })))
                                .deep.equal(outcome.wireViolations);
                            if (!outcome.success) should(scenario.appendedEvents).deep.equal(before);
                            else should(scenario.appendedEvents.slice(before.length).map(entry => entry.context.eventSourceId))
                                .deep.equal(operation.events.map(entry => entry.source));
                            should((await scenario.eventSequence.getNextSequenceNumber()).value.toString()).equal(outcome.next);
                        }
                    } finally { validate.mockRestore(); }
                });
                it('should keep numeric, Guid and definition rejections atomic', async () => {
                    const scenario = new EventScenario({ artifacts });
                    for (const entry of [
                        { source: 'A', type: 'number', values: { key: 1.5 } },
                        { source: 'A', type: 'number', values: { key: Number.MAX_SAFE_INTEGER + 1 } },
                        { source: 'A', type: 'guid', values: { key: 'not-a-guid' } }
                    ] as Entry[]) {
                        const error = await append(scenario, { mode: 'batch', events: [template.isolatedConstraintOperations[0].events[0], entry] }, types)
                            .then(() => undefined, error => error);
                        should(error).instanceOf(UnsupportedEventSequenceOperation);
                        should(scenario.appendedEvents).deep.equal([]);
                        should(scenario.results).deep.equal([]);
                    }
                    const other = definition(types, { ...template.constraintDefinitions[0], name: 'OracleOtherKey' }, mask);
                    should(() => new EventScenario({ artifacts: { ...artifacts, constraints: [...constraints, other] } }))
                        .throw(UnsupportedEventSequenceOperation);
                    const cased = definition(types, template.constraintDefinitions[0], mask, true);
                    should(() => new EventScenario({ artifacts: { ...artifacts, constraints: [cased] } }))
                        .throw(UnsupportedEventSequenceOperation, 'Case-insensitive keys');
                });
            });
        }
    }
}
