// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
suite('Dummy11', () => {
    test('dummy11', () => {
        //
    });
});
// // Copyright (c) Microsoft Corporation. All rights reserved.
// // Licensed under the MIT License.
// 'use strict';
// import { ReactWrapper } from 'enzyme';
// import * as React from 'react';
// import * as AdazzleReactDataGrid from 'react-data-grid';
// import { Disposable } from 'vscode';
// import { sleep } from '../../platform/common/utils/async';
// import { InteractiveWindowMessages } from '../../platform/datascience/interactive-common/interactiveWindowTypes';
// import { IJupyterVariable } from '../../platform/datascience/types';
// import { DataScienceIocContainer } from './dataScienceIocContainer';
// import { addCode, getOrCreateInteractiveWindow } from './interactiveWindowTestHelpers';
// import { addCell, createNewEditor } from './nativeEditorTestHelpers';
// import { openVariableExplorer, runDoubleTest, runInteractiveTest, waitForVariablesUpdated } from './testHelpers';
// import { verifyAfterStep, verifyCanFetchData, verifyVariables } from './variableTestHelpers';

// /* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */
// const rangeInclusive = require('range-inclusive');

// /* eslint-disable , comma-dangle, @typescript-eslint/no-explicit-any, no-multi-str */
// [false, true].forEach((runByLine) => {
//     suite(`DataScience Interactive Window variable explorer tests with RunByLine set to ${runByLine}`, () => {
//         const disposables: Disposable[] = [];
//         let ioc: DataScienceIocContainer;
//         let createdNotebook = false;

//         suiteSetup(function () {
//             // These test require python, so only run with a non-mocked jupyter
//             const isRollingBuild = process.env ? process.env.VSC_FORCE_REAL_JUPYTER !== undefined : false;
//             if (!isRollingBuild) {
//                 // eslint-disable-next-line no-console
//                 console.log('Skipping Variable Explorer tests. Requires python environment');
//                 // eslint-disable-next-line no-invalid-this
//                 this.skip();
//             }
//         });
//         setup(async () => {
//             ioc = new DataScienceIocContainer();
//             ioc.registerDataScienceTypes();
//             createdNotebook = false;
//             await ioc.activate();
//         });

//         teardown(async () => {
//             for (const disposable of disposables) {
//                 if (!disposable) {
//                     continue;
//                 }
//                 // eslint-disable-next-line @typescript-eslint/no-explicit-any
//                 const promise = disposable.dispose() as Promise<any>;
//                 if (promise) {
//                     await promise;
//                 }
//             }
//             await ioc.dispose();
//         });

//         async function addCodeImpartial(
//             wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
//             code: string,
//             waitForVariables: boolean = true,
//             waitForVariablesCount: number = 1,
//             expectError: boolean = false
//         ): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
//             wrapper.update();
//             await sleep(100); // Give wrapper time to update.
//             const nodes = wrapper.find('InteractivePanel');
//             if (nodes.length > 0) {
//                 const variablesUpdated = waitForVariables
//                     ? waitForVariablesUpdated(ioc.getInteractiveWebPanel(undefined), waitForVariablesCount)
//                     : Promise.resolve();
//                 const result = await addCode(ioc, code, expectError);
//                 await variablesUpdated;
//                 return result;
//             } else {
//                 // For the native editor case, we need to create an editor before hand.
//                 if (!createdNotebook) {
//                     await createNewEditor(ioc);
//                     createdNotebook = true;
//                 }
//                 const variablesUpdated = waitForVariables
//                     ? waitForVariablesUpdated(ioc.getNativeWebPanel(undefined), waitForVariablesCount)
//                     : Promise.resolve();
//                 await addCell(ioc.getNativeWebPanel(undefined), code, true);
//                 await variablesUpdated;
//                 return wrapper;
//             }
//         }

