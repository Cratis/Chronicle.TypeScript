// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it } from 'vitest';
import type { EventContext } from '../../../events/EventContext.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { compileModelBound } from '../../for_ProjectionDefinitionCompiler/given/compile_model_bound.js';
import { setFrom } from '../setFrom.js';
import { setFromContext } from '../setFromContext.js';

chai.should();

class AccountRenamed {
    name = '';
    displayName = '';
}
eventType()(AccountRenamed);

describe('when model-bound properties are set once', () => {
    let properties: Record<string, string>;

    beforeEach(() => {
        class Account {
            id = '';
            name = '';
            firstName = '';
            latestName = '';
            createdAt = new Date(0);
            createdBy = '';
            renamedBy = '';
        }
        for (const property of ['id', 'name', 'firstName', 'latestName', 'createdBy', 'renamedBy']) field(String)(Account.prototype, property);
        field(Date)(Account.prototype, 'createdAt');
        setFrom(AccountRenamed, { setOnce: true })(Account.prototype, 'name');
        setFrom(AccountRenamed, { eventPropertyName: 'displayName', setOnce: true })(Account.prototype, 'firstName');
        setFrom(AccountRenamed, { eventPropertyName: 'displayName' })(Account.prototype, 'latestName');
        setFromContext(AccountRenamed, { contextProperty: 'occurred', setOnce: true })(Account.prototype, 'createdAt');
        setFromContext(AccountRenamed, { contextProperty: (c: EventContext) => c.causedBy, setOnce: true })(Account.prototype, 'createdBy');
        setFromContext(AccountRenamed, 'causedBy')(Account.prototype, 'renamedBy');
        const { definition } = compileModelBound(Account);
        properties = definition.From.find(entry => entry.Key!.Id === 'AccountRenamed')!.Value!.Properties;
    });

    it('should wrap the same-named event property in set once', () => properties.name.should.equal('$setOnce(name)'));
    it('should wrap the named event property in set once', () => properties.firstName.should.equal('$setOnce(displayName)'));
    it('should keep a plain options mapping as a set', () => properties.latestName.should.equal('displayName'));
    it('should wrap the event context property in set once', () => properties.createdAt.should.equal('$setOnce($eventContext(Occurred))'));
    it('should wrap an event context accessor in set once', () => properties.createdBy.should.equal('$setOnce($eventContext(CausedBy))'));
    it('should keep the positional event context form as a set', () => properties.renamedBy.should.equal('$eventContext(CausedBy)'));
});
