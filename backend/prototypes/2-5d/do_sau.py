"""Sinh ban do do sau bang Depth Anything V2 Small (ONNX), chay tren CPU.

Dau ra cua mo hinh la DO SAU NGHICH: gia tri LON = GAN may quay. Dung luon
quy uoc do cho phep thi sai, nen khong dao nguoc.

Chay: python do_sau.py <mo_hinh.onnx> <anh_vao> <anh_do_sau_ra> [canh]
"""
import os
import sys
import time

import numpy as np
import onnxruntime as ort
from PIL import Image

TRUNG_BINH = np.array([0.485, 0.456, 0.406], dtype=np.float32)
DO_LECH = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def main() -> None:
    mo_hinh, duong_vao, duong_ra = sys.argv[1], sys.argv[2], sys.argv[3]
    canh = int(sys.argv[4]) if len(sys.argv) > 4 else 518
    canh -= canh % 14  # mo hinh doi kich thuoc chia het cho 14

    goc = Image.open(duong_vao).convert("RGB")
    nho = goc.resize((canh, canh), Image.BILINEAR)

    x = np.asarray(nho).astype(np.float32) / 255.0
    x = (x - TRUNG_BINH) / DO_LECH
    x = x.transpose(2, 0, 1)[None]  # NCHW

    # Chan o 4: dat intra_op = 32 lam onnxruntime 1.31.1 segfault tren may nay.
    # KVM 4 chi co 4 nhan nen tran nay cung dung luon cho ban chay that.
    so_luong = min(4, os.cpu_count() or 4)
    tuy_chon = ort.SessionOptions()
    tuy_chon.intra_op_num_threads = so_luong
    tuy_chon.inter_op_num_threads = 1
    phien = ort.InferenceSession(mo_hinh, tuy_chon, providers=["CPUExecutionProvider"])

    bat_dau = time.time()
    ra = phien.run(None, {"pixel_values": x})[0]
    giay = time.time() - bat_dau

    do_sau = np.squeeze(ra).astype(np.float32)
    thap, cao = float(do_sau.min()), float(do_sau.max())
    chuan = (do_sau - thap) / max(1e-6, cao - thap)

    anh_ra = Image.fromarray((chuan * 255).astype(np.uint8)).resize(goc.size, Image.BICUBIC)
    anh_ra.save(duong_ra)

    print(f"suy luan {giay:.2f}s tren {so_luong} nhan, dau vao {canh}x{canh}")
    print(f"anh goc {goc.size[0]}x{goc.size[1]} -> ban do do sau {anh_ra.size[0]}x{anh_ra.size[1]}")
    print(f"khoang do sau tho: {thap:.3f} .. {cao:.3f}")
    # Phan vi de biet ban do co trai deu hay dinh het ve mot phia
    for q in (5, 25, 50, 75, 95):
        print(f"  phan vi {q:>2}%: {np.percentile(chuan, q):.3f}")


if __name__ == "__main__":
    main()
