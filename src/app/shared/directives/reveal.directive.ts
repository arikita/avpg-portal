import { AfterViewInit, Directive, ElementRef, inject } from '@angular/core';

/**
 * Adds a scroll-triggered fade-up. Put `appReveal` on an element; it starts
 * hidden (`.reveal`) and gains `.in` when it enters the viewport.
 * Respects prefers-reduced-motion (shows immediately).
 */
@Directive({ selector: '[appReveal]' })
export class RevealDirective implements AfterViewInit {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  ngAfterViewInit(): void {
    const node = this.el.nativeElement;
    node.classList.add('reveal');

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce || typeof IntersectionObserver === 'undefined') {
      node.classList.add('in');
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.classList.add('in');
            io.unobserve(node);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(node);
  }
}
