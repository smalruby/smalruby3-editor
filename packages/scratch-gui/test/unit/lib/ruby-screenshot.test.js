import { toBlob } from 'html-to-image'
import downloadBlob from '../../../src/lib/download-blob'
import {
  buildFilename,
  cropToWidth,
  measureTextWidth,
  measureFuriganaWidth,
  downloadRubyAsImage,
} from '../../../src/lib/ruby-screenshot'

jest.mock('../../../src/lib/download-blob', () => jest.fn())

// Mock html-to-image
jest.mock('html-to-image', () => ({
  toBlob: jest.fn(),
}))

// Helper: create a mock Monaco editor instance
const makeMockEditor = ({ lineCount = 5, contentHeight = 200 } = {}) => {
  const domNode = document.createElement('div')
  const container = document.createElement('div')
  container.style.height = '300px'
  container.appendChild(domNode)

  return {
    getDomNode: jest.fn(() => domNode),
    getModel: jest.fn(() => ({
      getLineCount: () => lineCount,
    })),
    getContentHeight: jest.fn(() => contentHeight),
    getScrollTop: jest.fn(() => 0),
    getScrollLeft: jest.fn(() => 0),
    setScrollTop: jest.fn(),
    setScrollLeft: jest.fn(),
    updateOptions: jest.fn(),
    layout: jest.fn(),
    _domNode: domNode,
    _container: container,
  }
}

// ---- buildFilename ----

describe('buildFilename', () => {
  test('builds filename with _ruby suffix', () => {
    expect(buildFilename('MyProject', 'Cat')).toBe('MyProject_Cat_ruby.png')
  })

  test('handles Japanese characters', () => {
    expect(buildFilename('プロジェクト', 'ネコ')).toBe('プロジェクト_ネコ_ruby.png')
  })

  test('handles empty strings', () => {
    expect(buildFilename('', '')).toBe('__ruby.png')
  })
})

// ---- measureTextWidth ----

describe('measureTextWidth', () => {
  test('returns 0 when .view-lines is not found', () => {
    const div = document.createElement('div')
    expect(measureTextWidth(div)).toBe(0)
  })

  test('measures max right edge of text spans', () => {
    const editor = document.createElement('div')
    const viewLines = document.createElement('div')
    viewLines.classList.add('view-lines')

    // Create two lines with spans at different widths
    const line1 = document.createElement('div')
    const span1 = document.createElement('span')
    const innerSpan1 = document.createElement('span')
    innerSpan1.textContent = 'short'
    span1.appendChild(innerSpan1)
    line1.appendChild(span1)

    const line2 = document.createElement('div')
    const span2 = document.createElement('span')
    const innerSpan2 = document.createElement('span')
    innerSpan2.textContent = 'this is a longer line of code'
    span2.appendChild(innerSpan2)
    line2.appendChild(span2)

    viewLines.appendChild(line1)
    viewLines.appendChild(line2)
    editor.appendChild(viewLines)
    document.body.appendChild(editor)

    // jsdom returns 0 for getBoundingClientRect, so result is 0
    // but the function should not throw
    const width = measureTextWidth(editor)
    expect(typeof width).toBe('number')

    document.body.removeChild(editor)
  })
})

// ---- measureFuriganaWidth ----

describe('measureFuriganaWidth', () => {
  test('returns 0 when .view-zones is not found', () => {
    const div = document.createElement('div')
    expect(measureFuriganaWidth(div)).toBe(0)
  })

  test('returns 0 when view-zones has no spans', () => {
    const editor = document.createElement('div')
    const viewZones = document.createElement('div')
    viewZones.classList.add('view-zones')
    editor.appendChild(viewZones)
    expect(measureFuriganaWidth(editor)).toBe(0)
  })
})

// ---- cropToWidth ----

describe('cropToWidth', () => {
  afterEach(() => {
    document.createElement.mockRestore?.()
    delete global.createImageBitmap
  })

  test('crops blob to specified width', async () => {
    const imgWidth = 1000
    const imgHeight = 500
    global.createImageBitmap = jest.fn(() =>
      Promise.resolve({ width: imgWidth, height: imgHeight, close: jest.fn() }),
    )

    const canvases = []
    const mockCtx = { drawImage: jest.fn() }
    const realCreateElement = document.createElement.bind(document)
    jest.spyOn(document, 'createElement').mockImplementation(tag => {
      const el = realCreateElement(tag)
      if (tag === 'canvas') {
        canvases.push(el)
        el.getContext = jest.fn(() => mockCtx)
        el.toBlob = jest.fn(cb => cb(new Blob(['cropped'], { type: 'image/png' })))
      }
      return el
    })

    const inputBlob = new Blob(['original'], { type: 'image/png' })
    const result = await cropToWidth(inputBlob, 400)

    expect(result).not.toBe(inputBlob)
    expect(canvases[0].width).toBe(400)
    expect(canvases[0].height).toBe(imgHeight)
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(1)
  })

  test('returns original blob when cropWidth >= image width', async () => {
    global.createImageBitmap = jest.fn(() => Promise.resolve({ width: 200, height: 100, close: jest.fn() }))

    const inputBlob = new Blob(['original'], { type: 'image/png' })
    const result = await cropToWidth(inputBlob, 300)

    expect(result).toBe(inputBlob)
  })

  test('returns original blob when cropWidth equals image width', async () => {
    global.createImageBitmap = jest.fn(() => Promise.resolve({ width: 200, height: 100, close: jest.fn() }))

    const inputBlob = new Blob(['original'], { type: 'image/png' })
    const result = await cropToWidth(inputBlob, 200)

    expect(result).toBe(inputBlob)
  })
})

// ---- downloadRubyAsImage ----