//         runInteractiveTest(
//             'Variable explorer - Exclude',
//             async () => {
//                 const basicCode: string = `import numpy as np
// import pandas as pd
// value = 'hello world'`;
//                 const basicCode2: string = `value2 = 'hello world 2'`;

//                 const { mount } = await getOrCreateInteractiveWindow(ioc);
//                 const wrapper = mount.wrapper;

//                 openVariableExplorer(wrapper);

//                 await addCodeImpartial(wrapper, 'a=1\na');
//                 await addCodeImpartial(wrapper, basicCode, true);

//                 // We should show a string and show an int, the modules should be hidden
//                 let targetVariables: IJupyterVariable[] = [
//                     {
//                         name: 'a',
//                         value: '1',
//                         supportsDataExplorer: false,
//                         type: 'int',
//                         size: 54,
//                         shape: '',
//                         count: 0,
//                         truncated: false
//                     },
//                     // eslint-disable-next-line @typescript-eslint/quotes
//                     {
//                         name: 'value',
//                         value: 'hello world',
//                         supportsDataExplorer: false,
//                         type: 'str',
//                         size: 54,
//                         shape: '',
//                         count: 0,
//                         truncated: false
//                     }
//                 ];
//                 verifyVariables(wrapper, targetVariables);

//                 // Update our exclude list to exclude strings
//                 ioc.forceDataScienceSettingsChanged({
//                     variableExplorerExclude: `${ioc.getSettings().variableExplorerExclude};str`
//                 });

//                 // Add another string and check our vars, strings should be hidden
//                 await addCodeImpartial(wrapper, basicCode2, true);

//                 targetVariables = [
//                     {
//                         name: 'a',
//                         value: '1',
//                         supportsDataExplorer: false,
//                         type: 'int',
//                         size: 54,
//                         shape: '',
//                         count: 0,
//                         truncated: false
//                     }
//                 ];
//                 verifyVariables(wrapper, targetVariables);
//             },
//             () => {
//                 return Promise.resolve(ioc);
//             }
//         );

//         runInteractiveTest(
//             'Variable explorer - Update',
//             async () => {
//                 const basicCode: string = `value = 'hello world'`;
//                 const basicCode2: string = `value2 = 'hello world 2'`;

//                 const { mount } = await getOrCreateInteractiveWindow(ioc);
//                 const wrapper = mount.wrapper;

//                 openVariableExplorer(wrapper);

//                 await addCodeImpartial(wrapper, 'a=1\na');

//                 // Check that we have just the 'a' variable
//                 let targetVariables: IJupyterVariable[] = [
//                     {
//                         name: 'a',
//                         value: '1',
//                         supportsDataExplorer: false,
//                         type: 'int',
//                         size: 54,
//                         shape: '',
//                         count: 0,
//                         truncated: false
//                     }
//                 ];
//                 verifyVariables(wrapper, targetVariables);

//                 // Add another variable and check it
//                 await addCodeImpartial(wrapper, basicCode, true);

//                 targetVariables = [
//                     {
//                         name: 'a',
//                         value: '1',
//                         supportsDataExplorer: false,
//                         type: 'int',
//                         size: 54,
//                         shape: '',
//                         count: 0,
//                         truncated: false
//                     },
//                     {
//                         name: 'value',
//                         value: 'hello world',
//                         supportsDataExplorer: false,
//                         type: 'str',
//                         size: 54,
//                         shape: '',
//                         count: 0,
//                         truncated: false
//                     }
//                 ];
//                 verifyVariables(wrapper, targetVariables);

//                 // Add a second variable and check it
//                 await addCodeImpartial(wrapper, basicCode2, true);

