// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { SpanStatusCode } from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { telemetrySession } from '../given/a_telemetry_session.fixture.js';
import { eventSequence, Recorded } from '../given/an_event_sequence.fixture.js';

chai.should();
const telemetry = telemetrySession();

describe('when an append fails with sensitive exception details', () => {
    const failure = new TypeError('sensitive token in error message');
    let span: ReadableSpan;
    let thrown: unknown;
    beforeEach(async () => {
        const { sequence, services } = eventSequence();
        services.append.mockRejectedValue(failure);
        try { await sequence.append('private', new Recorded()); } catch (error) { thrown = error; }
        span = telemetry.spans.getFinishedSpans()[0];
    });
    it('should rethrow the original failure', () => { (thrown === failure).should.be.true; });
    it('should record only failure types and error status', () => {
        span.status.should.deep.equal({ code: SpanStatusCode.ERROR });
        span.attributes.should.include({ 'error.type': 'TypeError' });
        span.events.should.have.lengthOf(1);
        span.events[0].attributes!.should.deep.equal({ 'exception.type': 'TypeError' });
    });
    it('should never export the exception message or stack', () => {
        JSON.stringify({ attributes: span.attributes, status: span.status, events: span.events }).should.not.contain('sensitive');
        span.events[0].attributes!.should.not.have.property('exception.stacktrace');
    });
});
