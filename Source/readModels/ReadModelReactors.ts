// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { IClientArtifactsProvider } from '../artifacts/IClientArtifactsProvider.js';
import type { IEventStore } from '../IEventStore.js';
import type { IEventLog } from '../eventSequences/IEventLog.js';
import { createLogger } from '../logging/createLogger.js';
import type { IChronicleLogger } from '../logging/IChronicleLogger.js';
import type { IReadModelReactors } from './IReadModelReactors.js';
import type { IReadModelWatcher } from './IReadModelWatcher.js';
import type { ReadModelChangeset } from './ReadModelChangeset.js';
import type { ReadModelReactorActivator } from './ReadModelReactorActivator.js';
import type { ReadModelReactorResultHandler } from './ReadModelReactorResultHandler.js';
import type { ReadModelReactorErrorHandler } from './ReadModelReactorErrorHandler.js';
import { ReadModelReactorDispatcher } from './ReadModelReactorDispatcher.js';
import { getReadModelReactorMetadata } from './readModelReactor.js';
import { rootReadModelTypes } from './rootReadModelTypes.js';

/** Owns one serial change consumer per discovered reactor class. */
export class ReadModelReactors implements IReadModelReactors {
    readonly completion: Promise<void>;
    private resolveCompletion!: () => void;
    private rejectCompletion!: (error: unknown) => void;
    private readonly cancellation = new AbortController();
    private readonly watchers: IReadModelWatcher<unknown>[] = [];
    private readonly tasks: Promise<void>[] = [];
    private starting?: Promise<void>;
    private readonly logger: ReturnType<typeof createLogger>;

    constructor(private readonly artifacts: IClientArtifactsProvider, private readonly store: IEventStore,
        private readonly eventLogForNamespace: (namespace: string) => IEventLog,
        private readonly activator?: ReadModelReactorActivator,
        private readonly resultHandler?: ReadModelReactorResultHandler,
        private readonly onError?: ReadModelReactorErrorHandler,
        private readonly diagnosticLogger?: IChronicleLogger) {
        this.logger = createLogger('@cratis/chronicle/readModels', diagnosticLogger);
        this.completion = new Promise((resolve, reject) => { this.resolveCompletion = resolve; this.rejectCompletion = reject; });
        void this.completion.catch(error => this.logger.error('Read-model reactors stopped unexpectedly', { error }));
    }

    start(): Promise<void> {
        this.starting ??= this.subscribe();
        return this.starting;
    }

    stop(): void {
        this.cancellation.abort();
        for (const watcher of this.watchers) watcher.dispose();
        void Promise.allSettled(this.tasks).then(() => this.resolveCompletion());
    }

    private async subscribe(): Promise<void> {
        try {
            if (this.cancellation.signal.aborted) throw new Error('Read-model reactors have been stopped.');
            const roots = rootReadModelTypes(this.artifacts);
            for (const type of new Set(this.artifacts.readModelReactors ?? [])) {
                const dispatcher = new ReadModelReactorDispatcher(type, this.store, this.eventLogForNamespace,
                    this.activator, this.resultHandler, this.diagnosticLogger);
                const model = getReadModelReactorMetadata(type)!.readModel;
                if (!roots.includes(model)) throw new Error(`Read-model reactor ${type.name} requires a registered root read model ${model.name}.`);
                const watcher = this.store.readModels.createWatcher(model, { resume: true, signal: this.cancellation.signal });
                this.watchers.push(watcher);
                this.tasks.push(this.consume(type, watcher, dispatcher));
            }
            await Promise.all(this.watchers.map(watcher => watcher.subscribed));
        } catch (error) {
            this.fail(error);
            throw error;
        }
    }

    private async consume(type: Constructor, watcher: IReadModelWatcher<unknown>, dispatcher: ReadModelReactorDispatcher): Promise<void> {
        try {
            for await (const changeset of watcher) {
                if (this.cancellation.signal.aborted) break;
                try {
                    await dispatcher.dispatch(changeset, this.cancellation.signal);
                } catch (error) {
                    await this.reportChangeFailure(error, changeset, type);
                }
            }
            if (!this.cancellation.signal.aborted) throw new Error(`Read-model reactor watcher ended for ${type.name}.`);
        } catch (error) {
            if (!this.cancellation.signal.aborted) this.fail(error);
        }
    }

    private async reportChangeFailure(error: unknown, changeset: ReadModelChangeset<unknown>, type: Constructor): Promise<void> {
        this.logger.error('Read-model reactor change failed', { artifactId: getReadModelReactorMetadata(type)!.id, error });
        try {
            await this.onError?.(error, changeset, type);
        } catch (callbackError) {
            this.logger.error('Read-model reactor onError callback failed', { error: callbackError });
        }
    }

    private fail(error: unknown): void {
        this.rejectCompletion(error);
        this.stop();
    }
}