//                 targetVariables = [
//                     {
//                         name: 'a',
//                         value: '1',
//                         supportsDataExplorer: false,
//                         type: 'int',
//                         size: 54,
//                         shape: '',
//                         count: 0,
//                         truncated: false
//                     },
//                     {
//                         name: 'value',
//                         value: 'hello world',
//                         supportsDataExplorer: false,
//                         type: 'str',
//                         size: 54,
//                         shape: '',
//                         count: 0,
//                         truncated: false
//                     },
//                     // eslint-disable-next-line @typescript-eslint/quotes
//                     {
//                         name: 'value2',
//                         value: 'hello world 2',
//                         supportsDataExplorer: false,
//                         type: 'str',
//                         size: 54,
//                         shape: '',
//                         count: 0,
//                         truncated: false
//                     }
//                 ];
//                 verifyVariables(wrapper, targetVariables);
//             },
//             () => {
//                 return Promise.resolve(ioc);
//             }
//         );

//         // Test our display of basic types. We render 8 rows by default so only 8 values per test
//         runInteractiveTest(
//             'Variable explorer - Types A',
//             async function () {
//                 const basicCode: string = `myList = [1, 2, 3]
// mySet = set([42])
// myDict = {'a': 1}
// myTuple = 1,2,3,4,5,6,7,8,9`;

//                 const { mount } = await getOrCreateInteractiveWindow(ioc);
//                 const wrapper = mount.wrapper;

//                 openVariableExplorer(wrapper);

//                 await addCodeImpartial(wrapper, 'a=1\na');
//                 // Variables are fetched in chunks of 5, we have six total here (including sys) so we need two variable fetches
//                 await addCodeImpartial(wrapper, basicCode, true, 2);

//                 const targetVariables: IJupyterVariable[] = [
//                     {
//                         name: 'a',
//                         value: '1',
//                         supportsDataExplorer: false,
//                         type: 'int',
//                         size: 54,
//                         shape: '',
//                         count: 0,
//                         truncated: false
//                     },
//                     // eslint-disable-next-line @typescript-eslint/quotes
//                     {
//                         name: 'myDict',
//                         value: "{'a': 1}",
//                         supportsDataExplorer: true,
//                         type: 'dict',
//                         size: 54,
//                         shape: '',
//                         count: 1,
//                         truncated: false
//                     },
//                     {
//                         name: 'myList',
//                         value: '[1, 2, 3]',
//                         supportsDataExplorer: true,
//                         type: 'list',
//                         size: 54,
//                         shape: '',
//                         count: 3,
//                         truncated: false
//                     },
//                     // Set can vary between python versions, so just don't both to check the value, just see that we got it
//                     {
//                         name: 'mySet',
//                         value: undefined,
//                         supportsDataExplorer: false,
//                         type: 'set',
//                         size: 54,
//                         shape: '',
//                         count: 1,
//                         truncated: false
//                     },
//                     {
//                         name: 'myTuple',
//                         value: '(1, 2, 3, 4, 5, 6, 7, 8, 9)',
//                         supportsDataExplorer: false,
//                         type: 'tuple',
//                         size: 54,
//                         shape: '9',
//                         count: 0,
//                         truncated: false
//                     }
//                 ];
//                 verifyVariables(wrapper, targetVariables);
//                 // Step into the first cell over again. Should have the same variables
//                 if (runByLine) {
//                     await verifyAfterStep(ioc, wrapper, () => {
//                         verifyVariables(wrapper, targetVariables);
//                         return Promise.resolve();
//                     });
//                 }

//                 // Restart the kernel and repeat
//                 const iw = await getOrCreateInteractiveWindow(ioc);

//                 const variablesComplete = iw.mount.waitForMessage(InteractiveWindowMessages.VariablesComplete);
//                 await iw.window.restartKernel();
//                 await variablesComplete; // Restart should cause a variable refresh

//                 // Should have no variables
//                 verifyVariables(wrapper, []);

//                 await addCodeImpartial(wrapper, 'a=1\na', true);
//                 await addCodeImpartial(wrapper, basicCode, true);

