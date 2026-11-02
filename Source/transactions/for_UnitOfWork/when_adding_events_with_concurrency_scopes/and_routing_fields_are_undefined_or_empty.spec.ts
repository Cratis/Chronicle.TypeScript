// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import type { ConcurrencyScope } from '../../../eventSequences/ConcurrencyScope.js';
import { a_unit_of_work_with_a_recording_store, type RecordedAppend } from '../given/a_unit_of_work_with_a_recording_store.js';

chai.should();

describe('when adding events with concurrency scopes and the routing fields are undefined or empty', () => {
    let appends: RecordedAppend[];
    let errors: unknown[];

    beforeEach(async () => {
        const recording = a_unit_of_work_with_a_recording_store();
        errors = [];
        const fields = ['eventStreamType', 'eventStreamId', 'eventSourceType'] as const;
        for (const field of fields) {
            const undefinedScope: ConcurrencyScope = { sequenceNumber: 1n };
            const emptyScope: ConcurrencyScope = { sequenceNumber: 1n, [field]: '' };
            const pairs = [[undefinedScope, emptyScope], [emptyScope, undefinedScope]];
            pairs.forEach(([first, second], index) => {
                const source = `${field}-${index}`;
                try {
                    recording.unitOfWork.addEvent(EventSequenceId.eventLog, source, { order: 0 }, { concurrencyScope: first });
                    recording.unitOfWork.addEvent(EventSequenceId.eventLog, source, { order: 1 }, { concurrencyScope: second });
                } catch (caught) {
                    errors.push(caught);
                }
            });
        }
        await recording.unitOfWork.commit();
        appends = recording.appends;
    });

    it('should not reject any event', () => errors.should.be.empty);
    it('should append every event', () => appends[0].events.should.have.lengthOf(12));
});
