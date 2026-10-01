// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { eventType } from '../../events/eventTypeDecorator.js';
import { EventType } from '../../events/EventType.js';
import type { EventContext } from '../../events/EventContext.js';
import { handles } from '../index.js';
import { ReducerEventDispatcher } from '../ReducerEventDispatcher.js';

chai.should();

@eventType('explicit-reducer-delivery')
class AuthorRegistered { constructor(readonly name: string) {} }

class AuthorReducer {
    @handles(AuthorRegistered)
    update(event: AuthorRegistered, state: { names: string[] } | undefined, context: EventContext) {
        return { names: [...(state?.names ?? []), event.name], id: context.eventSourceId };
    }
}

describe('when invoking an explicit reducer handler', () => {
    let result: unknown;
    beforeEach(async () => {
        const dispatcher = new ReducerEventDispatcher(AuthorReducer, [AuthorRegistered]);
        const instance = new AuthorReducer() as unknown as Record<string, Function>;
        const context: EventContext = {
            sequenceNumber: 1n, eventSourceId: 'author', eventType: EventType.parse('explicit-reducer-delivery'),
            occurred: new Date(), correlationId: '', causation: [], tags: []
        };
        const handler = dispatcher.handlerFor('explicit-reducer-delivery')!;
        const initial = await dispatcher.invoke(instance, handler, new AuthorRegistered('Ada'), undefined, context);
        result = await dispatcher.invoke(instance, handler, new AuthorRegistered('Grace'), initial, context);
    });
    it('should pass the event state and context to the named method', () => {
        (result as object).should.deep.equal({ names: ['Ada', 'Grace'], id: 'author' });
    });
});