//                 verifyVariables(wrapper, targetVariables);
//                 // Step into the first cell over again. Should have the same variables
//                 if (runByLine) {
//                     await verifyAfterStep(ioc, wrapper, () => {
//                         verifyVariables(wrapper, targetVariables);
//                         return Promise.resolve();
//                     });
//                 }
//             },
//             () => {
//                 return Promise.resolve(ioc);
//             }
//         );

//         runInteractiveTest(
//             'Variable explorer - Basic B',
//             async () => {
//                 const basicCode: string = `import numpy as np
// import pandas as pd
// myComplex = complex(1, 1)
// myInt = 99999999
// myFloat = 9999.9999
// mynpArray = np.array([1.0, 2.0, 3.0])
// myDataframe = pd.DataFrame(mynpArray)
// mySeries = myDataframe[0]
// `;
//                 const { mount } = await getOrCreateInteractiveWindow(ioc);
//                 const wrapper = mount.wrapper;

//                 openVariableExplorer(wrapper);

//                 await addCodeImpartial(wrapper, 'a=1\na');
//                 // Variables are fetched in chunks of 5, so we need two variable fetches here
//                 await addCodeImpartial(wrapper, basicCode, true, 2);

//                 const targetVariables: IJupyterVariable[] = [
//                     {
//                         name: 'a',
//                         value: '1',
//                         supportsDataExplorer: false,
//                         type: 'int',
//                         size: 54,
//                         shape: '',
//                         count: 0,
//                         truncated: false
//                     },
//                     {
//                         name: 'myComplex',
//                         value: '(1+1j)',
//                         supportsDataExplorer: false,
//                         type: 'complex',
//                         size: 54,
//                         shape: '',
//                         count: 0,
//                         truncated: false
//                     },
//                     {
//                         name: 'myDataframe',
//                         value: `0
// 0 1.0
// 1 2.0
// 2 3.0`,
//                         supportsDataExplorer: true,
//                         type: 'DataFrame',
//                         size: 54,
//                         shape: '(3, 1)',
//                         count: 0,
//                         truncated: false
//                     },
//                     {
//                         name: 'myFloat',
//                         value: '9999.9999',
//                         supportsDataExplorer: false,
//                         type: 'float',
//                         size: 58,
//                         shape: '',
//                         count: 0,
//                         truncated: false
//                     },
//                     {
//                         name: 'myInt',
//                         value: '99999999',
//                         supportsDataExplorer: false,
//                         type: 'int',
//                         size: 56,
//                         shape: '',
//                         count: 0,
//                         truncated: false
//                     },
//                     {
//                         name: 'mynpArray',
//                         value: '[1. 2. 3.]',
//                         supportsDataExplorer: true,
//                         type: 'ndarray',
//                         size: 54,
//                         shape: '(3,)',
//                         count: 0,
//                         truncated: false
//                     },
//                     /* eslint-disable no-trailing-spaces */
//                     {
//                         name: 'mySeries',
//                         value: `0 1.0
// 1 2.0
// 2 3.0
// Name: 0, dtype: float64`,
//                         supportsDataExplorer: true,
//                         type: 'Series',
//                         size: 54,
//                         shape: '(3,)',
//                         count: 0,
//                         truncated: false
//                     }
//                 ];
//                 verifyVariables(wrapper, targetVariables);

//                 // Step into the first cell over again. Should have the same variables
//                 if (runByLine) {
//                     targetVariables[5].value = 'array([1., 2., 3.])'; // Debugger shows np array differently
//                     await verifyAfterStep(ioc, wrapper, () => {
//                         verifyVariables(wrapper, targetVariables);
//                         return Promise.resolve();
//                     });
//                 }
//             },
//             () => {
//                 return Promise.resolve(ioc);
//             }
//         );

//         function generateVar(v: number): IJupyterVariable {
//             const valueEntry = Math.pow(v, 2) % 17;
//             const expectedValue =
//                 valueEntry < 10
//                     ? `[${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, <...> , ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}]`
//                     : `[${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, <...> , ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}, ${valueEntry}]`;
//             return {
//                 name: `var${v}`,
//                 value: expectedValue,
//                 supportsDataExplorer: true,
//                 type: 'list',
//                 size: 54,
//                 shape: '',
//                 count: 100000,
//                 truncated: false
//             };
//         }

