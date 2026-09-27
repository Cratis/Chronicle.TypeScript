// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { causationManager, CausationType } from '../auditing/index.js';
import { identityProvider, Identity } from '../identity/index.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { tag } from '../events/tagDecorator.js';
import { unique } from '../events/constraints/unique.js';
import { removeConstraint } from '../events/constraints/removeConstraint.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber.js';
import { EventScenario, UnsupportedEventSequenceOperation } from './index.js';

chai.should();

class Recorded {
    @field(String) name = 'recorded';
}
eventType('Recorded')(Recorded);
class PropertyUnique {
    @field(String) @unique() name = 'value';
}
eventType('PropertyUnique')(PropertyUnique);
class RemovesConstraint {
    @field(String) name = 'value';
}
eventType('RemovesConstraint')(RemovesConstraint);
removeConstraint('name')(RemovesConstraint);
class Tagged {
    @field(String) name = 'value';
}
eventType('Tagged')(Tagged);
tag('tagged')(Tagged);
class LaterGeneration {
    @field(String) name = 'value';
}
eventType('LaterGeneration', 2)(LaterGeneration);
class Tombstone {
    @field(String) name = 'value';
}
eventType('Tombstone', 1, true)(Tombstone);
class CommaId {
    @field(String) name = 'value';
}
eventType('Odd,Type')(CommaId);
class PaddedId {
    @field(String) name = 'value';
}
eventType(' PaddedId ')(PaddedId);

const scenario = () => new EventScenario({ artifacts: { eventTypes: [Recorded] }, constraints: 'disabled' });
const clean = (subject: EventScenario) => {
    subject.results.length.should.equal(0);
    subject.appendedEvents.length.should.equal(0);
};
function rejected(action: () => unknown, operation: string): void {
    try { action(); throw new Error(`Expected ${operation} rejection`); }
    catch (error) {
        (error instanceof UnsupportedEventSequenceOperation).should.be.true;
        (error as Error).message.should.include(operation);
        (error as Error).message.should.include('Use a kernel-backed test.');
    }
}
async function rejects(action: () => Promise<unknown>, operation: string): Promise<void> {
    await action().then(
        () => { throw new Error(`Expected ${operation} rejection`); },
        error => {
            (error instanceof UnsupportedEventSequenceOperation).should.be.true;
            (error as Error).message.should.include(operation);
            (error as Error).message.should.include('Use a kernel-backed test.');
        }
    );
}

