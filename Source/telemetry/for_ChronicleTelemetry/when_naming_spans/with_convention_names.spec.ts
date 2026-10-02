// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import { SpanKind } from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import type { ChronicleClient } from '../../../ChronicleClient.js';
import type { IEventSequence } from '../../../eventSequences/IEventSequence.js';
import type { ChronicleTelemetryOptions } from '../../ChronicleTelemetryOptions.js';
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

for (const spanNames of [undefined, 'convention'] as const) {
    // Simulate JavaScript retaining the previous minor's opt-in; it must have no effect.
    const options = spanNames === undefined ? undefined : { spanNames } as unknown as ChronicleTelemetryOptions;
    for (const sequenceId of [EventSequenceId.eventLog, new EventSequenceId('dynamic')]) {
        for (const operation of Object.keys(operations) as (keyof typeof operations)[]) {
            describe(`when naming ${operation} on ${sequenceId.value} with ${spanNames ?? 'default'} configuration`, () => {
                let instance: ChronicleClient;
                let span: ReadableSpan;
                beforeEach(async () => {
                    instance = client(options);
                    const store = await instance.getEventStore('store', 'namespace');
                    const sequence = sequenceId === EventSequenceId.eventLog ? store.eventLog : store.getEventSequence(sequenceId);
                    telemetry.spans.reset();
                    await operations[operation](sequence);
                    span = telemetry.spans.getFinishedSpans()[0];
                });
                afterEach(() => instance.dispose());
                it('should emit exactly one convention client span and no legacy span', () => {
                    telemetry.spans.getFinishedSpans().should.have.lengthOf(1);
                    span.name.should.equal(conventionSpans[operation]).and.not.equal(legacySpans[operation]);
                    span.kind.should.equal(SpanKind.CLIENT);
                });
                it('should retain the versioned shared instrumentation scope', () => {
                    span.instrumentationScope.name.should.equal('Cratis.Chronicle.Client');
                    should.equal(span.instrumentationScope.version, clientVersion);
                });
                it('should emit only canonical attributes', () => {
                    span.attributes.should.include({
                        'cratis.event_store.name': 'store', 'cratis.event_store.namespace': 'namespace',
                        'cratis.event_sequence.id': sequenceId.value
                    });
                    Object.keys(span.attributes).filter(key => key.startsWith('chronicle.')).should.be.empty;
                });
            });
        }
    }

    for (const operation of ['getEventStore', 'getEventStores', 'getNamespaces'] as const) {
        describe(`when naming ${operation} with ${spanNames ?? 'default'} configuration`, () => {
            let instance: ChronicleClient;
            let span: ReadableSpan;
            beforeEach(async () => {
                instance = client(options);
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
            it('should emit exactly one convention client span and no legacy span', () => {
                telemetry.spans.getFinishedSpans().should.have.lengthOf(1);
                span.name.should.equal(conventionSpans[operation]).and.not.equal(legacySpans[operation]);
                span.kind.should.equal(SpanKind.CLIENT);
                span.instrumentationScope.name.should.equal('Cratis.Chronicle.Client');
                should.equal(span.instrumentationScope.version, clientVersion);
            });
            it('should not emit legacy attributes', () => {
                Object.keys(span.attributes).filter(key => key.startsWith('chronicle.')).should.be.empty;
            });
            if (operation !== 'getEventStores') {
                it('should retain the canonical event store attribute', () => {
                    span.attributes.should.include({ 'cratis.event_store.name': 'store' });
                });
            }
        });
    }
}
