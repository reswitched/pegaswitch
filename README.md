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

Installation
============

1. Install Docker
2. Install Docker-Compose
3. Clone this repository
4. Run `docker-compose up`

Usage
=====

1. Ensure port 53, 80, and 8100 are open on the computer running pegaswitch.
2. PegaSwitch will start automatically when you start the docker container.
3. To run PegaSwitch natively without a container install NodeJS and run `npm install`.
4. Configure your Switch DNS settings to point to the IP of your computer.
5. Run a connection test to trigger the Captive Portal. (Likewise, going into an update page will do the same.)

It should no longer be necessary to run `usefulscripts/SetupNew.js`, since PegaSwitch will now do it automatically.

Documentation
=============

API documentation for SploitCore is automatically generated using jsdoc comments.

You can find the latest version of documentation hosted [here](https://reswitched.github.io/pegaswitch/)

To view locally: `npm run docs:serve` then visit `http://localhost:4001`

To generate to `docs` folder: `npm run docs:generate`

Why Docker?
===============

Docker allows the app to run in the same environment, regardless of what OS the host computer is running. This
simplifies development as well as reduces bugs and improves overall performance.

Troubleshooting
===============

### DNS responds with incorrect IP address

You can override the IP address that pegaswitch responds with by passing an `--ip` argument to the `node start.js` command.

eg.
```
sudo node start.js --ip 1.2.3.4
```

### Windows support

Pegaswitch should function on Windows, albeit with the curses ui disabled.

If --logfile is not specified, pegaswitch.log is used. You may open it with the text editor of your choice.

ex:
```
C:\pegaswitch\> node start.js --logfile log.txt
```

If you encounter problems using pegaswitch on Windows, we suggest using Docker.

NOTE: If running inside docker container inside Windows, this does not apply.

License
=======

ISC. See attached `LICENSE.md` file.
