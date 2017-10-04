#!/bin/bash

which docker

if [ $? -ne 0 ]; then
    echo "Docker must be installed to use this feature. Exiting..." >&2
    exit 1
fi

if [ "$(docker ps -aq -f name=pegaswitch)" ]; then
    echo "PegaSwitch is already running..." >&2
    exit 1
fi

ROOT_DIR="$(dirname $(pwd))"

BIND_ADDRESS=0.0.0.0

DNS_PORT=53
WEB_PORT=80
OTHER_PORT=8100

echo "Starting PegaSwitch..."

if [ ! -d "node_modules" ]; then
    echo "Node modules will install on the first run"
fi

docker run --rm -it \
  --name "pegaswitch" \
  -v $ROOT_DIR:/opt \
  -w /opt/pegaswitch \
  -p $BIND_ADDRESS:$DNS_PORT:53 \
  -p $BIND_ADDRESS:$WEB_PORT:80 \
  -p $BIND_ADDRESS:$OTHER_PORT:8100 \
  node:8 /bin/bash -c 'if [ ! -d "node_modules" ]; then npm install; fi; node start.js $@'