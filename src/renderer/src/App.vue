<template>
  <div v-if="!pinned" class="window-controls">
    <div class="control-button close" @click="handleWindowControls('close')" />
    <div class="control-button minimize" @click="handleWindowControls('minimize')" />
    <div class="control-button maximize" @click="handleWindowControls('maximize')" />
  </div>
  <div v-if="!pinned" ref="lyricsSwitchRef" class="lyrics-switch">
    <button
      type="button"
      class="toolbar-trigger lyrics-switch-trigger"
      title="歌词列表"
      :disabled="!lyricses.length"
      @click="toggleLyricsSwitchOpen"
    >
      <span class="toolbar-icon" />
    </button>
    <div v-show="lyricsSwitchOpen" class="lyrics-switch-popover">
      <button
        v-for="(_, index) in lyricses"
        :key="index"
        type="button"
        class="lyrics-switch-option"
        :class="{ active: index === selectedLyricsIndex }"
        @click="selectLyrics(index)"
      >
        Lyrics {{ index + 1 }}
      </button>
    </div>
  </div>
  <div v-if="!pinned" ref="lyricsOffsetRef" class="lyrics-offset">
    <button
      type="button"
      class="toolbar-trigger lyrics-offset-trigger"
      title="歌词偏移"
      @click="toggleOffsetOpen"
    >
      <span class="toolbar-icon" />
    </button>
    <div v-show="offsetOpen" class="lyrics-offset-popover">
      <div class="lyrics-offset-row">
        <button
          type="button"
          class="lyrics-offset-nudge"
          title="后退 0.5s"
          @click="nudgeOffset(-1)"
        >
          −
        </button>
        <span class="lyrics-offset-value">{{ offsetDisplay }}</span>
        <button type="button" class="lyrics-offset-nudge" title="前进 0.5s" @click="nudgeOffset(1)">
          +
        </button>
      </div>
      <label class="lyrics-offset-all">
        <input v-model="applyToAll" type="checkbox" />
        所有歌曲
      </label>
    </div>
  </div>
  <div v-if="!pinned" ref="lyricsColorRef" class="lyrics-color" :class="{ open: colorOpen }">
    <button
      type="button"
      class="toolbar-trigger lyrics-color-trigger"
      title="颜色"
      @click="toggleColorOpen"
    >
      <span class="toolbar-icon" />
    </button>
    <div v-show="colorOpen" class="lyrics-color-popover">
      <div class="lyrics-color-row">
        <span>标题</span>
        <div class="lyrics-color-controls">
          <input type="color" :value="toColorInputValue(titleColor)" @input="setTitleColor" />
          <input
            type="range"
            class="lyrics-color-alpha"
            min="0"
            max="100"
            :value="toAlphaPercent(titleColor)"
            title="透明度"
            @input="setTitleAlpha"
          />
        </div>
      </div>
      <div class="lyrics-color-row">
        <span>当前歌词</span>
        <div class="lyrics-color-controls">
          <input
            type="color"
            :value="toColorInputValue(currentLyricsColor)"
            @input="setCurrentLyricsColor"
          />
          <input
            type="range"
            class="lyrics-color-alpha"
            min="0"
            max="100"
            :value="toAlphaPercent(currentLyricsColor)"
            title="透明度"
            @input="setCurrentLyricsAlpha"
          />
        </div>
      </div>
      <div class="lyrics-color-row">
        <span>其他歌词</span>
        <div class="lyrics-color-controls">
          <input type="color" :value="toColorInputValue(lyricsColor)" @input="setLyricsColor" />
          <input
            type="range"
            class="lyrics-color-alpha"
            min="0"
            max="100"
            :value="toAlphaPercent(lyricsColor)"
            title="透明度"
            @input="setLyricsAlpha"
          />
        </div>
      </div>
    </div>
  </div>
  <div
    class="lyrics-pin"
    :class="{ pinned }"
    @mouseenter="onPinMouseEnter"
    @mouseleave="onPinMouseLeave"
  >
    <button
      type="button"
      class="toolbar-trigger lyrics-pin-trigger"
      :title="pinned ? '取消固定' : '固定'"
      @click="togglePinned"
    >
      <span class="toolbar-icon" />
    </button>
  </div>
  <div ref="musicInfoRef" class="music-info" :class="{ pinned }">
    <div
      ref="musicInfoScrollWrapperRef"
      class="music-info-scroll-wrapper"
      :class="{ slide: musicInfoWidthDifference > 0 }"
      :data-width="musicInfoWidthDifference"
    >
      <div class="music-name">{{ currentMusic?.name }}</div>
      &nbsp;-&nbsp;
      <div class="music-artist">{{ currentMusic?.artist }}</div>
      &nbsp;-&nbsp;
      <div class="music-album">{{ currentMusic?.album }}</div>
      &nbsp;-&nbsp;
      <div class="music-app-name">{{ currentMusic?.appName }}</div>
    </div>
  </div>
  <div ref="lyricsRef" class="lyrics">
    <div
      v-for="(line, index) in lyrics"
      :key="index"
      ref="lyricsLineRefs"
      class="lyrics-line"
      :class="{ current: index === currentLine }"
    >
      <span v-if="line.content">{{ line.content }}</span>
      <span v-else class="interlude">● ● ●</span>
    </div>
    <div class="blank-bottom"></div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeMount, ref, useTemplateRef, watch, watchEffect } from 'vue'
