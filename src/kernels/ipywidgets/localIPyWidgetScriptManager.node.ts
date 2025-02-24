// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from '../../platform/vscode-path/path';
import { Uri } from 'vscode';
import { IFileSystemNode } from '../../platform/common/platform/types.node';
import { IExtensionContext } from '../../platform/common/types';
import { StopWatch } from '../../platform/common/utils/stopWatch';
import { sendTelemetryEvent, Telemetry } from '../../telemetry';
import { getTelemetrySafeHashedString } from '../../telemetry/helpers';
import { IKernel } from '../types';
import { BaseIPyWidgetScriptManager } from './baseIPyWidgetScriptManager';
import { IIPyWidgetScriptManager, INbExtensionsPathProvider } from './types';

type KernelConnectionId = string;
/**
 * IPyWidgets have a single entry point in requirejs as follows:
 * - beakerx -> nbextensions/beakerx-widget/some-index.js
 * When rendering the widget, requirejs will end up loading the some-index.js in the renderer.
 * However, in some cases the file some-index.js will end up loading more static resources such as png files or other js files.
 * And some of these are loaded with the http request = `<document.body['data-base-url'] + 'nbextensions/beakerx-widget/save.png'`
 * For this to work:
 * - We need to ensure the `data-base-url` attribute is added to the body element, & that's retrieved via getBaseUrl
 * - We need to ensure all of the folders & files from `<python env>/share/jupyter/nbextensions` are copied into a location
 * in the extension folder so that it can be accessed via the webview.
 */
export class LocalIPyWidgetScriptManager extends BaseIPyWidgetScriptManager implements IIPyWidgetScriptManager {
    /**
     * Copy once per session of VS Code or until user restarts the kernel.
     */
    private sourceNbExtensionsPath?: Uri;
    private overwriteExistingFiles = true;
    static nbExtensionsCopiedKernelConnectionList = new Set<KernelConnectionId>();
    constructor(
        kernel: IKernel,
        private readonly fs: IFileSystemNode,
        private readonly nbExtensionsPathProvider: INbExtensionsPathProvider,
        private readonly context: IExtensionContext
    ) {
        super(kernel);
        // When re-loading VS Code, always overwrite the files.
        this.overwriteExistingFiles = !LocalIPyWidgetScriptManager.nbExtensionsCopiedKernelConnectionList.has(
            kernel.kernelConnectionMetadata.id
        );
    }
    public getBaseUrl() {
        return this.getNbExtensionsParentPath();
    }
    protected async getNbExtensionsParentPath(): Promise<Uri | undefined> {
        let overwrite = this.overwriteExistingFiles;

        try {
            const stopWatch = new StopWatch();
            this.sourceNbExtensionsPath = await this.nbExtensionsPathProvider.getNbExtensionsParentPath(this.kernel);
            if (!this.sourceNbExtensionsPath) {
                return;
            }
            const kernelHash = getTelemetrySafeHashedString(this.kernel.kernelConnectionMetadata.id);
            const baseUrl = Uri.joinPath(this.context.extensionUri, 'tmp', 'scripts', kernelHash, 'jupyter');
            const targetNbExtensions = Uri.joinPath(baseUrl, 'nbextensions');
            await this.fs.ensureLocalDir(targetNbExtensions.fsPath);
            await this.fs.copyLocal(
                Uri.joinPath(this.sourceNbExtensionsPath, 'nbextensions').fsPath,
                targetNbExtensions.fsPath,
                { overwrite }
            );
            // If we've copied once, then next time, don't overwrite.
            this.overwriteExistingFiles = false;
            LocalIPyWidgetScriptManager.nbExtensionsCopiedKernelConnectionList.add(
                this.kernel.kernelConnectionMetadata.id
            );
            sendTelemetryEvent(Telemetry.IPyWidgetNbExtensionCopyTime, stopWatch.elapsedTime);
            return baseUrl;
        } catch (ex) {
            sendTelemetryEvent(Telemetry.IPyWidgetNbExtensionCopyTime, undefined, undefined, ex);
            throw ex;
        }
    }
    protected async getWidgetEntryPoints(): Promise<{ uri: Uri; widgetFolderName: string }[]> {
        const [sourceNbExtensionsPath] = await Promise.all([
            this.nbExtensionsPathProvider.getNbExtensionsParentPath(this.kernel)
        ]);
        if (!sourceNbExtensionsPath) {
            return [];
        }

        // Get all of the widget entry points, which would be of the form `nbextensions/<widget folder>/extension.js`
        const nbExtensionsFolder = Uri.joinPath(sourceNbExtensionsPath, 'nbextensions');
        const extensions = await this.fs.searchLocal('*/extension.js', nbExtensionsFolder.fsPath, true);
        return extensions.map((entry) => ({
            uri: Uri.joinPath(nbExtensionsFolder, entry),
            widgetFolderName: path.dirname(entry)
        }));
    }
    protected getWidgetScriptSource(source: Uri): Promise<string> {
        return this.fs.readLocalFile(source.fsPath);
    }
}
