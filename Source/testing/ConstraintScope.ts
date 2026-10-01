// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventContext } from '../events/EventContext.js';
import type { ConstraintScopeCapture } from '../events/constraints/ConstraintBuilder.js';

/** Property indexes use the kernel's unescaped flattened key, not a tuple. */
export function propertyScopeKey(scope: ConstraintScopeCapture, context: EventContext): string {
    const parts: string[] = [];
    if (scope.perEventSourceType) parts.push(`est:${context.eventSourceType}`);
    if (scope.perEventStreamType) parts.push(`estt:${context.eventStreamType}`);
    if (scope.perEventStreamId) parts.push(`esid:${context.eventStreamId}`);
    return parts.join('|');
}

/** Event-type cycles compare selected dimensions exactly. Never flatten them like property keys. */
export function eventTypeScopeKey(scope: ConstraintScopeCapture, context: EventContext): string {
    return JSON.stringify([
        scope.perEventSourceType ? context.eventSourceType : null,
        scope.perEventStreamType ? context.eventStreamType : null,
        scope.perEventStreamId ? context.eventStreamId : null
    ]);
}

/** Keep definition names, scope keys and source IDs in separate map levels. */
export function scopeIndex<T>(indexes: Map<string, Map<string, T>>, name: string, scope: string, create: () => T): T {
    let scopes = indexes.get(name);
    if (!scopes) { scopes = new Map<string, T>(); indexes.set(name, scopes); }
    let index = scopes.get(scope);
    if (index === undefined) { index = create(); scopes.set(scope, index); }
    return index;
}
