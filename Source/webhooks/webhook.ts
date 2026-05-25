// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { Constructor } from '@cratis/fundamentals';
import { DecoratorType, TypeDiscoverer } from '../types';
import { WebhookId } from './WebhookId';
import { WebhookTargetUrl } from './WebhookTargetUrl';

/** Metadata key used to store webhook information on a class. */
const WEBHOOK_METADATA_KEY = 'chronicle:webhook';

/**
 * Metadata stored on a webhook class.
 */
export interface WebhookMetadata {
    /** The webhook identifier. */
    readonly id: WebhookId;

    /** The webhook target URL. */
    readonly targetUrl: WebhookTargetUrl;

    /** Optional explicit event sequence id. */
    readonly eventSequenceId: string | undefined;
}

/**
 * TypeScript decorator that marks a class as a discoverable webhook.
 * Overloads:
 * - `@webhook(targetUrl)` -> class name is used as identifier.
 * - `@webhook(id, targetUrl)` -> explicit identifier.
 * - `@webhook(id, targetUrl, eventSequenceId)` -> explicit identifier and event sequence.
 * @param idOrTargetUrl - The webhook identifier or target URL.
 * @param targetUrlOrUndefined - The webhook target URL when id is provided.
 * @param eventSequenceId - Optional event sequence identifier.
 * @returns A class decorator.
 */
export function webhook(targetUrl: string): ClassDecorator;
export function webhook(id: string, targetUrl: string): ClassDecorator;
export function webhook(id: string, targetUrl: string, eventSequenceId: string): ClassDecorator;
export function webhook(idOrTargetUrl: string, targetUrlOrUndefined?: string, eventSequenceId?: string): ClassDecorator {
    return (target: object) => {
        const hasExplicitId = targetUrlOrUndefined !== undefined;
        const explicitId = hasExplicitId ? idOrTargetUrl : undefined;
        const resolvedTargetUrl = hasExplicitId ? targetUrlOrUndefined : idOrTargetUrl;

        if (!resolvedTargetUrl) {
            throw new Error('A webhook targetUrl must be a non-empty string for @webhook.');
        }

        const constructor = target as Function;
        const webhookId = new WebhookId(explicitId ?? constructor.name);
        const metadata: WebhookMetadata = {
            id: webhookId,
            targetUrl: new WebhookTargetUrl(resolvedTargetUrl),
            eventSequenceId
        };
        Reflect.defineMetadata(WEBHOOK_METADATA_KEY, metadata, target);
        TypeDiscoverer.default.register(
            DecoratorType.Webhook,
            constructor as Constructor,
            webhookId.value
        );
    };
}

/**
 * Gets webhook metadata from a webhook class.
 * @param target - The class constructor.
 * @returns The metadata, if any.
 */
export function getWebhookMetadata(target: Function): WebhookMetadata | undefined {
    return Reflect.getMetadata(WEBHOOK_METADATA_KEY, target);
}

/**
 * Checks whether a class has webhook metadata.
 * @param target - The class constructor.
 * @returns True when decorated as webhook.
 */
export function isWebhook(target: Function): boolean {
    return Reflect.hasMetadata(WEBHOOK_METADATA_KEY, target);
}
