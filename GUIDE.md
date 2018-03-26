PegaSwitch Getting Started Guide
================================
A guide to getting your Switch from factory to running PegaSwitch.

Requirements
------------
- A Nintendo Switch running FW 1.0.0 - 3.1.0
	- For 1.0.0, you will also need a copy of [Puyo Puyo Tetris JP](https://www.amazon.com/gp/product/B01N4PKS4S/ref=oh_aui_detailpage_o00_s00?ie=UTF8&psc=1)
- A PC that can run Node.js

Setting up the Environment
--------------------------
### Windows
Windows users will need to setup the Windows Subsystem for Linux (WSL). [Setup the Windows Subsystem for Linux(WSL)](https://docs.microsoft.com/en-us/windows/wsl/install-win10). After WSL has been set up, continue with the Linux instructions, using the Ubuntu/Debian commands.
### Linux
You will need to install `git` and `Node.js` (8.x.x or higher) from your distribution's package manager.
- **Debian-based (Ubuntu, Mint, etc.)**: An alternate repository is required, as Ubuntu and Debian ship very old versions of Node.js.
```bash
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt-get install nodejs git build-essential
```
- **Fedora**:
```bash
sudo dnf install nodejs npm git
```
- **Arch Linux**:
```bash
sudo pacman -S nodejs npm git base-devel
```
- **Other**: See the [installation guide for Node.js](https://nodejs.org/en/download/package-manager/) to install Node.JS. Consult your distribution's package manager to find packages for `git` and `nodejs` if the installation guide doesn't support your platform.
### OS X/macOS
You will need to install [Homebrew](https://brew.sh/) to download the necessary packages. After Homebrew is installed:
```bash
brew install node git
```
Setting up PegaSwitch
---------------------
1. In a terminal window, navigate to the location you want to install PegaSwitch to, and clone the PegaSwitch git repository using `git clone https://github.com/reswitched/PegaSwitch.git`.
2. Navigate into the new `PegaSwitch` directory, and run `npm install`. This will install all the modules needed for PegaSwitch to function.
3. Start PegaSwitch with `sudo node start --setuid $USER`.
	- If you are using Puyo Puyo Tetris or fakenews to access PegaSwitch, add `--webapplet` to this command. 

Launching PegaSwitch
--------------------
4. Set up a connection to the Internet on your Switch, if you haven't already. Select Manual Setup and set up your network. This is to ensure you don't connect without the DNS settings!
5. Select DNS Settings and change it from Automatic to Manual. Set the Primary and Secondary DNS settings to the IP address that PegaSwitch shows in it's console.
6.  - 1.0.0: Follow the instructions [here](http://switchbrew.org/index.php?title=Internet_Browser#WebApplet_launch_with_Tetris) to launch PegaSwitch with Puyo Puyo Tetris. After launching PegaSwitch using Puyo Puyo Tetris, Fakenews can be used to install a faster way to launch PegaSwitch.
	- 2.0.0 or above: Go back, and select Connect to This Network. If you set it up correctly, the connection should fail with the message "Registration is required to use this network.", and you will enter PegaSwitch.
7. Congratulations! You have successfully run PegaSwitch on your console!

Optional: Setup fakenews
------------------------
Fakenews is an alternative way of starting PegaSwitch that uses a fake news entry installed into the news applet. This method is highly recommended for Puyo Puyo Tetris users, as it provides a much more convenient way to access PegaSwitch without needing the game. This works for all versions, however, so it's up to you if you want to use this method.

1. In the PegaSwitch console, run `evalfile usefulscripts/installFakeNews.js`. Your Switch will restart after the installation.
2. If you were using the captive portal method (ie. not using Puyo Puyo Tetris) to get into PegaSwitch, restart PegaSwitch with the `--webapplet` argument added to the command.
3. Open the news applet, select the new "Launch PegaSwitch!" option, and follow the instructions on the page to start PegaSwitch.

FAQ/Troubleshooting
-------------------
### Can I use PegaSwitch without running it on my computer/being connected to the internet?
No. PegaSwitch is controlled entirely from the your computer, and as such, there is no way to run it without a computer.
### I can't get into PegaSwitch! Help!
There are a few possible problems:

- You didn't type the DNS IP properly in your Switch. Double-check that it matched the one displayed in the PegaSwitch console.
- PegaSwitch isn't running on your computer. Make sure that PegaSwitch is started and running on your computer, and that it didn't crash with an error.
- Your firewall might be blocking the required ports. Consult the documentation for your systems firewall to unblock UDP port 51, and TCP ports 80 and 8100.
### What can I do with PegaSwitch?
TODO
### I have a question!
Feel free to ask any of us for help in the [ReSwitched Discord](https://discord.gg/fK3VSQy)!
### Where's the silly part of the FAQ at the end to make people laugh?
Nope, none of those here.

Credits
-------
- Omninewb: For writing the initial version of this guide that I based this one off of
- retvoid/TheReturningVoid: For converting the initial version to markdown
- The ReSwitched team: For making all of this possible