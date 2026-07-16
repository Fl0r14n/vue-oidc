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
  // restart the model watcher per key so a read never writes and a stale watcher can't write to the old key
  let stop: WatchHandle | undefined
  watch(
    () => toValue(key),
    k => {
      stop?.()
      const v = get(k)
      model.value = map?.(v || initial) || v || initial
      stop = watch(
        model,
        async m => {
          set(k, m)
        },
        { deep: true }
      )
    },
    { immediate: true }
  )
  return model as Ref<T>
}
