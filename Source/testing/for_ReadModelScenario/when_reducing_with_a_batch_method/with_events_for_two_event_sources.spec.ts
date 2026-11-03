// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { EventBatch, observes } from '../../../observation/index.js';
import { reducer } from '../../../reducers/reducer.js';
import { ReadModelScenario } from '../../index.js';

chai.should();

@eventType('scenario-batch-points-earned')
class PointsEarned {
    constructor(readonly points: number = 0) {}
}

class Score {
    @field(Number) points = 0;
}

let calls = 0;

@reducer('scenario-batch-scores', undefined, Score)
class Scores {
    @observes(PointsEarned)
    reduce(events: EventBatch, current: Score | undefined): Score {
        calls++;
        return { points: events.ofType(PointsEarned).reduce((total, entry) => total + entry.event.points, current?.points ?? 0) };
    }
}

describe('when reducing with a batch method in a read model scenario', () => {
    it('should call the batch method once per event source and keep each state', async () => {
        calls = 0;
        const scenario = new ReadModelScenario(Score, { eventTypes: [PointsEarned], reducers: [Scores] });
        scenario.given.forEventSource('player-1').events(new PointsEarned(3), new PointsEarned(4));
        scenario.given.forEventSource('player-2').events(new PointsEarned(10));
        (await scenario.instanceForEventSourceId('player-1'))!.should.deep.equal({ points: 7 });
        (await scenario.instanceForEventSourceId('player-2'))!.should.deep.equal({ points: 10 });
        calls.should.be.greaterThan(0);
    });
});
