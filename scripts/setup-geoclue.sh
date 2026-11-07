#!/usr/bin/env bash
set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo $0" >&2
  exit 1
fi

echo "Installing geoclue package..."
pacman -S --needed --noconfirm geoclue

echo "Writing Trichy coordinates to /etc/geolocation..."
cat << 'EOF' > /etc/geolocation
10.7905
78.7047
88
10
EOF
chmod 644 /etc/geolocation

echo "Configuring /etc/geoclue/conf.d/99-trichy.conf..."
mkdir -p /etc/geoclue/conf.d
cat << 'EOF' > /etc/geoclue/conf.d/99-trichy.conf
[static-source]
enable=true

[brave]
allowed=true
system=false
users=

[brave-browser]
allowed=true
system=false
users=

[chromium]
allowed=true
system=false
users=

[google-chrome]
allowed=true
system=false
users=
EOF

echo "Enabling and restarting geoclue.service..."
systemctl enable --now geoclue.service
systemctl restart geoclue.service

echo ""
echo "GeoClue is active. Testing location via where-am-i demo..."
if [ -x /usr/lib/geoclue-2.0/demos/where-am-i ]; then
  /usr/lib/geoclue-2.0/demos/where-am-i -t 5 || true
fi

echo ""
echo "Setup complete! Reload http://localhost:3000/ and click 'My location'."
