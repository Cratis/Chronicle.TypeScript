// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { Constructor } from '@cratis/fundamentals';
import { DecoratorType, TypeDiscoverer } from '../../../types/index.js';
import type { ChronicleClassDecorator } from '../../../types/standardDecoratorMetadata.js';
import type { ViewOfMetadata } from './ViewOfMetadata.js';
import type { ViewOfOptions } from './ViewOfOptions.js';

const METADATA_KEY = 'chronicle:graph:view';

/**
 * Class decorator that marks a class as a view over a property graph. A view is a read model that is anchored at one
 * node. Its members are properties of that node (viewKey and viewProperty), relations along declared edges to other
 * views (follows) and properties of the edge that was followed (fromEdge). Name the graph with the graph decorator.
 * A view only declares what is read; the class is never a node or an edge.
 * @param root - A function returning the class of the node the view is anchored at. It is resolved when the views
 * are validated, so the classes can be declared in any order.
 * @param options - The name of the view, which defaults to the name of the class.
 * @returns A class decorator.
 */
export function viewOf(root: () => Function, options: ViewOfOptions = {}): ChronicleClassDecorator {
    return (target: object) => {
        const type = target as Function;
        const metadata: ViewOfMetadata = { root, name: options.name ?? type.name };
        Reflect.defineMetadata(METADATA_KEY, metadata, target);

        // Discovery is keyed by name. Views of different graphs may share a class name, so they must not replace each other.
        const registered = TypeDiscoverer.default.getTypesByDecoratorType(DecoratorType.GraphView);
        if (!registered.includes(type as Constructor)) {
            let key = type.name;
            let suffix = 2;
            while (TypeDiscoverer.default.getTypeByDecoratorTypeAndName(DecoratorType.GraphView, key) !== undefined) {
                key = `${type.name}#${suffix++}`;
            }

            TypeDiscoverer.default.register(DecoratorType.GraphView, type as Constructor, key);
        }
    };
}

/**
 * Retrieves the metadata stored by the viewOf decorator.
 * @param target - The class constructor.
 * @returns The metadata, or undefined when the class is not a view.
 */
export function getViewOfMetadata(target: Function): ViewOfMetadata | undefined {
    return Reflect.getMetadata(METADATA_KEY, target) as ViewOfMetadata | undefined;
}
