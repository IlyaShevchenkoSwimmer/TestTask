import { useCallback, useEffect, useRef, useState } from "react";

const PAGE_SIZE = 50;

export function useInfiniteScroll<T>(items: T[], pageSize = PAGE_SIZE) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const totalRef = useRef(items.length);
  totalRef.current = items.length; // всегда актуально для колбэка

  const observerRef = useRef<IntersectionObserver | null>(null);

  // При смене набора данных — снова показываем с первой порции
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [items, pageSize]);

  // Callback-ref: наблюдатель подключается ровно тогда, когда «маячок» появился в DOM
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      if (node) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting) {
              setVisibleCount((prev) =>
                Math.min(prev + pageSize, totalRef.current),
              );
            }
          },
          { rootMargin: "300px" },
        );
        observerRef.current.observe(node);
      }
    },
    [pageSize],
  );

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  return { visibleItems, hasMore, sentinelRef };
}
