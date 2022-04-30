#!/bin/bash     
echo Add Node.JS 16 repo
curl -sSL https://deb.nodesource.com/setup_16.x | sudo bash -
echo Install Node.JS
sudo apt install -y nodejs

sudo mkdir /opt/de
sudo chown $(id -u):$(id -g) /opt/de
sudo useradd -m radar
sudo groupadd radar
sudo usermod -a -G dialout radar
sudo usermod -a -G audio radar
sudo usermod -a -G i2c radar
sudo usermod -a -G radar $(id -u -n)
newgrp radar
mkdir /opt/de/radar
mkdir /opt/de/appdata
mkdir /opt/de/appdata/radar
sudo chown radar:radar /opt/de/appdata/radar
sudo chmod g+rw /opt/de/appdata/radar
sudo chown radar:radar /opt/de/radar
sudo chmod g+rw /opt/de/radar

mkdir /opt/de/appdata/radar/config
mkdir /opt/de/appdata/radar/data
cd /opt/de/radar
echo downloading latest version of code
curl -s https://api.github.com/repos/Andrewiski/RadarGun/releases/latest | sed -n 's/.*"tarball_url": "\(.*\)",.*/\1/p' | xargs -n1 wget -O - -q | tar -xz --strip-components=1
npm install
sudo cp /opt/de/radar/install/raspberrypi/service/radar.service /lib/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start radar
sudo systemtl enable radar
#echo install precompiled ffmpeg to fix fault segment error in built in version proboly not needed once raspberry 64bit lite is patched as I reported 
#sudo apt-get -y install libaom-dev libass-dev libfreetype6-dev libgnutls28-dev libsdl2-dev libtool libva-dev libvdpau-dev libvorbis-dev libxcb1-dev libxcb-shm0-dev libxcb-xfixes0-dev pkg-config texinfo wget yasm zlib1g-dev libunistring-dev libdrm-dev libopus-dev libvpx-dev libwebp-dev libx264-dev libx265-dev libxml2-dev libfdk-aac-dev libmp3lame-dev
#tar -xf /opt/de/radar/ffmpeg/raspberryPi/ffmpeg-pi-4.3.3.tar.gz
#sudo cp -R ~/install/* /usr/local
