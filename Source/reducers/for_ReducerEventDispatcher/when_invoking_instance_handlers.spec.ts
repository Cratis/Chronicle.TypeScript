// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { eventType } from '../../events/eventTypeDecorator.js';
import { EventType } from '../../events/EventType.js';
import type { EventContext } from '../../events/EventContext.js';
import { handles } from '../index.js';
import { ReducerEventDispatcher } from '../ReducerEventDispatcher.js';

chai.should();

@eventType('instance-reducer-event')
class AuthorRegistered { constructor(readonly name: string) {} }

class BoundConventional {
    readonly prefix = 'conventional';
    constructor() { this.authorRegistered = this.authorRegistered.bind(this); }
    authorRegistered(event: AuthorRegistered, state: string[] | undefined, context: EventContext) {
        return [...(state ?? []), `${this.prefix}:${event.name}:${context.eventSourceId}`];
    }
}

class BoundExplicit {
    readonly prefix = 'explicit';
    constructor() { this.update = this.update.bind(this); }
    @handles(AuthorRegistered)
    update(event: AuthorRegistered, state: string[] | undefined, context: EventContext) {
        return [...(state ?? []), `${this.prefix}:${event.name}:${context.eventSourceId}`];
    }
}

class Conventional {
    authorRegistered(event: AuthorRegistered, state: string[] | undefined, context: EventContext) {
        return [...(state ?? []), `base:${event.name}:${context.eventSourceId}`];
    }
}

class FieldConventional extends Conventional {
    override authorRegistered = (event: AuthorRegistered, state: string[] | undefined, context: EventContext) =>
        [...(state ?? []), `field:${event.name}:${context.eventSourceId}`];
}

for (const { type, prefix } of [
    { type: BoundConventional, prefix: 'conventional' },
    { type: BoundExplicit, prefix: 'explicit' },
    { type: FieldConventional, prefix: 'field' }
]) {
    describe(`when invoking the ${prefix} reducer instance handler`, () => {
        let result: unknown;
        beforeEach(async () => {
            const dispatcher = new ReducerEventDispatcher(type, [AuthorRegistered]);
            const instance = new type();
            dispatcher.validateInstance(instance);
            const context: EventContext = {
                sequenceNumber: 1n, eventSourceId: 'author', eventType: EventType.parse('instance-reducer-event'),
                occurred: new Date(), correlationId: '', causation: [], tags: []
            };
            const handler = dispatcher.handlerFor('instance-reducer-event')!;
            const initial = await dispatcher.invoke(instance as unknown as Record<string, Function>, handler,
                new AuthorRegistered('Ada'), undefined, context);
            result = await dispatcher.invoke(instance as unknown as Record<string, Function>, handler,
                new AuthorRegistered('Grace'), initial, context);
        });
        it('should invoke the instance handler with the event state and context', () => {
            (result as string[]).should.deep.equal([`${prefix}:Ada:author`, `${prefix}:Grace:author`]);
        });
    });
}
