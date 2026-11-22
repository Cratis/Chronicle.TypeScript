// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { expect, it } from 'vitest';
import {
    EventMigrationPropertyBuilder, type IEventMigrationPropertyBuilder, type MigrationPropertyPath, type ValueMapping
} from '../../../index.js';

type Payload = {
    name: string;
    details?: { status: string; address: { city: string } | null } | null;
    list: readonly { status: string }[];
    created: Date;
    callback: () => void;
    recursive?: Payload;
};

function configure(builder: IEventMigrationPropertyBuilder<Payload, Payload>, root: keyof Payload & string) {
    const mappings: readonly ValueMapping[] = [{ from: 0, to: 'open' }];
    builder.mapValues('details.status', 'details.status', mappings)
        .split('details.address.city', 'name', ' ', 0)
        .combine('name', ' ', 'details.address.city', 'name')
        .renamedFrom('details.address.city', 'details.address.city')
        .defaultValue('details.status', 'open')
        .defaultValue(root, null)
        .renamedFrom('details', 'details')
        .renamedFrom('list', 'list')
        .renamedFrom('created', 'created')
        .renamedFrom('callback', 'callback');
    // @ts-expect-error Unknown target leaf.
    builder.mapValues('details.unknown', 'details.status', mappings);
    // @ts-expect-error Unknown source leaf.
    builder.mapValues('details.status', 'details.unknown', mappings);
    // @ts-expect-error Array indexing is not an object property path.
    builder.renamedFrom('name', 'list.0.status');
    // @ts-expect-error Array members cannot be traversed.
    builder.defaultValue('list.length', 0);
    // @ts-expect-error Date members cannot be traversed.
    builder.split('name', 'created.toISOString', ' ', 0);
    // @ts-expect-error Function members cannot be traversed.
    builder.combine('name', ' ', 'callback.name');
    // @ts-expect-error Misspelled target path.
    builder.renamedFrom('detail.status', 'name');
}

it('should accept root and bounded nested paths through the public API', () => {
    const path: MigrationPropertyPath<Payload> = 'recursive.recursive.recursive.recursive.recursive.recursive.recursive.name';
    // @ts-expect-error Paths stop at eight segments, even for recursive payloads.
    const tooDeep: MigrationPropertyPath<Payload> = 'recursive.recursive.recursive.recursive.recursive.recursive.recursive.recursive.name';
    expect(path).not.toBe(tooDeep);
    expect(configure).toBeTypeOf('function');
    expect(new EventMigrationPropertyBuilder<Payload, Payload>()).toBeDefined();
});
