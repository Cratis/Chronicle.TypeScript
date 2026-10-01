// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { handles, eventType } from '../../index.js';
import { getHandledEventType } from '../handles.js';
import { onceOnly } from '../../reactors/onceOnly.js';
import { getReactorEventTypes, selectReactorHandler } from '../../reactors/ReactorDispatcher.js';
import { EventObservationState } from '@cratis/chronicle.contracts';

chai.should();

@eventType('legacy-explicit-handler')
class AuthorRegistered {}

class NamedReactor {
    @onceOnly()
    @handles(AuthorRegistered)
    notify() { return 'called'; }

    helper() {}
}

describe('when decorating a legacy reactor method', () => {
    let handlers: ReturnType<typeof getReactorEventTypes>;
    beforeEach(() => { handlers = getReactorEventTypes(NamedReactor, [AuthorRegistered]); });

    it('should store the event constructor on the method', () => {
        (getHandledEventType(NamedReactor.prototype.notify) === AuthorRegistered).should.be.true;
    });
    it('should leave an undecorated helper unmarked', () => {
        (getHandledEventType(NamedReactor.prototype.helper) === undefined).should.be.true;
    });
    it('should discover the named handler', () => {
        handlers.should.deep.equal([{ id: 'legacy-explicit-handler', generation: 1, methodName: 'notify' }]);
    });
    it('should keep the original method behavior', () => {
        new NamedReactor().notify().should.equal('called');
    });
    it('should honor onceOnly during replay', () => {
        selectReactorHandler(handlers, NamedReactor, undefined, 'legacy-explicit-handler', EventObservationState.Replay)!
            .skipReplay.should.be.true;
    });
});

describe('when decorating a static legacy method', () => {
    it('should reject a method that cannot receive an instance delivery', () => {
        (() => {
            class Invalid {
                @handles(AuthorRegistered)
                static notify() {}
            }
            return Invalid;
        }).should.throw(TypeError, 'Handles requires a public, string-named instance method.');
    });
});

describe('when decorating an unsupported legacy member', () => {
    it('should reject a getter without evaluating it', () => {
        (() => {
            class Invalid {
                @handles(AuthorRegistered)
                get notify() { throw new Error('The getter must not run'); }
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
});

describe('when declaring handles twice on a legacy method', () => {
    it('should reject metadata that would silently replace an event type', () => {
        (() => {
            class Invalid {
                @handles(AuthorRegistered)
                @handles(AuthorRegistered)
                notify() {}
            }
            return Invalid;
        }).should.throw(TypeError, "Handler 'notify' can only declare @handles once.");
    });
});
