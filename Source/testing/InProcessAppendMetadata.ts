// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';
import { toContractsGuid } from '../connection/Guid.js';
import { Identity } from '../identity/Identity.js';
import type { prepareSingleAppend } from '../eventSequences/prepareSingleAppend.js';
import type { AppendOptions } from '../eventSequences/AppendOptions.js';
import type { EventForEventSourceId } from '../eventSequences/EventForEventSourceId.js';
import { hasNamedTags } from './singleAppendRoute.js';
import type { InProcessEventSequenceEnvironment } from './InProcessEventSequenceEnvironment.js';

/** Prepares only the metadata domain proven by the in-process append fixtures. */
export class InProcessAppendMetadata {
    constructor(private readonly environment: InProcessEventSequenceEnvironment) {}

    batch(options?: AppendOptions): void {
        if (options === undefined) return;
        if (!this.optionsObject(options)) {
            throw this.environment.unsupported('appendMany.options', this.environment.sequenceId, 'Append options must be an object.');
        }
        if (hasNamedTags(options.namedTags)) throw this.environment.unsupported('appendMany.namedTags', this.environment.sequenceId, 'Named tags are not fixture-backed.');
        this.batchKeys(options);
        this.subject(options);
        this.tags(options);
    }

    entry(entry: EventForEventSourceId): void {
        if (!this.entryObject(entry) || this.unknown(entry,
            ['eventSourceId', 'event', 'eventSourceType', 'eventStreamType', 'eventStreamId', 'subject', 'occurred', 'tags', 'namedTags'])) {
            throw this.environment.unsupported('appendMany.entry', this.environment.sequenceId, 'Unrecognized per-entry metadata.');
        }
        if (hasNamedTags(entry.namedTags)) throw this.environment.unsupported('appendMany.namedTags', this.environment.sequenceId, 'Named tags are not fixture-backed.');
        if (entry.occurred !== undefined) this.checkedDate(entry.occurred, 'appendMany.occurred');
        this.subject(entry);
        this.tags(entry);
    }

    guid(value: string | Guid, operation: string): void {
        try {
            toContractsGuid(Guid.as(value));
            if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value.toString())) throw new Error('Invalid GUID.');
        } catch { throw this.environment.unsupported(operation, this.environment.sequenceId, 'Correlation ID must be a valid GUID.'); }
    }

    checkedDate(value: Date, operation: string): Date {
        if (!(value instanceof Date) || !this.validTime(value)) {
            throw this.environment.unsupported(operation, this.environment.sequenceId, 'Occurrence must be within UTC years 1–9999 at millisecond precision.');
        }
        return new Date(value);
    }

    source(source: string, operation: string): void {
        if (typeof source !== 'string' || !/^[A-Za-z0-9_-]+$/.test(source)) {
            throw this.environment.unsupported(operation, String(source), 'Only simple source identifiers are fixture-backed.');
        }
    }

    private subject(metadata: Pick<AppendOptions, 'subject'>): void {
        if (!this.validSubject(metadata)) {
            throw this.environment.unsupported('appendMany.subject', this.environment.sequenceId, 'Subject must be a string.');
        }
    }

    private validSubject(metadata: Pick<AppendOptions, 'subject'>): boolean {
        return metadata.subject === undefined || metadata.subject === null || typeof metadata.subject === 'string';
    }

    private tags(metadata: Pick<AppendOptions, 'tags'>): void {
        if (metadata.tags && !this.stringTags(metadata)) {
            throw this.environment.unsupported('appendMany.tags', this.environment.sequenceId, 'Only plain string tags are fixture-backed.');
        }
    }

    unsupportedOptions(options?: AppendOptions): boolean {
        if (options?.concurrencyScope !== undefined || options?.concurrencyScopes !== undefined) return true;
        return options?.eventSourceId !== undefined;
    }

    storedSubject(subject: string | undefined, eventSourceId: string): string {
        // Match the kernel's string.IsNullOrWhiteSpace, including U+0085 but not U+FEFF.
        return subject && !/^\p{White_Space}*$/u.test(subject) ? subject : eventSourceId;
    }

    private batchKeys(options: AppendOptions): void {
        const allowed = ['correlationId', 'sourceType', 'streamType', 'streamId', 'subject', 'occurred', 'tags', 'namedTags'];
        if (this.unknown(options, allowed) || this.unsupportedOptions(options)) {
            throw this.environment.unsupported('appendMany.options', this.environment.sequenceId, 'Concurrency and unrecognized metadata are not fixture-backed.');
        }
    }

    private unknown(value: object, allowed: string[]): boolean {
        return Reflect.ownKeys(value).some(key => !allowed.includes(String(key)));
    }

    private validTime(value: Date): boolean {
        return !Number.isNaN(value.getTime()) && value.getUTCFullYear() >= 1 && value.getUTCFullYear() <= 9999;
    }

    private stringTags(metadata: Pick<AppendOptions, 'tags'>): boolean {
        return Array.isArray(metadata.tags) && !metadata.tags.some(tag => typeof tag !== 'string');
    }

    private entryObject(value: unknown): boolean {
        return !!value && typeof value === 'object';
    }

    private optionsObject(value: unknown): boolean {
        return this.entryObject(value) && !Array.isArray(value);
    }

    ambientContext(identity: Identity, chain: ReturnType<typeof prepareSingleAppend>['causationChain']): boolean {
        return identity === Identity.system && this.emptyRoot(chain);
    }

    private emptyRoot(chain: ReturnType<typeof prepareSingleAppend>['causationChain']): boolean {
        return chain.length === 2 && Object.keys(chain[0].properties).length === 0;
    }
}