import parseLyrics from '@renderer/utils/lyrics-parser'
import useMusicTime from '@renderer/utils/music-time'
import { onClickOutside, useElementSize } from '@vueuse/core'

const OFFSET_STEP = 500
const OFFSET_STORAGE_KEY = 'lyrics-offset'
const COLOR_STORAGE_KEY = 'lyrics-colors'
const DEFAULT_TITLE_COLOR = '#000000'
const DEFAULT_LYRICS_COLOR = '#00000085'
const DEFAULT_CURRENT_LYRICS_COLOR = '#000000'

const lyricsRef = useTemplateRef<HTMLDivElement>('lyricsRef')
const lyricsLineRefs = useTemplateRef<HTMLDivElement[]>('lyricsLineRefs')
const musicInfoRef = useTemplateRef<HTMLDivElement>('musicInfoRef')
const musicInfoScrollWrapperRef = useTemplateRef<HTMLDivElement>('musicInfoScrollWrapperRef')
const pinned = ref(false)
const { width: musicInfoWidth } = useElementSize(musicInfoRef)
const { width: musicInfoScrollWrapperWidth } = useElementSize(musicInfoScrollWrapperRef)
const musicInfoWidthDifference = computed(() =>
  Math.max(musicInfoScrollWrapperWidth.value - musicInfoWidth.value, 0)
)
const currentMusic = ref<globalThis.CurrentMusic | null>(null)
const isPlaying = ref(false)
const lyricses = ref<string[]>([])
const selectedLyricsIndex = ref(0)
const lyrics = ref<{ time: number; content: string }[]>([])
const { currentTime, start, stop, resume, clear, calibrate } = useMusicTime(500)
const lyricsOffsetRef = useTemplateRef<HTMLDivElement>('lyricsOffsetRef')
const lyricsSwitchRef = useTemplateRef<HTMLDivElement>('lyricsSwitchRef')
const lyricsSwitchOpen = ref(false)
const offsetOpen = ref(false)
const applyToAll = ref(false)
const globalOffset = ref(0)
const localOffset = ref(0)
const songOffsets = ref<Record<string, number>>({})
const songKey = computed(() => {
  const music = currentMusic.value
  if (!music) return ''
  return [music.name, music.artist, music.album].join('::')
})
const currentOffset = computed(() => (applyToAll.value ? globalOffset.value : localOffset.value))
const offsetDisplay = computed(() => {
  const seconds = currentOffset.value / 1000
  const sign = seconds > 0 ? '+' : ''
  return `${sign}${seconds.toFixed(1)}s`
})
const persistOffset = (): void => {
  localStorage.setItem(
    OFFSET_STORAGE_KEY,
    JSON.stringify({
      applyToAll: applyToAll.value,
      globalOffset: globalOffset.value,
      songOffsets: songOffsets.value
    })
  )
}
const writeSongOffset = (key: string, value: number): void => {
  if (value === 0) {
    if (!(key in songOffsets.value)) return
    const next = { ...songOffsets.value }
    delete next[key]
    songOffsets.value = next
    return
  }
  songOffsets.value = { ...songOffsets.value, [key]: value }
}
const setOffset = (value: number): void => {
  if (applyToAll.value) {
    globalOffset.value = value
  } else {
    localOffset.value = value
    const key = songKey.value
    if (key) writeSongOffset(key, value)
  }
  persistOffset()
}
const nudgeOffset = (direction: 1 | -1): void => {
  setOffset(currentOffset.value + direction * OFFSET_STEP)
}
try {
  const raw = localStorage.getItem(OFFSET_STORAGE_KEY)
  if (raw) {
    const parsed = JSON.parse(raw) as {
      applyToAll?: boolean
      globalOffset?: number
      songOffsets?: Record<string, number>
    }
    applyToAll.value = Boolean(parsed.applyToAll)
    globalOffset.value = Number(parsed.globalOffset) || 0
    songOffsets.value =
      parsed.songOffsets && typeof parsed.songOffsets === 'object' ? parsed.songOffsets : {}
  }
} catch {
  // ignore invalid persisted offset
}
watch(
  songKey,
  (key) => {
    if (applyToAll.value) return
    localOffset.value = key ? (songOffsets.value[key] ?? 0) : 0
  },
  { immediate: true }
)
watch(applyToAll, (checked, wasChecked) => {
  if (wasChecked === undefined) return
  if (checked) {
    globalOffset.value = localOffset.value
  } else {
    localOffset.value = globalOffset.value
    const key = songKey.value
    if (key) writeSongOffset(key, localOffset.value)
  }
  persistOffset()
})
onClickOutside(lyricsOffsetRef, () => {
  offsetOpen.value = false
})
onClickOutside(lyricsSwitchRef, () => {
  lyricsSwitchOpen.value = false
})
const lyricsColorRef = useTemplateRef<HTMLDivElement>('lyricsColorRef')
const colorOpen = ref(false)
const titleColor = ref(DEFAULT_TITLE_COLOR)
const lyricsColor = ref(DEFAULT_LYRICS_COLOR)
const currentLyricsColor = ref(DEFAULT_CURRENT_LYRICS_COLOR)
const toColorInputValue = (color: string): string =>
  color.length >= 7 ? color.slice(0, 7) : DEFAULT_TITLE_COLOR