//         // Test our limits. Create 1050 items. Do this with both to make
//         // sure no perf problems with one or the other and to smoke test the native editor
//         runDoubleTest(
//             'Variable explorer - A lot of items',
//             async (t) => {
//                 const basicCode: string = `for _i in range(1050):
//     exec("var{}=[{} ** 2 % 17 for _l in range(100000)]".format(_i, _i))`;

//                 const { mount } = t === 'native' ? await createNewEditor(ioc) : await getOrCreateInteractiveWindow(ioc);
//                 const wrapper = mount.wrapper;
//                 openVariableExplorer(wrapper);

//                 // Wait for two variable completes so we get the visible list (should be about 16 items when finished)
//                 await addCodeImpartial(wrapper, basicCode, true, 2);

//                 const allVariables: IJupyterVariable[] = rangeInclusive(0, 1050)
//                     .map(generateVar)
//                     .sort((a: IJupyterVariable, b: IJupyterVariable) => a.name.localeCompare(b.name));

//                 const targetVariables = allVariables.slice(0, 14);
//                 verifyVariables(wrapper, targetVariables);

//                 // Force a scroll to the bottom
//                 const complete = mount.waitForMessage(InteractiveWindowMessages.VariablesComplete);
//                 const grid = wrapper.find(AdazzleReactDataGrid);
//                 const viewPort = grid.find('Viewport').instance();
//                 const rowHeight = (viewPort.props as any).rowHeight as number;
//                 const scrollTop = (allVariables.length - 11) * rowHeight;
//                 (viewPort as any).onScroll({ scrollTop, scrollLeft: 0 });

//                 // Wait for a variable complete
//                 await complete;

//                 // Now we should have the bottom. For some reason only 10 come back here.
//                 const bottomVariables = allVariables.slice(1041, 1050);
//                 verifyVariables(wrapper, bottomVariables);

//                 // Step into the first cell over again. Should have the same variables
//                 if (runByLine && t === 'interactive') {
//                     // Remove values, don't bother checking them as they'll be different from the debugger
//                     const nonValued = bottomVariables
//                         .map((v) => {
//                             return { ...v, value: undefined };
//                         })
//                         .slice(0, 9);
//                     await verifyAfterStep(
//                         ioc,
//                         wrapper,
//                         () => {
//                             verifyVariables(wrapper, nonValued);
//                             return Promise.resolve();
//                         },
//                         2 // 2 refreshes because the variable explorer is scrolled to the bottom.
//                     );
//                 }
//             },
//             () => {
//                 return Promise.resolve(ioc);
//             }
//         );

//         runInteractiveTest(
//             'Variable explorer - DataFrameInfo and Rows',
//             async () => {
//                 const basicCode: string = `import numpy as np
// import pandas as pd
// mynpArray = np.array([1.0, 2.0, 3.0])
// myDataframe = pd.DataFrame(mynpArray)
// mySeries = myDataframe[0]
// `;
//                 const { mount } = await getOrCreateInteractiveWindow(ioc);
//                 const wrapper = mount.wrapper;

//                 openVariableExplorer(wrapper);

//                 await addCodeImpartial(wrapper, 'a=1\na');
//                 await addCodeImpartial(wrapper, basicCode, true);

//                 await verifyCanFetchData(ioc, 2, 'myDataframe', [1, 2, 3]);
//                 await verifyCanFetchData(ioc, 2, 'mynpArray', [1, 2, 3]);
//                 await verifyCanFetchData(ioc, 2, 'mySeries', [1, 2, 3]);

