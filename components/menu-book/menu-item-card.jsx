'use client'

import DietMark from './diet-mark'
import LazyDishImage from './lazy-dish-image'
import { formatMenuPrice } from '@/lib/menu-format'

export default function MenuItemCard({ item }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-[8px] border border-[#e4dfd4] bg-[#fffcf7] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#cfc6b4] hover:shadow-[0_6px_18px_rgba(40,32,20,0.08)]">
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <LazyDishImage src={item.image} alt={item.name} />
        {item.chefRecommend && (
          <span className="absolute left-1.5 top-1.5 rounded-[5px] border border-[#c5a55a]/70 bg-[#fffcf7]/95 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-[#8b6a20] sm:left-2 sm:top-2 sm:text-[10px]">
            Chef&apos;s pick
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col px-2 py-2 sm:px-3 sm:py-3">
        <div className="mb-1 flex items-start justify-between gap-1">
          <h3 className="font-[family-name:var(--font-menu-display)] text-[0.85rem] font-semibold leading-snug text-[#1c1a16] sm:text-[1.05rem]">
            {item.name}
          </h3>
          <DietMark diet={item.diet} />
        </div>
        {item.description ? (
          <p className="mb-2 line-clamp-2 flex-1 font-[family-name:var(--font-menu-body)] text-[0.75rem] leading-snug text-[#6e675c] sm:text-[0.9rem]">
            {item.description}
          </p>
        ) : null}
        <p className="mt-auto border-t border-[#ebe4d8] pt-1.5 text-[0.8rem] font-bold tabular-nums text-[#1c1a16] sm:pt-2 sm:text-[0.95rem]">
          {formatMenuPrice(item.price)}
        </p>
      </div>
    </article>
  )
}
