// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it } from 'vitest';
import { eventType, handles, onceOnly, reactor, type EventContext, type ReactorServices } from '../../index.js';
import { ReactorScenario } from '../index.js';

chai.should();

@eventType('scenario-explicit-author')
class AuthorRegistered {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}
@eventType('scenario-explicit-notification')
class AuthorNotified {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}

const calls: { name: string; source: string; method: string }[] = [];
@reactor('explicit-scenario-handler')
class AuthorReactor {
    @onceOnly()
    @handles(AuthorRegistered)
    notify(event: AuthorRegistered, context: EventContext, services: ReactorServices) {
        (services.readModels === services.eventStore.readModels).should.be.true;
        calls.push({ name: event.name, source: context.eventSourceId, method: 'notify' });
        return new AuthorNotified(event.name);
    }
}

const options = { artifacts: { eventTypes: [AuthorRegistered, AuthorNotified] }, constraints: 'disabled' as const };

describe('when delivering a live event to an explicitly named onceOnly handler in ReactorScenario', () => {
    let scenario: ReactorScenario;
    beforeEach(async () => {
        calls.length = 0;
        scenario = new ReactorScenario(AuthorReactor, options);
        await scenario.when.forEventSource('author-1').events(new AuthorRegistered('Ada'));
    });
    it('should invoke the method with the event and context', () => {
        calls.should.deep.equal([{ name: 'Ada', source: 'author-1', method: 'notify' }]);
    });
    it('should process returned side effects', () => {
        scenario.shouldHaveProduced(AuthorNotified, event => event.name === 'Ada');
    });
    it('should complete delivery', () => {
        scenario.results[0].completed.should.be.true;
    });
});

describe('when ReactorScenario has an unregistered explicit handler', () => {
    it('should reject it before constructing the reactor', () => {
        let constructed = false;
        @reactor('invalid-explicit-scenario')
        class Invalid {
            constructor() { constructed = true; }
            @handles(AuthorRegistered) notify() {}
        }
        (() => new ReactorScenario(Invalid, { ...options, artifacts: { eventTypes: [AuthorNotified] } }))
            .should.throw(/notify.*AuthorRegistered.*no registered event type/);
        constructed.should.be.false;
    });
});

@reactor('field-shadowing-scenario')
class FieldReactor extends AuthorReactor {
    override notify = () => new AuthorNotified('hidden');
}

describe('when an instance field hides an inherited ReactorScenario handler', () => {
    it('should reject the field after constructing the reactor', () => {
        (() => new ReactorScenario(FieldReactor, options)).should.throw(
            "Override 'notify' on 'FieldReactor' hides @handles(AuthorRegistered) declared on 'AuthorReactor'; use a method with @handles instead of an instance field.");
    });
    it('should reject an activator-created field before delivery and dispose its lease', async () => {
        let disposed = false;
        const scenario = new ReactorScenario(FieldReactor, { ...options, artifactActivator: type => ({
            instance: new type(), dispose: () => { disposed = true; }
        }) });
        const [result] = await Promise.allSettled([scenario.when.forEventSource('author').events(new AuthorRegistered('Ada'))]);
        result.status.should.equal('rejected');
        if (result.status === 'rejected') (result.reason as Error).message.should.match(/Override 'notify'.*use a method/);
        scenario.produced.should.have.lengthOf(0);
        disposed.should.be.true;
    });
});

describe('when ReactorScenario has duplicate explicit and conventional handlers', () => {
    @reactor('duplicate-explicit-scenario')
    class Invalid {
        @handles(AuthorRegistered) notify() {}
        authorRegistered() {}
    }
    it('should reject the ambiguous event delivery', () => {
        (() => new ReactorScenario(Invalid, options)).should.throw(/multiple handlers.*scenario-explicit-author/);
    });
});
