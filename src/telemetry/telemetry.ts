// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// eslint-disable-next-line @typescript-eslint/no-require-imports
import cloneDeep = require('lodash/cloneDeep');
import { Uri } from 'vscode';
import { Resource } from '../platform/common/types';
import { IInterpreterPackages, ResourceSpecificTelemetryProperties } from './types';
import { getTelemetrySafeHashedString } from './helpers';
import { PythonEnvironment } from '../platform/pythonEnvironments/info';
import { createDeferred } from '../platform/common/utils/async';
import { getResourceType } from '../platform/common/utils';
import { IServiceContainer } from '../platform/ioc/types';
import { getComparisonKey } from '../platform/vscode-path/resources';

type Context = {
    previouslySelectedKernelConnectionId: string;
};
export const trackedInfo = new Map<string, [ResourceSpecificTelemetryProperties, Context]>();
export const pythonEnvironmentsByHash = new Map<string, PythonEnvironment>();
let globalContainer: IServiceContainer | undefined = undefined;

export function initializeGlobals(serviceContainer: IServiceContainer) {
    globalContainer = serviceContainer;
}

/**
 * The python package information is fetch asynchronously.
 * Its possible the information is available at a later time.
 * Use this to update with the latest information (if available)
 */
export function updatePythonPackages(
    currentData: ResourceSpecificTelemetryProperties & { waitBeforeSending?: Promise<void> },
    clonedCurrentData?: ResourceSpecificTelemetryProperties & {
        waitBeforeSending?: Promise<void>;
    }
) {
    if (!currentData.pythonEnvironmentPath) {
        return;
    }
    // Getting package information is async, hence update property to indicate that a promise is pending.
    const deferred = createDeferred<void>();
    // Hold sending of telemetry until we have updated the props with package information.
    currentData.waitBeforeSending = deferred.promise;
    if (clonedCurrentData) {
        clonedCurrentData.waitBeforeSending = deferred.promise;
    }
    getPythonEnvironmentPackages({
        interpreterHash: currentData.pythonEnvironmentPath
    })
        .then((packages) => {
            currentData.pythonEnvironmentPackages = packages || currentData.pythonEnvironmentPackages;
            if (clonedCurrentData) {
                clonedCurrentData.pythonEnvironmentPackages = packages || clonedCurrentData.pythonEnvironmentPackages;
            }
        })
        .catch(() => undefined)
        .finally(() => {
            deferred.resolve();
            currentData.waitBeforeSending = undefined;
            if (clonedCurrentData) {
                clonedCurrentData.waitBeforeSending = undefined;
            }
        });
}
/**
 * Gets a JSON with hashed keys of some python packages along with their versions.
 */
async function getPythonEnvironmentPackages(options: { interpreter: PythonEnvironment } | { interpreterHash: string }) {
    let interpreter: PythonEnvironment | undefined;
    if ('interpreter' in options) {
        interpreter = options.interpreter;
    } else {
        interpreter = pythonEnvironmentsByHash.get(options.interpreterHash);
    }
    if (!interpreter) {
        return '{}';
    }
    const intepreterPackages = globalContainer?.get<IInterpreterPackages>(IInterpreterPackages);
    const packages = intepreterPackages
        ? await intepreterPackages.getPackageVersions(interpreter).catch(() => new Map<string, string>())
        : new Map<string, string>();
    if (!packages || packages.size === 0) {
        return '{}';
    }
    return JSON.stringify(Object.fromEntries(packages));
}
export function deleteTrackedInformation(resource: Uri) {
    trackedInfo.delete(getComparisonKey(resource));
}

/**
 * Always return a clone of the properties.
 * We will be using a reference of this object elsewhere & adding properties to the object.
 */
export function getContextualPropsForTelemetry(
    resource: Resource
): ResourceSpecificTelemetryProperties & { waitBeforeSendingTelemetry?: Promise<void> } {
    if (!resource) {
        return {};
    }
    const data = trackedInfo.get(getComparisonKey(resource));
    const resourceType = getResourceType(resource);
    if (!data && resourceType) {
        return {
            resourceType,
            resourceHash: resource ? getTelemetrySafeHashedString(resource.toString()) : undefined
        };
    }
    if (!data) {
        return {};
    }
    // Create a copy of this data as it gets updated later asynchronously for other events.
    // At the point of sending this telemetry we don't want it to change again.
    const clonedData = cloneDeep(data[0]);
    // Possible the Python package information is now available, update the properties accordingly.
    // We want to update both the data items with package information
    // 1. Data we track against the Uri.
    // 2. Data that is returned & sent via telemetry now
    updatePythonPackages(data[0], clonedData);
    return clonedData;
}
