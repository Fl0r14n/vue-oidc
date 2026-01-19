import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { storageRef } from './ref'

describe('storageRef', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    })
    vi.clearAllMocks()
  })

  describe('with string key', () => {
    it('should initialize with value from localStorage if present', () => {
      const key = 'test-key'
      const storedValue = { foo: 'bar' }
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(storedValue))

      const model = storageRef(key)

      expect(localStorage.getItem).toHaveBeenCalledWith(key)
      expect(model.value).toEqual(storedValue)
    })

    it('should initialize with initial value if localStorage is empty', () => {
      const key = 'test-key'
      const initialValue = { foo: 'initial' }
      vi.mocked(localStorage.getItem).mockReturnValue(null)

      const model = storageRef(key, initialValue)

      expect(model.value).toEqual(initialValue)
    })

    it('should use map function if provided', () => {
      const key = 'test-key'
      const storedValue = 'raw'
      const mappedValue = 'mapped'
      const map = vi.fn().mockReturnValue(mappedValue)
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(storedValue))

      const model = storageRef(key, 'initial', map)

      expect(map).toHaveBeenCalledWith(storedValue)
      expect(model.value).toBe(mappedValue)
    })

    it('should update localStorage when model value changes', async () => {
      const key = 'test-key'
      vi.mocked(localStorage.getItem).mockReturnValue(null)
      const model = storageRef(key, 'initial')

      model.value = 'updated'
      await nextTick()

      expect(localStorage.setItem).toHaveBeenCalledWith(key, JSON.stringify('updated'))
    })
  })

  describe('with Ref key', () => {
    it('should react to key changes', async () => {
      const keyRef = ref('key1')
      const val1 = 'val1'
      const val2 = 'val2'

      vi.mocked(localStorage.getItem).mockImplementation(k => {
        if (k === 'key1') return JSON.stringify(val1)
        if (k === 'key2') return JSON.stringify(val2)
        return null
      })

      const model = storageRef(keyRef)
      await nextTick()
      expect(model.value).toBe(val1)

      keyRef.value = 'key2'
      await nextTick()
      expect(model.value).toBe(val2)
    })

    it('should update correct localStorage key when model value changes', async () => {
      const keyRef = ref('key1')
      const model = storageRef(keyRef, 'initial')
      await nextTick()

      model.value = 'new-val-1'
      await nextTick()
      expect(localStorage.setItem).toHaveBeenCalledWith('key1', JSON.stringify('new-val-1'))

      keyRef.value = 'key2'
      await nextTick()
      model.value = 'new-val-2'
      await nextTick()
      expect(localStorage.setItem).toHaveBeenCalledWith('key2', JSON.stringify('new-val-2'))
    })
  })
})
