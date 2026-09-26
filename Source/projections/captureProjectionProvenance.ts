// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ProjectionCapabilityProvenance } from './ProjectionCapabilityProvenance.js';
import type { ContractEventType } from './declarative/ProjectionBuilderCore.js';
import { eventContractPath } from './eventContractPath.js';

/** Captures pre-lowering declarations without changing the registration contract. */
export function captureProjectionProvenance(definition: Record<string, unknown>, modelBound: boolean, overrides: ReadonlyMap<string, string> = new Map()): ProjectionCapabilityProvenance[] {
    const result: ProjectionCapabilityProvenance[] = [];
    const add = (contractPath: string, declaration: string) => result.push({ contractPath, declaration: overrides.get(contractPath) ?? declaration });
    const prefix = modelBound ? '@' : '.';
    const from = definition.From as Array<{ Key: ContractEventType; Value: { Properties: Record<string, string>; Key: string; ParentKey: string } }> ?? [];
    for (const entry of from) {
        const path = eventContractPath('From', entry.Key);
        add(path, `${prefix}${modelBound ? 'fromEvent' : 'from'}`);
        add(`${path}.Key`, `${prefix}${modelBound ? 'fromEvent' : 'from().usingKey'}`);
        add(`${path}.ParentKey`, `${prefix}${modelBound ? 'fromEvent' : 'from().usingParentKey'}`);
        for (const [property, expression] of Object.entries(entry.Value.Properties ?? {})) {
            const operation = expression.startsWith('$add(') ? 'addFrom' : expression.startsWith('$subtract(') ? 'subtractFrom'
                : expression === '$count' ? 'count' : expression === '$increment' ? 'increment'
                    : expression === '$decrement' ? 'decrement' : expression === '$null' ? 'clearWith'
                        : expression.startsWith('$value(') ? 'setValue' : expression.startsWith('$context.') ? 'setFromContext' : 'setFrom';
            add(`${path}.Properties.${property}`, `${prefix}${modelBound ? operation : `from().${operation}`}`);
        }
    }
    for (const section of ['Join', 'RemovedWith', 'RemovedWithJoin'] as const) {
        for (const entry of definition[section] as Array<{ Key: ContractEventType; Value: { Properties?: Record<string, string>; Key?: string; ParentKey?: string } }> ?? []) {
            const path = eventContractPath(section, entry.Key);
            const declaration = modelBound ? `@${section[0].toLowerCase()}${section.slice(1)}` : `.${section[0].toLowerCase()}${section.slice(1)}`;
            add(path, declaration);
            if (entry.Value.Key !== undefined) add(`${path}.Key`, declaration);
            if (entry.Value.ParentKey !== undefined) add(`${path}.ParentKey`, declaration);
            for (const property of Object.keys(entry.Value.Properties ?? {})) add(`${path}.Properties.${property}`, declaration);
        }
    }
    for (const section of ['Children', 'Nested'] as const) {
        for (const property of Object.keys(definition[section] as Record<string, unknown> ?? {})) {
            add(`${section}.${property}`, modelBound ? (section === 'Children' ? '@childrenFrom' : '@nested') : `.${section.toLowerCase()}`);
        }
    }
    const all = definition.All as { Properties?: Record<string, string>; IncludeChildren?: boolean } | undefined;
    if (all?.IncludeChildren || Object.keys(all?.Properties ?? {}).length) add('All', modelBound ? '@fromEvery' : '.fromEvery');
    for (const property of Object.keys(all?.Properties ?? {})) add(`All.Properties.${property}`, modelBound ? '@fromEvery' : '.fromEvery');
    if ((definition.FromEvery as unknown[] | undefined)?.length) add('FromEvery', modelBound ? '@fromEvery' : '.fromEvery');
    if (definition.IsActive === false) add('IsActive', modelBound ? '@passive' : '.passive');
    if (definition.EventSequenceId) add('EventSequenceId', modelBound ? '@eventSequence' : '.fromEventSequence');
    if (definition.FromEventProperty) add('FromEventProperty', modelBound ? '@fromEvent' : '.from');
    return result;
}
