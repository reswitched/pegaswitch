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

[Guide/Installation](GUIDE.md)
=====

Usage
=====

1. Ensure port 53, 80, and 8100 are open on the computer running PegaSwitch.
2. Start PegaSwitch with `sudo node start.js`
    * If on 1.0.0 or you are using the Fake News entrypoint, you will need to run `sudo node start.js --webapplet` instead. 
3. Configure your Switch DNS settings to point to the IP of your computer.
4. Run a connection test to trigger the Captive Portal. (Likewise, going into an update page will do the same.)
    * If on 1.0.0, [use a JPN copy of Puyo Puyo Tetris to launch the webapplet](http://switchbrew.org/index.php?title=Internet_Browser#WebApplet_launch_with_Tetris) instead.

It should no longer be necessary to run `usefulscripts/SetupNew.js`, since PegaSwitch will now do it automatically.

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

Pegaswitch should function on Windows, albeit with the curses ui disabled.

If --logfile is not specified, pegaswitch.log is used. You may open it with the text editor of your choice.

ex:
```
C:\pegaswitch\> node start.js --logfile log.txt
```

If you encounter problems using pegaswitch on Windows, we suggest installing through WSL.

License
=======

ISC. See attached `LICENSE.md` file.
