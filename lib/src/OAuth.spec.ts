import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import OAuth from './OAuth.vue'
import { OAuthType } from './models'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { mdiAccount, mdiAccountOutline } from '@mdi/js'

const vuetify = createVuetify({
  components,
  directives
})

// Mock useOAuth and useOAuthUser from module
const mockOAuth = {
  login: vi.fn(),
  logout: vi.fn(),
  isAuthorized: ref(false),
  hasError: ref(false),
  errorDescription: ref(''),
  type: ref(OAuthType.AUTHORIZATION_CODE)
}
const mockUser = ref<any>(null)

vi.mock('./module', () => ({
  useOAuth: () => mockOAuth,
  useOAuthUser: () => mockUser
}))

describe('OAuth.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOAuth.isAuthorized.value = false
    mockOAuth.hasError.value = false
    mockOAuth.errorDescription.value = ''
    mockUser.value = null

    // Mock location
    vi.stubGlobal('location', {
      origin: 'http://localhost',
      pathname: '/',
      search: ''
    })
  })

  it('renders login button when not authorized', async () => {
    const wrapper = mount(OAuth, {
      global: {
        plugins: [vuetify]
      }
    })

    const btn = wrapper.findComponent(components.VBtn)
    expect(btn.exists()).toBe(true)
    expect(btn.props('icon')).toBe(mdiAccountOutline)
  })

  it('renders authorized icon when authorized', async () => {
    mockOAuth.isAuthorized.value = true
    const wrapper = mount(OAuth, {
      global: {
        plugins: [vuetify]
      }
    })

    const btn = wrapper.findComponent(components.VBtn)
    expect(btn.props('icon')).toBe(mdiAccount)
  })

  it('calls login with correct params when login button clicked', async () => {
    const wrapper = mount(OAuth, {
      global: {
        plugins: [vuetify]
      },
      props: {
        type: OAuthType.AUTHORIZATION_CODE,
        state: 'test-state'
      }
    })

    mockOAuth.isAuthorized.value = false
    const loginBtn = wrapper.findAllComponents(components.VBtn).find(b => b.text().toLowerCase().includes('login'))
    if (loginBtn) {
      await loginBtn.trigger('click')
      expect(mockOAuth.login).toHaveBeenCalledWith(
        expect.objectContaining({
          responseType: OAuthType.AUTHORIZATION_CODE,
          state: 'test-state'
        })
      )
    }
  })

  it('renders form when type is RESOURCE', async () => {
    const wrapper = mount(OAuth, {
      global: {
        plugins: [vuetify],
        stubs: {
          VMenu: {
            template: '<div><slot name="activator" :props="{}"></slot><slot></slot></div>'
          }
        }
      },
      props: {
        type: OAuthType.RESOURCE
      }
    })

    expect(wrapper.findComponent(components.VForm).exists()).toBe(true)
    expect(wrapper.findAllComponents(components.VTextField).length).toBe(2)
  })

  it('shows user info when authorized', async () => {
    mockOAuth.isAuthorized.value = true
    mockUser.value = {
      name: 'John Doe',
      email: 'john@example.com',
      given_name: 'John',
      family_name: 'Doe'
    }

    const wrapper = mount(OAuth, {
      global: {
        plugins: [vuetify],
        stubs: {
          VMenu: {
            template: '<div><slot name="activator" :props="{}"></slot><slot></slot></div>'
          }
        }
      }
    })

    expect(wrapper.text()).toContain('John Doe')
    expect(wrapper.text()).toContain('john@example.com')
    expect(wrapper.text()).toContain('JD')
  })

  it('calls logout when signOut clicked', async () => {
    mockOAuth.isAuthorized.value = true
    const wrapper = mount(OAuth, {
      global: {
        plugins: [vuetify],
        stubs: {
          VMenu: {
            template: '<div><slot name="activator" :props="{}"></slot><slot></slot></div>'
          }
        }
      },
      props: {
        logoutRedirectUri: 'http://logout.com'
      }
    })

    const logoutBtn = wrapper.findAllComponents(components.VBtn).find(b => b.text().toLowerCase().includes('logout'))
    await logoutBtn?.trigger('click')

    expect(mockOAuth.logout).toHaveBeenCalledWith('http://logout.com')
  })

  it('shows error alert when hasError is true', async () => {
    mockOAuth.hasError.value = false
    mockOAuth.errorDescription.value = 'Invalid credentials'

    const wrapper = mount(OAuth, {
      global: {
        plugins: [vuetify],
        stubs: {
          VMenu: {
            template: '<div><slot name="activator" :props="{}"></slot><slot></slot></div>'
          }
        }
      }
    })

    mockOAuth.hasError.value = true
    await nextTick()
    await nextTick()

    const alert = wrapper.findComponent(components.VAlert)
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain('Invalid credentials')
  })
})
