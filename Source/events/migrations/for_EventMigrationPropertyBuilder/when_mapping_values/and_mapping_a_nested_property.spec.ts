// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, describe, expect, it } from 'vitest';
import { EventMigrationPropertyBuilder } from '../../EventMigrationPropertyBuilder.js';

describe('when mapping values and mapping a nested property', () => {
    let builder: EventMigrationPropertyBuilder<{ details: { status: string } }, { details: { status: number } }>;

    beforeEach(() => {
        builder = new EventMigrationPropertyBuilder();
        builder.mapValues('details.status', 'details.status', [{ from: 0, to: 'open' }]);
    });

    it('should retain dotted paths verbatim in the kernel expression', () => {
        expect(builder.properties).toEqual({
            'details.status': { $mapValues: { source: 'details.status', mappings: [{ from: 0, to: 'open' }] } }
        });
    });
});
