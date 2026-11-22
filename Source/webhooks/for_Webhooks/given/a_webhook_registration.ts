// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AddWebhooksRequest } from '@cratis/chronicle.contracts';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import type { IEventTypes } from '../../../events/IEventTypes.js';
import { Webhooks } from '../../Webhooks.js';

export class a_webhook_registration {
    sent = AddWebhooksRequest.fromPartial({});
    readonly webhooks: Webhooks;

    constructor() {
        const connection = {
            webhooks: {
                addWebhooks: async (request: AddWebhooksRequest) => {
                    this.sent = request;
                    return { IsAuthorized: true, ValidationResults: [], ExceptionMessages: [] };
                }
            }
        } as unknown as ChronicleConnection;
        this.webhooks = new Webhooks('store', connection, { all: [] } as unknown as IEventTypes, {} as IClientArtifactsProvider);
    }
}
