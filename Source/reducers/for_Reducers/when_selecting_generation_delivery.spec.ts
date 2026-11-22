// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { EventGenerationDelivery } from '../../observation/index.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import { getReducerMetadata, reducer } from '../reducer.js';
import { observeReducerMessages } from './given/observe_reducer_messages.js';

chai.should();

@eventType('delivery-item-counted')
class ItemCounted {}

for (const mode of ['omitted', 'legacy', EventGenerationDelivery.Compatibility, EventGenerationDelivery.Pinned] as const) {
    describe(`when registering a reducer with ${mode} generation delivery`, () => {
        let wireMode: number;
        beforeEach(async () => {
            class Counts {
                itemCounted() { return { count: 1 }; }
            }
            if (typeof mode === 'number') reducer('counts', undefined, undefined, true, mode)(Counts);
            else reducer('counts')(Counts);
            if (mode === 'legacy') delete (getReducerMetadata(Counts) as { generationDelivery?: EventGenerationDelivery }).generationDelivery;
            const { registration } = await observeReducerMessages(Counts, [ItemCounted], []);
            wireMode = registration.Reducer!.GenerationDelivery;
            registration.Reducer!.EventTypes[0].EventType!.Generation.should.equal(1);
        });
        it('should serialize the requested mode or default to compatibility', () => {
            wireMode.should.equal(typeof mode === 'number' ? mode : EventGenerationDelivery.Compatibility);
        });
    });
}
