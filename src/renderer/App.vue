<template>
  <div class="window-controls">
    <div class="control-button close" @click="handleWindowControls('close')" />
    <div class="control-button minimize" @click="handleWindowControls('minimize')" />
    <div class="control-button maximize" @click="handleWindowControls('maximize')" />
  </div>
  <div class="music-info">
    <div class="music-name">{{ currentMusic?.name }}</div>
    &nbsp;-&nbsp;
    <div class="music-artist">{{ currentMusic?.artist }}</div>
    &nbsp;-&nbsp;
    <div class="music-album">{{ currentMusic?.album }}</div>
  </div>
  <div class="lyrics" ref="lyricsRef">
    <div class="blank-top"></div>
    <div
      class="lyrics-line"
      v-for="(line, index) in lyrics"
      ref="lyricsLineRefs"
      :class="{ current: index === currentLine }"
      >{{ line.content }}</div
    >
    <div class="blank-bottom"></div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeMount, ref, useTemplateRef, watch } from "vue";
import parseLyrics from "./lyrics-parser";
import useMusicTime from "./music-time";

import type { CurrentMusic } from "@/renderer/interface";

const lyricsRef = useTemplateRef<HTMLDivElement>("lyricsRef");
const lyricsLineRefs = useTemplateRef<HTMLDivElement[]>("lyricsLineRefs");
const currentMusic = ref<CurrentMusic | null>(null);
const isPlaying = ref(false);
const lyrics = ref<{ time: number; content: string }[]>([]);
const { currentTime, start, stop, resume, clear } = useMusicTime(500);
const lyricsLineTime = computed(() => {
  return lyrics.value.map((line) => line.time);
});
const currentLine = computed(() => {
  const currentLine = Math.max((lyricsLineTime.value.findIndex((time) => time > currentTime.value) || 0) - 1, 0);

  const pageHeight = document.documentElement.clientHeight;

  lyricsRef.value?.scrollTo({
    top: (lyricsLineRefs.value?.[currentLine]?.offsetTop || 0) - (pageHeight * 5) / 100,
    behavior: "smooth",
  });

  return currentLine;
});

watch(
  [
    () => currentMusic.value?.name,
    () => currentMusic.value?.artist,
    () => currentMusic.value?.album,
    () => currentMusic.value?.elapsedTime,
    () => isPlaying.value,
  ],
  async (
    [name, artist, album, elapsedTime, isPlaying],
    [oldName, oldArtist, oldAlbum, oldElapsedTime, oldIsPlaying]
  ) => {
    if (name !== oldName || artist !== oldArtist || album !== oldAlbum) {
      console.log("song changed");

      clear();
      start(elapsedTime! * 1000);

      lyrics.value = [{ time: 0, content: "正在加载歌词..." }];
      const res = await window.electronAPI.fetchLyrics({ ...currentMusic.value });
      if (!res.success) {
        lyrics.value = [{ time: 0, content: "抱歉，没有找到歌词" }];
        return;
      }
      lyrics.value = parseLyrics(res.lyrics);
      console.log(lyrics.value);
    } else if (elapsedTime !== oldElapsedTime) {
      console.log("duration changed");
      clear();
      start(elapsedTime! * 1000);
    } else if (isPlaying !== oldIsPlaying) {
      console.log("playing changed");
      isPlaying ? resume() : stop();
    }
  },
  { immediate: true }
);
watch(
  [currentTime, () => currentMusic.value?.duration],
  ([currentTime, duration]) => {
    if (currentTime >= (duration || 0) * 1000) {
      clear();
      start(0);
    }
  },
  { immediate: true }
);

// 处理窗口控制按钮的点击事件
const handleWindowControls = (action: "close" | "minimize" | "maximize") => {
  window.electronAPI.sendWindowControl(`window-${action}`);
};

onBeforeMount(() => {
  window.electronAPI.onItunesMusicUpdate((data) => {
    currentMusic.value = data.currentMusic;
    isPlaying.value = data.isPlaying;
  });
});
</script>

<style lang="less" scoped>
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

.music-info {
  position: fixed;
  top: 8px;
  left: 8px;
  width: 100%;
  height: 12px;
  padding-left: 60px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.lyrics {
  width: 100%;
  height: calc(100% - 30px);
  min-height: 300px;
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

  &::before {
    position: fixed;
    top: 30px;
    left: 0;
    content: "";
    width: 100%;
    height: 5vh;
    background: linear-gradient(to bottom, #ffffff, transparent);
  }

  &::after {
    position: fixed;
    bottom: 0;
    left: 0;
    content: "";
    width: 100%;
    height: 5vh;
    background: linear-gradient(to top, #ffffff, transparent);
  }

  &::-webkit-scrollbar {
    display: none;
  }

  .blank-top {
    height: 5vh;
  }

  .blank-bottom {
    flex-shrink: 0;
    height: 100vh;
  }

  .lyrics-line {
    width: calc(100% - 50px);
    height: auto;
    flex-shrink: 0;
    padding: 20px 0;
    white-space: normal;
    text-align: center;
    font-size: 20px;
    font-weight: bold;
    color: #00000085;

    &.current {
      color: #000;
    }
  }
}
</style>
