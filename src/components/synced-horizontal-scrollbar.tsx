"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface SyncedHorizontalScrollbarProps {
  targetRef: React.RefObject<HTMLElement | null>;
  className?: string;
}

export function SyncedHorizontalScrollbar({
  targetRef,
  className,
}: SyncedHorizontalScrollbarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const syncing = useRef(false);

  useEffect(() => {
    const target = targetRef.current;
    const track = trackRef.current;
    if (!target || !track) return;

    const updateMetrics = () => {
      const needsScroll = target.scrollWidth > target.clientWidth + 1;
      setVisible(needsScroll);
      setContentWidth(target.scrollWidth);
      track.scrollLeft = target.scrollLeft;
    };

    updateMetrics();

    const resizeObserver = new ResizeObserver(updateMetrics);
    resizeObserver.observe(target);

    const mutationObserver = new MutationObserver(updateMetrics);
    mutationObserver.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    const onTargetScroll = () => {
      if (syncing.current) return;
      syncing.current = true;
      track.scrollLeft = target.scrollLeft;
      syncing.current = false;
    };

    const onTrackScroll = () => {
      if (syncing.current) return;
      syncing.current = true;
      target.scrollLeft = track.scrollLeft;
      syncing.current = false;
    };

    target.addEventListener("scroll", onTargetScroll, { passive: true });
    track.addEventListener("scroll", onTrackScroll, { passive: true });
    window.addEventListener("resize", updateMetrics);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      target.removeEventListener("scroll", onTargetScroll);
      track.removeEventListener("scroll", onTrackScroll);
      window.removeEventListener("resize", updateMetrics);
    };
  }, [targetRef]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={cn(
        "shrink-0 border-t bg-muted/40 px-3 py-2",
        className,
      )}
    >
      <div
        ref={trackRef}
        className="h-3 overflow-x-auto overflow-y-hidden rounded-full bg-muted"
        aria-label="Desplazamiento horizontal de la tabla"
      >
        <div style={{ width: contentWidth, height: 1 }} aria-hidden />
      </div>
    </div>
  );
}
