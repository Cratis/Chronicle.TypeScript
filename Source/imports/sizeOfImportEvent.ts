// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ImportEvent } from '@cratis/chronicle.contracts';

/**
 * Measures an event as the kernel counts it against its chunk byte limit: the content, tags, named tags, causation
 * and idempotency key, as UTF-8.
 * @param event - The {@link ImportEvent} in its wire form.
 * @returns The bytes it carries.
 */
export function sizeOfImportEvent(event: ImportEvent): number {
    let bytes = utf8(event.Content) + utf8(event.IdempotencyKey);
    for (const tag of event.Tags) bytes += utf8(tag);
    for (const tag of event.NamedTags) bytes += utf8(tag.Name) + utf8(tag.Value);
    for (const causation of event.Causation) {
        bytes += utf8(causation.Type);
        for (const [name, value] of Object.entries(causation.Properties)) bytes += utf8(name) + utf8(value);
    }
    return bytes;
}

function utf8(value: string | undefined): number {
    return value ? Buffer.byteLength(value, 'utf8') : 0;
}
