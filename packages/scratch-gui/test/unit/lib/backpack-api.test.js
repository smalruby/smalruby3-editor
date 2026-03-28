import {
  getBackpackContents,
  saveBackpackObject,
  deleteBackpackObject,
  getLocalStorageBackpackAssetURL,
} from '../../../src/lib/backpack-api'

const STORAGE_KEY = 'smalrubyBackpack'

describe('backpack-api (localStorage)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getBackpackContents', () => {
    test('returns empty array when backpack is empty', async () => {
      const contents = await getBackpackContents({
        host: 'localStorage',
        username: 'localUser',
        token: 'localToken',
        limit: 20,
        offset: 0,
      })
      expect(contents).toEqual([])
    })

    test('returns stored items with data: URLs', async () => {
      const item = {
        id: 'abc123',
        type: 'script',
        name: 'test',
        mime: 'application/json',
        body: 'e30=', // base64 of '{}'
        thumbnail: 'dGVzdA==', // base64 of 'test'
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([item]))

      const contents = await getBackpackContents({
        host: 'localStorage',
        username: 'localUser',
        token: 'localToken',
        limit: 20,
        offset: 0,
      })
      expect(contents).toHaveLength(1)
      expect(contents[0].thumbnailUrl).toBe('data:image/jpeg;base64,dGVzdA==')
      expect(contents[0].bodyUrl).toBe('data:application/json;base64,e30=')
    })

    test('supports pagination via offset and limit', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        id: `id${i}`,
        type: 'script',
        name: `item${i}`,
        mime: 'application/json',
        body: 'e30=',
        thumbnail: 'dGVzdA==',
      }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))

      const page1 = await getBackpackContents({
        host: 'localStorage',
        username: 'localUser',
        token: 'localToken',
        limit: 3,
        offset: 0,
      })
      expect(page1).toHaveLength(3)

      const page2 = await getBackpackContents({
        host: 'localStorage',
        username: 'localUser',
        token: 'localToken',
        limit: 3,
        offset: 3,
      })
      expect(page2).toHaveLength(2)
    })
  })

  describe('saveBackpackObject', () => {
    test('saves item to localStorage and returns item with URLs', async () => {
      const result = await saveBackpackObject({
        host: 'localStorage',
        username: 'localUser',
        token: 'localToken',
        type: 'script',
        name: 'myCode',
        mime: 'application/json',
        body: 'e30=',
        thumbnail: 'dGVzdA==',
      })

      expect(result.type).toBe('script')
      expect(result.name).toBe('myCode')
      expect(result.id).toBeDefined()
      expect(result.thumbnailUrl).toBe('data:image/jpeg;base64,dGVzdA==')
      expect(result.bodyUrl).toBe('data:application/json;base64,e30=')

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(stored).toHaveLength(1)
      expect(stored[0].name).toBe('myCode')
    })

    test('prepends new item (newest first)', async () => {
      await saveBackpackObject({
        host: 'localStorage',
        username: 'localUser',
        token: 'localToken',
        type: 'script',
        name: 'first',
        mime: 'application/json',
        body: 'e30=',
        thumbnail: 'dGVzdA==',
      })
      await saveBackpackObject({
        host: 'localStorage',
        username: 'localUser',
        token: 'localToken',
        type: 'script',
        name: 'second',
        mime: 'application/json',
        body: 'e30=',
        thumbnail: 'dGVzdA==',
      })

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(stored[0].name).toBe('second')
      expect(stored[1].name).toBe('first')
    })
  })

  describe('deleteBackpackObject', () => {
    test('removes item by id from localStorage', async () => {
      const items = [
        { id: 'keep', type: 'script', name: 'keep', mime: 'application/json', body: 'e30=', thumbnail: 'dGVzdA==' },
        {
          id: 'remove',
          type: 'script',
          name: 'remove',
          mime: 'application/json',
          body: 'e30=',
          thumbnail: 'dGVzdA==',
        },
      ]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))

      await deleteBackpackObject({
        host: 'localStorage',
        username: 'localUser',
        token: 'localToken',
        id: 'remove',
      })

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(stored).toHaveLength(1)
      expect(stored[0].id).toBe('keep')
    })

    test('is a no-op when id does not exist', async () => {
      const items = [
        { id: 'keep', type: 'script', name: 'keep', mime: 'application/json', body: 'e30=', thumbnail: 'dGVzdA==' },
      ]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))

      await deleteBackpackObject({
        host: 'localStorage',
        username: 'localUser',
        token: 'localToken',
        id: 'nonexistent',
      })

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(stored).toHaveLength(1)
    })
  })

  describe('getLocalStorageBackpackAssetURL', () => {
    test('returns data: URL for a known id', () => {
      const items = [
        {
          id: 'abc123',
          mime: 'image/svg+xml',
          body: 'PHN2Zy8+', // base64 of '<svg/>'
        },
      ]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))

      const url = getLocalStorageBackpackAssetURL('localStorage', 'abc123')
      expect(url).toBe('data:image/svg+xml;base64,PHN2Zy8+')
    })

    test('returns false for an unknown id', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]))

      const url = getLocalStorageBackpackAssetURL('localStorage', 'unknown')
      expect(url).toBe(false)
    })
  })
})
