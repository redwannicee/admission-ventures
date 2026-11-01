'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Dependency-free scroll-snap carousel: cards are rendered on the server, only arrows are client JS. */
export function Carousel({
  children,
  prevLabel,
  nextLabel,
}: {
  children: React.ReactNode;
  prevLabel: string;
  nextLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="outline" size="icon" aria-label={prevLabel} onClick={() => scroll(-1)}>
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </Button>
        <Button variant="outline" size="icon" aria-label={nextLabel} onClick={() => scroll(1)}>
          <ChevronRight className="h-5 w-5 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}
