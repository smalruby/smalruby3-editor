/* eslint-env jest */
/**
 * クラスの流れで読み込んだ作品がメッシュを使っていれば、接続モーダルを自動で開く (#1251)。
 */
import {
    CLASSROOM_LOAD_SOURCES,
    MESH_V2_EXTENSION_ID,
    readMeshState,
    shouldPromptMeshConnect,
    shouldShowMeshConnectNow,
} from '../../../src/lib/classroom-mesh-connect.js';

describe('shouldPromptMeshConnect', () => {
    test.each(CLASSROOM_LOAD_SOURCES)('%s から読み込んだメッシュ作品で未接続なら出す', (source) => {
        expect(shouldPromptMeshConnect({ source, meshLoaded: true, meshConnected: false })).toBe(true);
    });

    test('メッシュのブロックを使っていなければ出さない', () => {
        expect(shouldPromptMeshConnect({ source: 'starter', meshLoaded: false, meshConnected: false })).toBe(false);
    });

    test('接続済みなら出さない', () => {
        expect(shouldPromptMeshConnect({ source: 'previous', meshLoaded: true, meshConnected: true })).toBe(false);
    });

    test('クラスの流れ以外の読み込み元では出さない', () => {
        expect(shouldPromptMeshConnect({ source: 'file', meshLoaded: true, meshConnected: false })).toBe(false);
        expect(shouldPromptMeshConnect({ source: null, meshLoaded: true, meshConnected: false })).toBe(false);
        expect(shouldPromptMeshConnect({ meshLoaded: true, meshConnected: false })).toBe(false);
    });
});

describe('shouldShowMeshConnectNow', () => {
    test('依頼があり、ほかのモーダルが開いていなければ出す', () => {
        expect(shouldShowMeshConnectNow({ pending: true })).toBe(true);
    });

    test('依頼が無ければ出さない', () => {
        expect(shouldShowMeshConnectNow({ pending: false })).toBe(false);
    });

    test('クラスのモーダル (先生側も) が開いている間は待つ (重ねない)', () => {
        expect(shouldShowMeshConnectNow({ pending: true, classroomModalVisible: true })).toBe(false);
        expect(shouldShowMeshConnectNow({ pending: true, teacherModalVisible: true })).toBe(false);
    });

    test('接続モーダルがすでに開いていれば出さない', () => {
        expect(shouldShowMeshConnectNow({ pending: true, connectionModalVisible: true })).toBe(false);
    });
});

describe('readMeshState', () => {
    test('VM からメッシュ拡張の読み込みと接続状態を読む', () => {
        const vm = {
            extensionManager: { isExtensionLoaded: jest.fn((id) => id === MESH_V2_EXTENSION_ID) },
            getPeripheralIsConnected: jest.fn(() => false),
        };
        expect(readMeshState(vm)).toEqual({ meshLoaded: true, meshConnected: false });
        expect(vm.getPeripheralIsConnected).toHaveBeenCalledWith('meshV2');
    });

    test('VM の API が無ければ「読み込まれていない」とみなす', () => {
        expect(readMeshState({})).toEqual({ meshLoaded: false, meshConnected: false });
        expect(readMeshState(null)).toEqual({ meshLoaded: false, meshConnected: false });
    });
});
