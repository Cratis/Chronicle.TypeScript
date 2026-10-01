// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventObservationState } from '@cratis/chronicle.contracts';
import { beforeEach, chai, describe, it } from 'vitest';
import { eventType } from '../../events/eventTypeDecorator.js';
import { handles, onceOnly, replay } from '../index.js';
import { getReactorEventTypes, selectReactorHandler } from '../ReactorDispatcher.js';

chai.should();

@eventType('selected-handler')
class AuthorRegistered {}

function selected(type: new () => object, state: EventObservationState) {
    return selectReactorHandler(getReactorEventTypes(type, [AuthorRegistered]), type, undefined, 'selected-handler', state)!;
}

describe('when selecting an explicit handler with a replay alternative', () => {
    class Observer {
        @handles(AuthorRegistered)
        @onceOnly()
        notify() {}

        @replay(AuthorRegistered)
        rebuild() {}
    }
    it('should select the explicit method for live events', () => {
        selected(Observer, EventObservationState.Initial).methodName!.should.equal('notify');
    });
    it('should select the replay alternative even when the live method is onceOnly', () => {
        selected(Observer, EventObservationState.Replay).should.deep.equal({ methodName: 'rebuild', isReplay: true, skipReplay: false });
    });
});

describe('when selecting an explicit handler without a replay alternative', () => {
    class Observer { @handles(AuthorRegistered) notify() {} }
    let handler: ReturnType<typeof selected>;
    beforeEach(() => { handler = selected(Observer, EventObservationState.Replay); });
    it('should use the explicit method during replay too', () => {
        handler.should.deep.equal({ methodName: 'notify', isReplay: true, skipReplay: false });
    });
});

describe('when an explicit handler is onceOnly', () => {
    class Observer { @onceOnly() @handles(AuthorRegistered) notify() {} }
    it('should not skip live delivery', () => {
        selected(Observer, EventObservationState.Initial).skipReplay.should.be.false;
    });
    it('should skip replay delivery', () => {
        selected(Observer, EventObservationState.Replay).skipReplay.should.be.true;
    });
});

describe('when a method declares both live and replay roles', () => {
    class Observer { @handles(AuthorRegistered) @replay(AuthorRegistered) notify() {} }
    it('should reject the ambiguous declaration during discovery', () => {
        (() => getReactorEventTypes(Observer, [AuthorRegistered])).should.throw(/notify.*Observer.*cannot combine @handles and @replay/);
    });
});
