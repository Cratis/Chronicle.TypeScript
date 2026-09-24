// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { JsonSchema } from './JsonSchema.js';

/** Expected schema contract for both decorator transforms. */
export const expectedProperties: Record<string, JsonSchema> = {
    name: { type: 'string' },
    age: { type: 'number' },
    active: { type: 'boolean' },
    id: { type: 'string', format: 'guid' },
    occurred: { type: 'string', format: 'date-time' },
    codes: { type: 'array', items: { type: 'string' } },
    address: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        title: 'Address',
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
        additionalProperties: false
    },
    code: { type: 'string' },
    quantity: { type: 'number' }
};