//                 // Step into the first cell over again. Should have the same variables
//                 if (runByLine) {
//                     await verifyAfterStep(ioc, wrapper, async (_w) => {
//                         await verifyCanFetchData(ioc, 2, 'myDataframe', [1, 2, 3]);
//                         await verifyCanFetchData(ioc, 2, 'mynpArray', [1, 2, 3]);
//                         await verifyCanFetchData(ioc, 2, 'mySeries', [1, 2, 3]);
//                     });
//                 }
//             },
//             () => {
//                 return Promise.resolve(ioc);
//             }
//         );

//         runInteractiveTest(
//             '2D tensor shapes are correctly reported',
//             async () => {
//                 const basicCode: string = `
// # PyTorch Tensors
// import torch
// a = torch.LongTensor([[2, 4]])
// b = torch.FloatTensor([[1, 3], [5, 7]])
// c = torch.sparse.FloatTensor(a, b)  # sparse tensor

// # TensorFlow EagerTensors
// import tensorflow as tf
// d = tf.constant([[1.0, 2.0], [3.0, 4.0]])
//                 `;
//                 const { mount } = await getOrCreateInteractiveWindow(ioc);
//                 const wrapper = mount.wrapper;

//                 openVariableExplorer(wrapper);

//                 await addCodeImpartial(wrapper, basicCode, true);

//                 const targetVariables = [
//                     {
//                         name: 'a',
//                         type: 'Tensor',
//                         shape: '(1, 2)',
//                         supportsDataExplorer: true,
//                         value: 'tensor([[2, 4]])',
//                         size: 42,
//                         count: 0,
//                         truncated: false
//                     },
//                     {
//                         name: 'b',
//                         type: 'Tensor',
//                         shape: '(2, 2)',
//                         supportsDataExplorer: true,
//                         value: `tensor([[1., 3.],
//         [5., 7.]])`,
//                         size: 42,
//                         count: 0,
//                         truncated: false
//                     },
//                     {
//                         name: 'c',
//                         type: 'Tensor',
//                         shape: '(5, 2)',
//                         supportsDataExplorer: true,
//                         value: `tensor(indices=tensor([[2, 4]]),
//         values=tensor([[1., 3.],
//                       [5., 7.]]),
//         size=(5, 2), nnz=2, layout=torch.sparse_coo)`,
//                         size: 42,
//                         count: 0,
//                         truncated: false
//                     },
//                     {
//                         name: 'd',
//                         type: 'EagerTensor',
//                         shape: '(2, 2)',
//                         supportsDataExplorer: true,
//                         value: `tf.Tensor(
// [[1. 2.] [3. 4.]], shape=(2, 2), dtype=float32)`,
//                         size: 42,
//                         count: 0,
//                         truncated: false
//                     }
//                 ];
//                 verifyVariables(wrapper, targetVariables);
//             },
//             () => {
//                 return Promise.resolve(ioc);
//             }
//         );

//         runInteractiveTest(
//             'Variable explorer - Sort by name column',
//             async () => {
//                 const basicCode: string = `B = set([42])
// z = complex(1, 1)
// C = {'c': 1}
// Ab = [1, 2, 3]
// aa = 1,2,3,4,5,6,7,8,9
// A = 1,2`;

//                 const { mount } = await getOrCreateInteractiveWindow(ioc);
//                 const wrapper = mount.wrapper;
//                 openVariableExplorer(wrapper);

//                 // Wait for two variable completes so we get the visible list (should be 6 items when finished)
//                 await addCodeImpartial(wrapper, basicCode, true, 2);

