'use client'

import { useEffect, useRef, useState } from 'react'

/** Loads src only when near the viewport — keeps /menu fast. */
export default function LazyDishImage({ src, alt }) {
  const ref = useRef(null)
  const [show, setShow] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || !src) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShow(true)
          io.disconnect()
        }
      },
      { rootMargin: '180px 0px', threshold: 0.01 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [src])

  return (
    <div ref={ref} className="absolute inset-0 bg-[#efeae0]">
      {(!show || failed || !src) && (
        <div className="flex h-full w-full items-center justify-center text-[#c4b8a4]" aria-hidden>
          <svg viewBox="0 0 64 64" className="h-9 w-9 opacity-60" fill="none">
            <ellipse cx="32" cy="42" rx="22" ry="6" stroke="currentColor" strokeWidth="2" />
            <path d="M12 40c2-14 12-22 20-22s18 8 20 22" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
      )}
      {src && show && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          decoding="async"
          fetchPriority="low"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
      )}
    </div>
  )
}
