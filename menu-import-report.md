# Menu Import Report — Dim Sum Puri Fastfood Restaurant

- Generated: 2026-08-02T11:22:42.179Z
- Source: `data/menu/Menu.xlsx` → `data/menu/menu-grid.json`
- Mode: APPLIED to active database
- Items parsed: **103** across **13** groups
- DB result: categories 13 created / 0 updated; items 103 created / 0 updated
- Legacy items hidden (is_available=0, not deleted): **0**

## ⚠️ Assumptions requiring client confirmation
- **Cold Beverages** — the workbook leaves this heading blank; grouped provisionally. Confirm the name.

## Variant items (slash prices → variants, not text)

| Item | Category | Variants | Source cell |
|------|----------|----------|-------------|
| Mutton Shadeko | Non-Vegetarian Snacks | Boiled Rs 300; Fried Rs 320 | J9 / L9 (`300/320`) |
| Chicken Shadeko | Non-Vegetarian Snacks | Boiled Rs 280; Fried Rs 300 | J12 / L12 (`280/300`) |
| Saussage | Non-Vegetarian Snacks | Fried Rs 260; Boiled Rs 270 | J18 / L18 (`260/270`) |

## Suspected spelling corrections (NOT auto-applied — confirm meaning)

| Raw name (kept) | Suggestion | Category | Source cell |
|-----------------|------------|----------|-------------|
| Milk Coffee Nascoffe | Nescafé | Coffee Items | B12 |
| Black Coffee Nascoffe | Nescafé | Coffee Items | B13 |
| Lamonade | Lemonade | Cold Beverages | B28 |
| Musli | Muesli | Breakfast | F9 |
| Veg Burgar | Burger | Sandwiches & Burgers | F16 |
| Chicken Shapta | Shapta (confirm spelling) | Non-Vegetarian Snacks | J11 |
| Chicken Loly Pop | Lollipop | Non-Vegetarian Snacks | J14 |
| Draigon Chicken | Dragon | Non-Vegetarian Snacks | J16 |
| Saussage Fried/Boiled | Sausage | Non-Vegetarian Snacks | J18 |
| Chcken Fried Momo | Chicken | Momo | J22 |
| Veg. Thupka | Thukpa | Fast Food | J41 |
| Chicken Thupka | Thukpa | Fast Food | J42 |

## Full item list by group

### Coffee Items (15)

| # | Raw name | Display name | Price (Rs) | source_ref | Cell |
|---|----------|--------------|-----------|------------|------|
| 1 | Espresso | Espresso | 90 | `dsp:coffee-items:espresso` | B5 |
| 2 | Doppio | Doppio | 130 | `dsp:coffee-items:doppio` | B6 |
| 3 | Americano | Americano | 120 | `dsp:coffee-items:americano` | B7 |
| 4 | Americano Double Shot | Americano Double Shot | 130 | `dsp:coffee-items:americano-double-shot` | B8 |
| 5 | Cappuccino | Cappuccino | 150 | `dsp:coffee-items:cappuccino` | B9 |
| 6 | Café latte | Café latte | 140 | `dsp:coffee-items:caf-latte` | B10 |
| 7 | Macchiato | Macchiato | 120 | `dsp:coffee-items:macchiato` | B11 |
| 8 | Milk Coffee Nascoffe | Milk Coffee Nascoffe | 80 | `dsp:coffee-items:milk-coffee-nascoffe` | B12 |
| 9 | Black Coffee Nascoffe | Black Coffee Nascoffe | 60 | `dsp:coffee-items:black-coffee-nascoffe` | B13 |
| 10 | Milk Masala Tea | Milk Masala Tea | 40 | `dsp:coffee-items:milk-masala-tea` | B14 |
| 11 | Black Tea | Black Tea | 30 | `dsp:coffee-items:black-tea` | B15 |
| 12 | Green Tea | Green Tea | 50 | `dsp:coffee-items:green-tea` | B16 |
| 13 | Herbal Tea | Herbal Tea | 50 | `dsp:coffee-items:herbal-tea` | B17 |
| 14 | Hot Lemon Honey | Hot Lemon Honey | 150 | `dsp:coffee-items:hot-lemon-honey` | B18 |
| 15 | Hot Lemon | Hot Lemon | 80 | `dsp:coffee-items:hot-lemon` | B19 |

### Cold Coffee (5)

