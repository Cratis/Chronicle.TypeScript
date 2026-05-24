// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IWebhookDefinitionBuilder } from './IWebhookDefinitionBuilder';

/**
 * Defines a discoverable webhook.
 */
export interface IWebhook {
    /**
     * Defines the webhook using the provided builder.
     * @param builder - The builder used for configuration.
     */
    define(builder: IWebhookDefinitionBuilder): void;
}
