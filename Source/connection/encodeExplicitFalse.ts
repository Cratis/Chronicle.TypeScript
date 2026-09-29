// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ReactorDefinition, WebhookDefinition } from '@cratis/chronicle.contracts';

// STOPGAP - remove once Cratis/Chronicle#4394 is fixed (tracked here as Cratis/Chronicle.TypeScript#161).
//
// The generated ts-proto contracts never write a boolean `false` (proto3 default omission), while the
// kernel's protobuf-net contracts default these flags to `true` when the field is absent. Without an
// explicit `false` on the wire, a class-level @onceOnly() reactor is still replayed and a webhook built
// with notReplayable() / notActive() keeps the defaults.
//
// This only affects the copy of @cratis/chronicle.contracts this package imports (the ESM build, since
// this package is ESM only). Another copy loaded elsewhere, for example through `require`, is not patched.

const wrapped = Symbol.for('@cratis/chronicle:explicit-false-encoding');

type Wrapped = { [wrapped]?: true };

// The contracts package bundles its own copy of @bufbuild/protobuf, so the writer type is taken from the definition.
function writeExplicitFalse<T, D extends { encode: (message: T, writer?: any) => any }>(
    definition: D,
    fields: readonly { property: keyof T & string; tag: number }[]
): void {
    const original = definition.encode as D['encode'] & Wrapped;
    if (original[wrapped]) {
        return;
    }

    const encode = ((message: T, writer?: Parameters<D['encode']>[1]) => {
        const result = original.call(definition, message, writer);
        for (const { property, tag } of fields) {
            if (message[property] === false) {
                result.uint32(tag).bool(false);
            }
        }
        return result;
    }) as D['encode'] & Wrapped;
    encode[wrapped] = true;
    definition.encode = encode;
}

/**
 * Makes the generated contracts write an explicit `false` for the replayable and active flags.
 * Safe to call more than once.
 */
export function applyExplicitFalseEncoding(): void {
    // Tag is (field number << 3) | wire type 0 (varint).
    writeExplicitFalse<ReactorDefinition, typeof ReactorDefinition>(ReactorDefinition, [{ property: 'IsReplayable', tag: (4 << 3) | 0 }]);
    writeExplicitFalse<WebhookDefinition, typeof WebhookDefinition>(WebhookDefinition, [
        { property: 'IsReplayable', tag: (5 << 3) | 0 },
        { property: 'IsActive', tag: (6 << 3) | 0 }
    ]);
}

applyExplicitFalseEncoding();
