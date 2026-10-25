#!/bin/bash

# ==============================================================================
# QUY HOẠCH TÀI NGUYÊN BẰNG SYSTEMD SLICES 
# ==============================================================================
# Script này phải được chạy dưới quyền root (sudo)
if [ "$EUID" -ne 0 ]; then
  echo "Vui lòng chạy script này với quyền root (ví dụ: sudo bash setup_vps_limits.sh)"
  exit 1
fi

echo "Bắt đầu thiết lập giới hạn tài nguyên Systemd..."

# 1. TẠO NOVA SLICE (RAM max 3G, CPU ưu tiên cao)
cat <<EOF > /etc/systemd/system/nova.slice
[Unit]
Description=NOVA Trading Bot Slice
Before=slices.target

[Slice]
# Giới hạn tổng RAM cho tất cả các tiến trình NOVA là 3GB
MemoryMax=3G
# Ưu tiên CPU cao (mặc định là 100)
CPUWeight=200
EOF

# 2. TẠO VIPROSELL SLICE (RAM max 2G, CPU trung bình)
cat <<EOF > /etc/systemd/system/viprosell.slice
[Unit]
Description=Viprosell UI and Backend Slice
Before=slices.target

[Slice]
# Giới hạn tổng RAM cho Viprosell là 2GB
MemoryMax=2G
# Ưu tiên CPU bình thường
CPUWeight=100
EOF

# 3. ÁP DỤNG SLICE CHO CÁC SERVICE CỦA NOVA
NOVA_SERVICES=(
  "nova-execution.service"
  "nova-oracle.service"
  "nova-quant.service"
  "nova-risk.service"
  "nova-signal.service"
  "nova-telegram.service"
  "nova-writer.service"
)

for service in "${NOVA_SERVICES[@]}"; do
  echo "Gắn $service vào nova.slice..."
  mkdir -p "/etc/systemd/system/${service}.d"
  cat <<EOF > "/etc/systemd/system/${service}.d/slice.conf"
[Service]
Slice=nova.slice
EOF
done

# 4. ÁP DỤNG SLICE CHO CÁC SERVICE CỦA VIPROSELL
VIPROSELL_SERVICES=(
  "viprosell.service"
)
# viprosell-worker.service đã gỡ khỏi VPS ngày 24/10/2026: render chạy ở máy nhà.
# VPS chỉ 2 vCPU và chạy chung với NOVA (giao dịch tiền thật) + NinhClaw;
# worker bị bó 0,5 nhân thì một video mất 3-4,5 phút, không đáng. Đừng thêm lại.

for service in "${VIPROSELL_SERVICES[@]}"; do
  echo "Gắn $service vào viprosell.slice..."
  mkdir -p "/etc/systemd/system/${service}.d"
  cat <<EOF > "/etc/systemd/system/${service}.d/slice.conf"
[Service]
Slice=viprosell.slice
EOF
done

# 5. TẢI LẠI CẤU HÌNH VÀ KHỞI ĐỘNG LẠI DỊCH VỤ
echo "Tải lại systemd daemon..."
systemctl daemon-reload

echo "Khởi động lại các dịch vụ để nhận giới hạn mới..."
for service in "${NOVA_SERVICES[@]}" "${VIPROSELL_SERVICES[@]}"; do
  # Chỉ restart nếu service đang được enable/active để tránh lỗi
  if systemctl is-active --quiet "$service"; then
    echo "Restarting $service..."
    systemctl restart "$service"
  fi
done

echo "======================================================================"
echo "Hoàn tất! Các service hiện đã được quy hoạch vào các Slice riêng biệt."
echo "Bạn có thể kiểm tra trạng thái bằng lệnh:"
echo "  systemd-cgtop"
echo "  systemctl status nova.slice"
echo "  systemctl status viprosell.slice"
echo "======================================================================"
