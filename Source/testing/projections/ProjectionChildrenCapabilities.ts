// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap } from '@cratis/chronicle.contracts';
import { eventContractPath } from '../../projections/eventContractPath.js';
import type { ContractEventType, FromRecord, RemovedWithRecord } from '../../projections/declarative/ProjectionBuilderCore.js';
import type { ChildrenDefinitionLike } from '../../projections/modelBound/childrenAndNestedBuilder.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import { ProjectionValueChildrenCapabilities } from './ProjectionValueChildrenCapabilities.js';
import { ProjectionContextChildKeyCapabilities } from './ProjectionContextChildKeyCapabilities.js';

/** Rejects an operation at a contract path, optionally naming the responsible declaration. */
export type RejectOperation = (path: string, reason: string, fallback?: string) => never;

/** Validates a scalar mapping into a target schema, rejecting anything outside the fixture-backed subset. */
export type CheckMapping = (modelSchema: JsonSchema, eventSchema: JsonSchema, destination: string, expression: string, path: string) => void;

/** The inputs children validation shares with root validation. */
export interface ChildrenValidationContext {
    readonly schema: JsonSchema;
    readonly rootAutoMap: AutoMap;
    readonly hasInitialModelState: boolean;
    readonly from: readonly FromRecord[];
    readonly removedWith: readonly RemovedWithRecord[];
    readonly declarationFor: (path: string) => string | undefined;
    readonly requireEventSchema: (eventType: ContractEventType, path: string) => JsonSchema;
    readonly checkMapping: CheckMapping;
    readonly reject: RejectOperation;
}

const kernelBacked = 'require a kernel-backed test (ChronicleKernelScenario / live kernel)';

/** Validates one level of fixture-backed keyed-object or plain-string value children. */
export class ProjectionChildrenCapabilities {
    static validate(children: Record<string, ChildrenDefinitionLike>, context: ChildrenValidationContext): void {
        if (Object.keys(children).length && context.hasInitialModelState) {
            context.reject('InitialModelState', `children with initial model state ${kernelBacked}`);
        }
        ProjectionContextChildKeyCapabilities.validate(children, context);
        const owners = new Map<string, string>();
        for (const [property, child] of Object.entries(children)) {
            new ChildValidation(property, child, context, owners).validate();
        }
    }
}

interface ChildAutoMap {
    readonly items: JsonSchema;
    readonly eventSchema: JsonSchema;
    readonly properties: Record<string, string>;
    readonly path: string;
    readonly key: string;
}

class ChildValidation {
    private readonly base: string;
    private readonly reject: (path: string, reason: string) => never;

    constructor(private readonly property: string, private readonly child: ChildrenDefinitionLike,
        private readonly context: ChildrenValidationContext, private readonly owners: Map<string, string>) {
        this.base = `Children.${property}`;
        const declaration = context.declarationFor(this.base);
        this.reject = (path, reason) => context.reject(path, reason, declaration);
    }

    validate(): void {
        this.unsupported();
        this.metadata();
        if (ProjectionValueChildrenCapabilities.definition(this.child)) {
            ProjectionValueChildrenCapabilities.validate(this.property, this.child, this.context, this.owners);
            return;
        }
        const items = this.items();
        for (const entry of [...(this.child.From ?? []), ...(this.child.RemovedWith ?? [])]) this.entry(entry, items);
    }

    private unsupported(): void {
        const { child, base, reject } = this;
        if ((child.Join ?? []).length) reject(`${base}.Join`, 'joins inside children require a kernel-backed test');
        if (Object.keys(child.Children ?? {}).length) reject(`${base}.Children`, `nested children collections ${kernelBacked}`);
        if (Object.keys(child.Nested ?? {}).length) reject(`${base}.Nested`, `nested projections inside children ${kernelBacked}`);
        if ((child.RemovedWithJoin ?? []).length) reject(`${base}.RemovedWithJoin`, `removedWithJoin inside children ${kernelBacked}`);
    }

    private metadata(): void {
        const { child, base, reject } = this;
        if (child.Ordering !== undefined) reject(`${base}.Ordering`, `prepended or sorted children ${kernelBacked}`);
        if (this.hasAllOperations()) reject(`${base}.All`, `fromEvery/all inside children ${kernelBacked}`);
        if ((child.NoAutoMapProperties ?? []).length) reject(`${base}.NoAutoMapProperties`, `child AutoMap exclusions ${kernelBacked}`);
        const autoMap = child.AutoMap === AutoMap.Inherit ? this.context.rootAutoMap : child.AutoMap;
        if (autoMap === AutoMap.Disabled) reject(`${base}.AutoMap`, `children with AutoMap disabled ${kernelBacked}`);
    }

    private hasAllOperations(): boolean {
        const all = this.child.All;
        return Object.keys(all?.Properties ?? {}).length > 0 || !!all?.IncludeChildren || (all?.AutoMap ?? AutoMap.Inherit) !== AutoMap.Inherit;
    }

