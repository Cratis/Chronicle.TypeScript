// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { FromBuilder } from '../FromBuilder.js';

chai.should();

class Account {
    name!: string;
    openedAt!: Date;
    openedBy!: string;
    accountId!: string;
    tier!: string;
}

class AccountChanged {
    name!: string;
}

describe('when setting read model properties once', () => {
    let builder: FromBuilder<Account, AccountChanged>;

    beforeEach(() => {
        builder = new FromBuilder<Account, AccountChanged>();
        builder
            .setOnce(m => m.name).to(e => e.name)
            .setOnce(m => m.openedAt).toEventContextProperty('occurred')
            .setOnce(m => m.openedBy).toCausedBy('subject')
            .setOnce(m => m.accountId).toEventSourceId()
            .setOnce(m => m.tier).toValue('basic');
    });

    it('should wrap an event property in set once', () => builder.entry.properties.name.should.equal('$setOnce(name)'));
    it('should wrap an event context property in set once', () => builder.entry.properties.openedAt.should.equal('$setOnce($eventContext(Occurred))'));
    it('should wrap the causing identity in set once', () => builder.entry.properties.openedBy.should.equal('$setOnce($causedBy(subject))'));
    it('should wrap the event source id in set once', () => builder.entry.properties.accountId.should.equal('$setOnce($eventSourceId)'));
    it('should wrap a constant in set once', () => builder.entry.properties.tier.should.equal('$setOnce($value(basic))'));
});
