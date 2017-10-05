#!/usr/bin/env node
/* eslint no-mixed-operators: "off" */
require('colors');

const repl = require('repl');
const events = require('events');
const fs = require('fs');
const path = require('path');

const WebSocket = require('ws');
const History = require('repl.history');
const stringArgv = require('string-argv');

const utils = require('./exploit/utils');

const ee = new events.EventEmitter();
const wss = new WebSocket.Server({ port: 8100 });

const historyPath = path.resolve(__dirname, '.shell_history');

//This is needed to update the output to the console so the writing in start.js shows
console.log('');

let connection;

function sendMsg (cmd, args = []) {
	connection.send(JSON.stringify({
		cmd,
		args
	}));
}

ee.on('error', function (message) {
	console.error('ERROR:', message.slice(0, 2));
});

function loadConfig() {
	try {
		fs.statSync("config.json"); // test existence
		return JSON.parse(fs.readFileSync("config.json", "utf-8"));
	} catch(e) {
		var config = { // default config
		};
		fs.writeFileSync("config.json", JSON.stringify(config), "utf-8");
		return config;
	}
}

const fns = {
	sp: {
		response: 'gotsp',
		helptxt: 'Return SP'
	},
	reboot: {
		response: 'rebooting',
		helptxt: 'Reboot console'
	},
	gc: {
		response: 'gcran',
		helptxt: 'Forcefully run GC'
	},
	malloc: {
		response: 'mallocd',
		args: 1,
		help: 'malloc <bytes>',
		helptxt: 'Allocates space at returned address'
	},
	free: {
		response: 'freed',
		wait: false,
		args: 1,
		help: 'free <address>',
		helptxt: 'Frees memory at address allocated by malloc'
	},
	write4: {
		response: 'wrote4',
		wait: false,
		minArgs: 2,
		maxArgs: 3,
		help: 'write4 <addr> <data> <offset=0>',
		helptxt: 'Writes 4 bytes of data to address'
	},
	write8: {
		response: 'wrote8',
		wait: false,
		minArgs: 2,
		maxArgs: 3,
		help: 'write8 <addr> <data> <offset=0>',
		helptxt: 'Writes 8 bytes of data to address'
	},
	read4: {
		response: 'rread',
		minArgs: 1,
		maxArgs: 2,
		help: 'read4 <addr> <offset=0>',
		helptxt: 'Reads 4 bytes of data from address'
	},
	read8: {
		response: 'rread',
		minArgs: 1,
		maxArgs: 2,
		help: 'read8 <addr> <offset=0>',
		helptxt: 'Reads 8 bytes of data from address'
	},
	readstring: {
		response: 'rreadstring',
		minArgs: 1,
		maxArgs: 2,
		help: 'readstring <addr> <bytes=4>',
		helptxt: 'Reads data at address and prints as string'
	},
	eval: {
		response: 'evald',
		help: 'eval <...code>',
		helptxt: 'Evals code on remote console and returns response if applicable. If no arguments are passed it will switch to js shell instead'
	},
	evalfile: {
		response: 'evald',
		help: 'evalfile <filename>',
		helptxt: 'Evals code read from file',
		complete: function (line) {
			var args = line.split(' ');
			var dirPath = './';
			var path = '';
			var match = args[1].match(/^.*[/\\]/);
			if (match !== null) {
				dirPath = path = match[0];
			}
			var matchPiece = args[1].substr(path.length);
			try {
				var files = fs.readdirSync(dirPath);
				var completions = files.filter((c) => (path + c).startsWith(args[1])).map((c) => fs.lstatSync(dirPath + c).isDirectory() ? c + '/' : c).filter((c) => c.endsWith('/') || c.endsWith('.js'));
				return [completions, matchPiece];
			} catch (e) {
				throw e;
			}
		},
		setup: function (args, callback) {
			try {
				var filepath = path.resolve(__dirname, args[0]);
				fs.statSync(filepath);
				return [fs.readFileSync(filepath).toString()];
			} catch (e) {
				return callback(null, 'invalid file ' + e.message);
			}
		}
	},
	enable: {
		help: 'enable <property>',
		helptxt: 'Set the config property to `true`',
		noSend: true,
		setup: function (args, callback) {
			var config = loadConfig();
			config[args[0]] = true;
			fs.writeFileSync("config.json", JSON.stringify(config), "utf-8");
			console.log("enabled " + args[0] + " (won't take effect until you reconnect switch)");
			return callback();
		},
		complete: function (line) {
			var args = line.split(" ");
			var completions = Object.keys(loadConfig()).map((c) => args[0] + " " + c);
			return [args[1].length ? completions.filter((k) => k.startsWith(line) && k.length > 0) : completions, line];
		}
	},
	disable: {
		help: 'disable <property>',
		helptxt: 'Set the config property to `false`',
		noSend: true,
		setup: function (args, callback) {
			var config = loadConfig();
			config[args[0]] = false;
			fs.writeFileSync("config.json", JSON.stringify(config), "utf-8");
			console.log("disabled " + args[0] + " (won't take effect until you reconnect switch)");
			return callback();
		},
		complete: function (line) {
			var args = line.split(" ");
			var completions = Object.keys(loadConfig()).map((c) => args[0] + " " + c);
			return [args[1].length ? completions.filter((k) => k.startsWith(line) && k.length > 0) : completions, line];
		}
	},
	exit: {
		help: 'exit',
		helptxt: 'Close REPL and shut off server',
		noSend: true,
		setup(args, callback) {
			process.exit();
		}
	},
	quit: {
		help: 'quit',
		helptxt: 'Close REPL and shut off server',
		noSend: true,
		setup(args, callback) {
			process.exit();
		}
	}
};

