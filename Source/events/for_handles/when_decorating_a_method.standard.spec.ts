// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { handles } from '../../index.js';
import { getHandledEventType } from '../handles.js';
import { isOnceOnly, onceOnly } from '../../reactors/onceOnly.js';

// Chai installs this property at runtime; the standalone type-check needs its declaration too.
declare global {
    interface Object { should: Chai.Assertion; }
}
chai.should();

class AuthorRegistered {}
class NamedReactor {
    @handles(AuthorRegistered)
    @onceOnly()
    notify() { return 'called'; }

    @onceOnly()
    @handles(AuthorRegistered)
    otherOrder() {}

    helper() {}
}

describe('when decorating a standard reactor method', () => {
    let eventType: ReturnType<typeof getHandledEventType>;
    beforeEach(() => { eventType = getHandledEventType(NamedReactor.prototype.notify); });

    it('should store the constructor on the method before instantiation', () => {
        (eventType === AuthorRegistered).should.be.true;
    });
    it('should keep onceOnly metadata in either decorator order', () => {
        isOnceOnly(NamedReactor.prototype.notify).should.be.true;
        isOnceOnly(NamedReactor.prototype.otherOrder).should.be.true;
    });
    it('should not mark another method', () => {
        (getHandledEventType(NamedReactor.prototype.helper) === undefined).should.be.true;
    });
    it('should keep the original method behavior', () => {
        new NamedReactor().notify().should.equal('called');
    });
});

describe('when decorating an unsupported standard member', () => {
    it('should reject a static method', () => {
        (() => {
            class Invalid { @handles(AuthorRegistered) static notify() {} }
            return Invalid;
        }).should.throw(TypeError, 'Handles requires a public, string-named instance method.');
    });
    it('should reject a private method', () => {
        (() => {
            class Invalid { @handles(AuthorRegistered) #notify() {} }
            return Invalid;
        }).should.throw(TypeError, 'Handles requires a public, string-named instance method.');
    });
    it('should reject a symbol method', () => {
        (() => {
            class Invalid { @handles(AuthorRegistered) [Symbol.iterator]() {} }
            return Invalid;
        }).should.throw(TypeError, 'Handles requires a public, string-named instance method.');
    });
    it('should reject a getter', () => {
        (() => {
            class Invalid {
                // @ts-expect-error Getters are not event handlers.
                @handles(AuthorRegistered)
                get notify() { return () => {}; }
            }
            return Invalid;
        }).should.throw(TypeError, 'Handles requires a public, string-named instance method.');
    });
    it('should reject a function-valued field', () => {
        (() => {
            class Invalid {
                // @ts-expect-error Fields are not event handlers.
                @handles(AuthorRegistered)
                notify = () => {};
            }
            return Invalid;
        }).should.throw(TypeError, 'Handles requires a public, string-named instance method.');
    });
    it('should reject two event declarations on one method', () => {
        (() => {
            class Invalid { @handles(AuthorRegistered) @handles(AuthorRegistered) notify() {} }
            return Invalid;
        }).should.throw(TypeError, "Handler 'notify' can only declare @handles once.");
    });
    it('should reject an absent event constructor', () => {
        (() => {
            class Invalid {
                // @ts-expect-error An event constructor is required.
                @handles(undefined)
                notify() {}
            }
            return Invalid;
        }).should.throw(TypeError, 'Handles requires an event constructor.');
    });
});
