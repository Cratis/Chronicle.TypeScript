// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import type { EventContext } from '../../../events/EventContext.js';
import { DictionaryKey } from '../DictionaryKey.js';
import { FromBuilder } from '../FromBuilder.js';

chai.should();

class Sales {
    unitsByCategory!: Record<string, number>;
    salesByCategory!: Record<string, number>;
    salesByUser!: Record<string, number>;
    returnsByCategory!: Record<string, number>;
    firstSaleByCategory!: Record<string, Date>;
    seriesBySlot!: Record<string, string>;
    lastSeller!: Record<string, string>;
}

class ItemSold {
    category!: string;
    quantity!: number;
    seriesId!: string;
    slot!: { name: string };
}

describe('when targeting dictionary entries with keys from the event content', () => {
    let builder: FromBuilder<Sales, ItemSold>;

    beforeEach(() => {
        builder = new FromBuilder<Sales, ItemSold>();
        builder
            .set(m => m.seriesBySlot, e => e.slot.name).to(e => e.seriesId)
            .add(m => m.unitsByCategory, e => e.category).with(e => e.quantity)
            .subtract(m => m.returnsByCategory, e => e.category).with(e => e.quantity)
            .increment(m => m.salesByCategory, e => e.category)
            .count(m => m.salesByUser, e => e.category)
            .decrement(m => m.lastSeller, DictionaryKey.fromEventContent<ItemSold>(e => e.category));
    });

    it('should key a set entry by the nested event property', () => builder.entry.properties['seriesBySlot.$eventContent.slot.name'].should.equal('seriesId'));
    it('should key an add entry by the event property', () => builder.entry.properties['unitsByCategory.$eventContent.category'].should.equal('$add(quantity)'));
    it('should key a subtract entry by the event property', () => builder.entry.properties['returnsByCategory.$eventContent.category'].should.equal('$subtract(quantity)'));
    it('should key an increment entry by the event property', () => builder.entry.properties['salesByCategory.$eventContent.category'].should.equal('$increment'));
    it('should key a count entry by the event property', () => builder.entry.properties['salesByUser.$eventContent.category'].should.equal('$count'));
    it('should accept an explicit event content key', () => builder.entry.properties['lastSeller.$eventContent.category'].should.equal('$decrement'));
});

describe('when targeting dictionary entries with keys from the event context', () => {
    let builder: FromBuilder<Sales, ItemSold>;

    beforeEach(() => {
        builder = new FromBuilder<Sales, ItemSold>();
        builder
            .count(m => m.salesByUser, DictionaryKey.fromEventContext((c: EventContext) => c.causedBy!.subject))
            .increment(m => m.salesByCategory, DictionaryKey.fromEventContext('EventSourceId'));
    });

    it('should key the entry by the event context path from an accessor', () => builder.entry.properties['salesByUser.$eventContext.causedBy.subject'].should.equal('$count'));
    it('should key the entry by a camel-cased event context property name', () => builder.entry.properties['salesByCategory.$eventContext.eventSourceId'].should.equal('$increment'));
});

describe('when targeting dictionary entries with keys from the identity that caused the event', () => {
    let builder: FromBuilder<Sales, ItemSold>;

    beforeEach(() => {
        builder = new FromBuilder<Sales, ItemSold>();
        builder
            .count(m => m.salesByUser, DictionaryKey.causedBy('userName'))
            .set(m => m.lastSeller, DictionaryKey.causedBy('subject')).toCausedBy('name');
    });

    it('should key the entry by the causing user name', () => builder.entry.properties['salesByUser.$causedBy.userName'].should.equal('$count'));
    it('should key the entry by the causing subject', () => builder.entry.properties['lastSeller.$causedBy.subject'].should.equal('$causedBy(name)'));
});

describe('when removing and setting dictionary entries once', () => {
    let builder: FromBuilder<Sales, ItemSold>;

    beforeEach(() => {
        builder = new FromBuilder<Sales, ItemSold>();
        builder
            .removeKey(m => m.seriesBySlot, e => e.slot.name)
            .removeKey(m => m.salesByUser, DictionaryKey.causedBy('subject'))
            .setOnce(m => m.firstSaleByCategory, e => e.category).toEventContextProperty('occurred');
    });

    it('should remove the entry keyed by the event property', () => builder.entry.properties['seriesBySlot.$eventContent.slot.name'].should.equal('$remove'));
    it('should remove the entry keyed by the causing subject', () => builder.entry.properties['salesByUser.$causedBy.subject'].should.equal('$remove'));
    it('should wrap the entry value in set once', () => builder.entry.properties['firstSaleByCategory.$eventContent.category'].should.equal('$setOnce($eventContext(Occurred))'));
});

describe('when using invalid dictionary keys', () => {
    it('should reject a key that selects no event property', () => (() => DictionaryKey.fromEventContent(e => e)).should.throw('Invalid dictionary key'));
    it('should reject an unknown event context property', () => (() => DictionaryKey.fromEventContext('notAProperty')).should.throw("Invalid event context property 'notAProperty'"));
    it('should reject a derived event context function', () => (() => DictionaryKey.fromEventContext('occurred.week()')).should.throw("Invalid event context property 'occurred.week()'"));
    it('should reject an unknown causing identity member', () => (() => DictionaryKey.causedBy('email' as 'subject')).should.throw("Invalid caused by property 'email'"));
});
