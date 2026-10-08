// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { IncomingHttpHeaders } from 'node:http';

/**
 * A request the kernel delivered to a {@link WebhookReceiver}.
 */
export interface ReceivedWebhookRequest {
    /** The HTTP method. */
    readonly method: string;

    /** The request path, including any query string. */
    readonly path: string;

    /** The request headers, with lowercase names. */
    readonly headers: IncomingHttpHeaders;

    /** The raw request body. */
    readonly body: string;
}
