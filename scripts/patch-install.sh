#!/bin/bash
# Patch script to fix install.sh bugs

# Fix 1: Replace source ~/.bashrc on line 937
sudo sed -i '937s/.*/        # Source bashrc via subshell to avoid PS1 unbound variable with set -u\n        if [ -f ~\\/.bashrc ]; then\n            export PATH="$(bash -c '"'"'source ~\\/.bashrc 2>\/dev\/null; echo $PATH'"'"')"\n        fi/' /opt/novapanel/scripts/install.sh

# Fix 2: Replace source /root/.bashrc on line 966
sudo sed -i '966s/.*/        # Cannot source bashrc directly with set -u - use PATH instead\n        export PNPM_HOME="\/root\/.local\/share\/pnpm"\n        export PATH="$PNPM_HOME:\/usr\/local\/bin:\$PATH"/' /opt/novapanel/scripts/install.sh

# Fix 3: Replace undefined step() calls with log()
sudo sed -i '977s/step/log/' /opt/novapanel/scripts/install.sh
sudo sed -i '980s/step/log/' /opt/novapanel/scripts/install.sh

echo "Done patching"