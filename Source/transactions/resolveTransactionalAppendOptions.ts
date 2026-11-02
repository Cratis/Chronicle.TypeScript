// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { TransactionalAppendOptions } from './TransactionalAppendOptions.js';
import { AppendOptionNotSupportedInUnitOfWork } from './AppendOptionNotSupportedInUnitOfWork.js';
import { ConflictingAppendOptionNamesInUnitOfWork } from './ConflictingAppendOptionNamesInUnitOfWork.js';

/**
 * Validates transactional append options and normalizes ordinary append option aliases.
 * @param options - Optional metadata for an event added to a unit of work.
 * @returns The options with aliases replaced by their transactional names.
 */
export function resolveTransactionalAppendOptions(options?: TransactionalAppendOptions): TransactionalAppendOptions | undefined {
    if (options === undefined) {
        return undefined;
    }
    const values = options as Readonly<Record<string, unknown>>;
    const unsupportedOptions = [
        ['correlationId', 'The unit of work appends with its own correlation identifier; begin the unit of work with it instead: unitOfWorkManager.begin(correlationId).'],
        ['concurrencyScopes', 'Give each event its own concurrencyScope; the unit of work combines them per event source identifier.'],
        ['eventSourceId', 'The event source identifier is the append argument.']
    ] as const;
    for (const [optionName, guidance] of unsupportedOptions) {
        if (optionName in options && values[optionName] !== undefined) {
            throw new AppendOptionNotSupportedInUnitOfWork(optionName, guidance);
        }
    }
    const aliases = [
        ['streamType', 'eventStreamType'],
        ['streamId', 'eventStreamId'],
        ['sourceType', 'eventSourceType']
    ] as const;
    for (const [appendOptionName, transactionalOptionName] of aliases) {
        if (options[appendOptionName] !== undefined && options[transactionalOptionName] !== undefined &&
            options[appendOptionName] !== options[transactionalOptionName]) {
            throw new ConflictingAppendOptionNamesInUnitOfWork(appendOptionName, transactionalOptionName);
        }
    }
    const { streamType, streamId, sourceType, ...rest } = options;
    const eventStreamType = rest.eventStreamType ?? streamType;
    const eventStreamId = rest.eventStreamId ?? streamId;
    const eventSourceType = rest.eventSourceType ?? sourceType;
    return {
        ...rest,
        ...(eventStreamType !== undefined ? { eventStreamType } : {}),
        ...(eventStreamId !== undefined ? { eventStreamId } : {}),
        ...(eventSourceType !== undefined ? { eventSourceType } : {})
    };
}
