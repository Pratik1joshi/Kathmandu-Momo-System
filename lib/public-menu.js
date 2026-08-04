import { MenuRepository } from '@/lib/db/repositories/menu.js'
import { formatMenuPrice } from '@/lib/menu-format.js'

export { formatMenuPrice }

function slugify(name, id) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return base || `category-${id}`
}

function mapDiet(item) {
  if (item.is_vegetarian === 1 || item.is_vegetarian === true || item.is_veg === 1) {
    return 'veg'
  }
  return 'nonveg'
}

function mapImage(url) {
  if (!url) return null
  const s = String(url).trim()
  if (!s) return null
  return s
}

/**
 * Build the public /menu payload from the same menu_items + menu_categories
 * tables the admin panel uses. Only available items in active categories.
 */
export async function getPublicMenuCategories() {
  const menuRepo = new MenuRepository()

  let categories = []
  let items = []

  try {
    categories = await menuRepo.getCategories()
  } catch (e) {
    console.error('getPublicMenuCategories categories:', e)
    categories = []
  }

  try {
    items = await menuRepo.getAllItems({ available: true })
  } catch (e) {
    console.error('getPublicMenuCategories items:', e)
    items = []
  }

  const byCategoryId = new Map()
  for (const item of items) {
    const cid = item.category_id
    if (!byCategoryId.has(cid)) byCategoryId.set(cid, [])
    byCategoryId.get(cid).push({
      id: String(item.item_id || item.id),
      name: item.item_name || item.name,
      description: item.description || '',
      price: Number(item.price ?? item.base_price) || 0,
      diet: mapDiet(item),
      image: mapImage(item.image_url),
      chefRecommend: false,
    })
  }

  return categories
    .map((cat) => {
      const list = byCategoryId.get(cat.id) || []
      if (list.length === 0) return null
      return {
        id: slugify(cat.name, cat.id),
        title: cat.name,
        subtitle: cat.description || 'From our kitchen',
        items: list,
      }
    })
    .filter(Boolean)
}
