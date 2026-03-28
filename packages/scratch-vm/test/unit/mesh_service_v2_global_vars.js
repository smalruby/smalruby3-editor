const test = require('tap').test
const minilog = require('minilog')
// Suppress debug and info logs during tests
minilog.suggest.deny('vm', 'debug')
minilog.suggest.deny('vm', 'info')

// Force network filter test mode to be disabled in unit tests
process.env.MESH_NETWORK_FILTER = 'false'

const MeshV2Service = require('../../src/extensions/scratch3_mesh_v2/mesh-service')
const Variable = require('../../src/engine/variable')

const createMockBlocks = () => ({
  runtime: {
    getTargetForStage: () => ({
      variables: {
        'var1-id': {
          name: 'var1',
          type: Variable.SCALAR_TYPE,
          value: 10,
        },
        'var2-id': {
          name: 'var2',
          type: Variable.SCALAR_TYPE,
          value: 'hello',
        },
        'list1-id': {
          name: 'list1',
          type: Variable.LIST_TYPE,
          value: [1, 2, 3],
        },
      },
    }),
    sequencer: {},
    emit: () => {},
    on: () => {},
    off: () => {},
  },
  opcodeFunctions: {
    event_broadcast: () => {},
  },
})

test('MeshV2Service Global Variables', t => {
  t.test('getGlobalVariables returns only scalar variables', st => {
    const blocks = createMockBlocks()
    const service = new MeshV2Service(blocks, 'node1', 'domain1')

    const vars = service.getGlobalVariables()

    st.equal(vars.length, 2)
    st.same(
      vars.find(v => v.key === 'var1'),
      { key: 'var1', value: '10' },
    )
    st.same(
      vars.find(v => v.key === 'var2'),
      { key: 'var2', value: 'hello' },
    )
    st.notOk(vars.find(v => v.key === 'list1'))

    st.end()
  })

  t.test('sendAllGlobalVariables calls sendData with all variables', async st => {
    const blocks = createMockBlocks()
    const service = new MeshV2Service(blocks, 'node1', 'domain1')
    service.groupId = 'group1'
    service.client = { mutate: () => Promise.resolve({}) }

    let sentData = null
    service.sendData = data => {
      sentData = data
      return Promise.resolve()
    }

    await service.sendAllGlobalVariables()

    st.ok(sentData)
    st.equal(sentData.length, 2)
    st.same(
      sentData.find(v => v.key === 'var1'),
      { key: 'var1', value: '10' },
    )
    st.same(
      sentData.find(v => v.key === 'var2'),
      { key: 'var2', value: 'hello' },
    )

    st.end()
  })

  t.test('sendAllGlobalVariables does nothing if no variables', async st => {
    const blocks = {
      runtime: {
        getTargetForStage: () => ({ variables: {} }),
        on: () => {},
      },
    }
    const service = new MeshV2Service(blocks, 'node1', 'domain1')
    service.groupId = 'group1'
    service.client = { mutate: () => Promise.resolve({}) }

    let sendDataCalled = false
    service.sendData = () => {
      sendDataCalled = true
      return Promise.resolve()
    }

    await service.sendAllGlobalVariables()

    st.notOk(sendDataCalled)

    st.end()
  })

  t.test('createGroup calls sendAllGlobalVariables', async st => {
    const blocks = createMockBlocks()
    const service = new MeshV2Service(blocks, 'node1', 'domain1')
    service.client = {
      mutate: () =>
        Promise.resolve({
          data: {
            createGroup: {
              id: 'group1',
              name: 'groupName',
              domain: 'domain1',
              expiresAt: '2099-01-01T00:00:00Z',
              heartbeatIntervalSeconds: 60,
            },
          },
        }),
      subscribe: () => ({
        subscribe: () => ({ unsubscribe: () => {} }),
      }),
    }

    let sendAllCalled = false
    service.sendAllGlobalVariables = () => {
      sendAllCalled = true
      return Promise.resolve()
    }

    await service.createGroup('groupName')

    st.ok(sendAllCalled)
    service.cleanup()

    st.end()
  })

  t.test('joinGroup calls sendAllGlobalVariables', async st => {
    const blocks = createMockBlocks()
    const service = new MeshV2Service(blocks, 'node1', 'domain1')
    service.client = {
      mutate: () =>
        Promise.resolve({
          data: {
            joinGroup: {
              domain: 'domain1',
              heartbeatIntervalSeconds: 60,
            },
          },
        }),
      query: () => Promise.resolve({ data: { listGroupStatuses: [] } }),
      subscribe: () => ({
        subscribe: () => ({ unsubscribe: () => {} }),
      }),
    }

    let sendAllCalled = false
    service.sendAllGlobalVariables = () => {
      sendAllCalled = true
      return Promise.resolve()
    }

    await service.joinGroup('groupId', 'domain1', 'groupName')

    st.ok(sendAllCalled)
    service.cleanup()

    st.end()
  })

  t.end()
})
