// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { AddWebhooks } from '@cratis/chronicle.contracts';
import { beforeEach, chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import type { IClientArtifactsProvider } from '../../artifacts/index.js';
import type { ChronicleConnection } from '../../connection/index.js';
import { eventType } from '../../events/index.js';
import type { IEventTypes } from '../../events/IEventTypes.js';
import { Webhooks } from '../Webhooks.js';

chai.should();

@eventType()
class ParcelReturned {
    @field(String) parcelId = '';
}

describe('when registering a webhook that is not replayable and not active', () => {
    let sent: AddWebhooks | undefined;

    beforeEach(async () => {
        sent = undefined;
        const connection = {
            webhooks: {
                addWebhooks: async (request: AddWebhooks) => {
                    sent = request;
                    return { IsAuthorized: true, ValidationResults: [], ExceptionMessages: [] };
                }
            }
        } as unknown as ChronicleConnection;
        const webhooks = new Webhooks('store', connection, { all: [] } as unknown as IEventTypes, {} as IClientArtifactsProvider);

        await webhooks.register('parcels', 'http://localhost:9/parcels', _ => _
            .withEventType(ParcelReturned)
            .notReplayable()
            .notActive());
    });

    it('should send the webhook as not active', () => sent!.Webhooks[0].IsActive.should.be.false);
    it('should send the webhook as not replayable', () => sent!.Webhooks[0].IsReplayable.should.be.false);
});
