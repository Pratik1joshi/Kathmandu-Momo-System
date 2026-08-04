'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import CategorySection from './category-section'

const HEADER_OFFSET = 130

export default function MenuBook({ categories }) {
  const [activeId, setActiveId] = useState(categories[0]?.id || '')
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const tabsRef = useRef(null)
  const tabBtnRefs = useRef({})
  const ticking = useRef(false)
  const clicking = useRef(false)

  const updateArrows = useCallback(() => {
    const el = tabsRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft < max - 4)
  }, [])

  const scrollTabIntoView = useCallback((id) => {
    const btn = tabBtnRefs.current[id]
    const scroller = tabsRef.current
    if (!btn || !scroller) return
    const btnLeft = btn.offsetLeft
    const btnRight = btnLeft + btn.offsetWidth
    const viewLeft = scroller.scrollLeft
    const viewRight = viewLeft + scroller.clientWidth
    if (btnLeft < viewLeft + 8) {
      scroller.scrollTo({ left: Math.max(0, btnLeft - 24), behavior: 'smooth' })
    } else if (btnRight > viewRight - 8) {
      scroller.scrollTo({
        left: btnRight - scroller.clientWidth + 24,
        behavior: 'smooth',
      })
    }
  }, [])

  const syncActiveFromScroll = useCallback(() => {
    if (clicking.current) return
    let current = categories[0]?.id || ''
    for (const cat of categories) {
      const el = document.getElementById(cat.id)
      if (!el) continue
      const top = el.getBoundingClientRect().top
      if (top <= HEADER_OFFSET) current = cat.id
    }
    setActiveId((prev) => {
      if (prev !== current) {
        queueMicrotask(() => scrollTabIntoView(current))
        return current
      }
      return prev
    })
  }, [categories, scrollTabIntoView])

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(() => {
        syncActiveFromScroll()
        ticking.current = false
      })
    }
    syncActiveFromScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [syncActiveFromScroll])

  useEffect(() => {
    const el = tabsRef.current
    if (!el) return
    updateArrows()
    el.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [updateArrows, categories])

  const goToCategory = (id) => {
    const el = document.getElementById(id)
    if (!el) return
    clicking.current = true
    setActiveId(id)
    scrollTabIntoView(id)
    const top = window.scrollY + el.getBoundingClientRect().top - (HEADER_OFFSET - 8)
    window.scrollTo({ top, behavior: 'smooth' })
    window.setTimeout(() => {
      clicking.current = false
      syncActiveFromScroll()
    }, 700)
  }

  const nudgeTabs = (dir) => {
    const el = tabsRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.min(280, el.clientWidth * 0.6), behavior: 'smooth' })
  }

  return (
    <div className="menu-book-page min-h-screen bg-[#fffcf7] text-[#1c1a16]">
      <header className="sticky top-0 z-40 border-b border-[#e4dfd4] bg-[#fffcf7]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <Link href="/" className="min-w-0">
            <span className="font-[family-name:var(--font-menu-display)] text-lg tracking-tight">
              Kathmandu Momo
            </span>
            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a8f7a]">
              Surkhet · Menu
            </span>
          </Link>
          <div className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e675c]">
            <Link href="/" className="hover:text-[#1c1a16]">
              Home
            </Link>
            <Link href="/#reserve" className="hidden hover:text-[#1c1a16] sm:inline">
              Reserve
            </Link>
          </div>
        </div>

        {/* Category tabs — always scrollable, arrows on desktop so nothing is “lost” */}
        <div className="border-t border-[#ebe4d8]">
          <div className="relative mx-auto max-w-5xl">
            <button
              type="button"
              aria-label="Previous categories"
              onClick={() => nudgeTabs(-1)}
              disabled={!canLeft}
              className={`absolute left-0 top-0 z-10 hidden h-full w-9 items-center justify-center bg-gradient-to-r from-[#fffcf7] via-[#fffcf7] to-transparent sm:flex ${
                canLeft ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <ChevronLeft className="h-5 w-5 text-[#1c1a16]" />
            </button>
            <button
              type="button"
              aria-label="Next categories"
              onClick={() => nudgeTabs(1)}
              disabled={!canRight}
              className={`absolute right-0 top-0 z-10 hidden h-full w-9 items-center justify-center bg-gradient-to-l from-[#fffcf7] via-[#fffcf7] to-transparent sm:flex ${
                canRight ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <ChevronRight className="h-5 w-5 text-[#1c1a16]" />
            </button>

            <div
              ref={tabsRef}
              className="flex gap-1.5 overflow-x-auto scroll-smooth px-4 py-2.5 sm:px-10"
              style={{ scrollbarWidth: 'thin' }}
            >
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  ref={(node) => {
                    if (node) tabBtnRefs.current[cat.id] = node
                  }}
                  onClick={() => goToCategory(cat.id)}
                  className={`shrink-0 rounded-[6px] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors duration-200 ${
                    activeId === cat.id
                      ? 'bg-[#1c1a16] text-[#fffcf7]'
                      : 'bg-transparent text-[#6e675c] hover:bg-[#f0ebe3] hover:text-[#1c1a16]'
                  }`}
                >
                  {cat.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-8 sm:pt-14">
        <div className="mb-12 text-center sm:mb-16">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#9a8f7a]">
            Our Menu
          </p>
          <h1 className="font-[family-name:var(--font-menu-display)] text-3xl font-semibold tracking-tight sm:text-5xl">
            Crafted with Passion
          </h1>
          <p className="mx-auto mt-3 max-w-md font-[family-name:var(--font-menu-body)] text-base italic text-[#7a7266] sm:text-lg">
            Momo steamed to order, Nepali plates and café classics
          </p>
          <div className="mx-auto mt-5 flex max-w-xs items-center gap-3">
            <span className="h-px flex-1 bg-[#d4cbb8]" />
            <span className="text-[#c5a55a]">✦</span>
            <span className="h-px flex-1 bg-[#d4cbb8]" />
          </div>
          <div className="mt-5 flex justify-center gap-5 text-[10px] uppercase tracking-[0.14em] text-[#8a8276]">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-3 w-3 items-center justify-center rounded-[2px] border border-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-700" />
              </span>
              Veg
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-3 w-3 items-center justify-center rounded-[2px] border border-red-700">
                <span className="h-1.5 w-1.5 rounded-full bg-red-700" />
              </span>
              Non-Veg
            </span>
          </div>
        </div>

        <div className="space-y-14 sm:space-y-20">
          {categories.length === 0 ? (
            <div className="rounded-[8px] border border-[#e4dfd4] bg-white/60 px-6 py-16 text-center">
              <p className="font-[family-name:var(--font-menu-display)] text-2xl text-[#1c1a16]">
                Menu coming soon
              </p>
              <p className="mt-2 text-sm text-[#8a8276]">
                Add dishes from the admin panel and they will appear here automatically.
              </p>
            </div>
          ) : (
            categories.map((category) => (
              <CategorySection key={category.id} category={category} />
            ))
          )}
        </div>

        <footer className="mt-16 border-t border-[#e4dfd4] pt-8 text-center sm:mt-20">
          <p className="font-[family-name:var(--font-menu-display)] text-xl">
            Kathmandu Momo
          </p>
          <p className="mt-2 text-sm text-[#8a8276]">
            Birendranagar, Surkhet ·{' '}
            <a href="tel:+9779849216081" className="hover:underline">
              +977 984-9216081
            </a>
          </p>
          <Link
            href="/#reserve"
            className="mt-5 inline-block rounded-[8px] border border-[#1c1a16] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors hover:bg-[#1c1a16] hover:text-[#fffcf7]"
          >
            Reserve a Table
          </Link>
        </footer>
      </main>
    </div>
  )
}
