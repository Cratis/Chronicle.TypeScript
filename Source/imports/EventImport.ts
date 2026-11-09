// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Guid } from '@cratis/fundamentals';
import type { ImportEvent } from '@cratis/chronicle.contracts';
import { toContractsGuid } from '../connection/Guid.js';
import { ensureCommandResponse, ensureQuerySuccess } from '../connection/callResults.js';
import type { EventForEventSourceId } from '../eventSequences/EventForEventSourceId.js';
import { delay, readUntilAborted, untilAborted } from './abortable.js';
import type { EventImportSettings } from './EventImportSettings.js';
import type { IEventImport } from './IEventImport.js';
import { ImportChunkRefused } from './ImportChunkRefused.js';
import type { ImportProgress } from './ImportProgress.js';
import type { ImportResult } from './ImportResult.js';
import { ImportState } from './ImportState.js';
import { ImportWasAbandoned } from './ImportWasAbandoned.js';
import { isTransientImportFailure } from './isTransientImportFailure.js';
import { sizeOfImportEvent } from './sizeOfImportEvent.js';
import { toImportProgress } from './toImportProgress.js';
import { toImportResult } from './toImportResult.js';

const defaultMaxChunksInFlight = 4;
const defaultMaxChunkAttempts = 5;
const defaultPollInterval = 500;
const terminalStates = new Set([ImportState.Completed, ImportState.Failed, ImportState.Abandoned]);

/**
 * Represents an implementation of {@link IEventImport} that cuts events into chunks within the kernel's limits and
 * keeps a bounded number of them in flight.
 */
export class EventImport implements IEventImport {
    readonly importId: Guid;
    readonly eventsAcknowledged: number;

    readonly #settings: EventImportSettings;
    readonly #maxEventsPerChunk: number;
    readonly #maxBytesPerChunk: number;
    readonly #maxChunksInFlight: number;
    readonly #maxChunkAttempts: number;
    readonly #retryDelay: (attempt: number) => number;
    readonly #abandoning = new AbortController();
    readonly #sends = new Set<Promise<void>>();
    readonly #slotWaiters: (() => void)[] = [];
    #buffer: ImportEvent[] = [];
    #bufferBytes = 0;
    #nextChunkIndex: number;
    #nextEventIndex: number;
    #chunksInFlight = 0;
    #exclusive: Promise<void> = Promise.resolve();
    #failure: { error: unknown } | undefined;
    #abandoned = false;

    /**
     * Creates a new {@link EventImport}.
     * @param settings - The {@link EventImportSettings}.
     */
    constructor(settings: EventImportSettings) {
        this.#settings = settings;
        this.importId = settings.importId;
        this.eventsAcknowledged = settings.acknowledgedEvents ?? 0;
        this.#nextChunkIndex = settings.acknowledgedChunks ?? 0;
        this.#nextEventIndex = settings.acknowledgedEvents ?? 0;
        const serverEvents = settings.maxChunkEvents > 0 ? settings.maxChunkEvents : Number.POSITIVE_INFINITY;
        this.#maxEventsPerChunk = Math.max(1, Math.min(serverEvents, settings.options.maxEventsPerChunk ?? Number.POSITIVE_INFINITY));
        this.#maxBytesPerChunk = settings.maxChunkBytes > 0 ? settings.maxChunkBytes : Number.POSITIVE_INFINITY;
        this.#maxChunksInFlight = Math.max(1, settings.options.maxChunksInFlight ?? defaultMaxChunksInFlight);
        this.#maxChunkAttempts = Math.max(1, settings.options.maxChunkAttempts ?? defaultMaxChunkAttempts);
        this.#retryDelay = settings.retryDelay ?? (attempt => Math.min(5000, 200 * attempt * attempt));
    }

    /** @inheritdoc */
    async *progress(signal?: AbortSignal): AsyncIterable<ImportProgress> {
        try {
            for await (const result of this.#settings.imports.observeImport(this.#identity(), { signal })) {
                if (result.Data) yield toImportProgress(result.Data);
            }
        } catch (error) {
            if (signal?.aborted) return;
            throw error;
        }
    }

