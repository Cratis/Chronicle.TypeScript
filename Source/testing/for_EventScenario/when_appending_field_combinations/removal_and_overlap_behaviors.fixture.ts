// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { chai, describe, it, vi, type Assertion } from 'vitest';
import { constraint } from '../../../events/constraints/constraint.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import { getEventTypeMetadata } from '../../../events/eventTypeDecorator.js';
import type { JsonSchema } from '../../../schemas/JsonSchema.js';
import { EventScenario } from '../../EventScenario.js';
import { InProcessConstraints } from '../../InProcessConstraints.js';
import { UnsupportedEventSequenceOperation } from '../../UnsupportedEventSequenceOperation.js';

chai.should();
const should = (value: unknown): Assertion => (value as { should: Assertion }).should;
type Constructor = new () => object;
type Types = Record<string, Constructor>;
type Declaration = { name: string; message: string; ignoreCasing: boolean; removedWithEventTypeIds: string[];
    events: { type: string; properties: string[] }[] };
type Entry = { source: string; type: string; value?: string; values?: Record<string, unknown> };
type Template = { name: string; eventSchemas: Record<string, { eventTypeId: string; properties: Record<string, string> }>;
    constraintDefinitions: Declaration[]; isolatedConstraintOperations: { mode: string; events: Entry[];
        options?: { sourceType: string; streamType: string; streamId: string } }[] };
type Fixture = { fieldCombinationCases: Template[]; expected: { cases: { name: string;
    outcomes: { success: boolean; sequences: string[]; wireViolations: unknown[]; next: string }[] }[] } };

function definition(types: Types, declaration: Declaration, mask: number): Constructor {
    class Definition {
        define(builder: IConstraintBuilder) {
            if (mask & 1) builder.perEventSourceType();
            if (mask & 2) builder.perEventStreamType();
            if (mask & 4) builder.perEventStreamId();
            builder.unique(key => {
                key.withMessage(declaration.message);
                for (const entry of declaration.events) key.on(types[entry.type], ...entry.properties.map(property =>
                    (event: object) => (event as Record<string, unknown>)[property]));
                for (const alias of declaration.removedWithEventTypeIds) key.removedWith(types[alias]);
                if (declaration.ignoreCasing) key.ignoreCasing();
            });
        }
    }
    constraint(declaration.name)(Definition);
    return Definition;
}

function eventFor(entry: Entry, types: Types): object {
    return Object.assign(new types[entry.type](), entry.values ?? (entry.value === undefined ? {} : { key: entry.value }));
}

function replay(fixture: Fixture, template: Template, mask: number, types: Types): void {
    it(`should replay ${template.name} with scope mask ${mask}, including raw violations and rollback`, async () => {
        const selected = Object.keys(template.eventSchemas).map(alias => types[alias]);
        for (const [alias, schema] of Object.entries(template.eventSchemas)) {
            const metadata = getEventTypeMetadata(types[alias])!;
            should(metadata.eventType.id.value).equal(schema.eventTypeId);
            should(Object.keys(metadata.schema.properties!).sort()).deep.equal(Object.keys(schema.properties).sort());
        }
        const constraints = template.constraintDefinitions.map(declaration => definition(types, declaration, mask));
        const scenario = new EventScenario({ artifacts: { eventTypes: selected, constraints } });
        const expected = fixture.expected.cases.find(test => test.name === `${template.name}-${mask}`)!.outcomes;
        should(expected.length).equal(template.isolatedConstraintOperations.length);
        const validate = vi.spyOn(InProcessConstraints.prototype, 'validate');
        try {
            for (const [index, operation] of template.isolatedConstraintOperations.entries()) {
                const before = [...scenario.appendedEvents];
                const events = operation.events.map(entry => ({ eventSourceId: entry.source, event: eventFor(entry, types) }));
                const results = operation.mode === 'single'
                    ? [await scenario.append(events[0].eventSourceId, events[0].event, operation.options)]
                    : await scenario.appendMany(events, operation.options);
                const outcome = expected[index];
                should(results.every(result => result.isSuccess === outcome.success)).equal(true);
                should(results.map(result => result.sequenceNumber.value.toString())).deep.equal(
                    outcome.success ? outcome.sequences : results.map(() => '0'));
                const raw = validate.mock.results.at(-1)!.value as ReturnType<InProcessConstraints['validate']>;
                should(raw.map(({ SequenceNumber, ...violation }) => ({ ...violation, SequenceNumber: SequenceNumber.toString() })))
                    .deep.equal(outcome.wireViolations);
                if (!outcome.success) should(scenario.appendedEvents).deep.equal(before);
                else should(scenario.appendedEvents.slice(before.length).map(event => event.content)).deep.equal(
                    events.map(entry => JSON.parse(JSON.stringify(entry.event))));
                should((await scenario.eventSequence.getNextSequenceNumber()).value.toString()).equal(outcome.next);
            }
        } finally { validate.mockRestore(); }
    });
}

function overlapDeclarations(template: Template, variation: string): Declaration[] {
    const declarations = structuredClone(template.constraintDefinitions);
    if (variation === 'same-property') declarations[1].events = structuredClone(declarations[0].events);
    if (variation === 'ignore-casing') declarations[1].ignoreCasing = true;
    if (variation === 'composite') declarations[1].events.forEach(entry => entry.properties.push('key'));
    if (variation === 'removal') declarations[1].removedWithEventTypeIds = ['removed'];
    if (variation === 'third-definition') declarations.push({ ...declarations[1], name: 'OracleThird' });
    return declarations;
}