describe('downloadRubyAsImage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock createImageBitmap for cropToWidth called inside downloadRubyAsImage.
    // Return a small image so cropping can work when contentWidth > 0.
    global.createImageBitmap = jest.fn(() => Promise.resolve({ width: 2000, height: 400, close: jest.fn() }))
    const mockCtx = { drawImage: jest.fn() }
    const realCreateElement = document.createElement.bind(document)
    jest.spyOn(document, 'createElement').mockImplementation(tag => {
      const el = realCreateElement(tag)
      if (tag === 'canvas') {
        el.getContext = jest.fn(() => mockCtx)
        el.toBlob = jest.fn(cb => cb(new Blob(['cropped'], { type: 'image/png' })))
      }
      return el
    })
  })

  afterEach(() => {
    document.createElement.mockRestore?.()
    delete global.createImageBitmap
  })

  test('does nothing when editor is null', async () => {
    await downloadRubyAsImage(null, 'project', 'sprite')
    expect(toBlob).not.toHaveBeenCalled()
  })

  test('does nothing when editor DOM node is null', async () => {
    const editor = makeMockEditor()
    editor.getDomNode.mockReturnValue(null)
    await downloadRubyAsImage(editor, 'project', 'sprite')
    expect(toBlob).not.toHaveBeenCalled()
  })

  test('does nothing when model is null', async () => {
    const editor = makeMockEditor()
    editor.getModel.mockReturnValue(null)
    await downloadRubyAsImage(editor, 'project', 'sprite')
    expect(toBlob).not.toHaveBeenCalled()
  })

  test('does nothing when model has zero lines', async () => {
    const editor = makeMockEditor({ lineCount: 0 })
    await downloadRubyAsImage(editor, 'project', 'sprite')
    expect(toBlob).not.toHaveBeenCalled()
  })

  test('calls toBlob with editor DOM node and correct options', async () => {
    const mockBlob = new Blob(['test'], { type: 'image/png' })
    toBlob.mockResolvedValue(mockBlob)

    const editor = makeMockEditor({ contentHeight: 500 })

    await downloadRubyAsImage(editor, 'MyProject', 'Cat')

    expect(toBlob).toHaveBeenCalledTimes(1)
    const [domNode, options] = toBlob.mock.calls[0]
    expect(domNode).toBe(editor.getDomNode())
    expect(options.backgroundColor).toBe('#ffffff')
    expect(options.pixelRatio).toBe(2)
    expect(options.skipFonts).toBe(true)
  })

  test('downloads blob with correct filename', async () => {
    const mockBlob = new Blob(['test'], { type: 'image/png' })
    toBlob.mockResolvedValue(mockBlob)

    const editor = makeMockEditor()

    await downloadRubyAsImage(editor, 'MyProject', 'Cat')

    // In jsdom, measureTextWidth returns 0, so no crop → original blob
    expect(downloadBlob).toHaveBeenCalledWith('MyProject_Cat_ruby.png', mockBlob)
  })

  test('does not download when toBlob returns null', async () => {
    toBlob.mockResolvedValue(null)

    const editor = makeMockEditor()

    await downloadRubyAsImage(editor, 'MyProject', 'Cat')

    expect(downloadBlob).not.toHaveBeenCalled()
  })

  test('temporarily expands editor to full content height', async () => {
    const mockBlob = new Blob(['test'], { type: 'image/png' })
    toBlob.mockImplementation(() => {
      // Check that container was expanded when toBlob is called
      expect(editor._container.style.height).toBe('500px')
      expect(editor._container.style.overflow).toBe('hidden')
      return Promise.resolve(mockBlob)
    })

    const editor = makeMockEditor({ contentHeight: 500 })
    editor._container.style.height = '300px'

    await downloadRubyAsImage(editor, 'project', 'sprite')

    // After capture, container should be restored
    expect(editor._container.style.height).toBe('300px')
  })

  test('restores scroll position after capture', async () => {
    const mockBlob = new Blob(['test'], { type: 'image/png' })
    toBlob.mockResolvedValue(mockBlob)

    const editor = makeMockEditor()
    editor.getScrollTop.mockReturnValue(42)
    editor.getScrollLeft.mockReturnValue(10)

    await downloadRubyAsImage(editor, 'project', 'sprite')

    expect(editor.setScrollTop).toHaveBeenCalledWith(42)
    expect(editor.setScrollLeft).toHaveBeenCalledWith(10)
  })

  test('restores state even when toBlob throws', async () => {
    toBlob.mockRejectedValue(new Error('capture failed'))

    const editor = makeMockEditor()
    editor._container.style.height = '300px'

    await expect(downloadRubyAsImage(editor, 'project', 'sprite')).rejects.toThrow('capture failed')

    // State should still be restored
    expect(editor._container.style.height).toBe('300px')
    expect(editor.layout).toHaveBeenCalled()
  })

  test('disables scrollBeyondLastLine before capture and restores it after', async () => {
    const mockBlob = new Blob(['test'], { type: 'image/png' })
    toBlob.mockResolvedValue(mockBlob)

    const editor = makeMockEditor()

    await downloadRubyAsImage(editor, 'project', 'sprite')

    // First call disables, second call (in finally) re-enables
    expect(editor.updateOptions).toHaveBeenCalledWith({ scrollBeyondLastLine: false })
    expect(editor.updateOptions).toHaveBeenCalledWith({ scrollBeyondLastLine: true })
  })

  test('calls editor.layout() to trigger re-render', async () => {
    const mockBlob = new Blob(['test'], { type: 'image/png' })
    toBlob.mockResolvedValue(mockBlob)

    const editor = makeMockEditor()

    await downloadRubyAsImage(editor, 'project', 'sprite')

    // layout should be called at least twice: once to expand, once to restore
    expect(editor.layout.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
