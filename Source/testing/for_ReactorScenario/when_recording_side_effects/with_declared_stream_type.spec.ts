// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it, vi } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { eventStreamType } from '../../../events/eventStreamTypeDecorator.js';
import type { EventForEventSourceId } from '../../../eventSequences/EventForEventSourceId.js';
import type { IEventLog } from '../../../eventSequences/IEventLog.js';
import { reactor } from '../../../reactors/reactor.js';
import { dispatchReactorSideEffects } from '../../../reactors/ReactorSideEffects.js';
import { ReactorScenario } from '../../ReactorScenario.js';

chai.should();
@eventType('scenario-type-side-effect-input')
class Input { @field(String) name = 'input'; }
@eventType('scenario-type-side-effect-output')
class Outbound { @field(String) name = 'output'; }
const bare = new Outbound();
const explicit = { eventSourceId: 'other', event: new Outbound(), eventSourceType: 'explicit-source', eventStreamType: 'explicit-stream' };
const omitted = { eventSourceId: 'omitted', event: new Outbound() };

@reactor('scenario-type-side-effects')
@eventStreamType('All')
class AllStreamsReactor { input() { return [bare, explicit, omitted]; } }

// Non-default filters still require kernel-backed delivery. An explicit unrestricted stream
// decorator exercises declared side-effect metadata without pretending to implement filtering.
describe('when recording side effects with an explicit unrestricted stream decorator', () => {
    let scenario: ReactorScenario;
    let appended: EventForEventSourceId[];
    beforeEach(async () => {
        scenario = new ReactorScenario(AllStreamsReactor, { artifacts: { eventTypes: [Input, Outbound] }, constraints: 'disabled' });
        await scenario.when.forEventSource('trigger').events(new Input());
        const eventLog = { appendMany: vi.fn(async (events: EventForEventSourceId[]) => {
            appended = events;
            return [{ isSuccess: true, errors: [], constraintViolations: [] }];
        }) } as unknown as IEventLog;
        await dispatchReactorSideEffects(eventLog, [bare, explicit, omitted], scenario.sideEffects[0].triggeringContext,
            AllStreamsReactor, 'store', 'namespace');
    });
    it('should record the same target metadata as production dispatch', () => {
        scenario.sideEffects.map(effect => effect.target).should.deep.equal(appended);
        scenario.sideEffects[0].target.eventStreamType!.should.equal('All');
    });
    it('should preserve explicitly targeted events instead of inheriting reactor metadata', () => {
        scenario.sideEffects[1].target.should.equal(explicit);
        scenario.sideEffects[2].target.should.equal(omitted);
    });
});