    private items(): JsonSchema {
        const collection = this.context.schema.properties?.[this.property];
        const items = collection?.items;
        if (collection?.type !== 'array' || items?.type !== 'object') {
            this.reject(this.base, `children collections must target an array of objects; other targets ${kernelBacked}`);
        }
        this.identity(items!);
        return items!;
    }

    private identity(items: JsonSchema): void {
        const identifiedBy = this.child.IdentifiedBy;
        if (!identifiedBy) this.reject(`${this.base}.IdentifiedBy`, `children without a direct identifying property ${kernelBacked}`);
        if (!this.directIdentifier(identifiedBy)) {
            this.reject(`${this.base}.IdentifiedBy`, `children without a direct identifying property ${kernelBacked}`);
        }
        const identity = items.properties?.[identifiedBy];
        if (items.properties !== undefined && !this.plainString(identity)) {
            this.reject(`${this.base}.IdentifiedBy`, `only a string child identifier is fixture-backed; other identifiers ${kernelBacked}`);
        }
    }

    private directIdentifier(expression: string): boolean {
        return expression !== '*NotSet*' && !expression.includes('.');
    }

    private plainString(schema: JsonSchema | undefined): boolean {
        return schema?.type === 'string' && !schema.format;
    }

    private entry(entry: FromRecord | RemovedWithRecord, items: JsonSchema): void {
        const adding = (this.child.From ?? []).includes(entry as FromRecord);
        const section = adding ? 'From' : 'RemovedWith';
        const path = `${this.base}.${eventContractPath(section, entry.Key)}`;
        this.owner(entry.Key, section, path);
        const eventSchema = this.context.requireEventSchema(entry.Key, path);
        this.keys(entry, eventSchema, path);
        if (!adding) return;
        const properties = (entry as FromRecord).Value.Properties ?? {};
        this.explicit(properties, entry.Value.Key, path);
        if (items.properties !== undefined) this.autoMap({ items, eventSchema, properties, path, key: entry.Value.Key });
    }

    private owner(event: ContractEventType, section: string, path: string): void {
        const owner = this.owners.get(event.Id);
        if (owner) this.reject(path, `an event subscribed by more than one children operation (${owner}) ${kernelBacked}`);
        this.owners.set(event.Id, path);
        const removesParent = this.context.removedWith.some(removal => removal.Key.Id === event.Id);
        const removesAndMaps = section === 'RemovedWith' && this.context.from.some(root => root.Key.Id === event.Id);
        if (removesParent || removesAndMaps) this.reject(path, `an event that both removes and changes the parent or a child ${kernelBacked}`);
    }

    private keys(entry: FromRecord | RemovedWithRecord, eventSchema: JsonSchema, path: string): void {
        if (!ProjectionContextChildKeyCapabilities.matches(entry.Value.Key)) this.contentKey(entry, eventSchema, path);
        if (entry.Value.ParentKey && entry.Value.ParentKey !== '$eventSourceId') {
            this.reject(`${path}.ParentKey`, `parent keys other than the event source id ${kernelBacked}`);
        }
    }

    private contentKey(entry: FromRecord | RemovedWithRecord, eventSchema: JsonSchema, path: string): void {
        const key = eventSchema.properties?.[entry.Value.Key];
        const plainStringKey = this.plainString(key);
        if (!/^[A-Za-z_]\w*$/.test(entry.Value.Key) || !plainStringKey) {
            this.reject(`${path}.Key`, `only a child key read from a string event property is fixture-backed; other child keys ${kernelBacked}`);
        }
    }

    private explicit(properties: Record<string, string>, key: string, path: string): void {
        for (const [destination, expression] of Object.entries(properties)) {
            const mappingPath = `${path}.Properties.${destination}`;
            if (destination === this.child.IdentifiedBy) {
                if (expression !== key) this.reject(mappingPath, `mapping the child identifier from anything but the child key ${kernelBacked}`);
                continue;
            }
            this.reject(mappingPath, `explicit child property mappings (renames, event context, constants, nulls) ${kernelBacked}; only same-name AutoMap into typed children is supported`);
        }
    }

    private autoMap(input: ChildAutoMap): void {
        for (const destination of Object.keys(input.items.properties ?? {})) this.autoMapProperty(destination, input);
    }

    private autoMapProperty(destination: string, { items, eventSchema, properties, path, key }: ChildAutoMap): void {
        if (Object.keys(properties).some(name => name.toLowerCase() === destination.toLowerCase())) return;
        const candidates = Object.keys(eventSchema.properties ?? {}).filter(source => source.toLowerCase() === destination.toLowerCase());
        if (!candidates.length) return;
        const mappingPath = `${path}.AutoMap.${destination}`;
        if (destination === this.child.IdentifiedBy) {
            if (candidates.length !== 1 || candidates[0] !== key) {
                this.reject(mappingPath, `AutoMap into the child identifier ${kernelBacked}`);
            }
            // Changeset.AddChild initializes the identifier from this same key.
            return;
        }
        if (candidates.length > 1) this.reject(mappingPath, `inferred AutoMap source is ambiguous: ${candidates.join(', ')}`);
        this.context.checkMapping(items, eventSchema, destination, candidates[0], mappingPath);
    }
}
