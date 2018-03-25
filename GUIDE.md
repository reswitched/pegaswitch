Pegaswitch Getting Started Guide
================================
A guide to getting your Switch from factory to running Pegaswitch.

Requirements
------------
- A Nintendo Switch running FW 1.0.0 - 3.1.0
	- For 1.0.0, you will also need a copy of [Puyo Puyo Tetris JP](https://www.amazon.com/gp/product/B01N4PKS4S/ref=oh_aui_detailpage_o00_s00?ie=UTF8&psc=1)
- A PC running any OS capable of running Node.JS that is connected to a network your Switch can connect to

Setting up the Environment
--------------------------
### Windows
Windows users will need to setup the Windows Subsystem for Linux (WSL). Instructions on how to set that up can be found [here](https://docs.microsoft.com/en-us/windows/wsl/install-win10). After WSL has been setup, continue with the Linux instructions, using the Ubuntu/Debian commands.
### Linux
You will need to install `git` and `nodejs` from your distributions package manager. Please note that the version of NodeJS installed must be 8.x.x or higher.
- **Debian-based (Ubuntu, Mint, etc.)**: An alternate repository is required, as Ubuntu/Debian ships very old versions of NodeJS.
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
- **Other**: See the [installation guide for Node.JS](https://nodejs.org/en/download/package-manager/) to install Node.JS. Consult your distributions package manager to find packages for `git` and `nodejs` if the installation guide doesn't support it.
### OS X/macOS
You will need to install [Homebrew](https://brew.sh/) to download the necessary packages. After Homebrew is installed:
```bash
brew install node git
```
Setting up Pegaswitch
---------------------
1. In a terminal window, navigate to the location you want to install Pegaswitch to, and clone the Pegaswitch git repository using `git clone https://github.com/reswitched/pegaswitch.git`.
2. Navigate into the new `pegaswitch` directory, and run `npm i`. This will install all the modules needed for Pegaswitch to function.
3. Start Pegaswitch with `sudo node start --setuid $(id)`. Your user id can be found by running `id`, and searching the number next to your username (typically 1000, on a single-user system).
	- If you are using Puyo Puyo Tetris or fakenews to access Pegaswitch, add `--webapplet` to this command. 

Launching Pegaswitch
--------------------
4. Setup a connection to the Internet on your Switch, if you haven't already. Don't stay connected for too long without setting the DNS, otherwise your Switch may download an update.
5. On your Switch, go into Settings -> Internet -> Internet Settings, pick the network your computer running Pegaswitch is connected to, and select Change Settings.
6. Select DNS Settings and change it from Automatic to Manual. Set the Primary and Secondary DNS settings to the IP address that Pegaswitch shows in it's console.
7.  - 1.0.0: Follow the instructions [here](http://switchbrew.org/index.php?title=Internet_Browser#WebApplet_launch_with_Tetris) to launch Pegaswitch with Puyo Puyo Tetris. If you 	don't feel like running PPT everytime you want to use pegaswitch see fakenews below.
	- 2.0.0 or above: Go back, and select Connect to This Network. If you set it up correctly, the connection should fail with the message "Registration is required to use this network.", and you will enter Pegaswitch.
8. Congratulations! You have successfully run Pegaswitch on your console!

Optional: Setup fakenews
------------------------
fakenews is an alternative way of starting Pegaswitch that uses a fake news entry installed into the news applet. This method is highly recommended for Puyo Puyo Tetris users, as it provides a much more convenient way to access Pegaswitch without needing the game. This works for all versions, however, so it's up to you if you want to use this method.

1. In the Pegaswitch console, run `evalfile usefulscripts/installFakeNews.js`. Don't worry if your Switch restarts after running this command - this is normal.
2. If you were using the captive portal method (ie. not using Puyo Puyo Tetris) to get into Pegaswitch, restart Pegaswitch with the `--webapplet` argument added to the command.
3. Open the news applet, select the new "Launch Pegaswitch!" option, and follow the instructions on the page to start Pegaswitch.

FAQ/Troubleshooting
-------------------
### Can I use Pegaswitch without running it on my computer/being connected to the internet?
No. Pegaswitch is controlled entirely from the console running on your computer, and as such, there is no way to run it without a computer.
### I can't get into Pegaswitch! Help!
There are a few possible problems:

- You didn't type the DNS IP properly in your Switch. Double-check that it matched the one displayed in the Pegaswitch console.
- Pegaswitch isn't running on your computer. Make sure that Pegaswitch is started and running on your computer, and that it didn't crash with an error.
- Your firewall might be blocking the required ports. Consult the documentation for your systems firewall to unblock UDP port 51, and TCP ports 80 and 8100.
### What can I do with Pegaswitch?
TODO: give some examples of things users can do with pegaswitch
### I have a question!
Feel free to ask any of us for help in the [ReSwitched Discord](https://discord.gg/fK3VSQy)!
### Where's the silly part of the FAQ at the end to make people laugh?
Nope, none of those here.

Credits
-------
- Omninewb: For writing the initial version of this guide that I based this one off of
- retvoid/TheReturningVoid: For converting the initial version to markdown
- The ReSwitched team: For making all of this possible