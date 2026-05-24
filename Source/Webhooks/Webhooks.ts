// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ObserverOwner, type WebhookDefinition } from '@cratis/chronicle.contracts';
import { Constructor } from '@cratis/fundamentals';
import { IClientArtifactsProvider } from '../artifacts';
import { ChronicleConnection } from '../connection';
import { EventSequenceId } from '../EventSequences/EventSequenceId';
import { IEventTypes } from '../Events/IEventTypes';
import { IWebhook } from './IWebhook';
import { IWebhookDefinitionBuilder } from './IWebhookDefinitionBuilder';
import { IWebhooks } from './IWebhooks';
import { WebhookDefinitionBuilder } from './WebhookDefinitionBuilder';
import { WebhookId } from './WebhookId';
import { WebhookTargetUrl } from './WebhookTargetUrl';
import { getWebhookMetadata } from './webhook';

/**
 * Implements {@link IWebhooks}.
 */
export class Webhooks implements IWebhooks {
    private readonly _discovered = new Map<string, WebhookDefinition>();

    /**
     * Creates a new {@link Webhooks} instance.
     * @param _eventStore - Event store name.
     * @param _connection - Chronicle connection.
     * @param _eventTypes - Event types manager.
     * @param _clientArtifacts - Client artifacts provider.
     */
    constructor(
        private readonly _eventStore: string,
        private readonly _connection: ChronicleConnection,
        private readonly _eventTypes: IEventTypes,
        private readonly _clientArtifacts: IClientArtifactsProvider
    ) {}

    /** @inheritdoc */
    async discover(): Promise<void> {
        this._discovered.clear();
        for (const type of this._clientArtifacts.webhooks) {
            const metadata = getWebhookMetadata(type);
            if (!metadata) {
                continue;
            }

            const definition = this.buildDefinition(
                type,
                metadata.id,
                metadata.targetUrl,
                () => undefined,
                metadata.eventSequenceId
            );
            this._discovered.set(metadata.id.value, definition);
        }
    }

    /** @inheritdoc */
    async registerDiscovered(): Promise<void> {
        if (this._discovered.size === 0) {
            await this.discover();
        }

        if (this._discovered.size === 0) {
            return;
        }

        await this._connection.webhooks.add({
            EventStore: this._eventStore,
            Owner: ObserverOwner.Client,
            Webhooks: [...this._discovered.values()]
        });
    }

    /** @inheritdoc */
    async register(
        webhookId: WebhookId | string,
        targetUrl: WebhookTargetUrl | string,
        configure: (builder: IWebhookDefinitionBuilder) => void
    ): Promise<void> {
        const definition = this.buildDefinition(
            undefined,
            typeof webhookId === 'string' ? new WebhookId(webhookId) : webhookId,
            typeof targetUrl === 'string' ? new WebhookTargetUrl(targetUrl) : targetUrl,
            configure
        );

        await this._connection.webhooks.add({
            EventStore: this._eventStore,
            Owner: ObserverOwner.Client,
            Webhooks: [definition]
        });
    }

    /** @inheritdoc */
    async getWebhooks(): Promise<WebhookDefinition[]> {
        const response = await this._connection.webhooks.getWebhooks({ EventStore: this._eventStore });
        return response.items ?? [];
    }

    /** @inheritdoc */
    async remove(webhookId: WebhookId | string): Promise<void> {
        const id = typeof webhookId === 'string' ? webhookId : webhookId.value;
        await this._connection.webhooks.remove({
            EventStore: this._eventStore,
            Webhooks: [id]
        });
    }

    private buildDefinition(
        type: Constructor | undefined,
        id: WebhookId,
        targetUrl: WebhookTargetUrl,
        configure: (builder: IWebhookDefinitionBuilder) => void,
        eventSequenceId?: string
    ): WebhookDefinition {
        const builder = new WebhookDefinitionBuilder(this._eventTypes);
        configure(builder);

        if (type) {
            const instance = new (type as new () => IWebhook)();
            instance.define(builder);
        }

        if (eventSequenceId) {
            builder.onEventSequence(new EventSequenceId(eventSequenceId));
        }

        return builder.build(id, targetUrl);
    }
}