const toAlphaHex = (color: string): string => (color.length >= 9 ? color.slice(7, 9) : 'ff')
const toAlphaPercent = (color: string): number =>
  Math.round((parseInt(toAlphaHex(color), 16) / 255) * 100)
const withRgb = (color: string, rgb: string): string => `${rgb}${toAlphaHex(color)}`
const withAlphaPercent = (color: string, percent: number): string => {
  const alpha = Math.round(Math.min(100, Math.max(0, percent)) * 2.55)
    .toString(16)
    .padStart(2, '0')
  return `${toColorInputValue(color)}${alpha}`
}
const persistColors = (): void => {
  localStorage.setItem(
    COLOR_STORAGE_KEY,
    JSON.stringify({
      titleColor: titleColor.value,
      lyricsColor: lyricsColor.value,
      currentLyricsColor: currentLyricsColor.value
    })
  )
}
const setTitleColor = (event: Event): void => {
  titleColor.value = withRgb(titleColor.value, (event.target as HTMLInputElement).value)
  persistColors()
}
const setTitleAlpha = (event: Event): void => {
  titleColor.value = withAlphaPercent(
    titleColor.value,
    Number((event.target as HTMLInputElement).value)
  )
  persistColors()
}
const setLyricsColor = (event: Event): void => {
  lyricsColor.value = withRgb(lyricsColor.value, (event.target as HTMLInputElement).value)
  persistColors()
}
const setLyricsAlpha = (event: Event): void => {
  lyricsColor.value = withAlphaPercent(
    lyricsColor.value,
    Number((event.target as HTMLInputElement).value)
  )
  persistColors()
}
const setCurrentLyricsColor = (event: Event): void => {
  currentLyricsColor.value = withRgb(
    currentLyricsColor.value,
    (event.target as HTMLInputElement).value
  )
  persistColors()
}
const setCurrentLyricsAlpha = (event: Event): void => {
  currentLyricsColor.value = withAlphaPercent(
    currentLyricsColor.value,
    Number((event.target as HTMLInputElement).value)
  )
  persistColors()
}
const toggleLyricsSwitchOpen = (): void => {
  if (!lyricses.value.length) return
  offsetOpen.value = false
  colorOpen.value = false
  lyricsSwitchOpen.value = !lyricsSwitchOpen.value
}
const selectLyrics = (index: number): void => {
  selectedLyricsIndex.value = index
  lyricsSwitchOpen.value = false
}
const toggleOffsetOpen = (): void => {
  lyricsSwitchOpen.value = false
  colorOpen.value = false
  offsetOpen.value = !offsetOpen.value
}
const toggleColorOpen = (): void => {
  lyricsSwitchOpen.value = false
  offsetOpen.value = false
  colorOpen.value = !colorOpen.value
}
const togglePinned = (): void => {
  pinned.value = !pinned.value
}
const onPinMouseEnter = (): void => {
  if (pinned.value) window.electronAPI.setIgnoreMouseEvents(false)
}
const onPinMouseLeave = (): void => {
  if (pinned.value) window.electronAPI.setIgnoreMouseEvents(true)
}
watch(pinned, (isPinned) => {
  document.documentElement.classList.toggle('pinned', isPinned)
  if (!isPinned) {
    window.electronAPI.setIgnoreMouseEvents(false)
    return
  }
  lyricsSwitchOpen.value = false
  offsetOpen.value = false
  colorOpen.value = false
})
try {
  const raw = localStorage.getItem(COLOR_STORAGE_KEY)
  if (raw) {
    const parsed = JSON.parse(raw) as {
      titleColor?: string
      lyricsColor?: string
      currentLyricsColor?: string
    }
    if (parsed.titleColor) titleColor.value = parsed.titleColor
    if (parsed.lyricsColor) lyricsColor.value = parsed.lyricsColor
    if (parsed.currentLyricsColor) currentLyricsColor.value = parsed.currentLyricsColor
  }
} catch {
  // ignore invalid persisted colors
}
onClickOutside(lyricsColorRef, () => {
  colorOpen.value = false
})
watchEffect(() => {
  const root = document.documentElement
  root.style.setProperty('--title-color', titleColor.value)
  root.style.setProperty('--lyrics-color', lyricsColor.value)
  root.style.setProperty('--current-lyrics-color', currentLyricsColor.value)
})
const lyricsLineTime = computed(() => {
  return lyrics.value.map((line) => line.time)
})
const currentLine = ref(0)
watchEffect(() => {
  let lineIndex = -1,
    lyricsIndex = 0
  const adjustedTime = currentTime.value + currentOffset.value

  while (adjustedTime > lyricsLineTime.value[lyricsIndex]) {
    lineIndex = lyricsIndex
    lyricsIndex++
  }

  lyricsRef.value?.scrollTo({
    top: lineIndex === -1 ? 0 : (lyricsLineRefs.value?.[lineIndex]?.offsetTop ?? 0),
    behavior: 'smooth'
  })

  currentLine.value = lineIndex
})

