'use client'

import MenuItemCard from './menu-item-card'

export default function CategorySection({ category }) {
  return (
    <section id={category.id} className="scroll-mt-[7.5rem] sm:scroll-mt-[8.5rem]">
      <header className="mb-5 text-center sm:mb-7">
        <div className="mx-auto mb-3 flex max-w-sm items-center gap-3">
          <span className="h-px flex-1 bg-[#d4cbb8]" />
          <span className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[#9a8f7a]">
            Menu
          </span>
          <span className="h-px flex-1 bg-[#d4cbb8]" />
        </div>
        <h2 className="font-[family-name:var(--font-menu-display)] text-2xl font-semibold tracking-tight text-[#1c1a16] sm:text-3xl">
          {category.title}
        </h2>
        <p className="mt-1.5 font-[family-name:var(--font-menu-body)] text-sm italic text-[#7a7266] sm:text-base">
          {category.subtitle}
        </p>
        <div className="mx-auto mt-3 h-px w-16 bg-[#c5a55a]" />
      </header>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-5 md:gap-6">
        {category.items.map((item) => (
          <MenuItemCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}
