// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createRequire } from 'node:module';
import { chronicleDescriptorSet, type ConnectionServiceClient } from '@cratis/chronicle.contracts';
import { ClientError, Status, type ClientMiddleware } from 'nice-grpc-common';
import { IncompatibleChronicleServer } from './IncompatibleChronicleServer';

const require = createRequire(import.meta.url);
const clientVersion = (require('@cratis/chronicle/package.json') as { version: string }).version;
const protocolVersion = (require('@cratis/chronicle.contracts/package.json') as { version: string }).version;

/** Verifies the installed wire contract before a channel can perform event-sequence operations. */
export class CompatibilityPreflight {
    private _verification?: Promise<void>;

    constructor(private readonly _connections: ConnectionServiceClient, private readonly _timeout: number) {}

    /** Shares in-flight checks and caches verdicts for this channel; transient failures can be retried. */
    verify(): Promise<void> {
        if (!this._verification) {
            const verification = this.check().catch(error => {
                if (!(error instanceof IncompatibleChronicleServer) && this._verification === verification) {
                    this._verification = undefined;
                }
                throw error;
            });
            this._verification = verification;
        }
        return this._verification;
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
        if (!chronicleDescriptorSet?.length) {
            throw new IncompatibleChronicleServer('The installed Chronicle contracts have no descriptor set; compatibility cannot be verified.');
        }
        const response = await this._connections.checkCompatibility({
            ClientType: 'TypeScript',
            ClientVersion: clientVersion,
            ProtocolVersion: protocolVersion,
            DescriptorSet: Buffer.from(chronicleDescriptorSet)
        }, { signal: AbortSignal.timeout(this._timeout) }).catch(error => {
            if (error instanceof ClientError && error.code === Status.UNIMPLEMENTED) {
                throw new IncompatibleChronicleServer('The Chronicle server does not support contract compatibility checks; upgrade the kernel before connecting this client.');
            }
            throw error;
        });
        if (response?.IsCompatible !== true || !Array.isArray(response.Incompatibilities) || response.Incompatibilities.length !== 0) {
            const reasons = response?.Incompatibilities?.join('; ') || 'missing, negative, or inconsistent compatibility verdict';
            throw new IncompatibleChronicleServer(`Chronicle server ${response?.ServerVersion ?? 'unknown'} is incompatible with contracts ${protocolVersion}: ${reasons}`);
        }
    }
}
