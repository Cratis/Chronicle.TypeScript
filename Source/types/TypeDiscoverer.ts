// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import path from 'path';
import { DecoratorType } from './DecoratorType.js';
import { Constructor } from '@cratis/fundamentals';
import { TypeIntrospector } from './TypeIntrospector.js';
import { hasPropertyMetadata } from './propertyDecoratorMetadata.js';

type GlobFunction = (pattern: string | string[], options?: { ignore: string[] }) => Promise<string[]>;
type FileImporter = (filePath: string) => Promise<unknown>;

const modelBoundPropertyKeys = [
    'setFrom', 'setFromContext', 'setValue', 'addFrom', 'subtractFrom',
    'increment', 'decrement', 'count', 'childrenFrom', 'join', 'fromEvery', 'fromAll'
].map(name => `chronicle:projection:${name}`);

/** Identifies models whose event mappings live on their properties rather than on @fromEvent. */
export function hasModelBoundProperties(type: Function): boolean {
    return TypeIntrospector.getTrackedProperties(type).some(property =>
        modelBoundPropertyKeys.some(key => hasPropertyMetadata(key, type.prototype, property)));
}

/**
 * Encapsulates discovery and registry operations for decorator-based artifacts.
 */
export class TypeDiscoverer {
    /** Shared default discoverer instance. */
    static readonly default = new TypeDiscoverer();

    private static readonly _registeredTypes: Map<DecoratorType, Map<string, Constructor>> = new Map();

    private readonly _glob: GlobFunction;
    private readonly _importFile: FileImporter;

    /**
     * Initializes a new instance of the {@link TypeDiscoverer} class.
     * @param glob - Optional glob function used to resolve file paths.
     * @param importFile - Optional importer used to load discovered files.
     */
    constructor(glob?: GlobFunction, importFile?: FileImporter) {
        this._glob = glob ?? TypeDiscoverer.resolveWithGlobPackage;
        this._importFile = importFile ?? TypeDiscoverer.importDiscoveredFile;
    }

    /**
     * Discovers and imports all files matching one or more glob patterns.
     * @param pattern - One or more file glob patterns.
     */
    async discover(pattern: string | string[]): Promise<void> {
        const patterns = Array.isArray(pattern) ? pattern : [pattern];
        const included = patterns.filter(pattern => !pattern.startsWith('!'));
        const excluded = patterns.filter(pattern => pattern.startsWith('!')).map(pattern => pattern.slice(1));
        const ignore = excluded.flatMap(pattern => [pattern, `${pattern}/**`]);
        const files = await this._glob(included, { ignore });
        for (const file of files) {
            const filePath = path.resolve(file);
            let module: unknown;
            try {
                module = await this._importFile(filePath);
            } catch (error) {
                throw new Error(`Could not import discovered file '${filePath}'.`, { cause: error });
            }
            if (module && typeof module === 'object') {
                for (const type of Object.values(module)) {
                    if (typeof type !== 'function' || !type.prototype) continue;
                    if (hasModelBoundProperties(type)) {
                        this.register(DecoratorType.ReadModel, type as Constructor);
                    }
                }
            }
        }
    }

    /**
     * Registers a discoverable type for a decorator category.
     * @param decoratorType - The decorator category to register for.
     * @param type - The type constructor to register.
     * @param name - Optional explicit discovery name for the type.
     */
    register(decoratorType: DecoratorType, type: Constructor, name?: string): void {
        const discoveredName = name ?? type.name;
        const typesForDecorator = TypeDiscoverer._registeredTypes.get(decoratorType) ?? new Map<string, Constructor>();
        if (decoratorType === DecoratorType.ReadModel) {
            const previous = Array.from(typesForDecorator).find(([, registered]) => registered === type);
            if (previous && previous[0] !== discoveredName) {
                // An explicit legacy registration overrides the type-name alias registered by an observer.
                if (previous[0] !== type.name) return;
                typesForDecorator.delete(previous[0]);
            }
        }
        let key = discoveredName;
        if (decoratorType === DecoratorType.ReadModel && typesForDecorator.has(key) && typesForDecorator.get(key) !== type &&
            !(type.prototype instanceof typesForDecorator.get(key)!)) {
            let suffix = 2;
            while (typesForDecorator.has(`${discoveredName}#${suffix}`)) suffix++;
            key = `${discoveredName}#${suffix}`;
        }
        typesForDecorator.set(key, type);
        TypeDiscoverer._registeredTypes.set(decoratorType, typesForDecorator);
    }

    /**
     * Gets all registered types for a decorator category.
     * @param decoratorType - The decorator category to retrieve types for.
     * @returns The registered types.
     */
    getTypesByDecoratorType(decoratorType: DecoratorType): Constructor[] {
        return Array.from((TypeDiscoverer._registeredTypes.get(decoratorType) ?? new Map()).values());
    }

    /**
     * Gets a registered type by decorator category and name.
     * @param decoratorType - The decorator category to resolve.
     * @param name - The registered name of the type.
     * @returns The matching type, if any.
     */
    getTypeByDecoratorTypeAndName(decoratorType: DecoratorType, name: string): Constructor | undefined {
        return TypeDiscoverer._registeredTypes.get(decoratorType)?.get(name);
    }

    /**
     * Clears all registered types.
     * Primarily intended for test isolation.
     */
    clear(): void {
        TypeDiscoverer._registeredTypes.clear();
    }

    private static async resolveWithGlobPackage(pattern: string | string[], options?: { ignore: string[] }): Promise<string[]> {
        let globFunction: unknown;
        try {
            const globModule = await import('glob') as { glob?: unknown };
            globFunction = globModule.glob;
        } catch {
            throw new Error('Could not load a compatible "glob" function for type discovery.');
        }

        if (typeof globFunction !== 'function') {
            throw new Error('The "glob" module was loaded but does not export a function named "glob".');
        }

        const files = await globFunction(pattern, options);
        if (!Array.isArray(files) || files.some(file => typeof file !== 'string')) {
            throw new Error('Type discovery glob resolution did not return an array of file paths.');
        }

        return files;
    }

    private static async importDiscoveredFile(filePath: string): Promise<unknown> {
        return await import(filePath);
    }
}
