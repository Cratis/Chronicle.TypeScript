// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import { IEventStore } from '@cratis/chronicle';

const logger = diag.createComponentLogger({ namespace: 'chronicle-test-console/ExternalServicesExample' });

/**
 * Registers an external HTTP service with the Chronicle Kernel, secured with a bearer
 * token and a custom tenant header.
 *
 * External services are Kernel-side registrations - reactors, projections, and other
 * server-side artifacts can call out to them by name without embedding connection
 * details or secrets in application code. Registering the same name again overwrites
 * the previous definition, so this is safe to call repeatedly (e.g. on every startup).
 *
 * @param store - The event store to register the external service with.
 */
export async function registerCustomersApi(store: IEventStore): Promise<void> {
    const token = process.env.CUSTOMERS_API_TOKEN ?? 'sample-bearer-token';

    await store.externalServices.register('CustomersApi', builder => builder
        .http('https://api.example.com')
        .withBearerToken(token)
        .withHeader('X-Tenant', 'acme'));

    console.log('[external-services] Registered \'CustomersApi\' as an HTTP endpoint with bearer token authorization');
    logger.info('Registered external service', { name: 'CustomersApi', endpoint: 'https://api.example.com' });
}
