// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { WebhookDefinition } from '@cratis/chronicle.contracts';
import { IWebhookDefinitionBuilder } from './IWebhookDefinitionBuilder';
import { WebhookId } from './WebhookId';
import { WebhookTargetUrl } from './WebhookTargetUrl';

/**
 * Defines the API for working with webhooks.
 */
export interface IWebhooks {
    /**
     * Discovers all webhooks from registered client artifacts.
     */
    discover(): Promise<void>;

    /**
     * Registers all discovered webhooks with the Chronicle Kernel.
     */
    registerDiscovered(): Promise<void>;

    /**
     * Registers a single webhook.
     * @param webhookId - Webhook identifier.
     * @param targetUrl - Webhook target URL.
     * @param configure - Function to configure the webhook definition.
     */
    register(
        webhookId: WebhookId | string,
        targetUrl: WebhookTargetUrl | string,
        configure: (builder: IWebhookDefinitionBuilder) => void
    ): Promise<void>;

    /**
     * Gets all registered webhooks for the event store.
     */
    getWebhooks(): Promise<WebhookDefinition[]>;

    /**
     * Removes a webhook by identifier.
     * @param webhookId - Webhook identifier.
     */
    remove(webhookId: WebhookId | string): Promise<void>;
}
