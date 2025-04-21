<template>
  <div class="window-controls">
    <div class="control-button close" @click="handleWindowControls('close')" />
    <div class="control-button minimize" @click="handleWindowControls('minimize')" />
    <div class="control-button maximize" @click="handleWindowControls('maximize')" />
  </div>
  <div class="music-info">
    <div class="music-name">{{ currentMusic?.name }}</div>
    <div class="music-artist">{{ currentMusic?.artist }}</div>
    <div class="music-album">{{ currentMusic?.album }}</div>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeMount, ref, watch } from "vue";

import type { CurrentMusic } from "@/renderer/interface";

const currentMusic = ref<CurrentMusic | null>(null);
const isPlaying = ref(false);

watch(
  [() => currentMusic.value?.name, () => currentMusic.value?.artist, () => currentMusic.value?.album],
  async (val) => {
    console.log(val);
    if (currentMusic.value) {
      const lyrics = await window.electronAPI.fetchLyrics({ ...currentMusic.value });
      console.log(lyrics);
    }
  }
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
  margin-top: 28px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: red;
}
</style>
