/* eslint-disable @typescript-eslint/no-use-before-define */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable, inject } from 'inversify';
import { IFileSystemNode } from '../../platform/common/platform/types.node';
import { IExtensionContext, IHttpClient } from '../../platform/common/types';
import { IKernel } from '../types';
import { IIPyWidgetScriptManager, IIPyWidgetScriptManagerFactory, INbExtensionsPathProvider } from './types';
import { RemoteIPyWidgetScriptManager } from './remoteIPyWidgetScriptManager';
import { LocalIPyWidgetScriptManager } from './localIPyWidgetScriptManager.node';

@injectable()
export class IPyWidgetScriptManagerFactory implements IIPyWidgetScriptManagerFactory {
    private readonly managers = new WeakMap<IKernel, IIPyWidgetScriptManager>();
    constructor(
        @inject(INbExtensionsPathProvider) private readonly nbExtensionsPathProvider: INbExtensionsPathProvider,
        @inject(IFileSystemNode) private readonly fs: IFileSystemNode,
        @inject(IExtensionContext) private readonly context: IExtensionContext,
        @inject(IHttpClient) private readonly httpClient: IHttpClient
    ) {}
    getOrCreate(kernel: IKernel): IIPyWidgetScriptManager {
        if (!this.managers.has(kernel)) {
            if (
                kernel.kernelConnectionMetadata.kind === 'connectToLiveRemoteKernel' ||
                kernel.kernelConnectionMetadata.kind === 'startUsingRemoteKernelSpec'
            ) {
                this.managers.set(kernel, new RemoteIPyWidgetScriptManager(kernel, this.httpClient, this.context));
            } else {
                this.managers.set(
                    kernel,
                    new LocalIPyWidgetScriptManager(kernel, this.fs, this.nbExtensionsPathProvider, this.context)
                );
            }
        }
        return this.managers.get(kernel)!;
    }
}