function showHelp (callback) {
	for (let k in fns) {
		let out = `${k.bold}: ${fns[k].helptxt}`;
		if (fns[k].help) {
			out += ` (${fns[k].help})`.dim;
		}
		console.log(out);
	}
	console.log();
	return callback();
}

let _; // last value reg
let isJavascript = false;

function defaultHandler (saveVal, callback) {
	return function (response) {
		if (saveVal) {
			_ = response;
		}
		return callback(null, response);
	};
}

function handle (input, context, filename, callback) {
	let tmp = input.replace(/\n$/, '');
	if (isJavascript){
		if(tmp.trim()==''){
			isJavascript = false;
			r.setPrompt('switch'.cyan+'> ');
			console.log("");
			return;
		}
		tmp = "eval "+tmp;
	}
	//for an eval with no arguments, just do js shell
	if(tmp.trim()=="eval"){
		isJavascript = true;
		r.setPrompt('switch/js'.cyan+'> ');
		console.log("");
		return;
	}

	if (!tmp) {
		return callback();
	}

	let saveVal = false;

	let args = tmp.trimLeft().split(' ');
	let cmd = args.shift();

	if (cmd === '_') {
		return callback(null, _);
	} else if (cmd === 'help') {
		return showHelp(callback);
	} else if (cmd === '$') {
		// if prefixed with $ we
		// save the response to _
		saveVal = true;
		cmd = args.shift();
	}

	for (let i = 0; i < args.length; i++) {
		if (args[i] === '_') {
			if (_ === undefined) {
				return callback(null, '_ has no value');
			}
			args[i] = _;
		}
	}

	let fn = fns[cmd];

	if (!fn) {
		return callback(null, 'unknown cmd');
	}

	if (
		fn.args !== undefined && fn.args !== args.length ||
						fn.minArgs !== undefined && fn.minArgs > args.length ||
						fn.maxArgs !== undefined && args.length > fn.maxArgs
	) {
		return callback(null, fn.help);
	}

	if (!connection && !fn.noSend) {
		console.log('Switch not connected...'.bold);
		r.prompt();
		return; 
	}
  
	if (fn.setup) {
		args = fn.setup(args, callback);
		if (!args) {
			return;
		}
	}

	if (!fn.noSend) {
		var handle = fn.handler ? fn.handler(args, callback) : defaultHandler(saveVal, callback);
    
		ee.once(fn.response, handle);
    
		sendMsg(cmd, args);

		if (fn.wait === false) {
			ee.removeListener(fn.response, handle);
			return callback();
		}
	}
}

function complete (line) {
	var args = line.split(' ');
	var cmd = args.shift();

	if (args.length === 0) {
		return [cmd.length ? Object.keys(fns).map((name) => name + ' ').filter((fn) => fn.startsWith(cmd)) : Object.keys(fns), line];
	} else {
		if (fns[cmd] && fns[cmd].complete) {
			return fns[cmd].complete(line);
		} else {
			return [[], line];
		}
	}
}

const r = repl.start({
	prompt: '',
	eval: handle,
	completer: complete
});

History(r, historyPath);

wss.on('connection', function (ws) {
	connection = ws;
	console.log();
	console.log('Switch connected...');
	r.prompt(true);

	ws.on('close', function () {
		console.log();
		console.log('Switch disconnected...');
		r.prompt(true);
		connection = null;
	});

	ws.on('message', function (data) {
		data = JSON.parse(data);
		const type = data.type;
		const response = data.response;
		ee.emit(type, response);
	});
});

r.on('exit', () => {
	process.exit();
});

r.setPrompt('switch'.cyan+'> ');
r.prompt();