//                 const targetVariablesAscending: IJupyterVariable[] = [
//                     {
//                         name: 'A',
//                         value: '(1, 2)',
//                         supportsDataExplorer: false,
//                         type: 'tuple',
//                         size: 54,
//                         shape: '2',
//                         count: 0,
//                         truncated: false
//                     },
//                     {
//                         name: 'aa',
//                         value: '(1, 2, 3, 4, 5, 6, 7, 8, 9)',
//                         supportsDataExplorer: false,
//                         type: 'tuple',
//                         size: 54,
//                         shape: '9',
//                         count: 0,
//                         truncated: false
//                     },
//                     {
//                         name: 'Ab',
//                         value: '[1, 2, 3]',
//                         supportsDataExplorer: true,
//                         type: 'list',
//                         size: 54,
//                         shape: '',
//                         count: 3,
//                         truncated: false
//                     },
//                     {
//                         name: 'B',
//                         value: undefined,
//                         supportsDataExplorer: false,
//                         type: 'set',
//                         size: 54,
//                         shape: '',
//                         count: 1,
//                         truncated: false
//                     },
//                     {
//                         name: 'C',
//                         value: "{'c': 1}",
//                         supportsDataExplorer: true,
//                         type: 'dict',
//                         size: 54,
//                         shape: '',
//                         count: 1,
//                         truncated: false
//                     },
//                     {
//                         name: 'z',
//                         value: '(1+1j)',
//                         supportsDataExplorer: false,
//                         type: 'complex',
//                         size: 54,
//                         shape: '',
//                         count: 0,
//                         truncated: false
//                     }
//                 ];

//                 const targetVariablesDescending: IJupyterVariable[] = [
//                     {
//                         name: 'z',
//                         value: '(1+1j)',
//                         supportsDataExplorer: false,
//                         type: 'complex',
//                         size: 54,
//                         shape: '',
//                         count: 0,
//                         truncated: false
//                     },
//                     {
//                         name: 'C',
//                         value: "{'c': 1}",
//                         supportsDataExplorer: true,
//                         type: 'dict',
//                         size: 54,
//                         shape: '',
//                         count: 1,
//                         truncated: false
//                     },
//                     {
//                         name: 'B',
//                         value: undefined,
//                         supportsDataExplorer: false,
//                         type: 'set',
//                         size: 54,
//                         shape: '',
//                         count: 1,
//                         truncated: false
//                     },
//                     {
//                         name: 'Ab',
//                         value: '[1, 2, 3]',
//                         supportsDataExplorer: true,
//                         type: 'list',
//                         size: 54,
//                         shape: '',
//                         count: 3,
//                         truncated: false
//                     },
//                     {
//                         name: 'aa',
//                         value: '(1, 2, 3, 4, 5, 6, 7, 8, 9)',
//                         supportsDataExplorer: false,
//                         type: 'tuple',
//                         size: 54,
//                         shape: '9',
//                         count: 0,
//                         truncated: false
//                     },
//                     {
//                         name: 'A',
//                         value: '(1, 2)',
//                         supportsDataExplorer: false,
//                         type: 'tuple',
//                         size: 54,
//                         shape: '2',
//                         count: 0,
//                         truncated: false
//                     }
//                 ];

//                 const grid = wrapper.find(AdazzleReactDataGrid);
//                 const viewPort = grid.find('Viewport').instance();

//                 // Sort by name ascending
//                 const completeAsc = mount.waitForMessage(InteractiveWindowMessages.VariablesComplete);
//                 (viewPort.props as any).onGridSort('name', 'ASC');
//                 await completeAsc;
//                 verifyVariables(wrapper, targetVariablesAscending);

//                 // Sort by name descending
//                 const completeDesc = mount.waitForMessage(InteractiveWindowMessages.VariablesComplete);
//                 (viewPort.props as any).onGridSort('name', 'DESC');
//                 await completeDesc;
//                 verifyVariables(wrapper, targetVariablesDescending);
//             },
//             () => {
//                 return Promise.resolve(ioc);
//             }
//         );
//         runInteractiveTest(
//             'Variable explorer - Sort by type column',
//             async () => {
//                 const basicCode: string = `B = set([42])
// z = complex(1, 1)
// C = {'c': 1}
// A = [1, 2, 3]
// a = 1,2,3,4,5,6,7,8,9`;

