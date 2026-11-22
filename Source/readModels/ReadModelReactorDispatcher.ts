// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { IEventStore } from '../IEventStore.js';
import type { IEventLog } from '../eventSequences/IEventLog.js';
import { hasEventType } from '../events/eventTypeDecorator.js';
import { appendReactorSideEffects } from '../reactors/ReactorSideEffects.js';
import type { IChronicleLogger } from '../logging/IChronicleLogger.js';
import { ReadModelChangeType } from './ReadModelChangeType.js';
import type { ReadModelChangeset } from './ReadModelChangeset.js';
import type { IReadModelReactor } from './IReadModelReactor.js';
import type { ReadModelReactorActivator } from './ReadModelReactorActivator.js';
import type { ReadModelReactorResultHandler } from './ReadModelReactorResultHandler.js';
import { getReadModelReactorHandlers, getReadModelReactorMetadata } from './readModelReactor.js';
import { withReadModelReactor } from './withReadModelReactor.js';

/** Dispatches a single typed change within its own activation lease. */
export class ReadModelReactorDispatcher {
    private readonly handlers: string[];

    constructor(private readonly type: Constructor, private readonly store: IEventStore,
        private readonly eventLogForNamespace: (namespace: string) => IEventLog,
        private readonly activator?: ReadModelReactorActivator,
        private readonly resultHandler?: ReadModelReactorResultHandler,
        private readonly logger?: IChronicleLogger) {
        this.handlers = getReadModelReactorHandlers(type);
    }

    async dispatch(changeset: ReadModelChangeset<unknown>, signal: AbortSignal): Promise<void> {
        const changeType = changeset.changeType ?? (changeset.removed ? ReadModelChangeType.Removed : ReadModelChangeType.Modified);
        const handlerName = ['added', 'modified', 'removed'][changeType];
        if (signal.aborted || !this.handlers.includes(handlerName)) return;
        const metadata = getReadModelReactorMetadata(this.type)!;
        await withReadModelReactor(this.type, {
            artifactId: metadata.id, eventStore: this.store, readModel: metadata.readModel, changeset, handlerName, signal
        }, async instance => {
            if (signal.aborted) return;
            const handler = (instance as IReadModelReactor<unknown>)[handlerName as keyof IReadModelReactor<unknown>]!;
            const result = await handler.call(instance, changeset.readModel, changeset);
            if (signal.aborted) return;
            await this.effects(result, changeset, signal);
        }, { activator: this.activator, logger: this.logger });
    }

    private async effects(result: unknown, changeset: ReadModelChangeset<unknown>, signal: AbortSignal): Promise<void> {
        if (await this.resultHandler?.(result, changeset, this.type, this.store, changeset.namespace)) return;
        if (signal.aborted) return;
        if (containsBareEvent(result)) {
            throw new Error('Read-model reactor events require EventForEventSourceId wrappers; a read model key is not an event source id.');
        }
        const appended = await appendReactorSideEffects(this.eventLogForNamespace(changeset.namespace), result, '', '', '');
        if (!appended.isSuccess) throw new Error(`Read-model reactor side effect failed to append: ${appended.errors.join('; ')}`);
    }
}

function containsBareEvent(result: unknown): boolean {
    const items = Array.isArray(result) ? result : [result];
    return items.some(item => {
        if (typeof item !== 'object' || item === null) return false;
        return hasEventType(item.constructor);
    });
}