watch(
  [
    () => currentMusic.value?.name,
    () => currentMusic.value?.artist,
    () => currentMusic.value?.album,
    () => currentMusic.value?.appName
  ],
  async ([name, artist, album, appName], [oldName, oldArtist, oldAlbum, oldAppName]) => {
    if (name !== oldName || artist !== oldArtist || album !== oldAlbum || appName !== oldAppName) {
      if (!name && !artist) {
        clear()
        lyrics.value = []
        lyricses.value = []
        return
      }

      console.log('song changed')

      clear()
      start((currentMusic.value?.elapsedTime || 0) * 1000)
      if (!isPlaying.value) {
        stop()
      }

      lyrics.value = [{ time: 0, content: '正在加载歌词...' }]
      lyricses.value = await window.electronAPI.fetchLyrics({ ...currentMusic.value! })
      if (!lyricses.value.length) {
        lyrics.value = [{ time: 0, content: '抱歉，没有找到歌词' }]
        return
      }
      console.log(lyricses.value)
      selectedLyricsIndex.value = 0
    }
  },
  { immediate: true }
)

watch(isPlaying, (playing) => {
  console.log('playing changed', playing)
  playing ? resume() : stop()
})

watch(
  () => currentMusic.value?.elapsedTime,
  (newElapsedTime) => {
    if (newElapsedTime === undefined) return
    const diff = Math.abs(currentTime.value - newElapsedTime * 1000)
    // 进度跳跃超过 2 秒（如用户手动快进/倒退拖动进度条），校准时间
    if (diff > 2000) {
      calibrate(newElapsedTime * 1000)
    }
  }
)
watch(
  [selectedLyricsIndex, lyricses],
  ([index, lyricses]) => {
    const nextLyrics = lyricses[index]
    if (!nextLyrics) return
    lyrics.value = parseLyrics(nextLyrics)
    console.log(lyrics.value)
  },
  { immediate: true }
)
watch(
  [currentTime, () => currentMusic.value?.duration],
  ([currentTime, duration]) => {
    if (currentTime >= (duration || 0) * 1000) {
      // 歌曲播放到结尾时，停止计时器，保持歌词在最后位置
      // 等待 iTunes 发送新的曲目事件后再重置
      stop()
    }
  },
  { immediate: true }
)

