// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import path from 'path';
import { DecoratorType } from './DecoratorType';
import { DiscoverableType } from './DiscoverableType';

type GlobFunction = (pattern: string) => Promise<string[]>;
type FileImporter = (filePath: string) => Promise<unknown>;

/**
 * Encapsulates discovery and registry operations for decorator-based artifacts.
 */
export class TypeDiscoverer {
    /** Shared default discoverer instance. */
    static readonly default = new TypeDiscoverer();

    private static readonly _registeredTypes: Map<DecoratorType, Map<string, DiscoverableType>> = new Map();

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
        for (const currentPattern of patterns) {
            const files = await this._glob(currentPattern);
            for (const file of files) {
                await this._importFile(path.resolve(file));
            }
        }
    }

    /**
     * Registers a discoverable type for a decorator category.
     * @param decoratorType - The decorator category to register for.
     * @param type - The type constructor to register.
     * @param name - Optional explicit discovery name for the type.
     */
    register(decoratorType: DecoratorType, type: DiscoverableType, name?: string): void {
        const discoveredName = name ?? type.name;
        const typesForDecorator = TypeDiscoverer._registeredTypes.get(decoratorType) ?? new Map<string, DiscoverableType>();
        typesForDecorator.set(discoveredName, type);
        TypeDiscoverer._registeredTypes.set(decoratorType, typesForDecorator);
    }

    /**
     * Gets all registered types for a decorator category.
     * @param decoratorType - The decorator category to retrieve types for.
     * @returns The registered types.
     */
    getTypesByDecoratorType(decoratorType: DecoratorType): DiscoverableType[] {
        return Array.from((TypeDiscoverer._registeredTypes.get(decoratorType) ?? new Map()).values());
    }

    /**
     * Gets a registered type by decorator category and name.
     * @param decoratorType - The decorator category to resolve.
     * @param name - The registered name of the type.
     * @returns The matching type, if any.
     */
    getTypeByDecoratorTypeAndName(decoratorType: DecoratorType, name: string): DiscoverableType | undefined {
        return TypeDiscoverer._registeredTypes.get(decoratorType)?.get(name);
    }

    /**
     * Clears all registered types.
     * Primarily intended for test isolation.
     */
    clear(): void {
        TypeDiscoverer._registeredTypes.clear();
    }

    private static async resolveWithGlobPackage(pattern: string): Promise<string[]> {
        const globModule = require('glob') as { glob?: unknown };
        const glob = globModule.glob;
        if (typeof glob !== 'function') {
            throw new Error('Could not load a compatible "glob" function for type discovery.');
        }

        const files = await glob(pattern);
        if (!Array.isArray(files) || files.some(file => typeof file !== 'string')) {
            throw new Error('Type discovery glob resolution did not return an array of file paths.');
        }

        return files;
    }

    private static async importDiscoveredFile(filePath: string): Promise<unknown> {
        return await import(filePath);
    }
}
