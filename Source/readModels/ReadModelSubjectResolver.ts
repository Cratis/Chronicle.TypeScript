// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { getSubjectPropertyName } from '../compliance/subject';

/**
 * Resolves the compliance subject - the natural person a read model's Personal Identifiable
 * Information (PII) belongs to - from a read model instance.
 */
export class ReadModelSubjectResolver {
    /**
     * Attempts to derive the compliance subject from a read model instance.
     *
     * Resolution order:
     * 1. The property decorated with `@subject()` on {@link readModelType}, when it has a value.
     * 2. The `id` property, by convention - kept so read models that predate `@subject()`
     *    continue to resolve exactly as before.
     * @param readModelType - The read model type to resolve subject metadata for.
     * @param instance - The read model instance to inspect, or undefined/null for a read model
     * that does not exist.
     * @returns The resolved subject, or undefined when neither source yields a value.
     */
    static resolveFrom<TReadModel>(readModelType: Constructor<TReadModel>, instance: TReadModel): string | undefined {
        if (instance === undefined || instance === null) {
            return undefined;
        }

        const anyInstance = instance as Record<string, unknown>;
        const subjectProperty = getSubjectPropertyName(readModelType);
        const explicitSubject = subjectProperty ? ReadModelSubjectResolver.toSubject(anyInstance[subjectProperty]) : undefined;

        return explicitSubject ?? ReadModelSubjectResolver.toSubject(anyInstance.id);
    }

    private static toSubject(value: unknown): string | undefined {
        if (value === undefined || value === null) {
            return undefined;
        }

        const stringValue = String(value);
        return stringValue.length > 0 ? stringValue : undefined;
    }
}
