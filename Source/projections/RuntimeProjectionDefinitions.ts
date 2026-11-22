// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { CompiledProjectionDefinitions } from './CompiledProjectionDefinitions.js';

/** Keeps acknowledged runtime definitions independent of artifact discovery. */
export class RuntimeProjectionDefinitions {
    private readonly _registered = new Map<string, { readModelType: Constructor; compiled: CompiledProjectionDefinitions }>();
    private readonly _pending = new Map<string, Constructor>();

    /** Gets the retained contracts to send again after reconnecting. */
    get registrations(): CompiledProjectionDefinitions[] {
        return Array.from(this._registered.values(), entry => entry.compiled);
    }

    /** Gets read models with retained or in-flight runtime registrations. */
    get readModelTypes(): Constructor[] {
        return [...Array.from(this._registered.values(), entry => entry.readModelType), ...this._pending.values()];
    }

    /** Checks acknowledged definitions by identifier. */
    has(identifier: string): boolean {
        return this._registered.has(identifier);
    }

    /** Refuses discovery or registration that would overwrite a runtime definition. */
    assertAvailable(identifier: string): void {
        if (this._registered.has(identifier) || this._pending.has(identifier)) {
            throw new Error(`Projection id '${identifier}' is already registered at runtime.`);
        }
    }

    /** Finds the acknowledged projection maintaining a read model. */
    findForModel(readModelType: Constructor): string | undefined {
        return Array.from(this._registered).find(([, entry]) => entry.readModelType === readModelType)?.[0];
    }

    /** Gets the event sequence used by an acknowledged runtime projection. */
    eventSequenceIdFor(identifier: string): string | undefined {
        return this._registered.get(identifier)?.compiled.definitions[0].EventSequenceId;
    }

    /** Reserves the identity until the kernel acknowledges it, retaining nothing on failure. */
    async register(readModelType: Constructor, compiled: CompiledProjectionDefinitions,
        send: (compiled: CompiledProjectionDefinitions) => Promise<void>): Promise<void> {
        const identifier = compiled.definitions[0].Identifier;
        this.assertAvailable(identifier);
        if (this.readModelTypes.includes(readModelType)) {
            throw new Error(`Read model '${readModelType.name}' already has a runtime projection.`);
        }
        this._pending.set(identifier, readModelType);
        try {
            await send(compiled);
            this._registered.set(identifier, { readModelType, compiled });
        } finally {
            this._pending.delete(identifier);
        }
    }
}
