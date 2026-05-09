// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

/** Metadata key for tracked schema properties on a target type. */
const TRACKED_PROPERTIES_METADATA_KEY = 'chronicle:typeIntrospection:properties';

/**
 * Provides reflection-based type introspection utilities for decorated Chronicle artifacts.
 */
export class TypeIntrospector {
    /**
     * Tracks a property name on a type so it can be included in reflection-based introspection.
     * @param target - The class constructor to track the property for.
     * @param propertyName - The property name to track.
     */
    static trackProperty(target: Function, propertyName: string): void {
        const trackedProperties = this.getTrackedProperties(target);
        if (trackedProperties.includes(propertyName)) {
            return;
        }

        Reflect.defineMetadata(TRACKED_PROPERTIES_METADATA_KEY, [...trackedProperties, propertyName], target);
    }

    /**
     * Gets all tracked properties for a type.
     * @param target - The class constructor to inspect.
     * @returns The tracked property names.
     */
    static getTrackedProperties(target: Function): string[] {
        return Reflect.getMetadata(TRACKED_PROPERTIES_METADATA_KEY, target) ?? [];
    }

    /**
     * Gets members and their runtime types for a class.
     * Members are discovered from tracked properties and constructor parameters.
     * @param target - The class constructor to inspect.
     * @returns A map of member name to runtime type.
     */
    static getMembers(target: Function): Map<string, Function | undefined> {
        const members = new Map<string, Function | undefined>();

        for (const property of this.getTrackedProperties(target)) {
            const runtimeType = Reflect.getMetadata('design:type', target.prototype, property) as Function | undefined;
            members.set(property, runtimeType);
        }

        const constructorParameterNames = this.getConstructorParameterNames(target);
        const constructorParameterTypes = Reflect.getMetadata('design:paramtypes', target) as Function[] | undefined ?? [];

        for (let index = 0; index < constructorParameterNames.length; index++) {
            const parameterName = constructorParameterNames[index];
            if (members.has(parameterName)) {
                continue;
            }

            members.set(parameterName, constructorParameterTypes[index]);
        }

        return members;
    }

    private static getConstructorParameterNames(target: Function): string[] {
        const source = target.toString();
        const constructorKeyword = 'constructor(';
        const constructorStart = source.indexOf(constructorKeyword);
        if (constructorStart < 0) {
            return [];
        }

        let index = constructorStart + constructorKeyword.length;
        let depth = 1;
        let parameterSegment = '';
        while (index < source.length && depth > 0) {
            const character = source[index];
            if (character === '(') {
                depth++;
                parameterSegment += character;
            } else if (character === ')') {
                depth--;
                if (depth > 0) {
                    parameterSegment += character;
                }
            } else {
                parameterSegment += character;
            }
            index++;
        }

        const names: string[] = [];
        let current = '';
        for (const character of parameterSegment) {
            if (character === ',') {
                const candidate = current.trim();
                if (candidate.length > 0) {
                    names.push(candidate);
                }
                current = '';
            } else {
                current += character;
            }
        }

        const lastCandidate = current.trim();
        if (lastCandidate.length > 0) {
            names.push(lastCandidate);
        }

        return names
            .map(name => this.extractParameterName(name))
            .filter(name => name.length > 0);
    }

    private static extractParameterName(rawParameter: string): string {
        if (/[{}\[\]]/.test(rawParameter)) {
            return '';
        }

        const withoutRest = rawParameter.startsWith('...') ? rawParameter.substring(3) : rawParameter;
        const equalsIndex = withoutRest.indexOf('=');
        const withoutDefaultValue = equalsIndex >= 0 ? withoutRest.substring(0, equalsIndex) : withoutRest;
        const colonIndex = withoutDefaultValue.indexOf(':');
        const withoutTypeAnnotation = colonIndex >= 0
            ? withoutDefaultValue.substring(0, colonIndex)
            : withoutDefaultValue;
        return withoutTypeAnnotation.trim();
    }
}
