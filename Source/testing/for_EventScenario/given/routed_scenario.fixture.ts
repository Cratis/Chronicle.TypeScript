// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { constraint } from '../../../events/constraints/constraint.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import type { EventContext } from '../../../events/EventContext.js';
import { reactor } from '../../../reactors/reactor.js';
import { EventScenario, ReactorScenario, UnsupportedEventSequenceOperation } from '../../index.js';

@eventType('BuilderRouteClaim')
export class Claim { @field(String) key: string; constructor(key: string) { this.key = key; } }
@eventType('BuilderRouteEffect')
export class Effect { @field(String) key: string; constructor(key: string) { this.key = key; } }
@constraint('BuilderRouteKey')
class ScopedKey {
    define(builder: IConstraintBuilder) {
        builder.perEventSourceType().perEventStreamType().perEventStreamId().unique(key => key.on(Claim, event => event.key));
    }
}
@reactor('BuilderRouteReactor')
export class RoutedReactor {
    claim(event: Claim, context: EventContext) {
        return new Effect(`${event.key}:${context.eventSourceType}/${context.eventStreamType}/${context.eventStreamId}`);
    }
}
export const route = { sourceType: 'Customer', streamType: 'Orders', streamId: 'West' };
export const artifacts = { eventTypes: [Claim, Effect], constraints: [ScopedKey] };
export const createEvents = () => new EventScenario({ artifacts });
export const createReactor = () => new ReactorScenario(RoutedReactor, { artifacts });
export const routing = (context: EventContext) => ({ sourceType: context.eventSourceType, streamType: context.eventStreamType, streamId: context.eventStreamId });
export async function rejection(action: () => unknown): Promise<UnsupportedEventSequenceOperation> {
    return Promise.resolve().then(action).then(() => { throw new Error('Expected unsupported operation'); }, error => {
        if (!(error instanceof UnsupportedEventSequenceOperation)) throw error;
        return error;
    });
}
