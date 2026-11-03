// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { eventType, observes, reactor } from '../../index.js';
import { ReactorScenario, UnsupportedReactorOperation } from '../index.js';

chai.should();

@eventType('scenario-batch-shipment-sent')
class ShipmentSent {
    @field(String) trackingNumber = '';
}

@reactor('scenario-batch-shipments')
class Shipments {
    @observes(ShipmentSent)
    track() {}
}

describe('when creating a reactor scenario for a reactor with a batch method', () => {
    it('should refuse it instead of skipping its events', () =>
        (() => new ReactorScenario(Shipments, { artifacts: { eventTypes: [ShipmentSent] }, constraints: 'disabled' }))
            .should.throw(UnsupportedReactorOperation, 'reactor.batchMethod'));
});
