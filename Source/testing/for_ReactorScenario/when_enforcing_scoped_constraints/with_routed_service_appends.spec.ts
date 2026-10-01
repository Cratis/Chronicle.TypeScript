// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { constraint } from '../../../events/constraints/constraint.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import type { EventContext } from '../../../events/EventContext.js';
import { reactor } from '../../../reactors/reactor.js';
import type { ReactorServices } from '../../../reactors/ReactorServices.js';
import { ReactorScenario } from '../../ReactorScenario.js';
import { UnsupportedEventSequenceOperation } from '../../UnsupportedEventSequenceOperation.js';

chai.should();
@eventType('ScopedServiceRequested')
class Requested { @field(String) stream: string; constructor(stream: string) { this.stream = stream; } }
@eventType('ScopedServiceClaimed')
class Claimed { @field(String) key = 'Key'; }
@eventType('ScopedServiceReturned')
class Returned { @field(String) label = 'returned'; }
@constraint('ScopedServiceKey')
class Key { define(builder: IConstraintBuilder) { builder.perEventStreamId().unique(key => key.on(Claimed, event => event.key)); } }

describe('when a reactor explicitly appends into a constraint scope', () => {
    it('should preserve routed service appends without routing or recursively delivering the input', async () => {
        const successes: boolean[] = [];
        @reactor('ScopedServiceWriter')
        class Writer {
            async requested(event: Requested, context: EventContext, services: ReactorServices) {
                successes.push((await services.eventStore.eventLog.append(context.eventSourceId, new Claimed(), { streamId: event.stream })).isSuccess);
            }
        }
        const scenario = new ReactorScenario(Writer, { artifacts: { eventTypes: [Requested, Claimed], constraints: [Key] } });
        await scenario.when.forEventSource('A').events(new Requested('West'));
        await scenario.when.forEventSource('B').events(new Requested('East'));
        await scenario.when.forEventSource('C').events(new Requested('West'));
        successes.should.deep.equal([true, true, false]);
        scenario.appendedEvents.map(event => event.context.eventStreamId).should.deep.equal(['Default', 'West', 'Default', 'East', 'Default']);
        scenario.results.length.should.equal(3);
        scenario.produced.length.should.equal(0);
    });

    it('should fail a delivery that swallows an unsupported route and record no returned effect', async () => {
        @reactor('ScopedServiceUnsupportedWriter')
        class Writer {
            async requested(_event: Requested, context: EventContext, services: ReactorServices) {
                try { await services.eventStore.eventLog.append(context.eventSourceId, new Claimed(), { streamId: 'bad|route' }); }
                catch { /* The harness must latch unsupported appends even if the handler swallows them. */ }
                return new Returned();
            }
        }
        const scenario = new ReactorScenario(Writer, { artifacts: { eventTypes: [Requested, Claimed, Returned], constraints: [Key] } });
        await scenario.when.forEventSource('A').events(new Requested('West')).then(
            () => { throw new Error('Unsupported route was swallowed'); }, error => {
                (error instanceof UnsupportedEventSequenceOperation).should.be.true;
                (error as Error).message.should.include('append.streamId');
            });
        scenario.appendedEvents.length.should.equal(1);
        scenario.produced.length.should.equal(0);
        scenario.sideEffects.length.should.equal(0);
        scenario.results[0].completed.should.be.false;
    });
});
