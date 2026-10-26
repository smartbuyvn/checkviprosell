#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Viprosell VPS Security Setup Script
# Tạo user riêng biệt, hardening SSH, kiểm tra bảo mật
# Chạy với: bash vps_security_setup.sh
# ═══════════════════════════════════════════════════════════════
set -e

VIPRO_USER="viprosell"
VIPRO_HOME="/home/viprosell"
VIPRO_PUBKEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPbAx+/Aosfh1tLFVceXpyDvoZENeFZFZC3h6tQ3mkV1 smartbuysaigon@gmail.com"

echo "========================================"
echo " [1/6] Tạo user viprosell riêng biệt"
echo "========================================"

if id "$VIPRO_USER" &>/dev/null; then
  echo "[OK] User $VIPRO_USER đã tồn tại"
else
  useradd -m -s /bin/bash -d "$VIPRO_HOME" "$VIPRO_USER"
  echo "[OK] Đã tạo user $VIPRO_USER"
fi

# Tạo thư mục .ssh cho viprosell user
mkdir -p "$VIPRO_HOME/.ssh"
chmod 700 "$VIPRO_HOME/.ssh"

# Cấp authorized_keys (PUBLIC key của smartbuysaigon)
echo "$VIPRO_PUBKEY" > "$VIPRO_HOME/.ssh/authorized_keys"
chmod 600 "$VIPRO_HOME/.ssh/authorized_keys"
chown -R "$VIPRO_USER:$VIPRO_USER" "$VIPRO_HOME/.ssh"
echo "[OK] SSH key đã được cấp cho $VIPRO_USER"

echo ""
echo "========================================"
echo " [2/6] Phân quyền thư mục /srv/viprosell"
echo "========================================"

# Chuyển ownership /srv/viprosell sang viprosell user
# Nhưng giữ thư mục renders_output có thể ghi bởi worker
if [ -d "/srv/viprosell" ]; then
  chown -R "$VIPRO_USER:$VIPRO_USER" "/srv/viprosell"
  # Nginx cần đọc được dist/
  chmod -R 755 "/srv/viprosell/dist"
  find "/srv/viprosell/dist" -type f -exec chmod 644 {} \;
  echo "[OK] Phân quyền /srv/viprosell xong"
else
  echo "[SKIP] /srv/viprosell chưa tồn tại"
fi

echo ""
echo "========================================"
echo " [3/6] Hardening SSH config"
echo "========================================"

SSH_CONF="/etc/ssh/sshd_config.d/viprosell-hardening.conf"
cat > "$SSH_CONF" << 'SSHEOF'
# Viprosell SSH Hardening - DO NOT EDIT MANUALLY
# Chỉ cho phép đăng nhập bằng key, không dùng password
PermitRootLogin prohibit-password
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
X11Forwarding no
AllowTcpForwarding no
MaxAuthTries 3
LoginGraceTime 30
SSHEOF

systemctl reload sshd
echo "[OK] SSH hardening áp dụng xong"

echo ""
echo "========================================"
echo " [4/6] Kiểm tra .env files - scan credentials"
echo "========================================"

echo "=== .env files trên toàn VPS ==="
find / -name ".env" -not -path "*/proc/*" -not -path "*/sys/*" 2>/dev/null | while read f; do
  echo "[FILE] $f"
  # Hiển thị keys nhưng MASKING values
  grep -E "^[A-Z_]+=.+" "$f" | sed 's/=.*/=***MASKED***/' 2>/dev/null || true
  echo ""
done

echo "=== Kiểm tra .env có bị expose qua nginx không ==="
grep -r "\.env" /etc/nginx/ 2>/dev/null | grep -v "#" || echo "[OK] Không thấy nginx serve .env files"

echo ""
echo "========================================"
echo " [5/6] Kiểm tra secrets có trong git history"
echo "========================================"

if [ -d "/srv/viprosell/.git" ]; then
  echo "=== Git repo tồn tại, kiểm tra .gitignore ==="
  if grep -q "\.env" "/srv/viprosell/.gitignore" 2>/dev/null; then
    echo "[OK] .env có trong .gitignore"
  else
    echo "[WARN] .env KHÔNG có trong .gitignore - nguy hiểm!"
  fi
else
  echo "[OK] Không có git repo trong /srv/viprosell"
fi

echo ""
echo "========================================"
echo " [6/6] Kiểm tra ports và firewall"
echo "========================================"

echo "=== Ports đang lắng nghe ==="
ss -tlnp 2>/dev/null | head -30

echo ""
echo "=== Firewall rules (UFW) ==="
ufw status 2>/dev/null || echo "[INFO] UFW chưa cài"

echo ""
echo "========================================"
echo " SETUP HOÀN TẤT"
echo "========================================"
echo ""
echo "Kết nối SSH với user viprosell:"
echo "  ssh -i <your_key> viprosell@76.13.210.71"
echo ""
echo "QUAN TRỌNG: Test kết nối trước khi đóng session root!"
