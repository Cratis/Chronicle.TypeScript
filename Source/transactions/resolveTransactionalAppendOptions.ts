// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { TransactionalAppendOptions } from './TransactionalAppendOptions.js';
import { AppendOptionNotSupportedInUnitOfWork } from './AppendOptionNotSupportedInUnitOfWork.js';
import { ConflictingAppendOptionNamesInUnitOfWork } from './ConflictingAppendOptionNamesInUnitOfWork.js';

const unsupportedOptions = [
    ['correlationId', 'The unit of work appends with its own correlation identifier; begin the unit of work with it instead: unitOfWorkManager.begin(correlationId).'],
    ['concurrencyScopes', 'Give each event its own concurrencyScope; the unit of work combines them per event source identifier.'],
    ['eventSourceId', 'The event source identifier is the append argument.']
] as const;

const aliases = [
    ['streamType', 'eventStreamType'],
    ['streamId', 'eventStreamId'],
    ['sourceType', 'eventSourceType']
] as const;

type OptionValues = Record<string, unknown>;

function throwIfUnsupported(values: Readonly<OptionValues>): void {
    const unsupported = unsupportedOptions.find(([optionName]) => values[optionName] !== undefined);
    if (unsupported) {
        throw new AppendOptionNotSupportedInUnitOfWork(unsupported[0], unsupported[1]);
    }
}

function isConflicting(values: Readonly<OptionValues>, appendOptionName: string, transactionalOptionName: string): boolean {
    const appendValue = values[appendOptionName];
    const transactionalValue = values[transactionalOptionName];
    return appendValue !== undefined && transactionalValue !== undefined && appendValue !== transactionalValue;
}

function throwIfConflicting(values: Readonly<OptionValues>): void {
    const conflict = aliases.find(([appendOptionName, transactionalOptionName]) => isConflicting(values, appendOptionName, transactionalOptionName));
    if (conflict) {
        throw new ConflictingAppendOptionNamesInUnitOfWork(conflict[0], conflict[1]);
    }
}

function normalizeAliases(values: Readonly<OptionValues>): OptionValues {
    const normalized: OptionValues = { ...values };
    for (const [appendOptionName, transactionalOptionName] of aliases) {
        const value = values[transactionalOptionName] ?? values[appendOptionName];
        delete normalized[appendOptionName];
        delete normalized[transactionalOptionName];
        if (value !== undefined) {
            normalized[transactionalOptionName] = value;
        }
    }
    return normalized;
}

/**
 * Validates transactional append options and normalizes ordinary append option aliases.
 * @param options - Optional metadata for an event added to a unit of work.
 * @returns The options with aliases replaced by their transactional names.
 */
export function resolveTransactionalAppendOptions(options?: TransactionalAppendOptions): TransactionalAppendOptions | undefined {
    if (options === undefined) {
        return undefined;
    }
    const values = options as Readonly<OptionValues>;
    throwIfUnsupported(values);
    throwIfConflicting(values);
    return normalizeAliases(values) as TransactionalAppendOptions;
}
