<p align="center">
  <img style="width: 50%" src="https://i.imgur.com/bHjfC0Q.png">
  By
  <br/>
  <br/>
  <img style="width: 100px" src="https://i.imgur.com/w2u26sA.png">
  <br/>
  <br/>
  An exploit toolkit for the Nintendo Switch™
</p>

Installation (Simple)
=====================

The development environment is configured by using Docker to remove software requirements from the host machine and to make updating easier.

1. Install the latest version of Docker [[OSX](https://docs.docker.com/docker-for-mac/install/)] [[Other](https://docs.docker.com/engine/installation/#supported-platforms)]
2. Clone this repository.
3. Run `./bin/docker-start.sh`.

## Windows Instructions

1. Install the latest version of [Docker](https://docs.docker.com/engine/installation/#supported-platforms).
2. Clone this repository.
3. Run `bin\start-docker.bat`.

Installation (Advanced)
=======================
Alternatively, this can be ran without docker.

1. Install the latest version of Node from [nodejs.org](https://nodejs.org/en/download/)
2. Clone this repository.
3. Run `npm install` to install node dependencies.
4. Run `npm run start` to start thet service.

Usage
=====

1. Ensure port 53, 80, and 8100 are open on the computer running PegaSwitch.
2. Start PegaSwitch with `./bin/start-docker.sh`.
3. Configure your Switch DNS settings to point to the IP of your computer.
4. Run a connection test to trigger the Captive Portal. (Likewise, going into an update page will do the same.)
5. **STRONG SUGGESTION**: If this is your first time running PegaSwitch on a new console, run the command `evalfile usefulscripts/SetupNew.js` to set up useful settings.

Documentation
=============

API documentation for SploitCore is automatically generated using jsdoc comments.

You can find the latest version of documentation hosted [here](https://reswitched.github.io/pegaswitch/)

To view locally: `npm run docs:serve` then visit `http://localhost:4001`

To generate to `docs` folder: `npm run docs:generate`

Troubleshooting
===============

### DNS responds with incorrect IP address

You can override the IP address that PegaSwitch responds with by passing an `--ip` argument to the `node start.js` command.

eg.
```
./bin/start-docker.sh --ip 1.2.3.4
```

### Windows support

The full curses interface on Windows is supported using WSL only. We will not provide support for native cmd.exe as it lacks necessary functionality.

You can, however, use `--disable-curses` and write the debug log out to a file for viewing.

License
=======

ISC. See attached `LICENSE.md` file.
