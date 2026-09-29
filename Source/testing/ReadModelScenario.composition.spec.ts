// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { eventType } from '../events/eventTypeDecorator.js';
import { fromEvent } from '../projections/modelBound/fromEvent.js';
import { reactor } from '../reactors/reactor.js';
import type { ReactorServices } from '../reactors/ReactorServices.js';
import { reducer } from '../reducers/reducer.js';
import { EventScenario, ReactorScenario, ReadModelScenario, UnsupportedProjectionOperation } from './index.js';

chai.should();

@eventType('composition-member-joined')
class MemberJoined {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}

@eventType('composition-member-welcomed')
class MemberWelcomed {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}

@fromEvent(MemberJoined)
class Member {
    @field(String) id = '';
    @field(String) name = '';
}

class MemberCount { joined = 0; }
class MemberCountReducer {
    memberJoined(_event: MemberJoined, current: MemberCount | undefined): MemberCount {
        return { joined: (current?.joined ?? 0) + 1 };
    }
}
reducer('composition-member-count', undefined, MemberCount)(MemberCountReducer);

@fromEvent(MemberWelcomed)
class Welcome {
    @field(String) id = '';
    @field(String) name = '';
}

@reactor('composition-welcomer')
class Welcomer {
    async memberJoined(event: MemberJoined, context: { eventSourceId: string }, services: ReactorServices) {
        await services.eventStore.eventLog.append(context.eventSourceId, new MemberWelcomed(event.name));
        return new MemberWelcomed(`returned ${event.name}`);
    }
}

const eventTypes = [MemberJoined, MemberWelcomed];
const catalog = { eventTypes, reducers: [MemberCountReducer], projections: [] };

describe('ReadModelScenario observing an EventScenario', () => {
    it('projects the committed history at the time of each read', async () => {
        const events = new EventScenario({ artifacts: { eventTypes }, constraints: 'disabled' });
        const members = new ReadModelScenario(Member, catalog).observe(events);
        await events.append('member-1', new MemberJoined('Ada'));
        (await members.instanceForEventSourceId('member-1'))!.name.should.equal('Ada');
        await events.appendMany('member-2', [new MemberJoined('Grace')]);
        (await members.instanceForEventSourceId('member-2'))!.name.should.equal('Grace');
    });

    it('folds setup and action events through a reducer', async () => {
        const events = new EventScenario({ artifacts: { eventTypes }, constraints: 'disabled' });
        const counts = new ReadModelScenario(MemberCount, catalog).observe(events);
        await events.given.forEventSource('club').events(new MemberJoined('Ada'));
        await events.when.forEventSource('club').events(new MemberJoined('Grace'));
        (await counts.instance)!.joined.should.equal(2);
    });

    it('rejects an explicitly routed event instead of guessing its projection semantics', async () => {
        const events = new EventScenario({ artifacts: { eventTypes }, constraints: 'disabled' });
        const members = new ReadModelScenario(Member, catalog).observe(events);
        await events.appendMany([{ eventSourceId: 'member-1', event: new MemberJoined('Ada'), eventSourceType: 'Members' }]);
        const error = await members.instanceForEventSourceId('member-1').then(() => undefined, (reason: unknown) => reason);
        error.should.be.instanceOf(UnsupportedProjectionOperation);
        (error as Error).message.should.contain('routed events');
    });

    it('rejects seeding events into an observing scenario', () => {
        const members = new ReadModelScenario(Member, catalog).observe(new EventScenario({ artifacts: { eventTypes }, constraints: 'disabled' }));
        (() => members.given.forEventSource('member-1').events(new MemberJoined('Ada'))).should.throw(UnsupportedProjectionOperation, 'not both');
    });

    it('rejects observing after seeding or observing twice', () => {
        const events = new EventScenario({ artifacts: { eventTypes }, constraints: 'disabled' });
        const seeded = new ReadModelScenario(Member, catalog);
        seeded.given.forEventSource('member-1').events(new MemberJoined('Ada'));
        (() => seeded.observe(events)).should.throw(UnsupportedProjectionOperation, 'not both');
        const observing = new ReadModelScenario(Member, catalog).observe(events);
        (() => observing.observe(events)).should.throw(UnsupportedProjectionOperation, 'not both');
    });
});

describe('ReadModelScenario observing a ReactorScenario', () => {
    it('reads input events and the reactor\'s explicit appends, but not its recorded returned effects', async () => {
        const reactorScenario = new ReactorScenario(Welcomer, { artifacts: { eventTypes }, constraints: 'disabled' });
        const welcomes = new ReadModelScenario(Welcome, catalog).observe(reactorScenario);
        const members = new ReadModelScenario(Member, catalog).observe(reactorScenario);
        await reactorScenario.when.forEventSource('member-1').events(new MemberJoined('Ada'));
        (await members.instanceForEventSourceId('member-1'))!.name.should.equal('Ada');
        (await welcomes.instanceForEventSourceId('member-1'))!.name.should.equal('Ada');
        reactorScenario.appendedEvents.length.should.equal(2);
        reactorScenario.shouldHaveProduced(MemberWelcomed, welcome => welcome.name === 'returned Ada');
    });
});
