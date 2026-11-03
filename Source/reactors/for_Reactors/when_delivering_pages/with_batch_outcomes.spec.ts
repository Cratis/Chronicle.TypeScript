// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { ObservationState, type ReactorResult } from '@cratis/chronicle.contracts';
import type { EventContext } from '../../../events/EventContext.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { EventBatch, observes } from '../../../observation/index.js';
import { reactor } from '../../reactor.js';
import { appended, observeReactorMessages, page } from '../given/observe_reactor_messages.js';

chai.should();

@eventType('outcome-document-indexed')
class DocumentIndexed {}

@eventType('outcome-document-archived')
class DocumentArchived {}

@eventType('outcome-document-shared')
class DocumentShared {}

describe('when batch methods report outcomes for partitions of a page', () => {
    let results: ReactorResult[];
    let failingMethodCalls: number;

    beforeEach(async () => {
        failingMethodCalls = 0;

        @reactor('outcome-documents')
        class Documents {
            @observes(DocumentIndexed)
            index(batch: EventBatch): void {
                const second = batch.events.find(entry => entry.context.sequenceNumber === 5n)!;
                batch.fail(second.context, new Error('index rejected the document'));
                batch.defer('throttled', 1500);
            }

            @observes(DocumentArchived)
            archive(): void {
                failingMethodCalls++;
                throw new Error('archive unavailable');
            }

            documentShared(_event: DocumentShared, context: EventContext) {
                if (context.eventSourceId === 'failed-late') throw new Error('share failed');
            }
        }

        ({ results } = await observeReactorMessages(Documents, [DocumentIndexed, DocumentArchived, DocumentShared], [page(1n, {
            healthy: [appended('outcome-document-indexed', 'healthy', 1n)],
            'failed-at-event': [appended('outcome-document-indexed', 'failed-at-event', 2n), appended('outcome-document-indexed', 'failed-at-event', 5n)],
            throttled: [appended('outcome-document-indexed', 'throttled', 3n), appended('outcome-document-indexed', 'throttled', 6n)],
            archived: [appended('outcome-document-indexed', 'archived', 4n), appended('outcome-document-archived', 'archived', 7n)],
            'failed-late': [appended('outcome-document-archived', 'failed-late', 8n), appended('outcome-document-shared', 'failed-late', 9n)]
        })]));
    });

    const resultFor = (partition: string) => results[0].Partitions.find(result => result.Partition === partition)!;

    it('should call each batch method once for the page', () => failingMethodCalls.should.equal(1));
    it('should succeed a partition nothing was reported for', () => {
        resultFor('healthy').State.should.equal(ObservationState.Success);
        resultFor('healthy').LastSuccessfulObservation.should.equal(1n);
    });
    it('should fail a partition from the event it was failed at, keeping the earlier events', () => {
        resultFor('failed-at-event').State.should.equal(ObservationState.Failed);
        resultFor('failed-at-event').LastSuccessfulObservation.should.equal(2n);
        resultFor('failed-at-event').ExceptionMessages.should.deep.equal(['Error: index rejected the document']);
    });
    it('should defer a partition from its first event in the batch, with the delay', () => {
        resultFor('throttled').State.should.equal(ObservationState.Deferred);
        resultFor('throttled').LastSuccessfulObservation.should.equal(4294967295n);
        resultFor('throttled').RetryAfterMilliseconds.should.equal(1500n);
    });
    it('should fail every partition of a throwing batch method at its first event in that batch', () => {
        resultFor('archived').State.should.equal(ObservationState.Failed);
        resultFor('archived').LastSuccessfulObservation.should.equal(4n);
        resultFor('archived').ExceptionMessages.should.deep.equal(['Error: archive unavailable']);
    });
    it('should settle a partition at the earliest problem any method reported', () => {
        resultFor('failed-late').State.should.equal(ObservationState.Failed);
        resultFor('failed-late').LastSuccessfulObservation.should.equal(4294967295n);
        resultFor('failed-late').ExceptionMessages.should.deep.equal(['Error: archive unavailable']);
    });
});