| # | Raw name | Display name | Price (Rs) | source_ref | Cell |
|---|----------|--------------|-----------|------------|------|
| 1 | Iced Americano | Iced Americano | 150 | `dsp:cold-coffee:iced-americano` | B21 |
| 2 | Cola Americano | Cola Americano | 180 | `dsp:cold-coffee:cola-americano` | B22 |
| 3 | Iced Latte | Iced Latte | 200 | `dsp:cold-coffee:iced-latte` | B23 |
| 4 | Iced Mocha | Iced Mocha | 220 | `dsp:cold-coffee:iced-mocha` | B24 |
| 5 | Oreo Frappe | Oreo Frappe | 300 | `dsp:cold-coffee:oreo-frappe` | B25 |

### Cold Beverages (10) — _provisional group_

| # | Raw name | Display name | Price (Rs) | source_ref | Cell |
|---|----------|--------------|-----------|------------|------|
| 1 | Lemon Ice Tea | Lemon Ice Tea | 150 | `dsp:cold-beverages:lemon-ice-tea` | B27 |
| 2 | Lamonade | Lamonade | 80 | `dsp:cold-beverages:lamonade` | B28 |
| 3 | Virgin Mojito | Virgin Mojito | 250 | `dsp:cold-beverages:virgin-mojito` | B29 |
| 4 | Chocolate Milkshake | Chocolate Milkshake | 200 | `dsp:cold-beverages:chocolate-milkshake` | B30 |
| 5 | Banana Milkshake | Banana Milkshake | 250 | `dsp:cold-beverages:banana-milkshake` | B31 |
| 6 | Banana Lassi | Banana Lassi | 200 | `dsp:cold-beverages:banana-lassi` | B32 |
| 7 | Sweet Lassi | Sweet Lassi | 150 | `dsp:cold-beverages:sweet-lassi` | B33 |
| 8 | Real Juice | Real Juice | 150 | `dsp:cold-beverages:real-juice` | B34 |
| 9 | Cold Drinks | Cold Drinks | 80 | `dsp:cold-beverages:cold-drinks` | B35 |
| 10 | Red Bull | Red Bull | 150 | `dsp:cold-beverages:red-bull` | B36 |

### Fresh Juice (3)

| # | Raw name | Display name | Price (Rs) | source_ref | Cell |
|---|----------|--------------|-----------|------------|------|
| 1 | Watermelon | Watermelon | 200 | `dsp:fresh-juice:watermelon` | B38 |
| 2 | Apple | Apple | 250 | `dsp:fresh-juice:apple` | B39 |
| 3 | Orange | Orange | 220 | `dsp:fresh-juice:orange` | B40 |

### Breakfast (6)

| # | Raw name | Display name | Price (Rs) | source_ref | Cell |
|---|----------|--------------|-----------|------------|------|
| 1 | Masala  Omelette | Masala Omelette | 150 | `dsp:breakfast:masala-omelette` | F5 |
| 2 | Bread Omelette | Bread Omelette | 200 | `dsp:breakfast:bread-omelette` | F6 |
| 3 | Aloo Paratha | Aloo Paratha | 180 | `dsp:breakfast:aloo-paratha` | F7 |
| 4 | Plain Paratha | Plain Paratha | 120 | `dsp:breakfast:plain-paratha` | F8 |
| 5 | Musli | Musli | 150 | `dsp:breakfast:musli` | F9 |
| 6 | Fruit Platter | Fruit Platter | 300 | `dsp:breakfast:fruit-platter` | F10 |

### Sandwiches & Burgers (5)

| # | Raw name | Display name | Price (Rs) | source_ref | Cell |
|---|----------|--------------|-----------|------------|------|
| 1 | Veg Sandwich | Veg Sandwich | 170 | `dsp:sandwiches-and-burgers:veg-sandwich` | F13 |
| 2 | Chicken Sandwich | Chicken Sandwich | 260 | `dsp:sandwiches-and-burgers:chicken-sandwich` | F14 |
| 3 | Club Sandwich | Club Sandwich | 300 | `dsp:sandwiches-and-burgers:club-sandwich` | F15 |
| 4 | Veg Burgar | Veg Burgar | 220 | `dsp:sandwiches-and-burgers:veg-burgar` | F16 |
| 5 | Chicken Burger | Chicken Burger | 300 | `dsp:sandwiches-and-burgers:chicken-burger` | F17 |

### Pizza (4)

| # | Raw name | Display name | Price (Rs) | source_ref | Cell |
|---|----------|--------------|-----------|------------|------|
| 1 | Veg. Pizza | Veg. Pizza | 450 | `dsp:pizza:veg-pizza` | F20 |
| 2 | Chicken Pizza | Chicken Pizza | 500 | `dsp:pizza:chicken-pizza` | F21 |
| 3 | Paneer Pizza | Paneer Pizza | 500 | `dsp:pizza:paneer-pizza` | F22 |
| 4 | Mushroom Pizza | Mushroom Pizza | 450 | `dsp:pizza:mushroom-pizza` | F23 |

