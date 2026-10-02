// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import { SpanKind } from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import type { ChronicleClient } from '../../../ChronicleClient.js';
import type { IEventSequence } from '../../../eventSequences/IEventSequence.js';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import { EventSequenceNumber } from '../../../eventSequences/EventSequenceNumber.js';
import { clientVersion } from '../../../connection/clientVersion.js';
import { client } from '../given/a_client.fixture.js';
import { Recorded } from '../given/an_event_sequence.fixture.js';
import { telemetrySession } from '../given/a_telemetry_session.fixture.js';
import { legacySpans, conventionSpans } from '../given/a_span_name_registry.fixture.js';

const should = chai.should();
const telemetry = telemetrySession();
const sequenceNumber = new EventSequenceNumber(42n);
const operations = {
    append: (sequence: IEventSequence) => sequence.append('source', new Recorded()),
    appendMany: (sequence: IEventSequence) => sequence.appendMany('source', [new Recorded(), new Recorded()]),
    getTailSequenceNumber: (sequence: IEventSequence) => sequence.getTailSequenceNumber(),
    hasEventsFor: (sequence: IEventSequence) => sequence.hasEventsFor('source'),
    getForEventSourceIdAndEventTypes: (sequence: IEventSequence) => sequence.getForEventSourceIdAndEventTypes('source', [Recorded]),
    getFromSequenceNumber: (sequence: IEventSequence) => sequence.getFromSequenceNumber(sequenceNumber),
    redact: (sequence: IEventSequence) => sequence.redact(sequenceNumber, 'reason'),
    redactForEventSource: (sequence: IEventSequence) => sequence.redactForEventSource('source', 'reason'),
    completeStream: (sequence: IEventSequence) => sequence.completeStream('stream-type', 'stream-id')
};

for (const spanNames of [undefined, 'legacy', 'convention'] as const) {
    const expected = spanNames === 'convention' ? conventionSpans : legacySpans;
    for (const sequenceId of [EventSequenceId.eventLog, new EventSequenceId('dynamic')]) {
        for (const operation of Object.keys(operations) as (keyof typeof operations)[]) {
            describe(`when naming ${operation} on ${sequenceId.value} with ${spanNames ?? 'default'} names`, () => {
                let instance: ChronicleClient;
                let span: ReadableSpan;
                beforeEach(async () => {
                    instance = client(spanNames === undefined ? undefined : { spanNames });
                    const store = await instance.getEventStore('store', 'namespace');
                    const sequence = sequenceId === EventSequenceId.eventLog ? store.eventLog : store.getEventSequence(sequenceId);
                    telemetry.spans.reset();
                    await operations[operation](sequence);
                    span = telemetry.spans.getFinishedSpans()[0];
                });
                afterEach(() => instance.dispose());
                it('should emit exactly one client span with the selected name', () => {
                    telemetry.spans.getFinishedSpans().should.have.lengthOf(1);
                    span.name.should.equal(expected[operation]);
                    span.kind.should.equal(SpanKind.CLIENT);
                });
                it('should retain the versioned shared instrumentation scope', () => {
                    span.instrumentationScope.name.should.equal('Cratis.Chronicle.Client');
                    should.equal(span.instrumentationScope.version, clientVersion);
                });
                it('should retain both attribute families', () => {
                    span.attributes.should.include({
                        'chronicle.event_store': 'store', 'cratis.event_store.name': 'store',
                        'chronicle.namespace': 'namespace', 'cratis.event_store.namespace': 'namespace',
                        'chronicle.event_sequence_id': sequenceId.value, 'cratis.event_sequence.id': sequenceId.value
                    });
                });
            });
        }
    }

    for (const operation of ['getEventStore', 'getEventStores', 'getNamespaces'] as const) {
        describe(`when naming ${operation} with ${spanNames ?? 'default'} names`, () => {
            let instance: ChronicleClient;
            let span: ReadableSpan;
            beforeEach(async () => {
                instance = client(spanNames === undefined ? undefined : { spanNames });
                if (operation === 'getNamespaces') {
                    const store = await instance.getEventStore('store', 'namespace');
                    telemetry.spans.reset();
                    await store.getNamespaces();
                } else if (operation === 'getEventStore') {
                    await instance.getEventStore('store', 'namespace');
                } else {
                    await instance.getEventStores();
                }
                span = telemetry.spans.getFinishedSpans()[0];
            });
            afterEach(() => instance.dispose());
            it('should emit exactly one client span with the selected name and shared scope', () => {
                telemetry.spans.getFinishedSpans().should.have.lengthOf(1);
                span.name.should.equal(expected[operation]);
                span.kind.should.equal(SpanKind.CLIENT);
                span.instrumentationScope.name.should.equal('Cratis.Chronicle.Client');
                should.equal(span.instrumentationScope.version, clientVersion);
            });
            if (operation !== 'getEventStores') {
                it('should retain both event store attributes', () => {
                    span.attributes.should.include({ 'chronicle.event_store': 'store', 'cratis.event_store.name': 'store' });
                });
            }
        });
    }
}

describe('when interleaving two clients with different span naming modes', () => {
    let legacy: ChronicleClient;
    let convention: ChronicleClient;
    let spans: ReadableSpan[];
    beforeEach(async () => {
        legacy = client({ spanNames: 'legacy' });
        convention = client({ spanNames: 'convention' });
        const [legacyStore, conventionStore] = await Promise.all([
            legacy.getEventStore('legacy-store'), convention.getEventStore('convention-store')
        ]);
        await Promise.all([convention.getEventStores(), legacy.getEventStores()]);
        await Promise.all([legacyStore.getNamespaces(), conventionStore.getNamespaces()]);
        await conventionStore.eventLog.append('source', new Recorded());
        await legacyStore.eventLog.append('source', new Recorded());
        const id = new EventSequenceId('dynamic');
        await legacyStore.getEventSequence(id).append('source', new Recorded());
        await conventionStore.getEventSequence(id).append('source', new Recorded());
        await legacy.getEventStore('legacy-store');
        await convention.getEventStore('convention-store');
        spans = telemetry.spans.getFinishedSpans();
    });
    afterEach(() => { legacy.dispose(); convention.dispose(); });
    it('should keep each client and its cached stores in its own mode', () => {
        spans.should.have.lengthOf(12);
        spans.filter(span => span.attributes['cratis.event_store.name'] === 'legacy-store').map(span => span.name).should.deep.equal([
            legacySpans.getEventStore, legacySpans.getNamespaces, legacySpans.append, legacySpans.append, legacySpans.getEventStore
        ]);
        spans.filter(span => span.attributes['cratis.event_store.name'] === 'convention-store').map(span => span.name).should.deep.equal([
            conventionSpans.getEventStore, conventionSpans.getNamespaces, conventionSpans.append, conventionSpans.append, conventionSpans.getEventStore
        ]);
        spans.map(span => span.name).should.include(legacySpans.getEventStores).and.include(conventionSpans.getEventStores);
    });
    it('should use the same tracer scope in both modes', () => {
        new Set(spans.map(span => `${span.instrumentationScope.name}/${span.instrumentationScope.version}`)).should.deep.equal(
            new Set([`Cratis.Chronicle.Client/${clientVersion}`]));
    });
});
