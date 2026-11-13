"use client";

import { useRef, type ReactNode } from "react";

/** Mouse-tracking 3D tilt wrapper (pure CSS transforms, no deps). */
export function TiltCard({
  children,
  className = "",
  max = 10,
  scale = 1.015,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  scale?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateY(${px * max * 2}deg) rotateX(${-py * max * 2}deg) scale(${scale})`;
  }

  function reset() {
    const el = ref.current;
    if (el) el.style.transform = "rotateY(0deg) rotateX(0deg) scale(1)";
  }

  return (
    <div className="scene-3d">
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={reset}
        className={`tilt-3d ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
