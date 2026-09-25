// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ObserverRemovalOutcome as ContractObserverRemovalOutcome, ObserverRunningState as ContractObserverRunningState, ObserverType as ContractObserverType } from '@cratis/chronicle.contracts';
import { describe, expect, it, vi } from 'vitest';
import type { ChronicleConnection } from '../connection/index.js';
import { ObserverRemovalOutcome } from './ObserverRemovalOutcome.js';
import { ObserverRunningState } from './ObserverRunningState.js';
import { ObserverType } from './ObserverType.js';
import { Observers } from './Observers.js';

function wireObserverInformation() {
    return {
        Id: 'employee-alerts',
        EventSequenceId: 'event-log',
        Type: ContractObserverType.Reactor,
        RunningState: ContractObserverRunningState.Active,
        LastHandledEventSequenceNumber: 6n,
        NextEventSequenceNumber: 7n,
        HandledEventCount: 6n
    };
}

function createObservers(getObserversResult?: unknown, removeObserverResult?: unknown) {
    const getObservers = vi.fn().mockResolvedValue(getObserversResult ?? { items: [] });
    const removeObserver = vi.fn().mockResolvedValue(
        removeObserverResult ?? { Outcome: ContractObserverRemovalOutcome.Removed, BlockingNamespace: '' }
    );
    const connection = { observers: { getObservers, removeObserver } } as unknown as ChronicleConnection;
    const observers = new Observers('my-event-store', 'my-namespace', connection);
    return { observers, getObservers, removeObserver };
}

describe('Observers', () => {
    describe('when getting all observers', () => {
        it('should map every field on the wire observer', async () => {
            const { observers } = createObservers({ items: [wireObserverInformation()] });
            const result = await observers.getAll();

            expect(result).toHaveLength(1);
            expect(result[0].id).toEqual('employee-alerts');
            expect(result[0].eventSequenceId.value).toEqual('event-log');
            expect(result[0].type).toEqual(ObserverType.Reactor);
            expect(result[0].runningState).toEqual(ObserverRunningState.Active);
            expect(result[0].lastHandledEventSequenceNumber.value).toEqual(6n);
            expect(result[0].nextEventSequenceNumber.value).toEqual(7n);
            expect(result[0].handledEventCount).toEqual(6n);
        });

        it('should call the RPC with the event store and namespace', async () => {
            const { observers, getObservers } = createObservers({ items: [] });
            await observers.getAll();

            expect(getObservers).toHaveBeenCalledTimes(1);
            const request = getObservers.mock.calls[0][0];
            expect(request.EventStore).toEqual('my-event-store');
            expect(request.Namespace).toEqual('my-namespace');
        });

        it('should return an empty array when there are no observers', async () => {
            const { observers } = createObservers({ items: [] });
            expect(await observers.getAll()).toEqual([]);
        });

        // OBSERVER_RUNNING_STATE_Disconnected is how the wire enum actually names it - protoc prefixes the
        // literal to dodge a collision elsewhere in the file - so a mapping onto the wrong wire constant would
        // compile fine and misreport every disconnected observer as unknown.
        it('should report a disconnected observer as disconnected, not unknown', async () => {
            const { observers } = createObservers({
                items: [{ ...wireObserverInformation(), RunningState: ContractObserverRunningState.OBSERVER_RUNNING_STATE_Disconnected }]
            });

            expect((await observers.getAll())[0].runningState).toEqual(ObserverRunningState.Disconnected);
        });
    });

    describe('when removing an observer', () => {
        it('should call the RPC with the observer id, the event store, the namespace and the event log', async () => {
            const { observers, removeObserver } = createObservers();
            await observers.remove('employee-alerts');

            expect(removeObserver).toHaveBeenCalledTimes(1);
            const request = removeObserver.mock.calls[0][0];
            expect(request.ObserverId).toEqual('employee-alerts');
            expect(request.EventStore).toEqual('my-event-store');
            expect(request.Namespace).toEqual('my-namespace');
            expect(request.EventSequenceId).toEqual('event-log');
        });

        it('should report a removed observer as removed', async () => {
            const { observers } = createObservers(undefined, {
                Outcome: ContractObserverRemovalOutcome.Removed,
                BlockingNamespace: ''
            });

            const result = await observers.remove('employee-alerts');

            expect(result.isRemoved).toBe(true);
            expect(result.outcome).toEqual(ObserverRemovalOutcome.Removed);
        });

        it('should refuse to remove an active observer and name the namespace still running it', async () => {
            const { observers } = createObservers(undefined, {
                Outcome: ContractObserverRemovalOutcome.ObserverActive,
                BlockingNamespace: 'production'
            });

            const result = await observers.remove('employee-alerts');

            expect(result.isRemoved).toBe(false);
            expect(result.outcome).toEqual(ObserverRemovalOutcome.ObserverActive);
            expect(result.blockingNamespace).toEqual('production');
        });
    });
});
