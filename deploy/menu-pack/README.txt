Kathmandu Momo — menu upload pack
=================================

Env (cPanel):
  UPLOADS_DIR = /home/thehairc/kathmandu-momo
  IMAGES_PATH = /uploads

Steps
-----
1. On the server, create the folder if needed:
     mkdir -p /home/thehairc/kathmandu-momo/menu
     chmod 750 /home/thehairc/kathmandu-momo

2. Upload EVERY .jpg from this pack's menu/ folder into:
     /home/thehairc/kathmandu-momo/menu/

3. In phpPgAdmin, open your app database and run:
     seed_menu.sql

4. Restart the Node.js app in cPanel.

5. Check:
     https://yoursite/menu
     https://yoursite/uploads/menu/veg-boil.jpg

Notes
-----
- Stock Unsplash photos (placeholders). Replace any file in menu/ with a
  real photo using the SAME filename to keep SQL URLs working.
- seed SQL deletes existing menu_categories / menu_items first.
- Total items: 91
