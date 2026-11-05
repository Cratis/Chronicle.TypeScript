// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { createHandlerInstanceValidator } from '../observation/createHandlerInstanceValidator.js';
import { getEventHandlers } from '../observation/getEventHandlers.js';
import { getInstanceMethods } from '../observation/getInstanceMethods.js';
import type { BatchContext } from '../observation/batches/BatchContext.js';
import type { BatchMethod } from '../observation/batches/BatchMethod.js';
import { getBatchMethods, withoutBatchMethods } from '../observation/batches/BatchMethods.js';
import type { EventBatch } from '../observation/batches/EventBatch.js';
import { ReducerMixesBatchAndPerEventMethods } from '../observation/batches/ReducerMixesBatchAndPerEventMethods.js';
import type { EventContext } from '../events/EventContext.js';
import type { ReducerEventHandler } from './ReducerEventHandler.js';

/** Selects and invokes the same reducer handlers for kernel deliveries and in-process scenarios. */
export class ReducerEventDispatcher {
    /** The per-event handlers; empty when the reducer has a batch method. */
    readonly handlers: ReducerEventHandler[];

    /** The batch method, when the reducer has one instead of per-event handlers. */
    readonly batchMethod: BatchMethod | undefined;

    readonly validateInstance: (instance: object) => void;

    /**
     * Discovers event methods from the artifact event types. A reducer has either per-event methods or one batch method.
     * @param reducerType - The reducer class.
     * @param eventTypes - The event types registered with the event store.
     * @throws {@link ReducerMixesBatchAndPerEventMethods} when the reducer mixes batch and per-event methods, or has two batch methods.
     */
    constructor(reducerType: Constructor, eventTypes: readonly Constructor[]) {
        const methods = getInstanceMethods(reducerType);
        const batchMethods = getBatchMethods(reducerType, eventTypes, methods);
        this.handlers = getEventHandlers(reducerType, eventTypes, withoutBatchMethods(methods, batchMethods));
        if (batchMethods.length > 1 || (batchMethods.length === 1 && this.handlers.length > 0)) {
            throw new ReducerMixesBatchAndPerEventMethods((reducerType as Function).name,
                [...batchMethods.map(method => method.methodName), ...this.handlers.map(handler => handler.methodName)]);
        }
        this.batchMethod = batchMethods[0];
        this.validateInstance = createHandlerInstanceValidator(reducerType,
            [...this.handlers.map(handler => handler.methodName), ...batchMethods.map(method => method.methodName)], methods);
    }

    /** The event types the reducer registers: the batch method's observed types, or the per-event handlers' types. */
    get eventTypes(): readonly { readonly id: string; readonly generation: number }[] {
        return this.batchMethod ? [...this.batchMethod.eventTypes.values()] : this.handlers;
    }

    /** Resolves a registered event type, or returns undefined for an unsubscribed event. */
    handlerFor(eventTypeId: string): ReducerEventHandler | undefined {
        return this.handlers.find(handler => handler.id === eventTypeId);
    }

    /** Calls the selected handler with the event, current state, and context. */
    async invoke(
        instance: Record<string, Function>,
        handler: ReducerEventHandler,
        event: unknown,
        currentState: unknown,
        context: EventContext
    ): Promise<unknown> {
        return await instance[handler.methodName](event, currentState, context) as unknown;
    }

    /**
     * Calls the batch method with the events of one event source, its current state and the page's context.
     * @param instance - The reducer instance.
     * @param batch - The {@link EventBatch} of the event source.
     * @param currentState - The stored state of the event source, or undefined.
     * @param context - The {@link BatchContext} of the page.
     * @returns The next state; undefined or null removes the read model.
     */
    async invokeBatch(instance: Record<string, Function>, batch: EventBatch, currentState: unknown, context: BatchContext): Promise<unknown> {
        return await instance[this.batchMethod!.methodName](batch, currentState, context) as unknown;
    }
}
