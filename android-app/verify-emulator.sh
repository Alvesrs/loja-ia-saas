#!/usr/bin/env bash
set -euo pipefail
adb install -r android-app/adminapp/build/outputs/apk/debug/adminapp-debug.apk
adb install -r android-app/estoqueapp/build/outputs/apk/debug/estoqueapp-debug.apk
for app in admin stock; do
  adb shell am force-stop "com.saintsai.$app"
  adb shell am start -W -n "com.saintsai.$app/.MainActivity"
  ready=0
  for attempt in $(seq 1 15); do
    adb shell uiautomator dump /sdcard/window.xml >/dev/null
    adb pull /sdcard/window.xml "android-app/$app-window.xml" >/dev/null
    if python3 - "$app" <<'PYTEST'
import sys
import xml.etree.ElementTree as ET
root = ET.parse('android-app/' + sys.argv[1] + '-window.xml')
text = ' '.join(n.get('text', '') + ' ' + n.get('content-desc', '') for n in root.iter())
assert 'Senha' in text and 'Entrar' in text and 'E-mail' in text, text
assert 'Tentar novamente' not in text, text
PYTEST
    then
      ready=1
      break
    fi
    sleep 3
  done
  if [ "$app" = admin ]; then image=admin; else image=estoque; fi
  adb exec-out screencap -p > "android-app/$image-screen.png"
  test "$ready" = 1
 done