//                 const { mount } = await getOrCreateInteractiveWindow(ioc);
//                 const wrapper = mount.wrapper;
//                 openVariableExplorer(wrapper);

//                 // Wait for two variable completes so we get the visible list (should be about 16 items when finished)
//                 await addCodeImpartial(wrapper, basicCode, true);

//                 const targetVariablesTypeAscending: IJupyterVariable[] = [
//                     {
//                         name: 'z',
//                         value: '(1+1j)',
//                         supportsDataExplorer: false,
//                         type: 'complex',
//                         size: 54,
//                         shape: '',
//                         count: 0,
//                         truncated: false
//                     },
//                     {
//                         name: 'C',
//                         value: "{'c': 1}",
//                         supportsDataExplorer: true,
//                         type: 'dict',
//                         size: 54,
//                         shape: '',
//                         count: 1,
//                         truncated: false
//                     },
//                     {
//                         name: 'A',
//                         value: '[1, 2, 3]',
//                         supportsDataExplorer: true,
//                         type: 'list',
//                         size: 54,
//                         shape: '',
//                         count: 3,
//                         truncated: false
//                     },
//                     {
//                         name: 'B',
//                         value: undefined,
//                         supportsDataExplorer: false,
//                         type: 'set',
//                         size: 54,
//                         shape: '',
//                         count: 1,
//                         truncated: false
//                     },
//                     {
//                         name: 'a',
//                         value: '(1, 2, 3, 4, 5, 6, 7, 8, 9)',
//                         supportsDataExplorer: false,
//                         type: 'tuple',
//                         size: 54,
//                         shape: '9',
//                         count: 0,
//                         truncated: false
//                     }
//                 ];

//                 const targetVariablesTypeDescending: IJupyterVariable[] = [
//                     {
//                         name: 'a',
//                         value: '(1, 2, 3, 4, 5, 6, 7, 8, 9)',
//                         supportsDataExplorer: false,
//                         type: 'tuple',
//                         size: 54,
//                         shape: '9',
//                         count: 0,
//                         truncated: false
//                     },
//                     {
//                         name: 'B',
//                         value: undefined,
//                         supportsDataExplorer: false,
//                         type: 'set',
//                         size: 54,
//                         shape: '',
//                         count: 1,
//                         truncated: false
//                     },

//                     {
//                         name: 'A',
//                         value: '[1, 2, 3]',
//                         supportsDataExplorer: true,
//                         type: 'list',
//                         size: 54,
//                         shape: '',
//                         count: 3,
//                         truncated: false
//                     },
//                     {
//                         name: 'C',
//                         value: "{'c': 1}",
//                         supportsDataExplorer: true,
//                         type: 'dict',
//                         size: 54,
//                         shape: '',
//                         count: 1,
//                         truncated: false
//                     },
//                     {
//                         name: 'z',
//                         value: '(1+1j)',
//                         supportsDataExplorer: false,
//                         type: 'complex',
//                         size: 54,
//                         shape: '',
//                         count: 0,
//                         truncated: false
//                     }
//                 ];

//                 const grid = wrapper.find(AdazzleReactDataGrid);
//                 const viewPort = grid.find('Viewport').instance();

//                 // Sort by type ascending
//                 const completeAsc = mount.waitForMessage(InteractiveWindowMessages.VariablesComplete);
//                 (viewPort.props as any).onGridSort('type', 'ASC');
//                 await completeAsc;
//                 verifyVariables(wrapper, targetVariablesTypeAscending);

//                 // Sort by type descending
//                 const completeDesc = mount.waitForMessage(InteractiveWindowMessages.VariablesComplete);
//                 (viewPort.props as any).onGridSort('type', 'DESC');
//                 await completeDesc;
//                 verifyVariables(wrapper, targetVariablesTypeDescending);
//             },
//             () => {
//                 return Promise.resolve(ioc);
//             }
//         );
//     });
// });
