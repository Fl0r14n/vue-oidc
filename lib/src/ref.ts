import { type Ref, ref, watch } from 'vue'

const get = (key: string) => {
  const value = globalThis.localStorage.getItem(key)
  return (value && JSON.parse(value)) || undefined
}

const set = (key: string, value: any) => {
  globalThis.localStorage.setItem(key, JSON.stringify(value))
}

export const storageRef = <T>(key: Ref<string> | string, initial?: T, map?: (v: any) => T) => {
  const model = ref<T>((map && map(initial)) || (initial as T))
  if (typeof key === 'string') {
    const v = get(key)
    model.value = (map && map(v || initial)) || v || initial
    // start watching after we get the value from storage
    watch(
      model,
      async m => {
        await set(key, m)
      },
      { deep: true }
    )
  } else {
    watch(
      key,
      async k => {
        const v = get(k)
        model.value = (map && map(v || initial)) || v || initial
        watch(
          model,
          async m => {
            set(k, m)
          },
          { deep: true }
        )
      },
      { immediate: true }
    )
  }
  return model
}
