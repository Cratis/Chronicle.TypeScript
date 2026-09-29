// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap } from '@cratis/chronicle.contracts';
import { eventContractPath } from '../../projections/eventContractPath.js';
import type { ContractEventType, FromRecord, RemovedWithRecord } from '../../projections/declarative/ProjectionBuilderCore.js';
import type { ChildrenDefinitionLike } from '../../projections/modelBound/childrenAndNestedBuilder.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';

/** Rejects an operation at a contract path, optionally naming the responsible declaration. */
export type RejectOperation = (path: string, reason: string, fallback?: string) => never;

/** Validates a scalar mapping into a target schema, rejecting anything outside the fixture-backed subset. */
export type CheckMapping = (modelSchema: JsonSchema, eventSchema: JsonSchema, destination: string, expression: string, path: string) => void;

/** The inputs children validation shares with root validation. */
export interface ChildrenValidationContext {
    readonly schema: JsonSchema;
    readonly rootAutoMap: AutoMap;
    readonly from: readonly FromRecord[];
    readonly removedWith: readonly RemovedWithRecord[];
    readonly declarationFor: (path: string) => string | undefined;
    readonly requireEventSchema: (eventType: ContractEventType, path: string) => JsonSchema;
    readonly checkMapping: CheckMapping;
    readonly reject: RejectOperation;
}

const kernelBacked = 'require a kernel-backed test (ChronicleKernelScenario / live kernel)';

/**
 * Validates one level of children collections against the packaged-kernel fixtures
 * (`children-from-keyed`, `children-identified-removed`, `children-untyped-items`).
 */
export class ProjectionChildrenCapabilities {
    /**
     * Throws for the first children operation outside the fixture-backed subset.
     * @param children - The wire `Children` section of the root definition.
     * @param context - Shared root validation state.
     */
    static validate(children: Record<string, ChildrenDefinitionLike>, context: ChildrenValidationContext): void {
        const owners = new Map<string, string>();
        for (const [property, child] of Object.entries(children)) {
            const base = `Children.${property}`;
            const declaration = context.declarationFor(base);
            const reject = (path: string, reason: string): never => context.reject(path, reason, declaration);
            const wire = child as unknown as Record<string, unknown>;
            if ((child.Join ?? []).length) reject(`${base}.Join`, 'joins require a kernel-backed test');
            if (Object.keys(child.Children ?? {}).length) reject(`${base}.Children`, `nested children collections ${kernelBacked}`);
            if (Object.keys(child.Nested ?? {}).length) reject(`${base}.Nested`, `nested projections inside children ${kernelBacked}`);
            if ((child.RemovedWithJoin ?? []).length) reject(`${base}.RemovedWithJoin`, `removedWithJoin inside children ${kernelBacked}`);
            if (wire.FromEventProperty) reject(`${base}.FromEventProperty`, `value children from an event property ${kernelBacked}`);
            if (Object.keys(child.All?.Properties ?? {}).length || child.All?.IncludeChildren || (child.All?.AutoMap ?? AutoMap.Inherit) !== AutoMap.Inherit) {
                reject(`${base}.All`, `fromEvery/all inside children ${kernelBacked}`);
            }
            if ((child.NoAutoMapProperties ?? []).length) reject(`${base}.NoAutoMapProperties`, `child AutoMap exclusions ${kernelBacked}`);
            const autoMap = child.AutoMap === AutoMap.Inherit ? context.rootAutoMap : child.AutoMap;
            if (autoMap === AutoMap.Disabled) reject(`${base}.AutoMap`, `children with AutoMap disabled ${kernelBacked}`);

            const collection = context.schema.properties?.[property];
            const items = collection?.items;
            if (collection?.type !== 'array' || items?.type !== 'object') {
                reject(base, `children collections must target an array of objects; other targets ${kernelBacked}`);
            }
            const typed = items!.properties !== undefined;
            const identifiedBy = child.IdentifiedBy;
            if (!identifiedBy || identifiedBy === '*NotSet*' || identifiedBy.includes('.')) {
                reject(`${base}.IdentifiedBy`, `children without a direct identifying property ${kernelBacked}`);
            }
            const identity = items!.properties?.[identifiedBy];
            if (typed && (identity?.type !== 'string' || identity.format)) {
                reject(`${base}.IdentifiedBy`, `only a string child identifier is fixture-backed; other identifiers ${kernelBacked}`);
            }

            for (const entry of [...(child.From ?? []), ...(child.RemovedWith ?? [])]) {
                const section = (child.From ?? []).includes(entry as FromRecord) ? 'From' : 'RemovedWith';
                const path = `${base}.${eventContractPath(section, entry.Key)}`;
                const owner = owners.get(entry.Key.Id);
                if (owner) reject(path, `an event subscribed by more than one children operation (${owner}) ${kernelBacked}`);
                owners.set(entry.Key.Id, path);
                if (context.removedWith.some(removal => removal.Key.Id === entry.Key.Id) ||
                    (section === 'RemovedWith' && context.from.some(root => root.Key.Id === entry.Key.Id))) {
                    reject(path, `an event that both removes and changes the parent or a child ${kernelBacked}`);
                }
                const eventSchema = context.requireEventSchema(entry.Key, path);
                const key = eventSchema.properties?.[entry.Value.Key];
                if (!/^[A-Za-z_]\w*$/.test(entry.Value.Key) || key?.type !== 'string' || key.format) {
                    reject(`${path}.Key`, `only a child key read from a string event property is fixture-backed; other child keys ${kernelBacked}`);
                }
                if (entry.Value.ParentKey && entry.Value.ParentKey !== '$eventSourceId') {
                    reject(`${path}.ParentKey`, `parent keys other than the event source id ${kernelBacked}`);
                }
                if (section === 'RemovedWith') continue;
                const properties = (entry as FromRecord).Value.Properties ?? {};
                for (const [destination, expression] of Object.entries(properties)) {
                    const mappingPath = `${path}.Properties.${destination}`;
                    if (destination === identifiedBy) {
                        if (expression !== entry.Value.Key) reject(mappingPath, `mapping the child identifier from anything but the child key ${kernelBacked}`);
                        continue;
                    }
                    if (!typed) reject(mappingPath, `mappings into an untyped child item schema ${kernelBacked}; declare the child's fields`);
                    context.checkMapping(items!, eventSchema, destination, expression, mappingPath);
                }
                if (!typed) continue;
                for (const destination of Object.keys(items!.properties ?? {})) {
                    if (Object.keys(properties).some(name => name.toLowerCase() === destination.toLowerCase())) continue;
                    const candidates = Object.keys(eventSchema.properties ?? {}).filter(source => source.toLowerCase() === destination.toLowerCase());
                    if (!candidates.length) continue;
                    const mappingPath = `${path}.AutoMap.${destination}`;
                    if (destination === identifiedBy) reject(mappingPath, `AutoMap into the child identifier ${kernelBacked}`);
                    if (candidates.length > 1) reject(mappingPath, `inferred AutoMap source is ambiguous: ${candidates.join(', ')}`);
                    context.checkMapping(items!, eventSchema, destination, candidates[0], mappingPath);
                }
            }
        }
    }
}
