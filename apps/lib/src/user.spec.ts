import { beforeEach, describe, expect, it, jest } from 'bun:test'
import { nextTick } from 'vue'
import { createOAuth } from './module'
import type { OAuthInstance } from './types'

const flush = async () => {
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 0))
}

const idToken = (payload: object) => `header.${btoa(JSON.stringify(payload))}.sig`

describe('user', () => {
  let oauth: OAuthInstance
  let userInfo: jest.Mock

  beforeEach(() => {
    globalThis.localStorage?.clear()
    userInfo = jest.fn()
    oauth = createOAuth({ functions: { refresh: jest.fn(), userInfo } })
  })

  it('derives the user from the id_token claims', async () => {
    oauth.token.value = { id_token: idToken({ name: 'Jane', email: 'jane@acme.io' }) }

    await flush()

    expect(oauth.user.value).toMatchObject({ name: 'Jane', email: 'jane@acme.io' })
  })

  it('fetches userinfo once authorized and a userPath is configured', async () => {
    userInfo.mockResolvedValue({ name: 'From Endpoint' })
    oauth.typeConfig.value = { userPath: '/userinfo' }
    oauth.token.value = { access_token: 'at', token_type: 'Bearer' }

    await flush()

    expect(userInfo).toHaveBeenCalledWith(oauth.typeConfig.value, oauth.http)
    expect(oauth.user.value).toEqual({ name: 'From Endpoint' })
  })

  it('does not fetch userinfo without a userPath', async () => {
    oauth.token.value = { access_token: 'at', token_type: 'Bearer' }

    await flush()

    expect(userInfo).not.toHaveBeenCalled()
  })

  it('keeps user state isolated between instances', async () => {
    oauth.token.value = { id_token: idToken({ name: 'Jane' }) }
    const second = createOAuth({ functions: { refresh: jest.fn() } })

    await flush()

    expect(oauth.user.value).toMatchObject({ name: 'Jane' })
    expect(second.user.value).toBeUndefined()
  })
})