// 处理窗口控制按钮的点击事件
const handleWindowControls = (action: 'close' | 'minimize' | 'maximize'): void => {
  window.electronAPI.sendWindowControl(`window-${action}`)
}

onBeforeMount(() => {
  window.electronAPI.onItunesMusicUpdate((data) => {
    currentMusic.value = data.currentMusic
    isPlaying.value = data.isPlaying
  })
  window.electronAPI.onItunesTimeCalibrate((data) => {
    calibrate(data.elapsedTime * 1000)
  })
})
</script>

<style lang="less" scoped>
@import '@renderer/assets/variables.less';

.window-controls {
  position: fixed;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 8px;
  z-index: 1000;
  -webkit-app-region: no-drag;

  .control-button {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    cursor: pointer;
    transition: opacity 0.2s;

    &:hover {
      opacity: 0.8;
    }

    &.close {
      background-color: #ff5f57;
    }

    &.minimize {
      background-color: #febc2e;
    }

    &.maximize {
      background-color: #28c840;
    }
  }
}

.toolbar-trigger {
  position: absolute;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;

  &:disabled {
    cursor: default;
    opacity: 0.45;
  }

  .toolbar-icon {
    width: 12px;
    height: 12px;
    background-color: currentColor;
    -webkit-mask-position: center;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-size: contain;
    mask-position: center;
    mask-repeat: no-repeat;
    mask-size: contain;
  }
}

.lyrics-switch {
  position: fixed;
  top: 8px;
  left: 68px;
  width: 12px;
  height: 12px;
  z-index: 1000;
  color: var(--title-color);
  -webkit-app-region: no-drag;

  .toolbar-icon {
    -webkit-mask-image: url('./assets/icons/lyrics-list.svg');
    mask-image: url('./assets/icons/lyrics-list.svg');
  }

  .lyrics-switch-popover {
    position: absolute;
    top: 20px;
    left: 0;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: #000;
    background: rgba(255, 255, 255, 0.78);
    backdrop-filter: blur(16px);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    white-space: nowrap;
  }

  .lyrics-switch-option {
    margin: 0;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font-size: 11px;
    line-height: 12px;
    text-align: left;
    cursor: pointer;

    &:hover,
    &.active {
      background: rgba(0, 0, 0, 0.06);
    }

    &.active {
      font-weight: 600;
    }
  }
}

.lyrics-offset {
  position: fixed;
  top: 8px;
  left: 89px;
  width: 12px;
  height: 12px;
  z-index: 1000;
  color: var(--title-color);
  -webkit-app-region: no-drag;

  .toolbar-icon {
    -webkit-mask-image: url('./assets/icons/lyrics-offset.svg');
    mask-image: url('./assets/icons/lyrics-offset.svg');
  }

  .lyrics-offset-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .lyrics-offset-nudge {
    width: 22px;
    height: 22px;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.06);
    color: inherit;
    font-size: 14px;
    line-height: 22px;
    cursor: pointer;

    &:hover {
      background: rgba(0, 0, 0, 0.1);
    }
  }

  .lyrics-offset-value {
    min-width: 42px;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    line-height: 12px;
    text-align: center;
  }

  .lyrics-offset-all {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 11px;
    line-height: 12px;
    cursor: pointer;

    input {
      margin: 0;
    }
  }

  .lyrics-offset-popover {
    position: absolute;
    top: 20px;
    left: 0;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: #000;
    background: rgba(255, 255, 255, 0.78);
    backdrop-filter: blur(16px);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    white-space: nowrap;
  }
}

