"use client";

import React, { useState, useEffect, useRef } from 'react';

interface LazyObserverProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  threshold?: number;
}

export function LazyObserver({
  children,
  fallback = <div className="animate-pulse bg-[#1F241D]/20 h-[450px] w-full rounded-2xl" />,
  rootMargin = '150px',
  threshold = 0.01,
}: LazyObserverProps) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isIntersecting) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(container);

    return () => {
      if (container) {
        observer.unobserve(container);
      }
    };
  }, [isIntersecting, rootMargin, threshold]);

  return (
    <div ref={containerRef} className="w-full">
      {isIntersecting ? children : fallback}
    </div>
  );
}
