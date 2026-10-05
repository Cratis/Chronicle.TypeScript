// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ReceivedWebhookRequest } from './ReceivedWebhookRequest.fixture.js';

/**
 * The host name the kernel container uses to reach this process. Docker Desktop resolves
 * host.docker.internal natively; on Linux (CI) the kernel container maps it to the host gateway
 * (--add-host=host.docker.internal:host-gateway, see .github/workflows/build.yml).
 * Override with CHRONICLE_INTEGRATION_WEBHOOK_HOST when the kernel reaches this process differently.
 */
const receiverHost = process.env.CHRONICLE_INTEGRATION_WEBHOOK_HOST ?? 'host.docker.internal';

/**
 * A local HTTP endpoint the kernel delivers webhook requests to. It records every request and
 * answers each with a fixed status code.
 */
export class WebhookReceiver {
    private readonly _requests: ReceivedWebhookRequest[] = [];
    private _server: Server | undefined;
    private _port = 0;

    /**
     * Initializes a new instance of the {@link WebhookReceiver} class.
     * @param _statusCode - The status code to answer every request with.
     */
    constructor(private readonly _statusCode: number) {}

    /** Gets the requests received so far, in arrival order. */
    get requests(): ReadonlyArray<ReceivedWebhookRequest> {
        return this._requests;
    }

    /**
     * Starts listening on all interfaces on a free port, so a kernel container can reach it.
     */
    async start(): Promise<void> {
        const server = createServer((request, response) => {
            const chunks: Buffer[] = [];
            request.on('data', (chunk: Buffer) => chunks.push(chunk));
            request.on('end', () => {
                this._requests.push({
                    method: request.method ?? '',
                    path: request.url ?? '',
                    headers: request.headers,
                    body: Buffer.concat(chunks).toString('utf8')
                });
                response.statusCode = this._statusCode;
                response.end();
            });
        });
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '0.0.0.0', () => resolve());
        });
        this._server = server;
        this._port = (server.address() as AddressInfo).port;
    }

    /**
     * Gets the URL the kernel should deliver to for the given path.
     * @param path - The path, starting with a slash.
     * @returns The URL as seen from the kernel.
     */
    urlFor(path: string): string {
        return `http://${receiverHost}:${this._port}${path}`;
    }

    /**
     * Waits until at least the given number of requests have arrived.
     * @param count - The number of requests to wait for.
     * @param timeoutMs - How long to wait before failing.
     * @returns The requests received.
     */
    async waitForRequests(count: number, timeoutMs = 30_000): Promise<ReadonlyArray<ReceivedWebhookRequest>> {
        const deadline = Date.now() + timeoutMs;
        while (this._requests.length < count) {
            if (Date.now() > deadline) {
                throw new Error(`Timed out waiting for ${count} webhook request(s); received ${this._requests.length}. ` +
                    `Is ${receiverHost} reachable from the kernel?`);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return this._requests;
    }

    /**
     * Stops listening.
     */
    async stop(): Promise<void> {
        const server = this._server;
        if (!server) return;
        this._server = undefined;
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
    }
}
