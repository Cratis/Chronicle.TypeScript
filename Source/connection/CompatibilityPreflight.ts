// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createRequire } from 'node:module';
import { chronicleDescriptorSet, type ConnectionServiceClient } from '@cratis/chronicle.contracts';
import type { ClientMiddleware } from 'nice-grpc-common';

const require = createRequire(import.meta.url);
const clientVersion = (require('@cratis/chronicle/package.json') as { version: string }).version;
const protocolVersion = (require('@cratis/chronicle.contracts/package.json') as { version: string }).version;

/** Verifies the installed wire contract before a channel can perform event-sequence operations. */
export class CompatibilityPreflight {
    private _verification?: Promise<void>;

    constructor(private readonly _connections: ConnectionServiceClient, private readonly _timeout: number) {}

    /** Shares one verdict per channel. A rejected or unavailable check never permits a write. */
    verify(): Promise<void> {
        return this._verification ??= this.check();
    }

    /** Gates even direct service calls that did not first call connect(). */
    middleware(): ClientMiddleware {
        const preflight = this;
        return async function* compatibilityMiddleware(call, options) {
            await preflight.verify();
            return yield* call.next(call.request, options);
        };
    }

    private async check(): Promise<void> {
        const response = await this._connections.checkCompatibility({
            ClientType: 'TypeScript',
            ClientVersion: clientVersion,
            ProtocolVersion: protocolVersion,
            DescriptorSet: Buffer.from(chronicleDescriptorSet)
        }, { signal: AbortSignal.timeout(this._timeout) });
        if (!response.IsCompatible) {
            throw new Error(`Chronicle server ${response.ServerVersion} is incompatible with contracts ${protocolVersion}: ${response.Incompatibilities.join('; ')}`);
        }
    }
}
