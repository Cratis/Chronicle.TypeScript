// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import { EventType } from '../../../events/EventType.js';
import { ConflictingConcurrencyScopesInUnitOfWork } from '../../ConflictingConcurrencyScopesInUnitOfWork.js';
import { a_unit_of_work_with_a_recording_store } from '../given/a_unit_of_work_with_a_recording_store.js';
import type { UnitOfWork } from '../../UnitOfWork.js';

chai.should();

describe('when adding events with concurrency scopes and the event type filters differ', () => {
    let unitOfWork: UnitOfWork;
    let errors: unknown[];

    const tryAdd = (eventSourceId: string, eventTypes: EventType[]) => {
        try {
            unitOfWork.addEvent(EventSequenceId.eventLog, eventSourceId, { eventSourceId }, { concurrencyScope: { sequenceNumber: 1n, eventTypes } });
        } catch (caught) {
            errors.push(caught);
        }
    };

    beforeEach(() => {
        ({ unitOfWork } = a_unit_of_work_with_a_recording_store());
        errors = [];
        tryAdd('different-type', [EventType.parse('OrderPlaced+1')]);
        tryAdd('different-type', [EventType.parse('OrderShipped+1')]);
        tryAdd('different-generation', [EventType.parse('OrderPlaced+1')]);
        tryAdd('different-generation', [EventType.parse('OrderPlaced+2')]);
        tryAdd('empty-versus-filled', []);
        tryAdd('empty-versus-filled', [EventType.parse('OrderPlaced+1')]);
    });

    it('should reject each conflicting event', () => {
        errors.should.have.lengthOf(3);
        errors.every(_ => _ instanceof ConflictingConcurrencyScopesInUnitOfWork).should.be.true;
    });
});
