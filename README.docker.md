Overview
========
This document will describe how to build and run pegaswitch within a docker container.

Building
========
The container image is based on the official `nodejs:9.2` image.
To build the docker container image simply run:

`docker build -t reswitched/pegaswitch .`


Running
=======
To run the docker container container first you have to figure out your
local network IP address.

1. Run `ip a`
2. Run `docker run -ti -p 53:53/udp -p 53:53 -p 80:80 -p 8100:8100 --env TERM --env IP_ADDR={your IP address from the prior command} reswitched/pegaswitch`

If you fail to set the `IP_ADDR` variable the container will not start.
