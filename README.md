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

1. Install the latest version of node from [nodejs.org](https://nodejs.org)
2. Clone this repository
3. Run `npm install`

Usage
=====

1. Ensure port 53, 80, and 8100 are open on the computer running pegaswitch.
2. Start pegaswitch with `sudo node start.js`
3. Configure your Switch DNS settings to point to the IP of your computer.
4. Go to the eShop or another area that will trigger the captive portal
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

You can override the IP address that pegaswitch responds with by passing an `--ip` argument to the `node start.js` command.

eg.
```
sudo node start.js --ip 1.2.3.4
```

### Windows support

The full curses interface on Windows is supported using WSL only. We will not provide support for native cmd.exe as it lacks necessary functionality.

You can, however, use --disable-curses and write the debug log out to a file for ing.

License
=======

ISC. See attached `LICENSE.md` file.
