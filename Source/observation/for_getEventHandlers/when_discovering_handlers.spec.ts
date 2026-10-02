// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { eventType } from '../../events/eventTypeDecorator.js';
import { handles } from '../../events/handles.js';
import { getReactorEventTypes } from '../../reactors/ReactorDispatcher.js';
import { ReducerEventDispatcher } from '../../reducers/ReducerEventDispatcher.js';

chai.should();

@eventType('explicit-author', 2)
class AuthorRegistered {}
@eventType('conventional-book')
class BookBorrowed {}

const registeredTypes = [AuthorRegistered, BookBorrowed];
const discoverers = [
    { name: 'reactor', discover: getReactorEventTypes },
    { name: 'reducer', discover: (type: new () => object, types: readonly (new () => object)[]) => new ReducerEventDispatcher(type, types).handlers }
];

for (const { name, discover } of discoverers) {
    describe(`when discovering explicit and conventional ${name} handlers`, () => {
        class Observer {
            @handles(AuthorRegistered)
            notify() {}
            bookBorrowed() {}
            helper() {}
            get unrelated() { throw new Error('A getter must not run during discovery'); }
        }
        let entries: ReturnType<typeof getReactorEventTypes>;
        beforeEach(() => { entries = discover(Observer, registeredTypes); });
        it('should include both event types without treating helpers as handlers', () => {
            entries.should.deep.equal([
                { id: 'explicit-author', generation: 2, methodName: 'notify' },
                { id: 'conventional-book', generation: 1, methodName: 'bookBorrowed' }
            ]);
        });
    });

    describe(`when an explicit ${name} method has another event's conventional name`, () => {
        class Observer { @handles(AuthorRegistered) bookBorrowed() {} }
        it('should use only the explicit event type', () => {
            discover(Observer, registeredTypes).should.deep.equal([{ id: 'explicit-author', generation: 2, methodName: 'bookBorrowed' }]);
        });
    });

    describe(`when an explicit ${name} method has its own conventional name`, () => {
        class Observer { @handles(AuthorRegistered) authorRegistered() {} }
        it('should register it only once', () => {
            discover(Observer, registeredTypes).should.have.lengthOf(1);
        });
    });

    describe(`when inheriting an explicit ${name} handler`, () => {
        class Base { @handles(AuthorRegistered) notify() {} }
        class Inherited extends Base {}
        class Overridden extends Base { notify() {} }
        class Remapped extends Base { @handles(BookBorrowed) notify() {} }
        it('should discover the inherited handler', () => {
            discover(Inherited, registeredTypes)[0].methodName!.should.equal('notify');
        });
        it('should reject an override that hides the base declaration', () => {
            (() => discover(Overridden, registeredTypes)).should.throw(
                "Override 'notify' on 'Overridden' hides @handles(AuthorRegistered) declared on 'Base'; redecorate the override.");
        });
        it('should reject an inherited undecorated override across multiple levels', () => {
            class Derived extends Overridden {}
            (() => discover(Derived, registeredTypes)).should.throw(
                "Override 'notify' on 'Overridden' hides @handles(AuthorRegistered) declared on 'Base'; redecorate the override.");
        });
        it('should allow an override explicitly keeping the same event type', () => {
            class Reaffirmed extends Base { @handles(AuthorRegistered) notify() {} }
            discover(Reaffirmed, registeredTypes).should.deep.equal([{ id: 'explicit-author', generation: 2, methodName: 'notify' }]);
        });
        it('should use the override event type instead of the base declaration', () => {
            discover(Remapped, registeredTypes).should.deep.equal([{ id: 'conventional-book', generation: 1, methodName: 'notify' }]);
        });
    });

    describe(`when explicit ${name} event classes share a name`, () => {
        const OtherAuthorRegistered = class AuthorRegistered {};
        eventType('another-author')(OtherAuthorRegistered);
        class Observer {
            @handles(AuthorRegistered) notify() {}
            @handles(OtherAuthorRegistered) archive() {}
        }
        it('should resolve event constructors rather than class names', () => {
            discover(Observer, [AuthorRegistered, OtherAuthorRegistered]).map(entry => entry.id)
                .should.deep.equal(['explicit-author', 'another-author']);
        });
    });

    describe(`when an explicit ${name} event type is not registered`, () => {
        class Observer { @handles(AuthorRegistered) notify() {} }
        it('should name the observer method and missing event constructor', () => {
            (() => discover(Observer, [BookBorrowed])).should.throw(/notify.*Observer.*AuthorRegistered.*no registered event type/);
        });
        it('should not accept a different constructor with the same event id', () => {
            @eventType('explicit-author', 2)
            class OtherAuthor {}
            (() => discover(Observer, [OtherAuthor])).should.throw(/notify.*no registered event type/);
        });
        it('should not accept a listed class without event metadata', () => {
            class Unknown {}
            class Invalid { @handles(Unknown) notify() {} }
            (() => discover(Invalid, [Unknown])).should.throw(/notify.*Unknown.*no registered event type/);
        });
    });

    describe(`when two ${name} methods handle one event type`, () => {
        class Explicit {
            @handles(AuthorRegistered) notify() {}
            @handles(AuthorRegistered) archive() {}
        }
        class Mixed {
            @handles(AuthorRegistered) notify() {}
            authorRegistered() {}
        }
        class Base { @handles(AuthorRegistered) notify() {} }
        class Inherited extends Base { @handles(AuthorRegistered) archive() {} }
        class Conventional extends Base { authorRegistered() {} }
        it('should reject two explicit handlers', () => {
            (() => discover(Explicit, registeredTypes)).should.throw(/multiple handlers.*explicit-author.*notify.*archive/);
        });
        it('should reject an explicit handler and a conventional handler', () => {
            (() => discover(Mixed, registeredTypes)).should.throw(/multiple handlers.*explicit-author.*notify.*authorRegistered/);
        });
        it('should include inherited methods in duplicate detection', () => {
            (() => discover(Inherited, registeredTypes)).should.throw(/multiple handlers.*explicit-author.*archive.*notify/);
        });
        it('should reject a conventional handler duplicating an inherited explicit handler', () => {
            (() => discover(Conventional, registeredTypes)).should.throw(/multiple handlers.*explicit-author.*notify.*authorRegistered/);
        });
    });
}
