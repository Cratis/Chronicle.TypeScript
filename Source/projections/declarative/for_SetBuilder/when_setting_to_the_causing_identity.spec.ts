// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { AllSetBuilder } from '../AllSetBuilder.js';
import { SetBuilder } from '../SetBuilder.js';

chai.should();

describe('when setting a property to the identity that caused the event', () => {
    let properties: Record<string, string>;
    let builder: (property: string) => SetBuilder<object, object>;

    beforeEach(() => {
        properties = {};
        builder = property => new SetBuilder<object, object>(property, (target, expression) => { properties[target] = expression; }, {});
        builder('causedBy').toCausedBy();
        builder('subject').toCausedBy('subject');
        builder('name').toCausedBy('name');
        builder('userName').toCausedBy('userName');
    });

    it('should map the whole identity', () => properties.causedBy.should.equal('$causedBy'));
    it('should map the subject', () => properties.subject.should.equal('$causedBy(subject)'));
    it('should map the name', () => properties.name.should.equal('$causedBy(name)'));
    it('should map the user name', () => properties.userName.should.equal('$causedBy(userName)'));
    it('should reject an unknown member', () =>
        (() => builder('other').toCausedBy('Subject' as 'subject')).should.throw("Invalid caused by property 'Subject'"));
});

describe('when setting an all-events property to the identity that caused the event', () => {
    it('should map the member', () => {
        const properties: Record<string, string> = {};
        new AllSetBuilder<object, object>('lastChangedBy', (target, expression) => { properties[target] = expression; }, {}).toCausedBy('userName');
        properties.lastChangedBy.should.equal('$causedBy(userName)');
    });
});
