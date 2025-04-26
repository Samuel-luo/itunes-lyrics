import { ref } from "vue";
import { setInterval } from "./timer";

const useMusicTime = (distance: number) => {
  const currentTime = ref(0);
  let isStop = true;
  let clearTimer: (() => void) | undefined;

  const start = (initTime: number) => {
    currentTime.value = initTime;
    isStop = false;
    clearTimer = setInterval(() => {
      if (isStop) {
        return;
      }
      currentTime.value += distance;
    }, distance);
  };

  const stop = () => {
    isStop = true;
  };

  const resume = () => {
    isStop = false;
  };

  const clear = () => {
    clearTimer?.();
    clearTimer = undefined;
    currentTime.value = 0;
    isStop = true;
  };

  return { currentTime, start, stop, resume, clear };
};

export default useMusicTime;
