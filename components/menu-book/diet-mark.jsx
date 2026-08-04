'use client'

/** Compact veg / non-veg mark for printed rows */
export default function DietMark({ diet }) {
  if (diet === 'veg') {
    return (
      <span
        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] border border-emerald-700"
        title="Vegetarian"
        aria-label="Vegetarian"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-700" />
      </span>
    )
  }
  if (diet === 'egg') {
    return (
      <span
        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] border border-amber-600"
        title="Contains egg"
        aria-label="Contains egg"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
      </span>
    )
  }
  return (
    <span
      className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] border border-red-700"
      title="Non-vegetarian"
      aria-label="Non-vegetarian"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-red-700" />
    </span>
  )
}