    /** @inheritdoc */
    add(events: AsyncIterable<EventForEventSourceId> | Iterable<EventForEventSourceId>, signal?: AbortSignal): Promise<void> {
        return this.#whileNotAbandoned(async waiting => {
            for await (const event of readUntilAborted(events, waiting)) {
                await this.#bufferEvent(event, waiting);
            }
        }, signal);
    }

    /** @inheritdoc */
    async complete(signal?: AbortSignal): Promise<ImportResult> {
        let result: ImportResult | undefined;
        await this.#whileNotAbandoned(async waiting => {
            await this.#flush(waiting);
            await untilAborted(Promise.all([...this.#sends]), waiting);
            this.#throwIfFailed();
            this.#throwIfAbandoned();

            const status = ensureCommandResponse('complete import', await this.#settings.imports.completeImport({
                ...this.#identity(),
                ExpectedChunks: this.#nextChunkIndex,
                ExpectedEvents: BigInt(this.#nextEventIndex)
            }, { signal: waiting }));

            result = !status.Error && (this.#settings.options.waitForCommit ?? true)
                ? await this.#waitForCommit(waiting)
                : await this.#read(waiting) ?? this.#resultFrom(status.State as number as ImportState, status.Error);
        }, signal);
        return result!;
    }

    /** @inheritdoc */
    async abandon(signal?: AbortSignal): Promise<ImportResult> {
        // No chunk is sent once this is set, and an add in progress is stopped rather than waited for: it may be reading
        // a source that never yields again.
        this.#abandoned = true;
        this.#abandoning.abort(new ImportWasAbandoned(this.importId));

        // Chunks already handed to the kernel settle first, so none is staged after the import is abandoned.
        await untilAborted(Promise.all([...this.#sends]), signal);
        const status = ensureCommandResponse('abandon import',
            await this.#settings.imports.abandonImport(this.#identity(), { signal }));
        return await this.#read(signal) ?? this.#resultFrom(status.State as number as ImportState, status.Error);
    }

    #identity() {
        return { EventStore: this.#settings.eventStore, Namespace: this.#settings.namespace, ImportId: toContractsGuid(this.importId) };
    }

    async #whileNotAbandoned(work: (waiting: AbortSignal) => Promise<void>, signal?: AbortSignal): Promise<void> {
        this.#throwIfAbandoned();
        const waiting = signal ? AbortSignal.any([signal, this.#abandoning.signal]) : this.#abandoning.signal;
        // Adds and completion run one at a time, so chunks are cut from the events in the order they were added.
        const run = this.#exclusive.then(() => {
            waiting.throwIfAborted();
            return work(waiting);
        });
        this.#exclusive = run.catch(() => undefined);
        try {
            await run;
        } catch (error) {
            if (this.#abandoning.signal.aborted && !signal?.aborted) throw new ImportWasAbandoned(this.importId);
            throw error;
        }
    }

    async #bufferEvent(event: EventForEventSourceId, waiting: AbortSignal): Promise<void> {
        this.#throwIfFailed();
        this.#throwIfAbandoned();
        const converted = this.#settings.convert(event);
        const bytes = sizeOfImportEvent(converted);
        if (this.#buffer.length > 0 &&
            (this.#buffer.length >= this.#maxEventsPerChunk || this.#bufferBytes + bytes > this.#maxBytesPerChunk)) {
            await this.#flush(waiting);
        }
        this.#buffer.push(converted);
        this.#bufferBytes += bytes;
    }

    async #flush(waiting: AbortSignal): Promise<void> {
        if (this.#buffer.length === 0) return;
        await this.#acquireSlot(waiting);
        // Checked after the wait, so an abandon sees every chunk sent before it and none is sent after it.
        if (this.#abandoned) {
            this.#releaseSlot();
            throw new ImportWasAbandoned(this.importId);
        }

        const events = this.#buffer;
        const chunkIndex = this.#nextChunkIndex++;
        const firstEventIndex = this.#nextEventIndex;
        this.#nextEventIndex += events.length;
        this.#buffer = [];
        this.#bufferBytes = 0;

        const send: Promise<void> = this.#send(chunkIndex, firstEventIndex, events).finally(() => this.#sends.delete(send));
        this.#sends.add(send);
    }

    async #send(chunkIndex: number, firstEventIndex: number, events: ImportEvent[]): Promise<void> {
        try {
            for (let attempt = 1; ; attempt++) {
                try {
                    const result = ensureCommandResponse('add import chunk', await this.#settings.imports.addImportChunk({
                        ...this.#identity(),
                        ChunkIndex: chunkIndex,
                        FirstEventIndex: BigInt(firstEventIndex),
                        Events: events
                    }));
                    if (result.Error) throw new ImportChunkRefused(chunkIndex, result.Error);
                    return;
                } catch (error) {
                    if (!isTransientImportFailure(error) || attempt >= this.#maxChunkAttempts) throw error;
                    // Sending the chunk again is safe: the kernel stages a chunk under its index once.
                    await delay(this.#retryDelay(attempt), this.#abandoning.signal);
                }
            }
        } catch (error) {
            this.#failure ??= { error };
        } finally {
            this.#releaseSlot();
        }
    }

    #acquireSlot(waiting: AbortSignal): Promise<void> {
        if (this.#chunksInFlight < this.#maxChunksInFlight) {
            this.#chunksInFlight++;
            return Promise.resolve();
        }
        return new Promise<void>((resolve, reject) => {
            const granted = () => {
                waiting.removeEventListener('abort', aborted);
                resolve();
            };
            const aborted = () => {
                const index = this.#slotWaiters.indexOf(granted);
                if (index >= 0) this.#slotWaiters.splice(index, 1);
                reject(waiting.reason);
            };
            if (waiting.aborted) return reject(waiting.reason);
            waiting.addEventListener('abort', aborted, { once: true });
            this.#slotWaiters.push(granted);
        });
    }

    #releaseSlot(): void {
        // A waiting chunk takes over the slot, so the number in flight never exceeds the bound.
        const next = this.#slotWaiters.shift();
        if (next) next();
        else this.#chunksInFlight--;
    }

    #throwIfAbandoned(): void {
        if (this.#abandoned) throw new ImportWasAbandoned(this.importId);
    }

    #throwIfFailed(): void {
        if (this.#failure) throw this.#failure.error;
    }

    async #waitForCommit(waiting: AbortSignal): Promise<ImportResult> {
        const pollInterval = this.#settings.pollInterval ?? defaultPollInterval;
        while (true) {
            const result = await this.#read(waiting);
            if (result && terminalStates.has(result.state)) return result;
            await delay(pollInterval, waiting);
        }
    }

    async #read(signal?: AbortSignal): Promise<ImportResult | undefined> {
        const progress = ensureQuerySuccess('get import', await this.#settings.imports.getImport(this.#identity(), { signal }));
        return progress ? toImportResult(progress) : undefined;
    }

    #resultFrom(state: ImportState, reason: string): ImportResult {
        return {
            importId: this.importId, state, eventsStaged: 0, eventsCommitted: 0, alreadyAppended: 0,
            rejectedCount: 0, rejections: [], failureReason: reason ? reason : undefined, isSuccess: state === ImportState.Completed
        };
    }
}
