import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_REGULAR = "C:/Windows/Fonts/segoeui.ttf"
FONT_SEMIBOLD = "C:/Windows/Fonts/seguisb.ttf"
if not os.path.exists(FONT_SEMIBOLD):
    FONT_SEMIBOLD = FONT_BOLD

def create_gradient(width, height, color1, color2):
    base = Image.new('RGBA', (width, height), color1)
    top = Image.new('RGBA', (width, height), color2)
    mask = Image.new('L', (width, height))
    mask_data = []
    for y in range(height):
        for x in range(width):
            # Diagonal gradient
            t = (x / width * 0.7 + y / height * 0.7)
            t = min(1.0, max(0.0, t))
            mask_data.append(int(255 * t))
    mask.putdata(mask_data)
    base.paste(top, (0, 0), mask)
    return base

def generate_logo():
    size = 512
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Rounded squircle background
    radius = 120
    rect = [24, 24, size - 24, size - 24]
    
    # Draw dark gradient box
    bg = create_gradient(size, size, (15, 23, 42, 255), (30, 27, 75, 255))
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(rect, radius=radius, fill=255)
    im.paste(bg, (0, 0), mask)

    # Border stroke
    border_draw = ImageDraw.Draw(im)
    border_draw.rounded_rectangle(rect, radius=radius, outline=(255, 255, 255, 35), width=4)

    # Fonts
    font_cs = ImageFont.truetype(FONT_BOLD, 170)
    font_ai = ImageFont.truetype(FONT_BOLD, 120)

    # Text measurements
    # 'cs'
    cs_text = "cs"
    ai_text = ".ai"
    
    # Draw text
    draw_txt = ImageDraw.Draw(im)
    # Positioning
    cs_x = 90
    cs_y = 175
    draw_txt.text((cs_x, cs_y), cs_text, font=font_cs, fill=(255, 255, 255, 255))
    
    ai_x = cs_x + 185
    ai_y = cs_y + 35
    draw_txt.text((ai_x, ai_y), ai_text, font=font_ai, fill=(16, 185, 129, 255))

    # Glowing dot indicator
    dot_x = 415
    dot_y = 125
    # Outer glow
    for r in range(22, 10, -2):
        alpha = int(40 * (1 - (r - 10) / 12))
        draw_txt.ellipse([dot_x - r, dot_y - r, dot_x + r, dot_y + r], fill=(16, 185, 129, alpha))
    draw_txt.ellipse([dot_x - 10, dot_y - 10, dot_x + 10, dot_y + 10], fill=(52, 211, 153, 255))

    # Save logo
    im.save("logo.png", "PNG")
    im.save("client/public/logo.png", "PNG")
    im.save("client/public/favicon.png", "PNG")
    print("Logo PNG generated successfully.")

