// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Uri } from 'vscode';
import { INotebookServer } from '../../kernels/jupyter/types';
import { IJupyterConnection, IJupyterSession } from '../../kernels/types';
import { TemporaryFile } from '../../platform/common/platform/types';

export class MockJupyterServer implements INotebookServer {
    constructor(public connection: IJupyterConnection) {}
    private notebookFile: TemporaryFile | undefined;

    public async createNotebook(_resource: Uri): Promise<IJupyterSession> {
        throw new Error('Not implemented');
    }
    public async dispose(): Promise<void> {
        if (this.connection) {
            this.connection.dispose(); // This should kill the process that's running
        }
        if (this.notebookFile) {
            this.notebookFile.dispose(); // This destroy any unwanted kernel specs if necessary
            this.notebookFile = undefined;
        }
    }
}
