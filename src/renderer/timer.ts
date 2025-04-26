export const setInterval = (callback: (timestamp: number) => void, interval: number) => {
  let last: number | undefined;
  let animationFrameId = 0;

  const requestAnimationFrameCallback = (timestamp: number) => {
    if (last === undefined) {
      last = timestamp;
    }
    const delta = timestamp - last;

    if (delta >= interval) {
      callback(delta);
      last = timestamp;
    }

    animationFrameId = window.requestAnimationFrame(requestAnimationFrameCallback);
  };

  animationFrameId = window.requestAnimationFrame(requestAnimationFrameCallback);

  return () => {
    window.cancelAnimationFrame(animationFrameId);
  };
};
