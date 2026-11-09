// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { FromAllBuilder } from '../FromAllBuilder.js';
import { FromEveryBuilder } from '../FromEveryBuilder.js';

chai.should();

class Document {
    firstSeen!: Date;
    createdBy!: string;
}

describe('when setting once from all events', () => {
    it('should wrap the event context value in set once', () => {
        const builder = new FromAllBuilder<Document>();
        builder.setOnce(m => m.firstSeen).toEventContextProperty('occurred');
        builder.properties.firstSeen.should.equal('$setOnce($eventContext(Occurred))');
    });
});

describe('when setting once from every event', () => {
    it('should wrap the causing identity in set once', () => {
        const builder = new FromEveryBuilder<Document>();
        builder.setOnce(m => m.createdBy).toCausedBy('subject');
        builder.entry.properties.createdBy.should.equal('$setOnce($causedBy(subject))');
    });
});
