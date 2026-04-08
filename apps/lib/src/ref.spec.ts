import { describe, expect, it } from 'bun:test'
import { storageRef } from './ref'

describe('storageRef', () => {
  it('should exist', () => {
    expect(storageRef).toBeDefined()
  })

  it('should be a function', () => {
    expect(typeof storageRef).toBe('function')
  })
})
