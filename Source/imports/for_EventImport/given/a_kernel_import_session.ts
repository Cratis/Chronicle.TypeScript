// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';
import {
    ImportState as ContractsImportState,
    type AddImportChunkRequest,
    type ImportEvent,
    type ImportProgressResponse,
    type ImportsClient
} from '@cratis/chronicle.contracts';
import { toContractsGuid } from '../../../connection/Guid.js';
import type { EventForEventSourceId } from '../../../eventSequences/EventForEventSourceId.js';
import { EventImport } from '../../EventImport.js';
import type { EventImportSettings } from '../../EventImportSettings.js';

/** A chunk the fake kernel received. */
export interface ReceivedChunk {
    readonly chunkIndex: number;
    readonly firstEventIndex: bigint;
    readonly contents: readonly string[];
}

/** A fake of the kernel's Imports service that records the calls an import session makes. */
export class a_kernel_import_session {
    readonly importId = Guid.create();
    readonly chunks: ReceivedChunk[] = [];
    readonly completions: { ExpectedChunks: number; ExpectedEvents: bigint }[] = [];
    readonly abandons: number[] = [];
    inFlight = 0;
    maxInFlight = 0;
    /** Answers each chunk; replace it to fail, refuse or hold chunks. */
    answerChunk: (request: AddImportChunkRequest) => Promise<{ Error: string }> = async () => ({ Error: '' });
    /** The progress the kernel reports on each read, the last one repeating. */
    reads: Partial<ImportProgressResponse>[] = [{ State: ContractsImportState.Completed }];
    readCount = 0;
    /** The progress the kernel streams to an observer. */
    observed: Partial<ImportProgressResponse>[] = [];

    /** The chunk limits the kernel gives when an import begins. */
    limits = { MaxChunkEvents: 0, MaxChunkBytes: 0 };

    readonly imports = {
        beginImport: async () => this.commandResult({ ImportId: toContractsGuid(this.importId), State: ContractsImportState.Open,
            ...this.limits, Error: '' }),
        addImportChunk: async (request: AddImportChunkRequest) => {
            this.inFlight++;
            this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
            try {
                const answer = await this.answerChunk(request);
                if (!answer.Error) {
                    this.chunks.push({
                        chunkIndex: request.ChunkIndex,
                        firstEventIndex: request.FirstEventIndex,
                        contents: request.Events.map(event => event.Content)
                    });
                }
                return this.commandResult({ ChunkIndex: request.ChunkIndex, AlreadyStaged: false, EventsReceived: request.Events.length,
                    EventsStaged: request.Events.length, Rejections: [], Error: answer.Error });
            } finally {
                this.inFlight--;
            }
        },
        completeImport: async (request: { ExpectedChunks: number; ExpectedEvents: bigint }) => {
            this.completions.push({ ExpectedChunks: request.ExpectedChunks, ExpectedEvents: request.ExpectedEvents });
            return this.commandResult({ ImportId: toContractsGuid(this.importId), State: ContractsImportState.Validating, Error: '' });
        },
        abandonImport: async () => {
            this.abandons.push(this.chunks.length);
            this.reads = [{ State: ContractsImportState.Abandoned }];
            return this.commandResult({ ImportId: toContractsGuid(this.importId), State: ContractsImportState.Abandoned, Error: '' });
        },
        getImport: async () => {
            const read = this.reads[Math.min(this.readCount++, this.reads.length - 1)];
            return { IsAuthorized: true, ValidationResults: [], ExceptionMessages: [], ExceptionStackTrace: '', CorrelationId: undefined,
                Data: this.progress(read) };
        },
        observeImport: () => this.observe()
    };

    get client(): ImportsClient {
        return this.imports as unknown as ImportsClient;
    }

    /** Creates a session against this fake, converting each event to a wire event carrying its JSON. */
    session(settings: Partial<EventImportSettings> = {}): EventImport {
        return new EventImport({
            imports: this.client,
            eventStore: 'store',
            namespace: 'default',
            importId: this.importId,
            options: {},
            maxChunkEvents: 0,
            maxChunkBytes: 0,
            convert: wireEventFor,
            retryDelay: () => 0,
            pollInterval: 0,
            ...settings
        });
    }

    /** The contents of every received chunk, in chunk order. */
    get receivedContents(): string[] {
        return [...this.chunks].sort((left, right) => left.chunkIndex - right.chunkIndex).flatMap(chunk => [...chunk.contents]);
    }

    async *observe() {
        for (const progress of this.observed) {
            yield { IsAuthorized: true, ValidationResults: [], ExceptionMessages: [], ExceptionStackTrace: '', CorrelationId: undefined,
                Data: this.progress(progress) };
        }
    }

    progress(values: Partial<ImportProgressResponse>): ImportProgressResponse {
        return {
            ImportId: toContractsGuid(this.importId), EventSequenceId: 'event-log', State: ContractsImportState.Staging, OnInvalid: 0,
            Created: undefined, LastActivity: undefined, StagedChunks: [], EventsReceived: 0n, EventsStaged: 0n, EventsCommitted: 0n,
            AlreadyAppended: 0n, RejectedCount: 0n, Rejections: [], CommittedRanges: [], FirstSequenceNumber: 0n, LastSequenceNumber: 0n,
            FailureReason: '', MaxChunkEvents: 0, MaxChunkBytes: 0, AcknowledgedChunks: 0, AcknowledgedEvents: 0n,
            ...values
        };
    }

    private commandResult<T>(response: T) {
        return { IsAuthorized: true, ValidationResults: [], ExceptionMessages: [], ExceptionStackTrace: '', AuthorizationFailureReason: '',
            CorrelationId: undefined, Response: response };
    }
}

/** An event for the fake, identified by its number. */
export function numbered(number: number): EventForEventSourceId {
    return { eventSourceId: 'source', event: { number } };
}

/** The numbered events from zero up to a count. */
export function numberedEvents(count: number): EventForEventSourceId[] {
    return Array.from({ length: count }, (_, index) => numbered(index));
}

/** The wire contents numbered events produce. */
export function contentsOf(count: number): string[] {
    return numberedEvents(count).map(event => JSON.stringify(event.event));
}

/** A wire event carrying the event's JSON as its content. */
export function wireEventFor(event: EventForEventSourceId): ImportEvent {
    return {
        EventSourceId: event.eventSourceId, EventSourceType: '', EventStreamType: '', EventStreamId: '',
        EventType: { Id: 'numbered', Generation: 1, Tombstone: false }, Content: JSON.stringify(event.event), Tags: [], NamedTags: [],
        Occurred: undefined, Subject: '', CorrelationId: undefined, Causation: [], CausedBy: undefined, IdempotencyKey: '', EventSource: '',
        SourceSequenceNumber: 0n
    };
}

/** A promise with its resolver, for holding a fake call until a spec lets it go. */
export function gate(): { promise: Promise<void>; open: () => void } {
    let open!: () => void;
    const promise = new Promise<void>(resolve => { open = resolve; });
    return { promise, open };
}