describe('when the fixture-bounded event sequence encounters unproven operations', () => {
    for (const [type, operation] of [
        [PropertyUnique, 'artifacts.constraints'], [RemovesConstraint, 'artifacts.eventTypes.constraints'], [Tagged, 'tags'],
        [LaterGeneration, 'artifacts.eventTypes'], [Tombstone, 'artifacts.eventTypes'],
        [CommaId, 'artifacts.eventTypes.id'], [PaddedId, 'artifacts.eventTypes.id']
    ] as const) {
        it(`should reject ${type.name} during catalog validation`, () => {
            const subject = scenario();
            rejected(() => new EventScenario({ artifacts: { eventTypes: [type] },
                ...(type === PropertyUnique || type === RemovesConstraint ? {} : { constraints: 'disabled' as const }) }), operation);
            clean(subject);
        });
    }

    it('should reject migrations', () => {
        const subject = scenario();
        rejected(() => new EventScenario({ artifacts: { eventTypes: [Recorded], eventTypeMigrations: [class Migration {}] }, constraints: 'disabled' }), 'artifacts.eventTypeMigrations');
        clean(subject);
    });
    it('should reject custom namespace', () => {
        const subject = scenario();
        rejected(() => new EventScenario({ artifacts: { eventTypes: [Recorded] }, constraints: 'disabled', namespace: 'other' }), 'options.namespace');
        clean(subject);
    });
    it('should reject custom sequence ID', () => {
        const subject = scenario();
        rejected(() => new EventScenario({ artifacts: { eventTypes: [Recorded] }, constraints: 'disabled', eventSequenceId: new EventSequenceId('other') }), 'options.eventSequenceId');
        clean(subject);
    });
    it('should reject transactional operations', () => {
        const subject = scenario();
        rejected(() => subject.eventSequence.transactional, 'transactional');
        clean(subject);
    });
    it('should reject append notifications', () => {
        const subject = scenario();
        rejected(() => subject.eventSequence.appendOperations, 'appendOperations');
        clean(subject);
    });
    it('should reject source-type tail filters', async () => {
        const subject = scenario();
        await rejects(() => subject.eventSequence.getTailSequenceNumber('A', 'Default'), 'getTailSequenceNumber.filters');
        clean(subject);
    });
    it('should reject stream-type tail filters', async () => {
        const subject = scenario();
        await rejects(() => subject.eventSequence.getTailSequenceNumber('A', undefined, 'All'), 'getTailSequenceNumber.filters');
        clean(subject);
    });
    it('should reject stream-ID tail filters', async () => {
        const subject = scenario();
        await rejects(() => subject.eventSequence.getTailSequenceNumber('A', undefined, undefined, 'Default'), 'getTailSequenceNumber.filters');
        clean(subject);
    });
    it('should reject event-type tail filters', async () => {
        const subject = scenario();
        await rejects(() => subject.eventSequence.getTailSequenceNumber('A', undefined, undefined, undefined, [Recorded]), 'getTailSequenceNumber.filters');
        clean(subject);
    });
    it('should reject event-type sequence filters', async () => {
        const subject = scenario();
        await rejects(() => subject.eventSequence.getFromSequenceNumber(EventSequenceNumber.first, 'A', [Recorded]), 'getFromSequenceNumber.filterEventTypes');
        clean(subject);
    });
    for (const value of [-1n, EventSequenceNumber.unset.value + 1n]) {
        it(`should reject out-of-range sequence number ${value}`, async () => {
            const subject = scenario();
            await rejects(() => subject.eventSequence.getFromSequenceNumber(new EventSequenceNumber(value)), 'getFromSequenceNumber.sequenceNumber');
            clean(subject);
        });
    }
    it('should asynchronously reject redaction by sequence', async () => {
        const subject = scenario();
        await rejects(() => subject.eventSequence.redact(EventSequenceNumber.first, 'reason'), 'redact');
        clean(subject);
    });
    it('should asynchronously reject redaction by source', async () => {
        const subject = scenario();
        await rejects(() => subject.eventSequence.redactForEventSource('A', 'reason'), 'redactForEventSource');
        clean(subject);
    });
    it('should asynchronously reject stream completion', async () => {
        const subject = scenario();
        await rejects(() => subject.eventSequence.completeStream('All', 'Default'), 'completeStream');
        clean(subject);
    });
    it('should asynchronously reject observer tail reads', async () => {
        const subject = scenario();
        await rejects(() => subject.eventSequence.getTailSequenceNumberForObserver(Recorded), 'getTailSequenceNumberForObserver');
        clean(subject);
    });
    it('should reject ambient identity before append', async () => {
        const subject = scenario();
        await identityProvider.run(new Identity('user', 'User'), () => rejects(() => subject.append('A', new Recorded()), 'append.context'));
        clean(subject);
    });
    it('should reject ambient causation before append', async () => {
        const subject = scenario();
        await causationManager.run(new CausationType('Command'), { value: 'test' }, () =>
            rejects(() => subject.append('A', new Recorded()), 'append.context'));
        clean(subject);
    });
    it('should reject an invalid scenario clock before append', async () => {
        const subject = new EventScenario({ artifacts: { eventTypes: [Recorded] }, constraints: 'disabled', clock: () => new Date(NaN) });
        await rejects(() => subject.append('A', new Recorded()), 'append.clock');
        clean(subject);
    });
});