.lyrics-color {
  position: fixed;
  top: 8px;
  left: 107px;
  width: 12px;
  height: 12px;
  z-index: 1000;
  color: var(--title-color);
  -webkit-app-region: no-drag;

  &.open {
    z-index: 1100;
  }

  .toolbar-icon {
    -webkit-mask-image: url('./assets/icons/lyrics-color.svg');
    mask-image: url('./assets/icons/lyrics-color.svg');
  }

  .lyrics-color-popover {
    position: absolute;
    top: 20px;
    left: 0;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: #000;
    background: rgba(255, 255, 255, 0.78);
    backdrop-filter: blur(16px);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    white-space: nowrap;
  }

  .lyrics-color-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 11px;
    line-height: 12px;
  }

  .lyrics-color-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  input[type='color'] {
    width: 18px;
    height: 18px;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;

    &::-webkit-color-swatch-wrapper {
      padding: 0;
    }

    &::-webkit-color-swatch {
      border: 1px solid rgba(0, 0, 0, 0.15);
      border-radius: 3px;
    }
  }

  .lyrics-color-alpha {
    width: 64px;
    height: 14px;
    margin: 0;
    accent-color: #333;
    cursor: pointer;
  }
}

.lyrics-pin {
  position: fixed;
  top: 8px;
  left: 126px;
  width: 12px;
  height: 12px;
  z-index: 1000;
  color: var(--title-color);
  -webkit-app-region: no-drag;

  &.pinned {
    left: 8px;
  }

  .toolbar-icon {
    -webkit-mask-image: url('./assets/icons/lyrics-pin.svg');
    mask-image: url('./assets/icons/lyrics-pin.svg');
  }
}

.music-info {
  position: fixed;
  top: 8px;
  left: 144px;
  width: calc(100% - 152px);
  height: 12px;
  overflow: hidden;
  color: var(--title-color);

  &.pinned {
    left: 26px;
    width: calc(100% - 34px);
  }

  .music-info-scroll-wrapper {
    width: fit-content;
    height: 100%;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    font-size: 12px;
    font-weight: 600;
    line-height: 12px;
    white-space: nowrap;

    &.slide {
      animation: slide 10s linear infinite;
    }
  }

  @keyframes slide {
    0%,
    40% {
      transform: translateX(0);
    }
    50%,
    90% {
      transform: translateX(calc(attr(data-width px) * -1));
    }
    100% {
      transform: translateX(0);
    }
  }
}

.lyrics {
  width: 100%;
  height: calc(100% - 30px);
  position: fixed;
  top: 0;
  left: 0;
  margin-top: 30px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  flex-direction: column;
  flex-wrap: nowrap;
  overflow-y: auto;
  -webkit-app-region: no-drag;

  //   &::before {
  //     position: fixed;
  //     top: 30px;
  //     left: 0;
  //     content: '';
  //     width: 100%;
  //     height: 3vh;
  //     background: linear-gradient(to bottom, @background-color, transparent);
  //   }

  //   &::after {
  //     position: fixed;
  //     bottom: 0;
  //     left: 0;
  //     content: '';
  //     width: 100%;
  //     height: 3vh;
  //     background: linear-gradient(to top, @background-color, transparent);
  //   }

  &::-webkit-scrollbar {
    display: none;
  }

  .blank-bottom {
    flex-shrink: 0;
    width: 100%;
    height: 100vh;
  }

  .lyrics-line {
    width: 100%;
    height: auto;
    flex-shrink: 0;
    padding: 20px 25px;
    white-space: normal;
    text-align: center;
    font-size: 20px;
    font-weight: bold;
    color: var(--lyrics-color);
    box-sizing: border-box;

    &.current {
      color: var(--current-lyrics-color);

      .interlude {
        animation: breathe 3s linear infinite;
      }

      @keyframes breathe {
        0% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.2);
        }
        100% {
          transform: scale(1);
        }
      }
    }

    .interlude {
      display: inline-block;
      font-size: 13px;
    }
  }
}
</style>
