// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { eventSequence, Recorded } from '../given/an_event_sequence.fixture.js';

chai.should();
describe('when appending without an OpenTelemetry SDK', () => {
    it('should preserve append behavior without telemetry setup', async () => {
        const { sequence, services } = eventSequence();
        const result = await sequence.append('source', new Recorded());
        result.sequenceNumber.value.should.equal(42n);
        services.append.mock.calls.should.have.lengthOf(1);
    });
});