function overlapRejections(template: Template, types: Types): void {
    for (const variation of ['same-property', 'different-scope', 'ignore-casing', 'composite', 'removal', 'third-definition', 'mixed-kind']) {
        it(`should reject unmeasured overlap: ${variation}`, () => {
            const declarations = overlapDeclarations(template, variation);
            const constraints = declarations.map((declaration, index) => definition(types, declaration, variation === 'different-scope' && index === 1 ? 1 : 0));
            if (variation === 'mixed-kind') {
                class Once { define(builder: IConstraintBuilder) { builder.uniqueFor(types.number, 'Once', 'OracleOnce'); } }
                constraint('OracleOnce')(Once);
                constraints[1] = Once;
            }
            const eventTypes = Object.keys(template.eventSchemas).map(alias => types[alias]);
            if (variation === 'removal') eventTypes.push(types.removed);
            should(() => new EventScenario({ artifacts: { eventTypes, constraints } }))
                .throw(UnsupportedEventSequenceOperation);
        });
    }
}

function fieldlessRejections(types: Types): void {
    for (const [label, alias, properties, ignoreCasing] of [
        ['composite', 'number', ['key', 'suffix'], false],
        ['ignore-casing', 'string', ['key'], true],
        ['boolean', 'boolean', ['key'], false]
    ] as const) {
        it(`should reject an unmeasured scoped fieldless remover: ${label}`, () => {
            const declaration: Declaration = { name: 'OracleFieldlessRejected', message: 'Taken', ignoreCasing,
                removedWithEventTypeIds: ['removed'], events: [{ type: alias, properties: [...properties] }] };
            const constraints = [definition(types, declaration, 1)];
            should(() => new EventScenario({ artifacts: { eventTypes: [types[alias], types.removed], constraints } }))
                .throw(UnsupportedEventSequenceOperation, 'Scoped fieldless removers require');
        });
    }
    it('should identify an unrelated fieldless event accurately', () => {
        should(() => new EventScenario({ artifacts: { eventTypes: [types.removed] }, constraints: 'disabled' }))
            .throw(UnsupportedEventSequenceOperation, 'Fieldless events must be removal-only types');
    });
}

function unprovenOverlapKeyRejections(types: Types): void {
    const schemas: JsonSchema[] = [
        { type: 'number', format: 'double' }, { type: 'number', format: 'decimal' }, { type: 'number', format: 'float' },
        { type: 'string', format: 'date' }, { type: 'string', format: 'date-time' }, { type: 'string', format: 'email' },
        { type: 'boolean' }, { type: 'integer' }, { type: 'object' }, { type: 'array' }
    ];
    for (const schema of schemas) {
        it(`should reject overlapping ${schema.type}/${schema.format} and string keys on one event type`, () => {
            const properties = getEventTypeMetadata(types.formatted)!.schema.properties!;
            const original = properties.key;
            properties.key = schema;
            try {
                const declaration: Declaration = { name: 'OracleUnprovenKey', message: 'Taken', ignoreCasing: false,
                    removedWithEventTypeIds: [], events: [{ type: 'formatted', properties: ['key'] }] };
                const stringDeclaration: Declaration = { ...declaration, name: 'OracleIndependentString',
                    events: [{ type: 'formatted', properties: ['suffix'] }] };
                const constraints = [declaration, stringDeclaration].map(entry => definition(types, entry, 0));
                should(() => new EventScenario({ artifacts: { eventTypes: [types.formatted], constraints } }))
                    .throw(UnsupportedEventSequenceOperation, 'Overlapping constraints are not fixture-backed.');
            } finally { properties.key = original; }
        });
    }
}

function claimRemoveRejection(fixture: Fixture, template: Template, mask: number, types: Types): void {
    it(`should reject covered/removal extended keys under scope mask ${mask}`, () => {
        // The kernel checks a covered/removal claim but does not retain it durably.
        const outcomes = fixture.expected.cases.find(test => test.name === `${template.name}-${mask}`)!.outcomes;
        should(outcomes.slice(0, 3).map(outcome => outcome.success)).deep.equal([true, true, false]);
        const constraints = template.constraintDefinitions.map(declaration => definition(types, declaration, mask));
        should(() => new EventScenario({ artifacts: { eventTypes: [types.number, types.guid, types.string], constraints } }))
            .throw(UnsupportedEventSequenceOperation, 'covered-and-removal');
    });
}

function registerTemplate(fixture: Fixture, template: Template, types: Types): void {
    for (let mask = 0; mask < 8; mask++) {
        if (template.name === 'claim-remove') claimRemoveRejection(fixture, template, mask, types);
        else replay(fixture, template, mask, types);
    }
    if (template.name === 'overlapping') overlapRejections(template, types);
}

function registerFixture(name: string, types: Types): void {
    const fixture = JSON.parse(readFileSync(new URL(`../../fixtures/constraints-${name}.json`, import.meta.url), 'utf8')) as Fixture;
    describe(`with ${name}`, () => {
        it('should retain every measured scope case', () => {
            const expectedNames = fixture.fieldCombinationCases.flatMap(test => Array.from({ length: 8 }, (_, mask) => `${test.name}-${mask}`));
            should(expectedNames.length).equal(name === 'removal-combinations' ? 16 : 8);
            should(fixture.expected.cases.map(test => test.name)).deep.equal(expectedNames);
        });
        for (const template of fixture.fieldCombinationCases) registerTemplate(fixture, template, types);
    });
}

export function removalAndOverlapBehaviors(types: Types): void {
    fieldlessRejections(types);
    unprovenOverlapKeyRejections(types);
    for (const name of ['removal-combinations', 'overlapping-definitions']) registerFixture(name, types);
}