### Soups (3)

| # | Raw name | Display name | Price (Rs) | source_ref | Cell |
|---|----------|--------------|-----------|------------|------|
| 1 | Veg Hot N Sour | Veg Hot N Sour | 180 | `dsp:soups:veg-hot-n-sour` | F26 |
| 2 | Chicken Hot N Sour | Chicken Hot N Sour | 200 | `dsp:soups:chicken-hot-n-sour` | F27 |
| 3 | Mushroom Soup | Mushroom Soup | 190 | `dsp:soups:mushroom-soup` | F28 |

### Vegetarian Snacks (12)

| # | Raw name | Display name | Price (Rs) | source_ref | Cell |
|---|----------|--------------|-----------|------------|------|
| 1 | Gurashe Aloo | Gurashe Aloo | 250 | `dsp:vegetarian-snacks:gurashe-aloo` | F31 |
| 2 | French Fries | French Fries | 220 | `dsp:vegetarian-snacks:french-fries` | F32 |
| 3 | Honey Chilly Potato | Honey Chilly Potato | 290 | `dsp:vegetarian-snacks:honey-chilly-potato` | F33 |
| 4 | Corn Salt N Pepper | Corn Salt N Pepper | 300 | `dsp:vegetarian-snacks:corn-salt-n-pepper` | F34 |
| 5 | Paneer Pakoda | Paneer Pakoda | 390 | `dsp:vegetarian-snacks:paneer-pakoda` | F35 |
| 6 | Paneer Chilly | Paneer Chilly | 400 | `dsp:vegetarian-snacks:paneer-chilly` | F36 |
| 7 | Veg. Pakoda | Veg. Pakoda | 180 | `dsp:vegetarian-snacks:veg-pakoda` | F37 |
| 8 | Mushroom Chilly | Mushroom Chilly | 320 | `dsp:vegetarian-snacks:mushroom-chilly` | F38 |
| 9 | Mushroom Pakoda | Mushroom Pakoda | 280 | `dsp:vegetarian-snacks:mushroom-pakoda` | F39 |
| 10 | Mushroom Chhoila | Mushroom Chhoila | 300 | `dsp:vegetarian-snacks:mushroom-chhoila` | F40 |
| 11 | Peanut Shadeko | Peanut Shadeko | 190 | `dsp:vegetarian-snacks:peanut-shadeko` | F41 |
| 12 | Cashewnut Fry | Cashewnut Fry | 400 | `dsp:vegetarian-snacks:cashewnut-fry` | F42 |

### Non-Vegetarian Snacks (14)

| # | Raw name | Display name | Price (Rs) | source_ref | Cell |
|---|----------|--------------|-----------|------------|------|
| 1 | Mutton Sekuwa | Mutton Sekuwa | 360 | `dsp:non-vegetarian-snacks:mutton-sekuwa` | J5 |
| 2 | Mutton Tass Set | Mutton Tass Set | 360 | `dsp:non-vegetarian-snacks:mutton-tass-set` | J6 |
| 3 | Jhaneko Sekuwa | Jhaneko Sekuwa | 400 | `dsp:non-vegetarian-snacks:jhaneko-sekuwa` | J7 |
| 4 | Mutton Chhoila | Mutton Chhoila | 380 | `dsp:non-vegetarian-snacks:mutton-chhoila` | J8 |
| 5 | Mutton Shadeko Boiled/Fried | Mutton Shadeko | Boiled 300 / Fried 320 | `dsp:non-vegetarian-snacks:mutton-shadeko` | J9 |
| 6 | Chicken Sekuwa | Chicken Sekuwa | 300 | `dsp:non-vegetarian-snacks:chicken-sekuwa` | J10 |
| 7 | Chicken Shapta | Chicken Shapta | 350 | `dsp:non-vegetarian-snacks:chicken-shapta` | J11 |
| 8 | Chicken Shadeko Boiled/Fried | Chicken Shadeko | Boiled 280 / Fried 300 | `dsp:non-vegetarian-snacks:chicken-shadeko` | J12 |
| 9 | Chicken Chhoila | Chicken Chhoila | 320 | `dsp:non-vegetarian-snacks:chicken-chhoila` | J13 |
| 10 | Chicken Loly Pop | Chicken Loly Pop | 350 | `dsp:non-vegetarian-snacks:chicken-loly-pop` | J14 |
| 11 | Chicken Wings | Chicken Wings | 370 | `dsp:non-vegetarian-snacks:chicken-wings` | J15 |
| 12 | Draigon Chicken | Draigon Chicken | 350 | `dsp:non-vegetarian-snacks:draigon-chicken` | J16 |
| 13 | Kalejo Pangro | Kalejo Pangro | 250 | `dsp:non-vegetarian-snacks:kalejo-pangro` | J17 |
| 14 | Saussage Fried/Boiled | Saussage | Fried 260 / Boiled 270 | `dsp:non-vegetarian-snacks:saussage` | J18 |

