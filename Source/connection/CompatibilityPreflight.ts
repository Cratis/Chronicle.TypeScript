// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createRequire } from 'node:module';
import { chronicleDescriptorSet, type CompatibilityResponse, type ConnectionServiceClient } from '@cratis/chronicle.contracts';
import { ClientError, Status, type ClientMiddleware } from 'nice-grpc-common';
import { IncompatibleChronicleServer } from './IncompatibleChronicleServer.js';
import { clientVersion } from './clientVersion.js';
import { runInBackgroundContext } from '../telemetry/runInBackgroundContext.js';

const require = createRequire(import.meta.url);
const protocolVersion = (require('@cratis/chronicle.contracts/package.json') as { version: string }).version;

/** Verifies the installed wire contract before a channel can perform event-sequence operations. */
export class CompatibilityPreflight {
    private _verification?: Promise<void>;
    private _kernelVersion?: string;
    private _capabilities: readonly string[] = [];

    /** The server version reported by a successful contract check, or undefined when skipped. */
    get kernelVersion(): string | undefined {
        return this._kernelVersion;
    }

    /**
     * The capabilities the server advertised in its answer to the contract check. Empty until the check has passed, and
     * for a server that predates the handshake, which advertises none.
     */
    get capabilities(): readonly string[] {
        return this._capabilities;
    }

    constructor(
        private readonly _connections: ConnectionServiceClient,
        private readonly _timeout: number,
        private readonly _skip: boolean = false
    ) {}

    /** Shares in-flight checks and caches verdicts for this channel; transient failures can be retried. */
    verify(): Promise<void> {
        if (this._skip) {
            return Promise.resolve();
        }

        if (!this._verification) {
            const verification = runInBackgroundContext(() => this.check()).catch(error => {
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
        this.verifyContract(response);
        this._kernelVersion = response.ServerVersion;
        this._capabilities = Array.isArray(response.Capabilities) ? [...response.Capabilities] : [];
    }

    private verifyContract(response: CompatibilityResponse): void {
        const compatible = response?.IsCompatible === true;
        const noIncompatibilities = Array.isArray(response?.Incompatibilities) && response.Incompatibilities.length === 0;
        if (compatible && noIncompatibilities) {
            return;
        }
        throw this.incompatibleContract(response);
    }

    private incompatibleContract(response: CompatibilityResponse): IncompatibleChronicleServer {
        const reasons = response?.Incompatibilities?.join('; ') || 'missing, negative, or inconsistent compatibility verdict';
        return new IncompatibleChronicleServer(`Chronicle server ${response?.ServerVersion ?? 'unknown'} is incompatible with contracts ${protocolVersion}: ${reasons}`);
    }
}
