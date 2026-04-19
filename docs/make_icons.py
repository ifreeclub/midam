"""
미담사진관 PWA 아이콘 생성
- icon-192.png (192x192)
- icon-512.png (512x512)
- icon-maskable-512.png (512x512, safe zone 적용)
"""

from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(OUT_DIR, exist_ok=True)

NAVY = (44, 62, 80, 255)
WHITE = (255, 255, 255, 255)

def make_icon(size, maskable=False):
    img = Image.new('RGBA', (size, size), NAVY)
    draw = ImageDraw.Draw(img)

    # maskable은 safe zone 80% 영역만 사용
    scale = 0.7 if maskable else 0.85
    inner = int(size * scale)
    offset = (size - inner) // 2

    # 카메라 본체
    body_top = offset + int(inner * 0.25)
    body_bottom = offset + int(inner * 0.85)
    body_left = offset + int(inner * 0.08)
    body_right = offset + int(inner * 0.92)
    draw.rounded_rectangle(
        [body_left, body_top, body_right, body_bottom],
        radius=int(inner * 0.08),
        fill=WHITE
    )

    # 상단 돌출부
    bump_w = int(inner * 0.25)
    bump_h = int(inner * 0.08)
    bump_cx = offset + inner // 2
    draw.rounded_rectangle(
        [bump_cx - bump_w // 2, body_top - bump_h,
         bump_cx + bump_w // 2, body_top + 2],
        radius=int(inner * 0.02),
        fill=WHITE
    )

    # 렌즈 (큰 원)
    lens_cx = offset + inner // 2
    lens_cy = (body_top + body_bottom) // 2 + int(inner * 0.05)
    lens_r = int(inner * 0.22)
    draw.ellipse(
        [lens_cx - lens_r, lens_cy - lens_r,
         lens_cx + lens_r, lens_cy + lens_r],
        fill=NAVY
    )

    # 렌즈 안쪽 원
    inner_r = int(lens_r * 0.65)
    draw.ellipse(
        [lens_cx - inner_r, lens_cy - inner_r,
         lens_cx + inner_r, lens_cy + inner_r],
        fill=WHITE
    )

    # 렌즈 중앙 점
    dot_r = int(lens_r * 0.35)
    draw.ellipse(
        [lens_cx - dot_r, lens_cy - dot_r,
         lens_cx + dot_r, lens_cy + dot_r],
        fill=NAVY
    )

    # 플래시 점
    flash_r = int(inner * 0.03)
    flash_x = body_right - int(inner * 0.1)
    flash_y = body_top + int(inner * 0.1)
    draw.ellipse(
        [flash_x - flash_r, flash_y - flash_r,
         flash_x + flash_r, flash_y + flash_r],
        fill=NAVY
    )

    return img

# 192
make_icon(192, maskable=False).save(os.path.join(OUT_DIR, 'icon-192.png'))
# 512
make_icon(512, maskable=False).save(os.path.join(OUT_DIR, 'icon-512.png'))
# maskable 512
make_icon(512, maskable=True).save(os.path.join(OUT_DIR, 'icon-maskable-512.png'))

print("아이콘 생성 완료:")
for f in os.listdir(OUT_DIR):
    path = os.path.join(OUT_DIR, f)
    print(f"  {f}: {os.path.getsize(path)} bytes")
