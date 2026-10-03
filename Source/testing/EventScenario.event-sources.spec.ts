// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { eventType } from '../events/eventTypeDecorator.js';
import { EventScenario, UnsupportedEventSequenceOperation } from './index.js';

chai.should();
class ScenarioSourceEvent { @field(String) name: string; constructor(name: string) { this.name = name; } }
eventType('ScenarioSourceEvent')(ScenarioSourceEvent);

const rejects = async (action: () => Promise<unknown>) => {
    let caught: unknown;
    try { await action(); } catch (error) { caught = error; }
    (caught instanceof UnsupportedEventSequenceOperation).should.be.true;
};
const create = () => new EventScenario({ artifacts: { eventTypes: [ScenarioSourceEvent] } });

describe('when appending with registered event sources in an in-process scenario', () => {
    it('should reject the eventSource option on append instead of dropping it', async () => {
        await rejects(() => create().append('A', new ScenarioSourceEvent('x'), { eventSource: 'Account' }));
    });
    it('should reject the eventSource option on appendMany instead of dropping it', async () => {
        await rejects(() => create().appendMany([{ eventSourceId: 'A', event: new ScenarioSourceEvent('x') }], { eventSource: 'Account' }));
    });
    it('should reject a per-event eventSource on appendMany instead of dropping it', async () => {
        await rejects(() => create().appendMany([{ eventSourceId: 'A', event: new ScenarioSourceEvent('x'), eventSource: 'Account' }]));
    });
    it('should reject a per-event eventStream on appendMany instead of dropping it', async () => {
        await rejects(() => create().appendMany([{ eventSourceId: 'A', event: new ScenarioSourceEvent('x'), eventStream: 'Transactions' }]));
    });
});
