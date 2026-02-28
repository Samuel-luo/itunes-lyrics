import { ref } from 'vue'

import type { Ref } from 'vue'

const useMusicTime = (
  updateInterval: number
): {
  currentTime: Ref<number>
  start: (initTime: number) => void
  stop: () => void
  resume: () => void
  clear: () => void
  calibrate: (actualTime: number) => void
} => {
  const currentTime = ref(0)

  let isRunning = false
  let animationFrameId = 0

  // 基准时间戳方案：记录启动时的 performance.now() 和对应的初始时间
  // currentTime = initTime + (performance.now() - startTimestamp)
  // 这样无论 rAF 回调间隔如何波动，时间都是准确的
  let startTimestamp = 0
  let initTime = 0
  let lastUpdateTime = 0

  const tick = (timestamp: number): void => {
    if (!isRunning) {
      animationFrameId = window.requestAnimationFrame(tick)
      return
    }

    const elapsed = timestamp - startTimestamp
    const now = initTime + elapsed

    // 按 updateInterval 节流更新 ref（避免过于频繁触发 Vue 响应式更新）
    if (now - lastUpdateTime >= updateInterval) {
      currentTime.value = now
      lastUpdateTime = now
    }

    animationFrameId = window.requestAnimationFrame(tick)
  }

  const start = (time: number): void => {
    // 清除之前的动画帧
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId)
    }

    initTime = time
    startTimestamp = performance.now()
    lastUpdateTime = time
    currentTime.value = time
    isRunning = true

    animationFrameId = window.requestAnimationFrame(tick)
  }

  const stop = (): void => {
    if (isRunning) {
      // 暂停时，把当前已经过的时间保存到 initTime
      const elapsed = performance.now() - startTimestamp
      initTime = initTime + elapsed
      isRunning = false
    }
  }

  const resume = (): void => {
    if (!isRunning) {
      // 恢复时，重置 startTimestamp，从 initTime 继续
      startTimestamp = performance.now()
      isRunning = true
    }
  }

  const clear = (): void => {
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId)
      animationFrameId = 0
    }
    currentTime.value = 0
    isRunning = false
    initTime = 0
    startTimestamp = 0
    lastUpdateTime = 0
  }

  /**
   * 校准：用 iTunes 返回的真实播放位置修正本地时间
   * 避免长时间播放后本地计时器与实际播放位置产生偏移
   */
  const calibrate = (actualTime: number): void => {
    if (!isRunning) return

    initTime = actualTime
    startTimestamp = performance.now()
    lastUpdateTime = actualTime
    // 不直接设置 currentTime.value，让下一次 tick 自然更新
    // 这样可以避免歌词突然跳动
  }

  return { currentTime, start, stop, resume, clear, calibrate }
}

export default useMusicTime
