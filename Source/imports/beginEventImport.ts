// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';
import { OnInvalidEvent as ContractsOnInvalidEvent } from '@cratis/chronicle.contracts';
import { ClientError, Status } from 'nice-grpc-common';
import { fromContractsGuid, toContractsGuid } from '../connection/Guid.js';
import { ensureCommandResponse, ensureQuerySuccess } from '../connection/callResults.js';
import { EventImport } from './EventImport.js';
import type { IEventImport } from './IEventImport.js';
import { ImportCouldNotBegin } from './ImportCouldNotBegin.js';
import type { ImportOptions } from './ImportOptions.js';
import { ImportsNotSupported } from './ImportsNotSupported.js';
import type { ImportTarget } from './ImportTarget.js';
import { OnInvalidEvent } from './OnInvalidEvent.js';
import { toImportEvent } from './toImportEvent.js';

/**
 * Begins a new import session, or reattaches to an existing one by its identifier.
 * @param target - The {@link ImportTarget}.
 * @param importIdOrOptions - The identifier of an import to reattach to, or the options for a new one.
 * @param options - The options, when reattaching.
 * @returns The {@link IEventImport}.
 * @throws {@link ImportsNotSupported} when the kernel does not serve imports.
 * @throws {@link ImportCouldNotBegin} when the kernel refuses the import, or the import to reattach to does not exist
 * or targets another event sequence.
 */
export async function beginEventImport(
    target: ImportTarget,
    importIdOrOptions?: string | Guid | ImportOptions,
    options?: ImportOptions
): Promise<IEventImport> {
    const reattachTo = typeof importIdOrOptions === 'string' || importIdOrOptions instanceof Guid ? Guid.as(importIdOrOptions) : undefined;
    const selected = (reattachTo ? options : importIdOrOptions as ImportOptions | undefined) ?? {};
    selected.signal?.throwIfAborted();
    try {
        return reattachTo ? await reattach(target, reattachTo, selected) : await begin(target, selected);
    } catch (error) {
        if (error instanceof ClientError && error.code === Status.UNIMPLEMENTED) throw new ImportsNotSupported();
        throw error;
    }
}

async function begin(target: ImportTarget, options: ImportOptions): Promise<IEventImport> {
    const response = ensureCommandResponse('begin import', await target.imports.beginImport({
        EventStore: target.eventStore,
        Namespace: target.namespace,
        EventSequenceId: target.eventSequenceId,
        OnInvalid: (options.onInvalid ?? OnInvalidEvent.Reject) as number as ContractsOnInvalidEvent,
        ImportId: options.importId === undefined ? undefined : toContractsGuid(Guid.as(options.importId))
    }, { signal: options.signal }));
    if (response.Error) throw new ImportCouldNotBegin(response.Error);
    return create(target, options, fromContractsGuid(response.ImportId), response.MaxChunkEvents, response.MaxChunkBytes, 0, 0);
}

async function reattach(target: ImportTarget, importId: Guid, options: ImportOptions): Promise<IEventImport> {
    const progress = ensureQuerySuccess('get import', await target.imports.getImport({
        EventStore: target.eventStore,
        Namespace: target.namespace,
        ImportId: toContractsGuid(importId)
    }, { signal: options.signal }));
    if (!progress) throw new ImportCouldNotBegin(`Import '${importId.toString()}' does not exist.`);
    if (progress.EventSequenceId !== target.eventSequenceId) {
        throw new ImportCouldNotBegin(
            `Import '${importId.toString()}' imports into event sequence '${progress.EventSequenceId}', not '${target.eventSequenceId}'.`);
    }
    return create(target, { ...options, onInvalid: progress.OnInvalid as number as OnInvalidEvent, importId },
        importId, progress.MaxChunkEvents, progress.MaxChunkBytes, progress.AcknowledgedChunks, Number(progress.AcknowledgedEvents));
}

function create(target: ImportTarget, options: ImportOptions, importId: Guid, maxChunkEvents: number, maxChunkBytes: number,
    acknowledgedChunks: number, acknowledgedEvents: number): IEventImport {
    return new EventImport({
        imports: target.imports,
        eventStore: target.eventStore,
        namespace: target.namespace,
        importId,
        options,
        maxChunkEvents,
        maxChunkBytes,
        convert: event => toImportEvent(event, target.eventSources),
        acknowledgedChunks,
        acknowledgedEvents
    });
}
