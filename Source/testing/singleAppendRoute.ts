// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { AppendOptions } from '../eventSequences/AppendOptions.js';
import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';

/**
 * Whether a named-tag option asks for anything. An explicitly empty array carries no tags, exactly like an
 * omitted option; anything else is reported, including malformed values the production client would reject.
 */
export function hasNamedTags(namedTags: unknown): boolean {
    return namedTags !== undefined && !(Array.isArray(namedTags) && namedTags.length === 0);
}

/** The fixture-proven single-append route boundary, shared with read-model setup. */
export function singleAppendRoute(options: AppendOptions | undefined, artifact: string,
    unsupported = (operation: string, artifact: string, reason: string) => new UnsupportedEventSequenceOperation(operation, artifact, reason),
    allowSubject = false
): { sourceType: string; streamType: string; streamId: string } {
    if (options !== undefined && (!options || typeof options !== 'object' || Array.isArray(options))) {
        throw unsupported('append.options', artifact, 'Append options must be an object.');
    }
    if (options && hasNamedTags(options.namedTags)) {
        throw unsupported('append.namedTags', artifact, 'Named tags are not fixture-backed.');
    }
    const allowed = ['sourceType', 'streamType', 'streamId', ...(allowSubject ? ['subject'] : [])];
    // An explicitly empty namedTags array is accepted (checked above) but not advertised as a supported option.
    if (options && (Reflect.ownKeys(options).some(key => key !== 'namedTags' && !allowed.includes(String(key))) ||
        options.correlationId !== undefined || (!allowSubject && options.subject !== undefined) || options.occurred !== undefined ||
        options.eventSourceId !== undefined || options.concurrencyScope !== undefined || options.tags !== undefined ||
        options.concurrencyScopes !== undefined)) {
        throw unsupported('append.options', artifact, `Only ${allowed.join(', ')} options are supported for single append.`);
    }
    if (options?.subject !== undefined && options.subject !== null && typeof options.subject !== 'string') {
        throw unsupported('append.subject', artifact, 'Subject must be a string.');
    }
    const route = { sourceType: options?.sourceType, streamType: options?.streamType, streamId: options?.streamId };
    for (const [name, value] of Object.entries(route)) {
        if (value !== undefined && (typeof value !== 'string' || !/^[A-Za-z0-9_-]*$/.test(value))) {
            throw unsupported(`append.${name}`, String(value), 'Only simple routing identifiers or empty defaults are fixture-backed.');
        }
    }
    // ts-proto omits empty strings; the append pipeline resolves omissions to these exact values.
    return { sourceType: route.sourceType || 'Default', streamType: route.streamType || 'All', streamId: route.streamId || 'Default' };
}
