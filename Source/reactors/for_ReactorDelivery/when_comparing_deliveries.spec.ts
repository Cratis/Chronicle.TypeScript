// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { ReactorDelivery } from '../index.js';

chai.should();

const components = ['order-confirmations', 'orders', 'default', 'event-log', 'order-42', 7n] as const;
for (const [name, replacement] of [
    ['reactor', 'shipment-notifications'], ['event store', 'billing'], ['namespace', 'another-tenant'],
    ['event sequence', 'inbox-upstream'], ['partition', 'order-43'], ['sequence number', 8n]
] as const) {
    describe(`when comparing deliveries differing only in ${name}`, () => {
        let original: ReactorDelivery;
        let different: ReactorDelivery;
        beforeEach(() => {
            original = new ReactorDelivery(...components);
            const changed: [string, string, string, string, string, bigint] = [...components];
            const index = ['reactor', 'event store', 'namespace', 'event sequence', 'partition', 'sequence number'].indexOf(name);
            if (typeof replacement === 'bigint') changed[5] = replacement;
            else changed[index as 0 | 1 | 2 | 3 | 4] = replacement;
            different = new ReactorDelivery(...changed);
        });
        it('should produce a distinct receipt key', () => { different.id.should.not.equal(original.id); });
    });
}
