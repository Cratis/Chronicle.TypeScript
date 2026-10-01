// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { chai, describe, it, vi, type Assertion } from 'vitest';
import type { Constructor } from '@cratis/fundamentals';
import { getEventTypeMetadata } from '../../../events/eventTypeDecorator.js';
import type { ConstraintScopeCapture } from '../../../events/constraints/ConstraintBuilder.js';
import { compileConstraints } from '../../../events/constraints/Constraints.js';
import type { AppendOptions } from '../../../eventSequences/AppendOptions.js';
import type { AppendedEventWithResult } from '../../../eventSequences/AppendedEventWithResult.js';
import { EventScenario, UnsupportedEventSequenceOperation } from '../../index.js';
import { InProcessConstraints } from '../../InProcessConstraints.js';

chai.should();
function should(value: unknown): Assertion { return (value as { should: Assertion }).should; }

type Entry = { source: string; type: string; value: string; sourceType?: string; streamType?: string; streamId?: string };
type Definition = { kind: string; name: string; scope: ConstraintScopeCapture; events?: Array<{ type: string; properties: string[] }>;
    eventTypes?: string[]; ignoreCasing?: boolean; removedWithEventTypeIds: string[]; message: string };
type History = { sequence: string; source: string; sourceType?: string; streamType?: string; streamId?: string;
    type: string; content: Record<string, unknown>; hash?: string };
type Outcome = { success: boolean; sequences: string[]; errors: string[];
    wireViolations: Array<{ EventTypeId: string; SequenceNumber: string; ConstraintType: number; ConstraintName: string; Message: string; Details: Record<string, string> }>;
    violations: Array<{ id: string; message: string; details: Record<string, string> }>; history: History[]; next: string };
type ScopeCase = { name: string; kind: string; eventSchemas: Record<string, { eventTypeId: string; properties: Record<string, string> }>;
    constraintDefinitions: Definition[];
    isolatedConstraintOperations: Array<{ label: string; mode: string; overload?: string; options?: AppendOptions; events: Entry[] }> };
type Fixture = { scopeCases: ScopeCase[]; expected: { cases: Array<{ name: string; result: { outcomes: Outcome[] } }> } };

