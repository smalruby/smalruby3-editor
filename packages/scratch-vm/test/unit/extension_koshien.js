const test = require('tap').test;
const KoshienBlocks = require('../../src/extensions/koshien/index.js');

const createMockRuntime = () => {
    const runtime = {
        on: () => {},
        emit: (event, data) => {
            runtime.lastEmittedEvent = event;
            runtime.lastEmittedData = data;
        },
        getEditingTarget: () => ({
            getAllVariableNamesInScopeByType: () => []
        }),
        formatMessage: messageData => messageData.default || messageData.defaultMessage,
        setup: () => ({
            locale: 'en',
            translations: {
                en: {}
            }
        })
    };
    runtime.formatMessage.setup = runtime.setup;
    return runtime;
};

test('Koshien Blocks', t => {
    t.test('constructor', st => {
        const mockRuntime = createMockRuntime();
        const blocks = new KoshienBlocks(mockRuntime);
        st.type(blocks, KoshienBlocks);
        st.ok(blocks._client);
        st.end();
    });

    t.test('getInfo', st => {
        const mockRuntime = createMockRuntime();
        const blocks = new KoshienBlocks(mockRuntime);
        const info = blocks.getInfo();
        st.equal(info.id, 'koshien');
        st.ok(info.blocks.length > 0);
        
        // Verify setMessage block exists
        const setMessageBlock = info.blocks.find(b => b.opcode === 'setMessage');
        st.ok(setMessageBlock);
        st.equal(setMessageBlock.text, 'message [MESSAGE]');
        st.end();
    });

    t.test('setMessage', st => {
        const mockRuntime = createMockRuntime();
        const blocks = new KoshienBlocks(mockRuntime);
        
        let messageSent = null;
        blocks._client.setMessage = message => {
            messageSent = message;
            return Promise.resolve();
        };

        const args = {MESSAGE: 'hello world'};
        const result = blocks.setMessage(args);
        
        st.type(result, Promise);
        st.equal(messageSent, 'hello world');
        st.end();
    });

    t.test('connectGame', st => {
        const mockRuntime = createMockRuntime();
        const blocks = new KoshienBlocks(mockRuntime);
        
        st.equal(blocks.connectGame({NAME: 'player1'}), true);
        st.ok(blocks._client.isConnected());
        st.equal(blocks._client._playerName, 'player1');
        
        // Second call should return false if already connected
        st.equal(blocks.connectGame({NAME: 'player2'}), false);
        st.end();
    });

    t.test('position', st => {
        const mockRuntime = createMockRuntime();
        const blocks = new KoshienBlocks(mockRuntime);
        st.equal(blocks.position({X: 1, Y: 2}), '1:2');
        st.end();
    });

    t.test('positionOf', st => {
        const mockRuntime = createMockRuntime();
        const blocks = new KoshienBlocks(mockRuntime);
        st.equal(blocks.positionOf({POSITION: '3:4', COORDINATE: 'x'}), 3);
        st.equal(blocks.positionOf({POSITION: '3:4', COORDINATE: 'y'}), 4);
        st.end();
    });

    t.test('object', st => {
        const mockRuntime = createMockRuntime();
        const blocks = new KoshienBlocks(mockRuntime);
        st.equal(blocks.object({OBJECT: 'wall'}), 1);
        st.equal(blocks.object({OBJECT: 'goal'}), 3);
        st.equal(blocks.object({OBJECT: 'unknown'}), -1);
        st.end();
    });

    t.end();
});
