// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import type { ConcurrencyScope } from '../../../eventSequences/ConcurrencyScope.js';
import { ConflictingConcurrencyScopesInUnitOfWork } from '../../ConflictingConcurrencyScopesInUnitOfWork.js';
import { a_unit_of_work_with_a_recording_store } from '../given/a_unit_of_work_with_a_recording_store.js';
import type { UnitOfWork } from '../../UnitOfWork.js';

chai.should();

describe('when adding events with concurrency scopes and a routing field is empty versus named', () => {
    let unitOfWork: UnitOfWork;
    let errors: unknown[];

    const tryAdd = (source: string, concurrencyScope: ConcurrencyScope) => {
        try {
            unitOfWork.addEvent(EventSequenceId.eventLog, source, { source }, { concurrencyScope });
        } catch (caught) {
            errors.push(caught);
        }
    };

    beforeEach(() => {
        ({ unitOfWork } = a_unit_of_work_with_a_recording_store());
        errors = [];
        for (const field of ['eventStreamType', 'eventStreamId', 'eventSourceType'] as const) {
            tryAdd(`${field}-undefined`, { sequenceNumber: 1n });
            tryAdd(`${field}-undefined`, { sequenceNumber: 1n, [field]: 'Named' });
            tryAdd(`${field}-empty`, { sequenceNumber: 1n, [field]: '' });
            tryAdd(`${field}-empty`, { sequenceNumber: 1n, [field]: 'Named' });
        }
    });

    it('should reject each conflicting event', () => {
        errors.should.have.lengthOf(6);
        errors.every(_ => _ instanceof ConflictingConcurrencyScopesInUnitOfWork).should.be.true;
    });
});
