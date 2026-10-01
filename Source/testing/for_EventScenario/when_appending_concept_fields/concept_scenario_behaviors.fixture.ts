// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ConceptAs, type Constructor } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it, vi, type Assertion } from 'vitest';
import type { ChronicleConnection } from '../../../connection/index.js';
import { EventSequence } from '../../../eventSequences/EventSequence.js';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import type { AppendResult } from '../../../eventSequences/AppendResult.js';
import type { IUnitOfWorkManager } from '../../../transactions/IUnitOfWorkManager.js';
import { EventScenario, ReactorScenario, ReadModelScenario, UnsupportedEventSequenceOperation } from '../../index.js';

chai.should();

// Keep fluent should assertions typed without adding global Object declarations.
function should(value: unknown): Assertion {
    return (value as { should: Assertion }).should;
}

class InvalidKey extends ConceptAs<unknown> {}

export function conceptScenarioBehaviors(fixtures: {
    eventTypes: Constructor[];
    constraints: Constructor[];
    registered: (name: string) => object;
    flag: (value: boolean) => object;
    composite: (first: string, last: string) => object;
    model: Constructor<{ id: string; name: string }>;
    reactor: Constructor;
}): void {
    const artifacts = { eventTypes: fixtures.eventTypes, constraints: fixtures.constraints, reducers: [], projections: [] };
    let scenario: EventScenario;
    beforeEach(() => { scenario = new EventScenario({ artifacts }); });

    describe('when appending a concept-valued unique property', () => {
        let result: AppendResult;
        let connectedContent: string;
        beforeEach(async () => {
            const append = vi.fn().mockResolvedValue({ Response: { SequenceNumber: 0n, ConstraintViolations: [], Errors: [] } });
            const connected = new EventSequence(EventSequenceId.eventLog, 'store', 'Default',
                { eventSequences: { append } } as unknown as ChronicleConnection, {} as IUnitOfWorkManager);
            const event = fixtures.registered('Ada');
            await connected.append('author-1', event);
            connectedContent = append.mock.calls[0][0].Content as string;
            result = await scenario.append('author-1', event);
        });
        it('should accept the same event as the connected client', () => { should(result.isSuccess).be.true; });
        it('should store the same primitive content as the connected client', () => {
            should(scenario.appendedEvents[0].content).deep.equal(JSON.parse(connectedContent));
            should(scenario.appendedEvents[0].content).deep.equal({ name: 'Ada' });
        });
    });

    describe('when appending an empty string concept key', () => {
        let result: AppendResult;
        beforeEach(async () => { result = await scenario.append('author-1', fixtures.registered('')); });
        it('should preserve the empty primitive value', () => {
            should(result.isSuccess).be.true;
            should(scenario.appendedEvents[0].content).deep.equal({ name: '' });
        });
    });

    for (const value of [new InvalidKey(42), new InvalidKey('É'), new Date('2025-01-02T00:00:00.000Z')]) {
        describe(`when a constrained string field contains an unsupported ${value.constructor.name} value`, () => {
            let error: unknown;
            beforeEach(async () => {
                const event = fixtures.registered('Ada');
                Object.assign(event, { name: value });
                error = await scenario.append('author-1', event).then(() => undefined, reason => reason);
            });
            it('should reject before changing scenario state', () => {
                should(error instanceof UnsupportedEventSequenceOperation).be.true;
                should(scenario.appendedEvents).have.lengthOf(0);
                should(scenario.results).have.lengthOf(0);
            });
        });
    }

    describe('when claiming a seeded concept key from another source', () => {
        let result: AppendResult;
        beforeEach(async () => {
            await scenario.given.forEventSource('author-1').events(fixtures.registered('Ada'));
            result = await scenario.append('author-2', fixtures.registered('Ada'));
        });
        it('should reject the duplicate primitive key', () => {
            should(result.isSuccess).be.false;
            should(result.constraintViolations[0].details).deep.equal({ PropertyName: 'name', PropertyValue: 'Ada' });
        });
        it('should preserve the seeded history', () => { should(scenario.appendedEvents).have.lengthOf(1); });
    });

    for (const mixed of [false, true]) {
        describe(`when appending concept fields in a ${mixed ? 'mixed-source' : 'single-source'} batch`, () => {
            let results: AppendResult[];
            beforeEach(async () => {
                const events = [fixtures.registered('Ada'), fixtures.registered('Grace')];
                results = mixed
                    ? await scenario.appendMany(events.map((event, index) => ({ eventSourceId: `author-${index}`, event })))
                    : await scenario.appendMany('author-1', events);
            });
            it('should accept both serialized concept values', () => {
                should(results.map(result => result.isSuccess)).deep.equal([true, true]);
                should(scenario.appendedEvents.map(event => event.content)).deep.equal([{ name: 'Ada' }, { name: 'Grace' }]);
            });
        });
    }

    describe('when a batch claims the same concept key twice', () => {
        let results: AppendResult[];
        beforeEach(async () => {
            results = await scenario.appendMany([
                { eventSourceId: 'author-1', event: fixtures.registered('Ada') },
                { eventSourceId: 'author-2', event: fixtures.registered('Ada') }
            ]);
        });
        it('should reject the entire batch without committing events', () => {
            should(results.map(result => result.isSuccess)).deep.equal([false, false]);
            should(scenario.appendedEvents).have.lengthOf(0);
        });
    });

    for (const value of [false, true]) {
        describe(`when claiming the boolean concept key ${value} twice`, () => {
            let accepted: AppendResult;
            let duplicate: AppendResult;
            beforeEach(async () => {
                accepted = await scenario.append('flag-1', fixtures.flag(value));
                duplicate = await scenario.append('flag-2', fixtures.flag(value));
            });
            it('should accept and serialize the boolean concept', () => {
                should(accepted.isSuccess).be.true;
                should(scenario.appendedEvents[0].content).deep.equal({ active: value });
            });
            it('should report the duplicate boolean key', () => {
                should(duplicate.isSuccess).be.false;
                should(duplicate.constraintViolations[0].details).deep.equal({ PropertyName: 'active', PropertyValue: value ? 'True' : 'False' });
            });
        });
    }

    describe('when a composite concept key differs only in casing', () => {
        let duplicate: AppendResult;
        beforeEach(async () => {
            await scenario.append('name-1', fixtures.composite('Ada', 'Lovelace'));
            duplicate = await scenario.append('name-2', fixtures.composite('ADA', 'LOVELACE'));
        });
        it('should compare serialized components and retain original values in violations', () => {
            should(duplicate.isSuccess).be.false;
            should(duplicate.constraintViolations.map(violation => violation.details.PropertyValue)).deep.equal(['ADA', 'LOVELACE']);
        });
    });

    describe('when observing accepted concept fields in a read model', () => {
        let name: string;
        beforeEach(async () => {
            const models = new ReadModelScenario(fixtures.model, artifacts).observe(scenario);
            await scenario.append('author-1', fixtures.registered('Ada'));
            name = (await models.instanceForEventSourceId('author-1'))!.name;
        });
        it('should project the serialized primitive', () => { should(name).equal('Ada'); });
    });

    describe('when delivering concept fields through a reactor and observing its explicit append', () => {
        let reactorScenario: ReactorScenario;
        let name: string;
        beforeEach(async () => {
            reactorScenario = new ReactorScenario(fixtures.reactor, { artifacts });
            const models = new ReadModelScenario(fixtures.model, artifacts).observe(reactorScenario);
            await reactorScenario.when.forEventSource('author-1').events(fixtures.registered('Ada'));
            name = (await models.instanceForEventSourceId('author-1'))!.name;
        });
        it('should complete the delivery and explicit concept append', () => {
            should(reactorScenario.results[0].completed).be.true;
            should(reactorScenario.appendedEvents.map(event => event.content)).deep.equal([{ name: 'Ada' }, { name: 'Ada' }]);
        });
        it('should expose the serialized primitive to the observing read model', () => { should(name).equal('Ada'); });
    });
}
