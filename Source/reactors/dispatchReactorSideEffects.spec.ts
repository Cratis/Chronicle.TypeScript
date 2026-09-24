// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import type { IEventLog } from '../eventSequences/IEventLog.js';
import type { EventContext } from '../events/EventContext.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { dispatchReactorSideEffects } from './ReactorSideEffects.js';

class Triggered {}
eventType('bb382cad-9aa9-4da6-a6de-90b9867d1aa0')(Triggered);
const context = { eventSourceId: 'id', eventStreamId: 'id', eventStreamType: 'Default' } as EventContext;
const reactor = class Reactor {};

function fixture() {
    const appendMany = vi.fn().mockResolvedValue([{ isSuccess: true, errors: [], constraintViolations: [] }]);
    return { appendMany, eventLog: { appendMany } as unknown as IEventLog };
}

describe('when dispatching a reactor result', () => {
    it('should let the application handle the result before an event append', async () => {
        const { eventLog, appendMany } = fixture();
        const handler = vi.fn().mockResolvedValue(true);
        const result = new Triggered();
        await dispatchReactorSideEffects(eventLog, result, context, reactor, 'store', 'tenant', handler);
        expect(handler).toHaveBeenCalledWith(result, context, reactor, 'store', 'tenant');
        expect(appendMany).not.toHaveBeenCalled();
    });
    it('should append events when the application declines', async () => {
        const { eventLog, appendMany } = fixture();
        await dispatchReactorSideEffects(eventLog, new Triggered(), context, reactor, 'store', 'tenant', () => false);
        expect(appendMany).toHaveBeenCalledTimes(1);
    });
    it('should propagate a handler failure without appending events', async () => {
        const { eventLog, appendMany } = fixture();
        await expect(dispatchReactorSideEffects(eventLog, new Triggered(), context, reactor, 'store', 'tenant', () => {
            throw new Error('Command failed');
        })).rejects.toThrow('Command failed');
        expect(appendMany).not.toHaveBeenCalled();
    });
});