### Momo (10)

| # | Raw name | Display name | Price (Rs) | source_ref | Cell |
|---|----------|--------------|-----------|------------|------|
| 1 | Chicken Steam Momo | Chicken Steam Momo | 180 | `dsp:momo:chicken-steam-momo` | J21 |
| 2 | Chcken Fried Momo | Chcken Fried Momo | 200 | `dsp:momo:chcken-fried-momo` | J22 |
| 3 | Chicken C Momo | Chicken C Momo | 250 | `dsp:momo:chicken-c-momo` | J23 |
| 4 | Chicken Chilly Momo | Chicken Chilly Momo | 250 | `dsp:momo:chicken-chilly-momo` | J24 |
| 5 | Chicken Jhol Momo | Chicken Jhol Momo | 250 | `dsp:momo:chicken-jhol-momo` | J25 |
| 6 | Mutton Steam Momo | Mutton Steam Momo | 200 | `dsp:momo:mutton-steam-momo` | J26 |
| 7 | Mutton Fried Momo | Mutton Fried Momo | 200 | `dsp:momo:mutton-fried-momo` | J27 |
| 8 | Mutton C Momo | Mutton C Momo | 280 | `dsp:momo:mutton-c-momo` | J28 |
| 9 | Mutton Chilly Momo | Mutton Chilly Momo | 280 | `dsp:momo:mutton-chilly-momo` | J29 |
| 10 | Mutton Jhol Momo | Mutton Jhol Momo | 290 | `dsp:momo:mutton-jhol-momo` | J30 |

### Fast Food (10)

| # | Raw name | Display name | Price (Rs) | source_ref | Cell |
|---|----------|--------------|-----------|------------|------|
| 1 | Veg. Chowmin | Veg. Chowmin | 150 | `dsp:fast-food:veg-chowmin` | J33 |
| 2 | Egg Chowmin | Egg Chowmin | 180 | `dsp:fast-food:egg-chowmin` | J34 |
| 3 | Chicken Chowmin | Chicken Chowmin | 220 | `dsp:fast-food:chicken-chowmin` | J35 |
| 4 | Mix Chowmin | Mix Chowmin | 280 | `dsp:fast-food:mix-chowmin` | J36 |
| 5 | Veg. Fried Rice | Veg. Fried Rice | 250 | `dsp:fast-food:veg-fried-rice` | J37 |
| 6 | Egg Fried Rice | Egg Fried Rice | 270 | `dsp:fast-food:egg-fried-rice` | J38 |
| 7 | Chicken Fried Rice | Chicken Fried Rice | 300 | `dsp:fast-food:chicken-fried-rice` | J39 |
| 8 | Mix Fried Rice | Mix Fried Rice | 360 | `dsp:fast-food:mix-fried-rice` | J40 |
| 9 | Veg. Thupka | Veg. Thupka | 170 | `dsp:fast-food:veg-thupka` | J41 |
| 10 | Chicken Thupka | Chicken Thupka | 220 | `dsp:fast-food:chicken-thupka` | J42 |

### Biryani (6)

| # | Raw name | Display name | Price (Rs) | source_ref | Cell |
|---|----------|--------------|-----------|------------|------|
| 1 | Normal Biryani | Normal Biryani | 120 | `dsp:biryani:normal-biryani` | N5 |
| 2 | Small Matka Biryani | Small Matka Biryani | 200 | `dsp:biryani:small-matka-biryani` | N6 |
| 3 | Jumbo Matka Biryani | Jumbo Matka Biryani | 250 | `dsp:biryani:jumbo-matka-biryani` | N7 |
| 4 | Family Matka Biryani | Family Matka Biryani | 750 | `dsp:biryani:family-matka-biryani` | N8 |
| 5 | Biryani Combo Set | Biryani Combo Set | 1000 | `dsp:biryani:biryani-combo-set` | N9 |
| 6 | Extra Gravy | Extra Gravy | 20 | `dsp:biryani:extra-gravy` | N10 |
