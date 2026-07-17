import { type MaybeRefOrGetter, type Ref, ref, toValue, type WatchHandle, watch } from 'vue'

const get = (key: string) => {
  const value = globalThis.localStorage?.getItem(key)
  return (value && JSON.parse(value)) || undefined
}

const set = (key: string, value: any) => {
  globalThis.localStorage?.setItem(key, JSON.stringify(value))
}

export const storageRef = <T>(key: MaybeRefOrGetter<string>, initial?: T, map?: (v: any) => T): Ref<T> => {
  const model = ref<T>(map?.(initial) || (initial as T))
  // restart the model watcher per key so a read never writes and a stale watcher can't write to the old key.
  // both watchers flush sync — determinism, not a race fix: writes are often immediately followed
  // by a navigation (authorize/logout redirect), and persisting at write time makes that safe by
  // construction instead of by scheduler/unload timing arguments
  let stop: WatchHandle | undefined
  watch(
    () => toValue(key),
    k => {
      stop?.()
      const v = get(k)
      model.value = map?.(v || initial) || v || initial
      stop = watch(
        model,
        m => {
          set(k, m)
        },
        { deep: true, flush: 'sync' }
      )
    },
    { immediate: true, flush: 'sync' }
  )
  return model as Ref<T>
}
