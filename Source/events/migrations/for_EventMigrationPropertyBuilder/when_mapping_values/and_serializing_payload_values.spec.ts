// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, describe, expect, it } from 'vitest';
import { EventMigrationPropertyBuilder } from '../../EventMigrationPropertyBuilder.js';
import type { ValueMapping } from '../../ValueMapping.js';

describe('when mapping values and serializing payload values', () => {
    let builder: EventMigrationPropertyBuilder<{ status: unknown }, { legacyStatus: unknown }>;
    let result: unknown;
    const mappings: readonly ValueMapping[] = [
        { from: 0, to: 'open' },
        { from: null, to: false },
        { from: { kind: 'old', parts: [1, 2] }, to: { kind: 'new' } },
        { from: ['old', true], to: ['new', false] }
    ];

    beforeEach(() => {
        builder = new EventMigrationPropertyBuilder();
        result = builder.mapValues('status', 'legacyStatus', mappings);
    });

    it('should return the same builder', () => expect(result).toBe(builder));

    it('should serialize ordered JSON pairs without changing payload values', () => {
        expect(JSON.parse(JSON.stringify(builder.properties))).toEqual({
            status: { $mapValues: { source: 'legacyStatus', mappings: [
                { from: 0, to: 'open' },
                { from: null, to: false },
                { from: { kind: 'old', parts: [1, 2] }, to: { kind: 'new' } },
                { from: ['old', true], to: ['new', false] }
            ] } }
        });
    });

    it('should snapshot the pair collection', () => {
        const expression = builder.properties.status as { $mapValues: { mappings: unknown } };
        expect(expression.$mapValues.mappings).not.toBe(mappings);
    });
});

describe('when mapping values with an empty map', () => {
    let builder: EventMigrationPropertyBuilder<{ status: unknown }, { status: unknown }>;

    beforeEach(() => {
        builder = new EventMigrationPropertyBuilder();
        builder.mapValues('status', 'status', []);
    });

    it('should serialize the empty ordered mapping array', () => {
        expect(JSON.parse(JSON.stringify(builder.properties))).toEqual({
            status: { $mapValues: { source: 'status', mappings: [] } }
        });
    });
});
