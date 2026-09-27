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
class NonAsciiPaddedId {
    @field(String) name = 'value';
}
eventType('\u0085NonAsciiPaddedId\u0085')(NonAsciiPaddedId);
class DuplicateId {
    @field(String) name = 'value';
}
eventType('Recorded')(DuplicateId);

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
        [CommaId, 'artifacts.eventTypes.id'], [PaddedId, 'artifacts.eventTypes.id'],
        [NonAsciiPaddedId, 'artifacts.eventTypes.id']
    ] as const) {
        it(`should reject ${type.name} during catalog validation`, () => {
            const subject = scenario();
            rejected(() => new EventScenario({ artifacts: { eventTypes: [type] },
                ...(type === PropertyUnique || type === RemovesConstraint ? {} : { constraints: 'disabled' as const }) }), operation);
            clean(subject);
        });
    }

    it('should reject duplicate event IDs in the catalog', () => {
        const subject = scenario();
        rejected(() => new EventScenario({ artifacts: { eventTypes: [Recorded, DuplicateId] }, constraints: 'disabled' }), 'artifacts.eventTypes');
        clean(subject);
    });
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
    for (const date of ['0000-12-31T23:59:59.999Z', '+010000-01-01T00:00:00.000Z']) {
        it(`should reject out-of-range UTC occurrence ${date} without changing history or results`, async () => {
            let clock = new Date('2024-01-01T00:00:00.000Z');
            const subject = new EventScenario({ artifacts: { eventTypes: [Recorded] }, constraints: 'disabled', clock: () => clock });
            await subject.append('A', new Recorded());
            const history = subject.appendedEvents;
            const results = subject.results;
            clock = new Date(date);
            await rejects(() => subject.append('B', new Recorded()), 'append.clock');
            subject.appendedEvents.should.deep.equal(history);
            subject.results.should.deep.equal(results);
        });
    }
    for (const [name, value] of [
        ['quote', '"'], ['backslash', '\\'], ['DEL', '\u007f'], ['uppercase accented letter', '\u00c9'],
        ['decomposed accent', 'e\u0301'], ['Japanese', '日本'], ['tab', '\t']
    ] as const) {
        it(`should reject ${name} outside the fixture-backed content domain`, async () => {
            const subject = scenario();
            const event = new Recorded();
            event.name = value;
            await rejects(() => subject.append('A', event), 'append.content');
            clean(subject);
        });
    }
    for (const [name, value] of [['missing', undefined], ['numeric', 42]] as const) {
        it(`should reject ${name} content`, async () => {
            const subject = scenario();
            const event = new Recorded();
            Object.assign(event, { name: value });
            await rejects(() => subject.append('A', event), 'append.content');
            clean(subject);
        });
    }
    it('should reject extra content fields', async () => {
        const subject = scenario();
        const event = Object.assign(new Recorded(), { extra: 'value' });
        await rejects(() => subject.append('A', event), 'append.content');
        clean(subject);
    });
    for (const source of ['a b', 'a|b', '\u00c9']) {
        it(`should reject unsupported append source ${JSON.stringify(source)}`, async () => {
            const subject = scenario();
            await rejects(() => subject.append(source, new Recorded()), 'append.source');
            clean(subject);
        });
    }
    it('should reject plain correlation options', async () => {
        const subject = scenario();
        await rejects(() => subject.append('A', new Recorded(), { correlationId: '00000000-0000-0000-0000-000000000001' }), 'append.options');
        clean(subject);
    });
    it('should reject plain subject options', async () => {
        const subject = scenario();
        await rejects(() => subject.append('A', new Recorded(), { subject: 'other' }), 'append.options');
        clean(subject);
    });
    for (const [name, filters] of [
        ['stream type', ['All', undefined, undefined]],
        ['stream ID', [undefined, 'Default', undefined]],
        ['source type', [undefined, undefined, 'Default']]
    ] as const) {
        it(`should reject ${name} source/type-read filters`, async () => {
            const subject = scenario();
            await rejects(() => subject.eventSequence.getForEventSourceIdAndEventTypes('A', [Recorded], ...filters),
                'getForEventSourceIdAndEventTypes.filters');
            clean(subject);
        });
    }
    it('should reject empty source/type-read event types', async () => {
        const subject = scenario();
        await rejects(() => subject.eventSequence.getForEventSourceIdAndEventTypes('A', []), 'getForEventSourceIdAndEventTypes.filters');
        clean(subject);
    });
    it('should reject unregistered source/type-read event types', async () => {
        const subject = scenario();
        await rejects(() => subject.eventSequence.getForEventSourceIdAndEventTypes('A', [DuplicateId]), 'read.eventTypes');
        clean(subject);
    });
    it('should reject non-ASCII padded read sources before returning an incorrect result', async () => {
        const subject = scenario();
        await subject.append('A', new Recorded());
        const history = subject.appendedEvents;
        const results = subject.results;
        for (const source of ['\u0085A\u0085', 'A\u00a0', 'A\u007f', 'A\u2000B']) {
            await rejects(() => subject.eventSequence.hasEventsFor(source), 'hasEventsFor.source');
            await rejects(() => subject.eventSequence.getTailSequenceNumber(source), 'getTailSequenceNumber.source');
            await rejects(() => subject.eventSequence.getFromSequenceNumber(EventSequenceNumber.first, source), 'getFromSequenceNumber.source');
            await rejects(() => subject.eventSequence.getForEventSourceIdAndEventTypes(source, [Recorded]), 'getForEventSourceIdAndEventTypes.source');
        }
        subject.appendedEvents.should.deep.equal(history);
        subject.results.should.deep.equal(results);
    });
    it('should reject overlapping act appends, including separate act entry points', async () => {
        const subject = scenario();
        const [first, second] = await Promise.allSettled([
            subject.append('A', new Recorded()),
            subject.eventLog.append('B', new Recorded())
        ]);
        first.status.should.equal('fulfilled');
        second.status.should.equal('rejected');
        if (second.status === 'rejected') {
            (second.reason instanceof UnsupportedEventSequenceOperation).should.be.true;
            (second.reason as Error).message.should.include('append');
        }
        subject.appendedEvents.length.should.equal(1);
        subject.results.length.should.equal(1);
    });
});
