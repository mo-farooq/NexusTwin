import { useState, useEffect } from "react";

/**
 * useRollingFps
 * Genuine rolling delta-time frame counter computed via requestAnimationFrame.
 * Updates at 500ms intervals to prevent frame-rate jitter.
 */
export function useRollingFps(): number {
  const [fps, setFps] = useState(60);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const loop = (now: number) => {
      frameCount++;
      const delta = now - lastTime;
      if (delta >= 500) {
        const computed = Math.round((frameCount * 1000) / delta);
        setFps(Math.min(144, Math.max(1, computed)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  return fps;
}
