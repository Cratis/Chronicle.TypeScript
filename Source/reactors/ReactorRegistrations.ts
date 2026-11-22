// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { getReactorMetadata } from './reactor.js';
import type { ReactorRegistration } from './ReactorRegistration.js';
import { ReactorRegistrationKind } from './ReactorRegistrationKind.js';

/** Coordinates discovery and runtime identities before any observation is opened. */
export class ReactorRegistrations {
    private readonly _entries = new Map<string, ReactorRegistration>();
    private readonly _removed = new Set<string>();

    get all(): readonly ReactorRegistration[] { return [...this._entries.values()]; }

    /** Validates the entire discovery batch before committing it. */
    discover(types: readonly Constructor[]): void {
        const discovered = new Map<string, ReactorRegistration>();
        for (const type of types) {
            const id = getReactorMetadata(type)?.id.value;
            if (id === undefined || this._removed.has(id)) continue;
            if (discovered.has(id)) this.duplicate(id);
            const existing = this._entries.get(id);
            if (existing && !(existing.kind === ReactorRegistrationKind.Discovered && existing.type === type)) this.duplicate(id);
            discovered.set(id, existing ?? { id, kind: ReactorRegistrationKind.Discovered, type });
        }
        for (const [id, entry] of discovered) this._entries.set(id, entry);
    }

    /** Reserves synchronously: local-start registration has no asynchronous acknowledgment window. */
    add(entry: ReactorRegistration): void {
        if (this._entries.has(entry.id)) this.duplicate(entry.id);
        this._entries.set(entry.id, entry);
    }

    /** Removes restoration eligibility and suppresses automatic rediscovery. */
    remove(id: string): void {
        if (this._entries.get(id)?.kind === ReactorRegistrationKind.Discovered) this._removed.add(id);
        this._entries.delete(id);
    }

    isCurrent(entry: ReactorRegistration): boolean { return this._entries.get(entry.id) === entry; }

    private duplicate(id: string): never { throw new Error(`Reactor id '${id}' is already registered.`); }
}