def generate_thumbnail():
    width = 1200
    height = 630
    
    # Base dark gradient
    im = create_gradient(width, height, (8, 12, 20, 255), (15, 23, 42, 255))
    draw = ImageDraw.Draw(im)

    # Subtle grid lines
    grid_color = (255, 255, 255, 8)
    for x in range(0, width, 40):
        draw.line([(x, 0), (x, height)], fill=grid_color, width=1)
    for y in range(0, height, 40):
        draw.line([(0, y), (width, y)], fill=grid_color, width=1)

    # Glowing background ambient light
    glow_im = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_im)
    glow_draw.ellipse([800, 250, 1300, 750], fill=(16, 185, 129, 22))
    glow_draw.ellipse([50, -50, 450, 350], fill=(99, 102, 241, 24))
    glow_im = glow_im.filter(ImageFilter.GaussianBlur(80))
    im.paste(glow_im, (0, 0), glow_im)

    # Main Card
    card_margin_x = 100
    card_margin_y = 65
    card_rect = [card_margin_x, card_margin_y, width - card_margin_x, height - card_margin_y]
    
    card_overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    c_draw = ImageDraw.Draw(card_overlay)
    c_draw.rounded_rectangle(card_rect, radius=24, fill=(18, 24, 38, 220), outline=(255, 255, 255, 28), width=2)
    im.paste(card_overlay, (0, 0), card_overlay)

    draw = ImageDraw.Draw(im)

    # 1. Monogram Box
    icon_box = [card_margin_x + 60, card_margin_y + 60, card_margin_x + 160, card_margin_y + 160]
    draw.rounded_rectangle(icon_box, radius=20, fill=(15, 23, 42, 255), outline=(255, 255, 255, 35), width=2)
    
    font_icon_cs = ImageFont.truetype(FONT_BOLD, 42)
    font_icon_ai = ImageFont.truetype(FONT_BOLD, 30)
    draw.text((icon_box[0] + 18, icon_box[1] + 24), "cs", font=font_icon_cs, fill=(255, 255, 255, 255))
    draw.text((icon_box[0] + 58, icon_box[1] + 34), ".ai", font=font_icon_ai, fill=(16, 185, 129, 255))
    draw.ellipse([icon_box[0] + 82, icon_box[1] + 16, icon_box[0] + 90, icon_box[1] + 24], fill=(52, 211, 153, 255))

    # 2. Pill Badge: "FINTECH AI ENGINE"
    badge_x = card_margin_x + 180
    badge_y = card_margin_y + 64
    badge_w = 175
    badge_h = 28
    draw.rounded_rectangle([badge_x, badge_y, badge_x + badge_w, badge_y + badge_h], radius=14, fill=(16, 185, 129, 30), outline=(16, 185, 129, 80), width=1)
    font_badge = ImageFont.truetype(FONT_BOLD, 12)
    draw.text((badge_x + 16, badge_y + 6), "FINTECH AI ENGINE", font=font_badge, fill=(52, 211, 153, 255))

    # 3. Main Title
    title_y = badge_y + 36
    font_title_bold = ImageFont.truetype(FONT_BOLD, 46)
    font_title_light = ImageFont.truetype(FONT_REGULAR, 46)
    draw.text((badge_x, title_y), "cs.ai", font=font_title_bold, fill=(255, 255, 255, 255))
    draw.text((badge_x + 115, title_y), "| ClearSettle", font=font_title_light, fill=(148, 163, 184, 255))

    # 4. Subheadline
    sub_y = card_margin_y + 185
    font_sub = ImageFont.truetype(FONT_SEMIBOLD, 24)
    draw.text((card_margin_x + 60, sub_y), "AI Obligation Management & PayPal Payment Reconciliation Platform", font=font_sub, fill=(241, 245, 249, 255))

    # 5. Core Proposition
    prop_y = sub_y + 40
    font_prop = ImageFont.truetype(FONT_REGULAR, 17)
    draw.text((card_margin_x + 60, prop_y), "Connects what people agreed to pay, ledger math, PayPal capture status, and net proceeds.", font=font_prop, fill=(148, 163, 184, 255))

    # 6. Feature Pills
    pills = [
        ("PayPal Orders v2", (56, 189, 248)),
        ("Multi-Currency Core", (16, 185, 129)),
        ("SHA-256 Audit Chain", (168, 85, 247)),
        ("Google OAuth 2.0", (245, 158, 11)),
    ]
    pill_start_x = card_margin_x + 60
    pill_y = card_margin_y + 330
    pill_w = 200
    pill_h = 44
    font_pill = ImageFont.truetype(FONT_SEMIBOLD, 14)

    for i, (name, color) in enumerate(pills):
        px = pill_start_x + i * (pill_w + 16)
        draw.rounded_rectangle([px, pill_y, px + pill_w, pill_y + pill_h], radius=12, fill=(255, 255, 255, 12), outline=(255, 255, 255, 25), width=1)
        # Dot
        draw.ellipse([px + 16, pill_y + 17, px + 26, pill_y + 27], fill=color)
        draw.text((px + 36, pill_y + 12), name, font=font_pill, fill=(248, 250, 252, 255))

    # 7. Hackathon Tag
    font_tag = ImageFont.truetype(FONT_BOLD, 13)
    draw.text((width - card_margin_x - 220, height - card_margin_y - 38), "PAYPAL HACKATHON 2026", font=font_tag, fill=(100, 116, 139, 255))

    # Save
    im.save("thumbnail.png", "PNG")
    im.save("client/public/thumbnail.png", "PNG")
    print("Thumbnail PNG generated successfully.")

if __name__ == '__main__':
    generate_logo()
    generate_thumbnail()
