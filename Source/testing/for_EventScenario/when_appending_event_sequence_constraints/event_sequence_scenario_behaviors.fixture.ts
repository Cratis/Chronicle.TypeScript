// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { chai, describe, it, vi, type Assertion } from 'vitest';
import type { Constructor } from '@cratis/fundamentals';
import { getEventTypeMetadata } from '../../../events/eventTypeDecorator.js';
import { compileConstraints } from '../../../events/constraints/Constraints.js';
import { EventScenario } from '../../index.js';
import { InProcessConstraints } from '../../InProcessConstraints.js';

chai.should();
function should(value: unknown): Assertion { return (value as { should: Assertion }).should; }

type Entry = { source: string; type: string; value: string };
type Definition = { kind: string; name: string; events?: Array<{ type: string; properties: string[] }>; eventTypes?: string[];
    ignoreCasing?: boolean; removedWithEventTypeIds: string[]; message: string; eventSequences: string[] };
type History = { sequence: string; source: string; sourceType?: string; streamType?: string; streamId?: string;
    type: string; content: Record<string, unknown>; hash?: string };
type Outcome = { success: boolean; sequences: string[]; errors: string[];
    wireViolations: Array<{ EventTypeId: string; SequenceNumber: string; ConstraintType: number; ConstraintName: string; Message: string; Details: Record<string, string> }>;
    violations: Array<{ id: string; message: string; details: Record<string, string> }>; history: History[]; next: string };
type SequenceCase = { name: string; kind: string; eventSchemas: Record<string, { eventTypeId: string; properties: Record<string, string> }>;
    constraintDefinitions: Definition[]; isolatedConstraintOperations: Array<{ mode: string; events: Entry[] }> };
type Fixture = { eventSequenceCases: SequenceCase[]; expected: { cases: Array<{ name: string; result: { outcomes: Outcome[] } }> } };

/**
 * Replays constraints-event-sequences.json: a definition applying to the event log behaves as unscoped, and one
 * applying only to other event sequences is neither validated nor indexed on the scenario's event log.
 * @param types - Event constructors by fixture alias.
 * @param constraints - Selects the constraint classes for a case name.
 */
export function eventSequenceScenarioBehaviors(
    types: Record<string, new (value: string) => object>,
    constraints: (caseName: string) => Constructor[]
): void {
    const fixture = JSON.parse(readFileSync(new URL('../../fixtures/constraints-event-sequences.json', import.meta.url), 'utf8')) as Fixture;
    const historyOf = (scenario: EventScenario): History[] => scenario.appendedEvents.map(event => ({
        sequence: event.context.sequenceNumber.toString(), source: event.context.eventSourceId,
        sourceType: event.context.eventSourceType, streamType: event.context.eventStreamType, streamId: event.context.eventStreamId,
        type: event.eventType.id.value, content: event.content, hash: event.context.hash
    }));
    const aliases = Object.fromEntries(Object.entries(types).map(([alias, type]) => [getEventTypeMetadata(type)!.eventType.id.value, alias]));

    it('should retain every event sequence case', () => {
        should(fixture.eventSequenceCases.map(test => test.name)).deep.equal([
            'property-event-log', 'property-event-log-and-outbox', 'property-outbox',
            'cycle-event-log', 'cycle-outbox', 'once-event-log', 'once-outbox'
        ]);
        should(fixture.expected.cases.map(test => test.name)).deep.equal(fixture.eventSequenceCases.map(test => test.name));
    });

    for (const [caseIndex, test] of fixture.eventSequenceCases.entries()) {
        describe(`with ${test.name}`, () => {
            it('should match the installed definitions and kernel violations, history and next sequence', async () => {
                const selected = Object.keys(test.eventSchemas).map(alias => types[alias]);
                const selectedConstraints = constraints(test.name);
                const compiled = compileConstraints({ eventTypes: selected, constraints: selectedConstraints });
                should([...compiled].map(([name, capture]) => ({
                    kind: capture.uniqueConstraint ? 'uniqueProperty' : 'uniqueEventType', name,
                    ...(capture.uniqueConstraint ? {
                        events: capture.uniqueConstraint.eventDefinitions.map(entry => ({ type: aliases[entry.eventTypeId], properties: entry.properties })),
                        ignoreCasing: capture.uniqueConstraint.ignoreCasing
                    } : { eventTypes: (capture.uniqueEventType!.eventTypeIds ?? [capture.uniqueEventType!.eventTypeId]).map(id => aliases[id]) }),
                    removedWithEventTypeIds: (capture.uniqueConstraint?.removedWithEventTypeIds ?? capture.uniqueEventType?.removedWithEventTypeIds ?? []).map(id => aliases[id]),
                    message: capture.uniqueConstraint?.message ?? capture.uniqueEventType?.message ?? '',
                    eventSequences: capture.eventSequences ?? []
                }))).deep.equal(test.constraintDefinitions);
                const scenario = new EventScenario({ artifacts: { eventTypes: selected, constraints: selectedConstraints } });
                const validate = vi.spyOn(InProcessConstraints.prototype, 'validate');
                const expected = fixture.expected.cases[caseIndex].result.outcomes;
                should(expected.length).equal(test.isolatedConstraintOperations.length);
                try {
                    for (const [index, operation] of test.isolatedConstraintOperations.entries()) {
                        const before = historyOf(scenario);
                        const entries = operation.events.map(entry => ({ eventSourceId: entry.source, event: new types[entry.type](entry.value) }));
                        const results = operation.mode === 'single'
                            ? [await scenario.append(entries[0].eventSourceId, entries[0].event)]
                            : await scenario.appendMany(entries);
                        const outcome = expected[index];
                        const raw = validate.mock.results.at(-1)!.value as ReturnType<InProcessConstraints['validate']>;
                        should(raw.map(({ SequenceNumber, ...violation }) => ({ ...violation, SequenceNumber: SequenceNumber.toString() })))
                            .deep.equal(outcome.wireViolations);
                        for (const [position, result] of results.entries()) {
                            should(result.isSuccess).equal(outcome.success);
                            should(result.sequenceNumber.value.toString()).equal(outcome.success ? outcome.sequences[position] : '0');
                            should(result.constraintViolations.map(violation => ({ id: violation.constraintId, message: violation.message, details: violation.details })))
                                .deep.equal(outcome.violations);
                            should(result.errors.map(error => error.message)).deep.equal(outcome.errors);
                        }
                        if (!outcome.success) should(historyOf(scenario)).deep.equal(before);
                        should(historyOf(scenario)).deep.equal(outcome.history);
                        should((await scenario.eventLog.getNextSequenceNumber()).value.toString()).equal(outcome.next);
                    }
                } finally {
                    validate.mockRestore();
                }
            });
        });
    }
}
