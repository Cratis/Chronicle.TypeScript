// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChildrenDefinition, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import { ChildrenOrderingNotSupportedByContracts } from './ChildrenOrderingNotSupportedByContracts.js';

type ChildrenLike = { Children?: Record<string, ChildrenLike>; Nested?: Record<string, ChildrenLike>; Ordering?: unknown };

/**
 * Detects whether the installed contracts carry `ChildrenDefinition.Ordering` to the kernel. The generated codec drops
 * fields it does not know, so an ordering the contracts cannot encode would be lost on the wire.
 * @returns True when the contracts encode children ordering.
 */
export function contractsSupportChildrenOrdering(): boolean {
    const probe = ChildrenDefinition.fromPartial({ Ordering: { Placement: 1, SortBy: '', Direction: 0 } } as Parameters<typeof ChildrenDefinition.fromPartial>[0]);
    return (probe as { Ordering?: unknown }).Ordering !== undefined;
}

/**
 * Throws when a projection orders any of its children collections, at any depth, and the contracts cannot carry it.
 * @param definition - The compiled projection definition.
 * @param supported - Whether the contracts support children ordering. Defaults to detecting it.
 */
export function ensureChildrenOrderingIsSupported(definition: ProjectionDefinition, supported: boolean = contractsSupportChildrenOrdering()): void {
    if (supported) return;
    const projection = String(definition.Identifier ?? '<unknown>');
    const visit = (owner: ChildrenLike, path: string): void => {
        for (const [property, child] of Object.entries(owner.Children ?? {})) {
            const childPath = `${path}Children.${property}`;
            if (child.Ordering !== undefined) {
                throw new ChildrenOrderingNotSupportedByContracts(projection, childPath);
            }
            visit(child, `${childPath}.`);
        }
        for (const [property, nested] of Object.entries(owner.Nested ?? {})) {
            visit(nested, `${path}Nested.${property}.`);
        }
    };
    visit(definition as unknown as ChildrenLike, '');
}
