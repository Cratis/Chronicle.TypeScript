// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { DictionaryKey } from '../DictionaryKey.js';
import { JoinBuilder } from '../JoinBuilder.js';

chai.should();

class Order {
    customerName!: string;
    ratingsByReviewer!: Record<string, number>;
    reviewers!: Record<string, string>;
}

class CustomerRated {
    name!: string;
    reviewer!: string;
    rating!: number;
}

describe('when a join sets once and targets dictionary entries', () => {
    let builder: JoinBuilder<Order, CustomerRated>;

    beforeEach(() => {
        builder = new JoinBuilder<Order, CustomerRated>();
        builder
            .setOnce(m => m.customerName).to(e => e.name)
            .set(m => m.ratingsByReviewer, e => e.reviewer).to(e => e.rating)
            .removeKey(m => m.reviewers, DictionaryKey.causedBy('subject'));
    });

    it('should wrap the value in set once', () => builder.entry.properties.customerName.should.equal('$setOnce(name)'));
    it('should key the entry by the event property', () => builder.entry.properties['ratingsByReviewer.$eventContent.reviewer'].should.equal('rating'));
    it('should remove the entry keyed by the causing subject', () => builder.entry.properties['reviewers.$causedBy.subject'].should.equal('$remove'));
});
