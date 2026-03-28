const test = require('tap').test
const Scratch3MeshV2Blocks = require('../../src/extensions/scratch3_mesh_v2/index')
const { validateDomain } = require('../../src/extensions/scratch3_mesh_v2/utils')

test('validateDomain', t => {
  t.equal(validateDomain('example.com'), 'example.com')
  t.equal(validateDomain('my-domain_123.test'), 'my-domain_123.test')
  t.equal(validateDomain(''), null)
  t.equal(validateDomain(null), null)
  t.equal(validateDomain('a'.repeat(257)), null)
  t.equal(validateDomain('invalid!char'), null)
  t.end()
})

test('setDomain', t => {
  const runtime = {
    registerPeripheralExtension: () => {},
    emit: () => {},
    extensionManager: {
      isExtensionLoaded: () => false,
    },
  }
  const blocks = new Scratch3MeshV2Blocks(runtime)

  // Mock localStorage
  global.window = {
    localStorage: {
      getItem: () => null,
      setItem: (key, val) => {
        t.equal(key, 'mesh_v2_domain')
        t.equal(val, 'new-domain')
      },
      removeItem: key => {
        t.equal(key, 'mesh_v2_domain')
      },
    },
    location: {
      search: '',
    },
  }

  t.equal(blocks.domain, null)

  const err = blocks.setDomain('new-domain')
  t.equal(err, null)
  t.equal(blocks.domain, 'new-domain')

  // Test connected state
  blocks.connectionState = 'connected'
  const errConnected = blocks.setDomain('another-domain')
  t.not(errConnected, null)
  t.equal(blocks.domain, 'new-domain') // Should not change

  delete global.window
  t.end()
})
