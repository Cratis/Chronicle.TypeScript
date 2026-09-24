// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { Constructor } from '@cratis/fundamentals';
import { ReadModelId } from './ReadModelId.js';
import { DecoratorType, TypeDiscoverer, TypeIntrospector } from '../types/index.js';
import { JsonSchema, JsonSchemaGenerator } from '../schemas/index.js';
import { ChronicleClassDecorator, requireCompletedStandardMetadata } from '../types/standardDecoratorMetadata.js';

/** Metadata key used to store read model information on a class. */
const READ_MODEL_METADATA_KEY = 'chronicle:readModel';

/**
 * Metadata stored on a read model class.
 */
export interface ReadModelMetadata {
    /** The unique identifier for the read model. */
    readonly id: ReadModelId;

    /** The reflected members and their runtime types. */
    readonly members: ReadonlyMap<string, Function | undefined>;

    /** The generated JSON schema for the read model. */
    readonly schema: JsonSchema;
}

/**
 * TypeScript decorator that marks a class as a read model and captures reflection metadata.
 * @param id - The unique identifier for the read model. Defaults to the class name if omitted.
 * @returns A class decorator.
 */
export function readModel(id: string = ''): ChronicleClassDecorator {
    return (target: object, context?: ClassDecoratorContext) => {
        const constructor = target as Function;
        const readModelId = new ReadModelId(id || constructor.name);
        const members = context?.kind === 'class' ? undefined : TypeIntrospector.getMembers(constructor);
        let resolved: { members: ReadonlyMap<string, Function | undefined>; schema: JsonSchema } | undefined;
        const resolve = () => {
            requireCompletedStandardMetadata(constructor);
            if (!resolved) {
                const members = TypeIntrospector.getMembers(constructor);
                resolved = { members, schema: JsonSchemaGenerator.generate(constructor, members, true) };
            }
            return resolved;
        };
        const metadata: ReadModelMetadata = context?.kind === 'class' ? {
            id: readModelId,
            get members() {
                return resolve().members;
            },
            get schema() {
                return resolve().schema;
            }
        } : {
            id: readModelId,
            members: members!,
            schema: JsonSchemaGenerator.generate(constructor, members)
        };
        Reflect.defineMetadata(READ_MODEL_METADATA_KEY, metadata, target);
        TypeDiscoverer.default.register(
            DecoratorType.ReadModel,
            constructor as Constructor,
            readModelId.value
        );
    };
}

/**
 * Gets the {@link ReadModelMetadata} associated with a class decorated with {@link readModel}.
 * @param target - The class constructor to retrieve metadata for.
 * @returns The associated metadata, or undefined if not decorated.
 */
export function getReadModelMetadata(target: Function): ReadModelMetadata | undefined {
    return Reflect.getMetadata(READ_MODEL_METADATA_KEY, target);
}

/**
 * Checks whether a class has been decorated with {@link readModel}.
 * @param target - The class constructor to check.
 * @returns True if the class has a read model decorator; false otherwise.
 */
export function isReadModel(target: Function): boolean {
    return Reflect.hasMetadata(READ_MODEL_METADATA_KEY, target);
}
