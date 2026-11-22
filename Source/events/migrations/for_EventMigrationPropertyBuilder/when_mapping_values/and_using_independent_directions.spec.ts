// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, describe, expect, it } from 'vitest';
import { EventMigrationBuilder } from '../../EventMigrationBuilder.js';

describe('when mapping values and configuring only an upcast', () => {
    let upcast: EventMigrationBuilder<{ status: string }, { status: number }>;
    let downcast: EventMigrationBuilder<{ status: number }, { status: string }>;

    beforeEach(() => {
        upcast = new EventMigrationBuilder();
        downcast = new EventMigrationBuilder();
        upcast.properties(properties => properties.mapValues('status', 'status', [{ from: 0, to: 'open' }]));
    });

    it('should retain the explicit upcast', () => expect(upcast.toObject()).toEqual({
        status: { $mapValues: { source: 'status', mappings: [{ from: 0, to: 'open' }] } }
    }));
    it('should not infer a downcast', () => expect(downcast.toObject()).toEqual({}));
});

describe('when mapping values and configuring only a downcast', () => {
    let upcast: EventMigrationBuilder<{ status: string }, { status: number }>;
    let downcast: EventMigrationBuilder<{ status: number }, { status: string }>;

    beforeEach(() => {
        upcast = new EventMigrationBuilder();
        downcast = new EventMigrationBuilder();
        downcast.properties(properties => properties.mapValues('status', 'status', [{ from: 'open', to: 0 }]));
    });

    it('should retain the explicit downcast', () => expect(downcast.toObject()).toEqual({
        status: { $mapValues: { source: 'status', mappings: [{ from: 'open', to: 0 }] } }
    }));
    it('should not infer an upcast', () => expect(upcast.toObject()).toEqual({}));
});
