#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""autopilot のアイコン（虹色の ∞ + A）を作り直す（#2413）。

使い方（monorepo のルートで）:
  # 1. 元の画像から角丸の四角を切り出して autopilot-icon-512.png を作る（元の画像があるときだけ）
  python3 tools/autopilot/assets/make-icon.py crop <元の JPEG>
  # 2. autopilot-icon-512.png から、モニターに埋める data URI（src/icon-data.js）を作る
  python3 tools/autopilot/assets/make-icon.py datauri

依存は Pillow だけ（コンテナにある）。モニターは自己完結の HTML なので、画像は
data URI で埋める（外部のファイルを参照しない）。
"""
import base64
import io
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
MASTER = os.path.join(HERE, 'autopilot-icon-512.png')
OUT_JS = os.path.join(HERE, '..', 'src', 'icon-data.js')

# 元の画像（1376×768）の右の角丸の四角。測った外形は x 409〜966・y 51〜634・角の半径 約 80px。
# 縦が 26px 長いので、上下を同じだけ落として正方形にする（ゆがませない）。
# 縁の JPEG のにじみ（灰色）を入れないよう、外形より 2px 内側を切り、角の半径も少し大きめに取る。
CROP = (411, 66, 965, 620)  # 554×554
RADIUS = 82  # 切り出した 554px での角の半径
SIZE = 512

# モニターで使う大きさ。favicon は 64px、見出しは 20px 表示の 2 倍（40px）。
# apple-touch-icon（180px）は 70KB を超えて HTML が重くなり、減色すると地の紺に縞が出るので入れない。
SIZES = {'FAVICON_64': 64, 'HEADING_40': 40}


def rounded_mask(size, radius, scale=4):
    """縁がなめらかな角丸のマスク（大きく描いて縮める）。"""
    big = Image.new('L', (size * scale, size * scale), 0)
    ImageDraw.Draw(big).rounded_rectangle(
        (0, 0, size * scale - 1, size * scale - 1), radius=radius * scale, fill=255)
    return big.resize((size, size), Image.LANCZOS)


def crop(src):
    im = Image.open(src).convert('RGB').crop(CROP)
    side = im.size[0]
    rgba = im.convert('RGBA')
    rgba.putalpha(rounded_mask(side, RADIUS))
    rgba.resize((SIZE, SIZE), Image.LANCZOS).save(MASTER, optimize=True)
    print('wrote', MASTER)


def png_data_uri(im, px):
    small = im.resize((px, px), Image.LANCZOS)
    buf = io.BytesIO()
    small.save(buf, format='PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')


def datauri():
    im = Image.open(MASTER).convert('RGBA')
    lines = [
        "'use strict';",
        '// このファイルは tools/autopilot/assets/make-icon.py datauri が作る。手で直さない（#2413）。',
        '// 元は tools/autopilot/assets/autopilot-icon-512.png（虹色の ∞ + A のアイコン）。',
        '',
    ]
    for name, px in SIZES.items():
        lines.append(f"const ICON_{name} = '{png_data_uri(im, px)}';")
    lines.append('')
    lines.append('module.exports = { ' + ', '.join(f'ICON_{n}' for n in SIZES) + ' };')
    with open(OUT_JS, 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print('wrote', os.path.normpath(OUT_JS))


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'crop' and len(sys.argv) == 3:
        crop(sys.argv[2])
    elif cmd == 'datauri':
        datauri()
    else:
        sys.exit(__doc__)