export function scopeScenarioBehaviors(
    types: Record<string, new (value: string) => object>,
    constraints: (scope: ConstraintScopeCapture, kind: string) => Constructor[]
): void {
    const fixture = JSON.parse(readFileSync(new URL('../../fixtures/constraints-scopes.json', import.meta.url), 'utf8')) as Fixture;
    const historyOf = (scenario: EventScenario): History[] => scenario.appendedEvents.map(event => ({
        sequence: event.context.sequenceNumber.toString(), source: event.context.eventSourceId,
        sourceType: event.context.eventSourceType, streamType: event.context.eventStreamType, streamId: event.context.eventStreamId,
        type: event.eventType.id.value, content: event.content, hash: event.context.hash
    }));
    const aliases = Object.fromEntries(Object.entries(types).map(([alias, type]) => [getEventTypeMetadata(type)!.eventType.id.value, alias]));

    it('should retain all seven scope combinations for both constraint kinds and the alias guards', () => {
        should(fixture.scopeCases.map(test => test.name)).deep.equal([
            ...Array.from({ length: 7 }, (_, index) => ['property', 'cycle', 'once'].map(kind => `${kind}-${index + 1}`)).flat(),
            'property-delimiter-alias', 'cycle-delimiter-alias'
        ]);
        should(fixture.expected.cases.map(test => test.name)).deep.equal(fixture.scopeCases.map(test => test.name));
    });

    for (const [caseIndex, test] of fixture.scopeCases.entries()) {
        describe(`with ${test.name}`, () => {
            it(test.kind === 'oracleGuard' ? 'should reject delimiter routes before mutation' :
                'should match kernel violations, routes, hashes, atomic history and notifications', async () => {
                const definition = test.constraintDefinitions[0];
                const selected = Object.keys(test.eventSchemas).map(alias => types[alias]);
                const selectedConstraints = constraints(definition.scope, test.name.split('-')[0]);
                const compiled = compileConstraints({ eventTypes: selected, constraints: selectedConstraints });
                should(Object.fromEntries(Object.entries(test.eventSchemas).map(([alias]) => {
                    const metadata = getEventTypeMetadata(types[alias])!;
                    return [alias, { eventTypeId: metadata.eventType.id.value,
                        properties: Object.fromEntries(Object.entries(metadata.schema.properties!).map(([key, property]) => [key, property.type])) }];
                }))).deep.equal(test.eventSchemas);
                should([...compiled].map(([name, capture]) => ({
                    kind: capture.uniqueConstraint ? 'uniqueProperty' : 'uniqueEventType', name,
                    ...(capture.uniqueConstraint ? {
                        events: capture.uniqueConstraint.eventDefinitions.map(entry => ({ type: aliases[entry.eventTypeId], properties: entry.properties })),
                        ignoreCasing: capture.uniqueConstraint.ignoreCasing
                    } : { eventTypes: (capture.uniqueEventType!.eventTypeIds ?? [capture.uniqueEventType!.eventTypeId]).map(id => aliases[id]) }),
                    removedWithEventTypeIds: (capture.uniqueConstraint?.removedWithEventTypeIds ?? capture.uniqueEventType?.removedWithEventTypeIds ?? []).map(id => aliases[id]),
                    message: capture.uniqueConstraint?.message ?? capture.uniqueEventType?.message ?? '', scope: capture.scope
                }))).deep.equal(test.constraintDefinitions);
                const scenario = new EventScenario({ artifacts: { eventTypes: selected, constraints: selectedConstraints } });
                const notifications = scenario.eventLog.appendOperations[Symbol.asyncIterator]();
                if (test.kind === 'oracleGuard') {
                    const pending = notifications.next();
                    try {
                        for (const operation of test.isolatedConstraintOperations) {
                            const entry = operation.events[0];
                            await scenario.append(entry.source, new types[entry.type](entry.value), operation.options)
                                .then(() => { throw new Error('Unsupported route succeeded'); }, error => {
                                    should(error instanceof UnsupportedEventSequenceOperation).be.true;
                                    should((error as Error).message).include('Only simple routing identifiers');
                                    should((error as Error).message).include('Use a kernel-backed test.');
                                });
                            should(scenario.appendedEvents.length).equal(0);
                            should(scenario.results.length).equal(0);
                            should((await scenario.eventLog.getNextSequenceNumber()).value).equal(0n);
                        }
                        const accepted = await scenario.append('Safe', new types[test.isolatedConstraintOperations[0].events[0].type]('Safe'));
                        should(accepted.isSuccess).be.true;
                        should(((await pending).value as AppendedEventWithResult[])[0].result).equal(accepted);
                    } finally { await notifications.return?.(); }
                    return;
                }
                const validate = vi.spyOn(InProcessConstraints.prototype, 'validate');
                const expected = fixture.expected.cases[caseIndex].result.outcomes;
                should(expected.length).equal(test.isolatedConstraintOperations.length);
                let resultCount = 0;
                try {
                    for (const [index, operation] of test.isolatedConstraintOperations.entries()) {
                        const before = historyOf(scenario);
                        const nextNotification = notifications.next();
                        const entries = operation.events.map(entry => ({ eventSourceId: entry.source, event: new types[entry.type](entry.value),
                            eventSourceType: entry.sourceType, eventStreamType: entry.streamType, eventStreamId: entry.streamId }));
                        const results = operation.mode === 'single'
                            ? [await scenario.append(entries[0].eventSourceId, entries[0].event, operation.options)]
                            : operation.overload === 'source'
                                ? await scenario.appendMany(entries[0].eventSourceId, entries.map(entry => entry.event), operation.options)
                                : await scenario.appendMany(entries, operation.options);
                        const outcome = expected[index];
                        const raw = validate.mock.results.at(-1)!.value as ReturnType<InProcessConstraints['validate']>;
                        should(raw.map(({ SequenceNumber, ...violation }) => ({ ...violation, SequenceNumber: SequenceNumber.toString() })))
                            .deep.equal(outcome.wireViolations, operation.label);
                        should(results.length).equal(operation.events.length);
                        for (const [position, result] of results.entries()) {
                            should(result.isSuccess).equal(outcome.success, operation.label);
                            should(result.sequenceNumber.value.toString()).equal(outcome.success ? outcome.sequences[position] : '0');
                            should(result.constraintViolations.map(violation => ({ id: violation.constraintId, message: violation.message, details: violation.details })))
                                .deep.equal(outcome.violations, operation.label);
                            should(result.errors.map(error => error.message)).deep.equal(outcome.errors);
                        }
                        const notification = (await nextNotification).value as AppendedEventWithResult[];
                        should(notification.length).equal(results.length);
                        notification.forEach((entry, position) => should(entry.result).equal(results[position]));
                        resultCount += results.length;
                        should(scenario.results.length).equal(resultCount);
                        if (!outcome.success) should(historyOf(scenario)).deep.equal(before, operation.label);
                        should(historyOf(scenario)).deep.equal(outcome.history, operation.label);
                        should((await scenario.eventLog.getNextSequenceNumber()).value.toString()).equal(outcome.next);
                    }
                } finally {
                    validate.mockRestore();
                    await notifications.return?.();
                }
            });
        });
    }
}
