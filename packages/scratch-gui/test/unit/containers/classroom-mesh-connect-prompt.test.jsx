/* eslint-env jest */
/**
 * クラスの読み込みが依頼したメッシュの接続モーダルを、クラスのモーダルと重ならない
 * タイミングで 1 回だけ開く (#1251)。
 */
import { render } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import ClassroomMeshConnectPrompt from '../../../src/containers/classroom-mesh-connect-prompt.jsx';

const mockStore = configureStore();

const renderPrompt = ({ classroom = {}, connectionModal = false, connected = false } = {}) => {
    const store = mockStore({
        scratchGui: {
            classroom,
            modals: { connectionModal },
            vm: {
                extensionManager: { isExtensionLoaded: () => true },
                getPeripheralIsConnected: () => connected,
            },
        },
    });
    render(
        <Provider store={store}>
            <ClassroomMeshConnectPrompt />
        </Provider>,
    );
    return store.getActions().map((a) => a.type);
};

const CLEAR = 'scratch-gui/classroom/CLEAR_MESH_CONNECT_REQUEST';

describe('ClassroomMeshConnectPrompt (#1251)', () => {
    test('依頼があり、クラスのモーダルが閉じていれば meshV2 の接続モーダルを開く', () => {
        const store = mockStore({
            scratchGui: {
                classroom: { meshConnectPending: true },
                modals: { connectionModal: false },
                vm: {},
            },
        });
        render(
            <Provider store={store}>
                <ClassroomMeshConnectPrompt />
            </Provider>,
        );
        const actions = store.getActions();
        expect(actions[0].type).toBe(CLEAR);
        expect(actions).toContainEqual(expect.objectContaining({ extensionId: 'meshV2' }));
        expect(actions).toContainEqual(expect.objectContaining({ modal: 'connectionModal' }));
    });

    test('クラスのモーダルが開いている間は待つ', () => {
        expect(renderPrompt({ classroom: { meshConnectPending: true, modalVisible: true } })).toEqual([]);
    });

    test('依頼が無ければ何もしない (classroom reducer が無くても落ちない)', () => {
        expect(renderPrompt({ classroom: undefined })).toEqual([]);
    });

    test('その間に接続済みになっていれば依頼だけ取り消す', () => {
        expect(renderPrompt({ classroom: { meshConnectPending: true }, connected: true })).toEqual([CLEAR]);
    });
});
