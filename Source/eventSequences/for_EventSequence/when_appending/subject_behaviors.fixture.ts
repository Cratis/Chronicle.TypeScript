// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { resolveEventSubject } from '../../../compliance/resolveEventSubject.js';
import { Guid, type Constructor } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it, vi, type Assertion } from 'vitest';
import type { ChronicleConnection } from '../../../connection/index.js';
import { EventSequence } from '../../EventSequence.js';
import { EventSequenceId } from '../../EventSequenceId.js';
import { EventScenario } from '../../../testing/EventScenario.js';
import { UnitOfWork } from '../../../transactions/UnitOfWork.js';
import type { IUnitOfWorkManager } from '../../../transactions/IUnitOfWorkManager.js';
import type { IEventStore } from '../../../IEventStore.js';

const should = chai.should();
function check(value: unknown): Assertion { return (value as { should: Assertion }).should; }

export function subjectBehaviors(fixtures: {
    types: Constructor[];
    annotated: (value: string) => object;
    inherited: (value: string) => object;
    concept: (value: string) => object;
    unannotated: () => object;
}): void {
    function connected() {
        const append = vi.fn().mockResolvedValue({ Response: { SequenceNumber: 0n } });
        const appendManyForEventSources = vi.fn().mockImplementation(async (request: { Events: object[] }) => ({
            Response: { SequenceNumbers: request.Events.map((_, index) => BigInt(index)) }
        }));
        const manager = {} as IUnitOfWorkManager;
        const sequence = new EventSequence(EventSequenceId.eventLog, 'store', 'Default',
            { eventSequences: { append, appendManyForEventSources } } as unknown as ChronicleConnection, manager);
        const unitOfWork = new UnitOfWork(Guid.create(), () => {},
            { getEventSequence: () => sequence } as unknown as IEventStore);
        Object.assign(manager, { current: unitOfWork });
        return { sequence, unitOfWork, append, appendManyForEventSources };
    }
    function scenario() {
        return new EventScenario({ artifacts: { eventTypes: fixtures.types, constraints: [] }, constraints: 'disabled' });
    }

    const cases = [
        { name: 'an annotated subject', event: () => fixtures.annotated('person'), expected: 'person', stored: 'person' },
        { name: 'an inherited annotated subject', event: () => fixtures.inherited('person'), expected: 'person', stored: 'person' },
        { name: 'a concept subject', event: () => fixtures.concept('person'), expected: 'person', stored: 'person' },
        { name: 'an empty annotated string', event: () => fixtures.annotated(''), expected: '', stored: 'source' },
        { name: 'a whitespace annotated string', event: () => fixtures.annotated('  '), expected: '  ', stored: 'source' },
        { name: 'an empty concept subject', event: () => fixtures.concept(''), expected: 'source', stored: 'source' },
        { name: 'no annotation despite an id property', event: fixtures.unannotated, expected: 'source', stored: 'source' }
    ];
    for (const testCase of cases) {
        describe(`when appending with ${testCase.name}`, () => {
            let wireSubjects: string[];
            let scenarioSubjects: (string | undefined)[];
            beforeEach(async () => {
                const client = connected();
                const memory = scenario();
                await client.sequence.append('source', testCase.event());
                await memory.append('source', testCase.event());
                await client.sequence.appendMany('source', [testCase.event()]);
                await memory.appendMany('source', [testCase.event()]);
                await client.sequence.appendMany([{ eventSourceId: 'source', event: testCase.event() }]);
                await memory.appendMany([{ eventSourceId: 'source', event: testCase.event() }]);
                wireSubjects = [client.append.mock.calls[0][0].Subject,
                    ...client.appendManyForEventSources.mock.calls.map(call => call[0].Events[0].Subject)];
                scenarioSubjects = memory.appendedEvents.map(event => event.context.subject);
            });
            it('should select the wire subject using .NET value semantics in every append overload', () => {
                check(wireSubjects).deep.equal([testCase.expected, testCase.expected, testCase.expected]);
            });
            it('should record the kernel subject in every scenario append overload', () => {
                check(scenarioSubjects).deep.equal([testCase.stored, testCase.stored, testCase.stored]);
            });
        });
    }
    for (const testCase of [
        { value: undefined, expected: 'source' },
        { value: 0, expected: '0' },
        { value: false, expected: 'false' },
        { value: Guid.as('00000000-0000-0000-0000-000000000001'), expected: '00000000-0000-0000-0000-000000000001' },
        { value: { toString: () => '' }, expected: 'source' },
        { value: { toString: () => null }, expected: 'source' }
    ]) {
        describe(`when an annotated property contains ${String(testCase.value)}`, () => {
            let subjects: string[];
            beforeEach(async () => {
                const client = connected();
                const event = fixtures.annotated('person');
                Reflect.set(event, 'personId', testCase.value);
                await client.sequence.append('source', event);
                await client.sequence.appendMany('source', [event]);
                await client.sequence.appendMany([{ eventSourceId: 'source', event }]);
                subjects = [client.append.mock.calls[0][0].Subject,
                    ...client.appendManyForEventSources.mock.calls.map(call => call[0].Events[0].Subject)];
            });
            it('should preserve .NET conversion and null fallback in every append overload', () => {
                check(subjects).deep.equal([testCase.expected, testCase.expected, testCase.expected]);
            });
        });
    }
    describe('when resolving a null annotated property before serialization', () => {
        let selected: string | undefined;
        beforeEach(() => {
            const event = fixtures.annotated('person');
            Reflect.set(event, 'personId', null);
            selected = resolveEventSubject(event);
        });
        it('should leave the subject unresolved for source fallback', () => should.equal(selected, undefined));
    });
    for (const { subject, stored } of [
        { subject: 'explicit', stored: 'explicit' },
        { subject: '', stored: 'source' },
        { subject: '  ', stored: 'source' },
        { subject: '\t\r\n', stored: 'source' },
        { subject: '\u0085\u00a0', stored: 'source' },
        { subject: '\ufeff', stored: '\ufeff' },
        { subject: ' person ', stored: ' person ' }
    ]) {
        describe(`when overriding the annotation with ${JSON.stringify(subject)}`, () => {
            let wireSubject: string;
            let scenarioSubject: string | undefined;
            beforeEach(async () => {
                const client = connected();
                const memory = scenario();
                await client.sequence.append('source', fixtures.annotated('person'), { subject });
                await memory.append('source', fixtures.annotated('person'), { subject });
                wireSubject = client.append.mock.calls[0][0].Subject;
                scenarioSubject = memory.appendedEvents[0].context.subject;
            });
            it('should prefer the explicit subject', () => should.equal(wireSubject, subject));
            it('should record the kernel subject in the scenario', () => should.equal(scenarioSubject, stored));
        });
    }
    for (const overload of ['single source', 'multiple sources'] as const) {
        for (const subject of [undefined, 'shared', '', '  ']) {
            describe(`when appending a ${overload} batch with shared subject ${JSON.stringify(subject)}`, () => {
                let wireSubjects: string[];
                let scenarioSubjects: (string | undefined)[];
                beforeEach(async () => {
                    const client = connected();
                    const memory = scenario();
                    const events = [fixtures.annotated('person'), fixtures.concept('other'), fixtures.unannotated()];
                    if (overload === 'single source') {
                        await client.sequence.appendMany('source', events, { subject });
                        await memory.appendMany('source', events, { subject });
                    } else {
                        const entries = events.map((event, index) => ({ eventSourceId: 'source', event, subject: index === 0 ? 'entry' : undefined }));
                        await client.sequence.appendMany(entries, { subject });
                        await memory.appendMany(entries, { subject });
                    }
                    wireSubjects = client.appendManyForEventSources.mock.calls[0][0].Events.map((entry: { Subject: string }) => entry.Subject);
                    scenarioSubjects = memory.appendedEvents.map(event => event.context.subject);
                });
                it('should prefer entry then shared then annotation then source', () => {
                    check(wireSubjects).deep.equal([overload === 'multiple sources' ? 'entry' : subject ?? 'person', subject ?? 'other', subject ?? 'source']);
                });
                it('should record the kernel subjects in the scenario', () => {
                    const stored = subject === '' || subject === '  ' ? 'source' : subject;
                    check(scenarioSubjects).deep.equal([overload === 'multiple sources' ? 'entry' : stored ?? 'person',
                        stored ?? 'other', stored ?? 'source']);
                });
            });
        }
    }
    for (const subject of ['', '  ', '\t\r\n', '\u0085\u00a0']) {
        describe(`when an entry has an explicit blank subject ${JSON.stringify(subject)}`, () => {
            let wireSubjects: string[];
            let scenarioSubjects: (string | undefined)[];
            beforeEach(async () => {
                const client = connected();
                const memory = scenario();
                const entries = [{ eventSourceId: 'source', event: fixtures.annotated('person'), subject }];
                await client.sequence.appendMany(entries, { subject: 'shared' });
                await memory.appendMany(entries, { subject: 'shared' });
                wireSubjects = client.appendManyForEventSources.mock.calls[0][0].Events.map((entry: { Subject: string }) => entry.Subject);
                scenarioSubjects = memory.appendedEvents.map(event => event.context.subject);
            });
            it('should not replace the blank entry subject on the wire', () => check(wireSubjects).deep.equal([subject]));
            it('should record the event source subject in the scenario', () => check(scenarioSubjects).deep.equal(['source']));
        });
    }
    describe('when committing transactional single and batch appends', () => {
        let subjects: string[];
        beforeEach(async () => {
            const client = connected();
            await client.sequence.transactional.append('source', fixtures.annotated('person'));
            await client.sequence.transactional.appendMany('source', [fixtures.concept('other'), fixtures.unannotated()]);
            await client.unitOfWork.commit();
            subjects = client.appendManyForEventSources.mock.calls[0][0].Events.map((entry: { Subject: string }) => entry.Subject);
        });
        it('should resolve each buffered event at append time', () => check(subjects).deep.equal(['person', 'other', 'source']));
    });
    for (const testCase of cases) {
        describe(`when seeding a scenario with ${testCase.name}`, () => {
            let subject: string | undefined;
            beforeEach(async () => {
                const memory = scenario();
                await memory.given.forEventSource('source').events(testCase.event());
                subject = memory.appendedEvents[0].context.subject;
            });
            it('should record the kernel subject through the append boundary', () => should.equal(subject, testCase.stored));
        });
    }
}
