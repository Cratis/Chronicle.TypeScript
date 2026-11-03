// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { ObservationState, type ReactorResult } from '@cratis/chronicle.contracts';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { observes } from '../../../observation/index.js';
import { reactor } from '../../reactor.js';
import { appended, observeReactorMessages, page } from '../given/observe_reactor_messages.js';

chai.should();

@eventType('returning-invoice-sent')
class InvoiceSent {}

describe('when a reactor batch method returns a value', () => {
    let results: ReactorResult[];

    beforeEach(async () => {
        @reactor('returning-invoices')
        class Invoices {
            @observes(InvoiceSent)
            send() {
                return new InvoiceSent();
            }
        }

        ({ results } = await observeReactorMessages(Invoices, [InvoiceSent], [page(1n, { 'invoice-1': [appended('returning-invoice-sent', 'invoice-1', 1n)] })]));
    });

    it('should fail the partition', () => results[0].Partitions[0].State.should.equal(ObservationState.Failed));
    it('should say that batch methods do not return events', () =>
        results[0].Partitions[0].ExceptionMessages[0].should.contain('BatchMethodReturnedAValue'));
});
