// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { telemetrySession } from '../given/a_telemetry_session.fixture.js';
import { eventSequence } from '../given/an_event_sequence.fixture.js';

const should = chai.should();
const telemetry = telemetrySession();
for (const [number, expected] of [[42n, 42], [9007199254740991n, Number.MAX_SAFE_INTEGER], [9007199254740992n, undefined], [18446744073709551615n, undefined]] as const) {
    describe(`when reading sequence number ${number}`, () => {
        beforeEach(async () => {
            const { sequence, services } = eventSequence();
            services.tailSequenceNumber.mockResolvedValue({ IsAuthorized: true, Data: { SequenceNumber: number } });
            await sequence.getTailSequenceNumber();
        });
        it('should keep the legacy string and emit only exactly representable shared integers', () => {
            const attributes = telemetry.spans.getFinishedSpans()[0].attributes;
            should.equal(attributes['cratis.event_sequence.number'], expected);
            should.equal(attributes['chronicle.sequence_number'], number.toString());
        });
    });
}
