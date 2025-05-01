import { ref } from 'vue'
import { setInterval } from './timer'

import type { Ref } from 'vue'

const useMusicTime = (
  distance: number
): {
  currentTime: Ref<number>
  start: (initTime: number) => void
  stop: () => void
  resume: () => void
  clear: () => void
} => {
  const currentTime = ref(0)
  let isStop = true
  let clearTimer: (() => void) | undefined

  const start = (initTime: number): void => {
    currentTime.value = initTime
    isStop = false
    clearTimer = setInterval(() => {
      if (isStop) {
        return
      }
      currentTime.value += distance
    }, distance)
  }

  const stop = (): void => {
    isStop = true
  }

  const resume = (): void => {
    isStop = false
  }

  const clear = (): void => {
    clearTimer?.()
    clearTimer = undefined
    currentTime.value = 0
    isStop = true
  }

  return { currentTime, start, stop, resume, clear }
}

export default useMusicTime
