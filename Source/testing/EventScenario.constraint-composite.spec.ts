// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { chai, describe, it, vi } from 'vitest';
import { field } from '@cratis/fundamentals';
import { eventType, getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import { constraint } from '../events/constraints/constraint.js';
import { compileConstraints } from '../events/constraints/Constraints.js';
import type { IConstraint } from '../events/constraints/IConstraint.js';
import type { IConstraintBuilder } from '../events/constraints/IConstraintBuilder.js';
import { EventScenario, UnsupportedEventSequenceOperation } from './index.js';
import { InProcessConstraints } from './InProcessConstraints.js';
import { ReactorScenario } from './ReactorScenario.js';
import { reactor } from '../reactors/reactor.js';

chai.should();
class OracleDomainText { @field(String) key: string; constructor(key: string) { this.key = key; } }
eventType('OracleDomainText')(OracleDomainText);
class OracleDomainRemoved { @field(String) label: string; constructor(label: string) { this.label = label; } }
eventType('OracleDomainRemoved')(OracleDomainRemoved);
class OracleCompositeName {
    @field(String) first: string; @field(String) last: string;
    constructor(first: string, last: string) { this.first = first; this.last = last; }
}
eventType('OracleCompositeName')(OracleCompositeName);
class OracleCompositeAlias {
    @field(String) given: string; @field(String) family: string;
    constructor(given: string, family: string) { this.given = given; this.family = family; }
}
eventType('OracleCompositeAlias')(OracleCompositeAlias);
class OracleCompositeTriple {
    @field(String) first: string; @field(String) middle: string; @field(String) last: string;
    constructor(first: string, middle: string, last: string) { this.first = first; this.middle = middle; this.last = last; }
}
eventType('OracleCompositeTriple')(OracleCompositeTriple);

// Declared order differs from field order on the alias type: family, then given.
class FullName implements IConstraint {
    define(builder: IConstraintBuilder) {
        builder.unique(key => key.on(OracleCompositeName, event => event.first, event => event.last)
            .on(OracleCompositeAlias, event => event.family, event => event.given)
            .on(OracleDomainText, event => event.key)
            .removedWith(OracleDomainRemoved).withMessage('Taken: {PropertyName}={PropertyValue}'));
    }
}
constraint('OracleFullName')(FullName);
class Triple implements IConstraint {
    define(builder: IConstraintBuilder) {
        builder.unique(key => key.on(OracleCompositeTriple, event => event.first, event => event.middle, event => event.last));
    }
}
constraint('OracleTriple')(Triple);

const aliases = { string: OracleDomainText, removed: OracleDomainRemoved, name: OracleCompositeName,
    alias: OracleCompositeAlias, triple: OracleCompositeTriple };
type Alias = keyof typeof aliases;
type Input = { source: string; type: Alias; value?: string; values?: Record<string, string> };
type History = { sequence: string; source: string; sourceType: string; streamType: string; streamId: string;
    type: string; content: Record<string, string>; hash: string };
type Violation = { EventTypeId: string; SequenceNumber: string; ConstraintType: number; ConstraintName: string;
    Message: string; Details: Record<string, string> };
type Outcome = { success: boolean; sequences: string[]; violations: Array<{ id: string; message: string; details: Record<string, string> }>;
    wireViolations: Violation[]; errors: string[]; history: History[]; next: string };
type Fixture = { eventSchemas: Record<string, { eventTypeId: string; properties: Record<string, string> }>;
    constraintDefinitions: Array<{ kind: string; name: string; events: Array<{ type: string; properties: string[] }>;
        ignoreCasing: boolean; removedWithEventTypeIds: string[]; message: string }>;
    isolatedConstraintOperations: Array<{ mode: 'single' | 'batch'; events: Input[] }>;
    expected: { outcomes: Outcome[] } };
const aliasById = Object.fromEntries(Object.entries(aliases).map(([alias, type]) => [getEventTypeMetadata(type)!.eventType.id.value, alias]));
const makeEvent = ({ type, value, values }: Input): object => {
    switch (type) {
        case 'string': return new OracleDomainText(value!);
        case 'removed': return new OracleDomainRemoved(value!);
        case 'name': return new OracleCompositeName(values!.first, values!.last);
        case 'alias': return new OracleCompositeAlias(values!.given, values!.family);
        case 'triple': return new OracleCompositeTriple(values!.first, values!.middle, values!.last);
    }
};
const historyOf = (scenario: EventScenario): History[] => scenario.appendedEvents.map(entry => ({
    sequence: entry.context.sequenceNumber.toString(), source: entry.context.eventSourceId,
    sourceType: entry.context.eventSourceType, streamType: entry.context.eventStreamType, streamId: entry.context.eventStreamId,
    type: entry.eventType.id.value, content: entry.content as Record<string, string>, hash: entry.context.hash
}));
const unsupported = async (action: () => unknown, operation: string, reason: string) => {
    await Promise.resolve().then(action).then(() => { throw new Error('Expected rejection'); }, error => {
        (error instanceof UnsupportedEventSequenceOperation).should.be.true;
        (error as Error).message.should.include(`UnsupportedEventSequenceOperation: ${operation}:`);
        (error as Error).message.should.include(reason);
        (error as Error).message.should.include('Use a kernel-backed test.');
    });
};
const compositeTypes = Object.values(aliases);
const shapeReason = 'Only one to three distinct flat properties per event type are fixture-backed; nested, indexed or repeated key paths are not.';

async function matchesFixture(name: string, selected: readonly Function[], constraints: readonly Function[]) {
    const fixture = JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as Fixture;
    const ids = new Set(selected);
    Object.fromEntries(Object.entries(aliases).filter(([, type]) => ids.has(type)).map(([alias, type]) => {
        const metadata = getEventTypeMetadata(type)!;
        return [alias, { eventTypeId: metadata.eventType.id.value,
            properties: Object.fromEntries(Object.entries(metadata.schema.properties ?? {}).map(([key, property]) => [key, property.type])) }];
    })).should.deep.equal(fixture.eventSchemas);
    const compiled = compileConstraints({ eventTypes: [...selected], constraints: [...constraints] });
    [...compiled].map(([key, capture]) => ({ kind: 'uniqueProperty', name: key,
        events: capture.uniqueConstraint!.eventDefinitions.map(entry => ({ type: aliasById[entry.eventTypeId], properties: entry.properties })),
        ignoreCasing: capture.uniqueConstraint!.ignoreCasing,
        removedWithEventTypeIds: (capture.uniqueConstraint!.removedWithEventTypeIds ?? []).map(id => aliasById[id]),
        message: capture.uniqueConstraint!.message ?? ''
    })).should.deep.equal(fixture.constraintDefinitions);
    fixture.isolatedConstraintOperations.length.should.be.greaterThan(0);
    fixture.expected.outcomes.length.should.equal(fixture.isolatedConstraintOperations.length);
    fixture.expected.outcomes.some(outcome => !outcome.success).should.be.true;
    const scenario = new EventScenario({ artifacts: { eventTypes: [...selected], constraints: [...constraints] } });
    const notifications = scenario.eventSequence.appendOperations[Symbol.asyncIterator]();
    const validate = vi.spyOn(InProcessConstraints.prototype, 'validate');
    let count = 0;
    try {
        for (const [index, operation] of fixture.isolatedConstraintOperations.entries()) {
            const expected = fixture.expected.outcomes[index];
            const before = historyOf(scenario);
            const calls = validate.mock.calls.length;
            const nextNotification = notifications.next();
            const results = operation.mode === 'single'
                ? [await scenario.append(operation.events[0].source, makeEvent(operation.events[0]))]
                : await scenario.appendMany(operation.events.map(entry => ({ eventSourceId: entry.source, event: makeEvent(entry) })));
            const notification = (await nextNotification).value!;
            validate.mock.calls.length.should.equal(calls + 1);
            const raw = validate.mock.results.at(-1)?.value as ReturnType<InProcessConstraints['validate']>;
            raw.map(({ SequenceNumber, ...violation }) => ({ ...violation, SequenceNumber: SequenceNumber.toString() }))
                .should.deep.equal(expected.wireViolations);
            notification.length.should.equal(operation.events.length);
            notification.every(item => item.result.isSuccess === expected.success).should.be.true;
            count += operation.events.length;
            scenario.results.length.should.equal(count);
            results.length.should.equal(operation.events.length);
            for (const [position, result] of results.entries()) {
                result.isSuccess.should.equal(expected.success);
                result.sequenceNumber.value.toString().should.equal(expected.success ? expected.sequences[position] : '0');
                result.constraintViolations.map(item => ({ id: item.constraintId, message: item.message, details: item.details }))
                    .should.deep.equal(expected.violations);
                result.errors.map(item => item.message).should.deep.equal(expected.errors);
            }
            if (!expected.success) historyOf(scenario).should.deep.equal(before);
            historyOf(scenario).should.deep.equal(expected.history);
            (await scenario.eventSequence.getNextSequenceNumber()).value.toString().should.equal(expected.next);
        }
    } finally {
        validate.mockRestore();
        await notifications.return?.();
    }
}

describe('fixture-backed composite unique-property keys', () => {
    it('matches the pinned kernel constraints-composite: declared order, dash joining, per-property violations, hashes and rollback',
        () => matchesFixture('constraints-composite', compositeTypes, [FullName, Triple]));

    it('rejects a repeated key path at the key-shape check, while the distinct shape is accepted', async () => {
        class Repeated implements IConstraint {
            define(builder: IConstraintBuilder) {
                builder.unique(key => key.on(OracleCompositeName, event => event.first, event => event.first));
            }
        }
        constraint('OracleRepeatedPath')(Repeated);
        class Distinct implements IConstraint {
            define(builder: IConstraintBuilder) {
                builder.unique(key => key.on(OracleCompositeName, event => event.first, event => event.last));
            }
        }
        constraint('OracleRepeatedPath')(Distinct);
        new EventScenario({ artifacts: { eventTypes: [OracleCompositeName], constraints: [Distinct] } }).should.be.instanceOf(EventScenario);
        await unsupported(() => new EventScenario({ artifacts: { eventTypes: [OracleCompositeName], constraints: [Repeated] } }),
            'artifacts.constraints (OracleRepeatedPath)', shapeReason);
    });

    it('rejects four key properties at the key-shape check, while three are accepted', async () => {
        class Quad {
            @field(String) a = 'a'; @field(String) b = 'b'; @field(String) c = 'c'; @field(String) d = 'd';
        }
        eventType('OracleCompositeQuad')(Quad);
        class Four implements IConstraint {
            define(builder: IConstraintBuilder) {
                builder.unique(key => key.on(Quad, event => event.a, event => event.b, event => event.c, event => event.d));
            }
        }
        constraint('OracleQuad')(Four);
        class Three implements IConstraint {
            define(builder: IConstraintBuilder) { builder.unique(key => key.on(Quad, event => event.a, event => event.b, event => event.c)); }
        }
        constraint('OracleQuad')(Three);
        new EventScenario({ artifacts: { eventTypes: [Quad], constraints: [Three] } }).should.be.instanceOf(EventScenario);
        await unsupported(() => new EventScenario({ artifacts: { eventTypes: [Quad], constraints: [Four] } }),
            'artifacts.constraints (OracleQuad)', shapeReason);
    });

    it('rejects a composite with a boolean component, while the boolean alone is accepted', async () => {
        class Mixed { @field(String) label = 'x'; @field(Boolean) active = true; }
        eventType('OracleCompositeMixed')(Mixed);
        class Composite implements IConstraint {
            define(builder: IConstraintBuilder) { builder.unique(key => key.on(Mixed, event => event.label, event => event.active)); }
        }
        constraint('OracleMixed')(Composite);
        class Single implements IConstraint {
            define(builder: IConstraintBuilder) { builder.unique(key => key.on(Mixed, event => event.active)); }
        }
        constraint('OracleMixed')(Single);
        new EventScenario({ artifacts: { eventTypes: [Mixed], constraints: [Single] } }).should.be.instanceOf(EventScenario);
        await unsupported(() => new EventScenario({ artifacts: { eventTypes: [Mixed], constraints: [Composite] } }),
            'artifacts.constraints (OracleMixed)', 'Every property of a composite key must be a schema-backed string.');
    });

    it('rejects an unproven component value in a batch and leaves history, results and claims unchanged', async () => {
        const scenario = new EventScenario({ artifacts: { eventTypes: compositeTypes, constraints: [FullName, Triple] } });
        (await scenario.append('A', new OracleCompositeName('Ada', 'Lovelace'))).isSuccess.should.be.true;
        const before = historyOf(scenario);
        const results = [...scenario.results];
        await unsupported(() => scenario.appendMany([{ eventSourceId: 'B', event: new OracleCompositeName('Grace', 'Hopper') },
            { eventSourceId: 'C', event: new OracleCompositeName('Ada', 'Love!') }]), 'artifacts.constraints (OracleFullName)',
        'Only fixture-backed scalar string and boolean keys are supported.');
        historyOf(scenario).should.deep.equal(before);
        scenario.results.should.deep.equal(results);
        (await scenario.append('D', new OracleCompositeName('Grace', 'Hopper'))).isSuccess.should.be.true;
        (await scenario.append('E', new OracleCompositeName('Ada', 'Lovelace'))).constraintViolations
            .map(item => item.message).should.deep.equal(['Taken: first=Ada', 'Taken: last=Lovelace']);
    });

    it('rolls back a setup call that ends in a delimiter collision', async () => {
        const scenario = new EventScenario({ artifacts: { eventTypes: compositeTypes, constraints: [FullName, Triple] } });
        await scenario.given.forEventSource('A').events(new OracleCompositeName('a-b', 'c'));
        await scenario.given.forEventSource('B').events(new OracleCompositeName('x', 'y'), new OracleCompositeName('a', 'b-c'))
            .then(() => { throw new Error('Invalid setup succeeded'); }, error => {
                (error as Error).message.should.include('EventScenario given setup failed');
            });
        historyOf(scenario).map(entry => entry.source).should.deep.equal(['A']);
        (await scenario.append('C', new OracleCompositeName('x', 'y'))).isSuccess.should.be.true;
    });

    it('delivers only committed composite claims to a reactor', async () => {
        const calls: string[] = [];
        @reactor('composite-reactor')
        class CompositeReactor {
            oracleCompositeName(event: OracleCompositeName) { calls.push(`${event.first}/${event.last}`); }
            oracleCompositeAlias(event: OracleCompositeAlias) { calls.push(`${event.family}/${event.given}`); }
        }
        const subject = new ReactorScenario(CompositeReactor, { artifacts: { eventTypes: compositeTypes, constraints: [FullName, Triple] } });
        await subject.when.forEventSource('A').events(new OracleCompositeName('Ada', 'Lovelace'));
        await subject.when.forEventSource('B').events(new OracleCompositeAlias('Lovelace', 'Ada'))
            .then(() => { throw new Error('Colliding alias delivered'); }, error => {
                (error as Error).message.should.include('ReactorScenario action append failed');
            });
        await subject.when.forEventSource('B').events(new OracleCompositeAlias('Ada', 'Lovelace'));
        calls.should.deep.equal(['Ada/Lovelace', 'Lovelace/Ada']);
    });
});
