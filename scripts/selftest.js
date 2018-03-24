var tests = [];
var fails = 0;

class Test {
	constructor(description, impl) {
		this.description = description;
		this.impl = impl;
		tests.push(this);
	}

	run() {
		utils.log("test that " + this.description + "...");
		var self = this;
		return new Promise((resolve, reject) => resolve(self.impl())).then((result) => {
			if(!result) { throw "test failed"; }
			utils.log("  PASS ✓");
			return true;
		}).catch((err) => {
			fails++;
			utils.log("  FAIL ✗ " + err);
			utils.log(err.stack);
			return false;
		});
	}
}

function assertEq(a, b) {
	if(a != b) {
		throw "assertion failed: " + a + " != " + b;
	}
	return true;
}

function assertNotEq(a, b) {
	if(a == b) {
		throw "assertion failed: " + a + " == " + b;
	}
	return true;
}

function assertPairEq(a, b) {
	if(a[0] != b[0] || a[1] != b[1]) {
		throw "assertion failed: " + utils.paddr(a) + " != " + utils.paddr(b);
	}
	return true;
}

function assertPairNotEq(a, b) {
	if(a[0] == b[0] && a[1] == b[1]) {
		throw "assertion failed: " + utils.paddr(a) + " == " + utils.paddr(b);
	}
	return true;
}

function assertArrayEq(a, b) {
	if(a.length !== b.length) {
		throw "length does not match";
	}
	if(a.every((v, i) => v === b[i])) {
		return true;
	} else {
		utils.log("a: " + a);
		utils.log("b: " + b);
		throw "mismatch";
	}
}

function assertErrorMessageStartsWith(em, fn) {
	try {
		fn();
	} catch(e) {
		if(!e instanceof Error) {
			throw "expected to catch Error, got " + e;
		}
		if(!e.message) {
			throw "error '" + e + "' has no message";
		}
		if(!e.message.startsWith(em)) {
			throw "error message '" + e.message + "' does not start with " + em;
		}
		return true;
	}
	throw "no Error thrown";
}

function assertArrayEq(a, b) {
	if(a.length !== b.length) {
		throw "length does not match";
	}
	if(a.every((v, i) => v === b[i])) {
		return true;
	} else {
		utils.log("a: " + a);
		utils.log("b: " + b);
		throw "mismatch";
	}
}

new Test("utils.paddr starts with 0x", () => {
	return utils.paddr([0,0]).startsWith("0x");
});

new Test("utils.paddr works", () => {
	return utils.paddr([0x12345678, 0x9ABCDEF0]) == "0x9abcdef012345678";
});

new Test("utils.assertu32 will fail on non-integers", () => {
	[NaN, Infinity, "a", {}, [], new ArrayBuffer(10), null, undefined, 0.4].forEach((t) => {
		assertErrorMessageStartsWith("expected integer", () => utils.assertu32(t));
	});
	return true;
});

new Test("utils.assertu32 will fail on signed numbers", () => {
	return assertErrorMessageStartsWith("expected pos", () => utils.assertu32(-3));
});

new Test("utils.assertu32 will fail on numbers >= 2^32", () => {
	return assertErrorMessageStartsWith("too large", () => utils.assertu32(0x100000000));
});

new Test("utils.assertu32 returns the same number if it is a u32", () => {
	return assertEq(utils.assertu32(0xADADDAB5), 0xADADDAB5);
});

new Test("utils.assertu64 will fail on non-array types", () => {
	[NaN, Infinity, "a", {}, 6, new ArrayBuffer(10), null, undefined, 0.4].forEach((t) => {
		assertErrorMessageStartsWith("expected array", () => utils.assertu64(t));
	});
	return true;
});

new Test("utils.assertu64 will fail on non [lo, hi] pairs", () => {
	[[0], [0, 1, 2], []].forEach((t) => {
		assertErrorMessageStartsWith("expected [lo, hi]", () => utils.assertu64(t));
	});
	return true;
});

new Test("utils.assertu64 will fail on pairs of non-u32s", () => {
	[[-1, 4], [0.4, 4], [NaN, 4], [4, 0.6], [0xFF, 0x100000000]].forEach((t) => {
		assertErrorMessageStartsWith("", () => utils.assertu64(t));
	});
	return true;  
});

new Test("utils.assertu64 returns the same number if it is a [u32, u32] pair", () => {
	return assertPairEq(utils.assertu64([0xADadDab5, 0x42Bee52C]), [0xADadDab5, 0x42Bee52C]);
});

new Test("utils.trunc32 will truncate [lo, 0] pairs", () => {
	return assertEq(utils.trunc32([0x3BadBee5, 0]), 0x3BadBee5);
});

new Test("utils.trunc32 will not truncate [lo, hi>0] pairs", () => {
	return assertErrorMessageStartsWith("high 32 bits must be clear", () => utils.trunc32([
		0xCDad1ef7, 0xBeef // (on the picnic table)
	]));
});

new Test("utils.trunc32 will assert numbers are u32", () => {
	return assertErrorMessageStartsWith("expected integer", () => utils.trunc32(0.4));
});

new Test("utils.trunc32 will return u32", () => {
	return assertEq(utils.trunc32(0xBadBee5), 0xBadBee5);
});

new Test("utils.trunclt32 will return u32", () => {
	return assertEq(utils.trunclt32(0xEA7, 13), 0xEa7);
});

new Test("utils.trunclt32 will not truncate 1 bits", () => {
	return assertErrorMessageStartsWith("number is too large", () => utils.trunclt32(0xDad5, 13));
});

new Test("utils.trunclt32 will truncate [lo, 0] pairs", () => {
	return assertEq(utils.trunclt32([0xBeef, 0], 32), 0xBeef);
});

new Test("utils.trunclt32 will not truncate [lo, hi>0] pairs", () => {
	return assertErrorMessageStartsWith("high", () => utils.trunclt32([0xDad155ad, 0xBeca05e], 32));
});

new Test("utils.trunclt32 will fail on non [lo, hi] pairs or non integers", () => {
	[NaN, Infinity, "a", {}, [], new ArrayBuffer(10), null, undefined, 0.4, [0], [1, 2, 3]].forEach((t) => {
		assertErrorMessageStartsWith("", () => utils.trunclt32(t, 32));
	});
	return true;
});

new Test("utils.trunclt32 will not accept bit numbers greater than 32", () => {
	return assertErrorMessageStartsWith("can't truncate > 32 bits", () => utils.trunclt32(0xDad1057, 0xF00d));
});

new Test("utils.trunclt64 will fail on numbers too large for n bits", () => {
	return assertErrorMessageStartsWith("number is too large", () => utils.trunclt64([0xDad5Babe, 0x5ee5Bee5], 57));
});

new Test("utils.trunclt64 will return the same number on success", () => {
	return assertPairEq(utils.trunclt64([0xBabe15, 0x5ca4ed], 56), [0xBabe15, 0x5ca4ed]);
});

new Test("utils.trunclt64 will return the same number on success (trunc 64 bits)", () => {
	return assertPairEq(utils.trunclt64([0xBabe15, 0x5ca4ed], 64), [0xBabe15, 0x5ca4ed]);
});

new Test("utils.pad64 will assert arrays are [lo, hi]", () => {
	return assertErrorMessageStartsWith("expected [lo, hi]", () => utils.pad64([0, 1, 2]));
});

new Test("utils.pad64 expects [lo, hi] or u32", () => {
	return assertErrorMessageStartsWith("expected [lo,hi] or number", () => utils.pad64({}));
});

new Test("utils.pad64 asserts u32", () => {
	return assertErrorMessageStartsWith("expected integer", () => utils.pad64(0.4));
});

new Test("utils.pad64 will convert u32 to [lo, hi]", () => {
	return assertPairEq(utils.pad64(0x0fBee5), [0x0fBee5, 0]);
});

new Test("utils.pad64 will return [lo, hi]", () => {
	return assertPairEq(utils.pad64([0xDad5ee5, 0xBadBee5]), [0xDad5ee5, 0xBadBee5]);
});

new Test("utils.packBitfield works", () => {
	return utils.packBitfield([
		{targetBegin: 0, size: 4},
		{targetBegin: 4, sourceBegin: 2, size: 4},
		{targetBegin: 8, sourceBegin: 2, sourceEnd: 7},
		{targetBegin: 13, targetEnd: 16}
	], [0xFF3, 0xFF9, 0xF48, 0xFF4])
    == (
    	(3 << 0) |
        (14 << 4) |
        (18 << 8) |
        (4 << 13));
});

new Test("utils.unpackBitfield works", () => {
	return assertArrayEq(
		utils.unpackBitfield([
			{targetBegin: 0, size: 4},
			{targetBegin: 4, sourceBegin: 2, size: 4},
			{targetBegin: 8, sourceBegin: 2, sourceEnd: 7},
			{targetBegin: 13, targetEnd: 16}
		],
		(3 << 0) |
                         (14 << 4) |
                         (18 << 8) |
                         (4 << 13)),
		[3, 14 << 2, 18 << 2, 4]);
});

new Test("sc.getArrayBufferAddr works", () => {
	var ab = new ArrayBuffer(32);
	var addr1 = sc.getArrayBufferAddr(ab);
	assertPairNotEq(addr1, [0,0]);
	var addr2 = sc.getArrayBufferAddr(ab);
	assertPairEq(addr1, addr2);
	var ab2 = new ArrayBuffer(32);
	var addr3 = sc.getArrayBufferAddr(ab2);
	assertPairNotEq(addr2, addr3);
	return true;
});

new Test("sc.getArrayBufferAddr works with TypedArrays", () => {
	var ab = new ArrayBuffer(256);
	var baseAddr = sc.getArrayBufferAddr(ab);
	var u32sub = new Uint32Array(ab, 44, 30);
	var subAddr = sc.getArrayBufferAddr(u32sub);
	assertPairEq(utils.add2(baseAddr, 44), subAddr);
	return true;
});

new Test("sc.read4 works", () => {
	var u32 = new Uint32Array(16);
	u32[0] = 0xAAAA;
	u32[1] = 0xBBBB;
	u32[2] = 0xCCCC;
	assertEq(sc.read4(sc.getArrayBufferAddr(u32.buffer), 0), 0xAAAA);
	assertEq(sc.read4(sc.getArrayBufferAddr(u32.buffer), 1), 0xBBBB);
	assertEq(sc.read4(sc.getArrayBufferAddr(u32.buffer), 2), 0xCCCC);

	u32[0] = 0xDDDD;
	assertEq(sc.read4(sc.getArrayBufferAddr(u32.buffer), 0), 0xDDDD);
	return true;
});

new Test("sc.write4 works", () => {
	var u32 = new Uint32Array(16);
	u32[0] = 0;
	u32[1] = 0;
	u32[2] = 0;
  
	sc.write4(0xAAAA, sc.getArrayBufferAddr(u32.buffer), 0);
	assertEq(u32[0], 0xAAAA);
	assertEq(u32[1], 0x0000);
	assertEq(u32[2], 0x0000);
  
	sc.write4(0xBBBB, sc.getArrayBufferAddr(u32.buffer), 1);
	assertEq(u32[0], 0xAAAA);
	assertEq(u32[1], 0xBBBB);
	assertEq(u32[2], 0x0000);

	return true;
});

new Test("sc.read8 works", () => {
	var u32 = new Uint32Array(16);
	u32[0] = 0xAAAA;
	u32[1] = 0xBBBB;
	u32[2] = 0xCCCC;
	u32[3] = 0xDDDD;

	assertPairEq(sc.read8(sc.getArrayBufferAddr(u32.buffer), 0), [u32[0], u32[1]]);
	assertPairEq(sc.read8(sc.getArrayBufferAddr(u32.buffer), 1), [u32[1], u32[2]]);
	assertPairEq(sc.read8(sc.getArrayBufferAddr(u32.buffer), 2), [u32[2], u32[3]]);
	return true;
});

new Test("sc.write8 works", () => {
	var u32 = new Uint32Array(16);
	u32[0] = 0x1111;
	u32[1] = 0x2222;
	u32[2] = 0x3333;
	u32[3] = 0x4444;

	sc.write8([0xAAAA, 0xBBBB], sc.getArrayBufferAddr(u32.buffer), 0);
	assertEq(u32[0], 0xAAAA);
	assertEq(u32[1], 0xBBBB);
	assertEq(u32[2], 0x3333);
	assertEq(u32[3], 0x4444);

	sc.write8([0xFEFE, 0x9A9A], sc.getArrayBufferAddr(u32.buffer), 1);
	assertEq(u32[0], 0xAAAA);
	assertEq(u32[1], 0xFEFE);
	assertEq(u32[2], 0x9A9A);
	assertEq(u32[3], 0x4444);
  
	sc.write8([0xCCCC, 0xDDDD], sc.getArrayBufferAddr(u32.buffer), 2);
	assertEq(u32[0], 0xAAAA);
	assertEq(u32[1], 0xFEFE);
	assertEq(u32[2], 0xCCCC);
	assertEq(u32[3], 0xDDDD);

	return true;
});

new Test("sc.memview works", () => {
	var u32 = new Uint32Array(16);
	u32[0] = 0x1111;
	u32[1] = 0x2222;
	u32[2] = 0x3333;
	u32[3] = 0x4444;

	sc.memview(sc.getArrayBufferAddr(u32.buffer), 16*4, (view) => {
		var u32view = new Uint32Array(view);
		u32view[0] = 0xAAAA;
		u32view[1] = 0xBBBB;
		u32view[3] = 0xDDDD;
	});

	assertEq(u32[0], 0xAAAA);
	assertEq(u32[1], 0xBBBB);
	assertEq(u32[2], 0x3333);
	assertEq(u32[3], 0xDDDD);

	sc.gc();
  
	return true;
});

new Test("sc.memview returns value returned from inner function", () => {
	var u32 = new Uint32Array(16);
	assertEq(sc.memview(sc.getArrayBufferAddr(u32.buffer), 16*4, (view) => {
		return "returned value";
	}), "returned value");
	sc.gc();
	return true;
});

new Test("sc.memview propogates exceptions and doesn't blow up", () => {
	try {
		sc.memview([0,0], 300, () => {
			throw "boo!";
		});
	} catch(e) {
		assertEq(e, "boo!");
		sc.gc();
		return true;
	}
	throw "exception was not propogated";
});

new Test("sc.memview view buffer length is correct", () => {
	sc.memview([0,0], 300, (view) => {
		assertEq(view.byteLength, 300);
	});
	return true;
});

new Test("sc.call (non-turbo) works", () => {
	sc.disableTurbo();
	var str = "test string";
	var ab = utils.str2ab(str);
	var addr = sc.getArrayBufferAddr(ab);
	assertPairEq(
		// strlen
		sc.call(sc.gadget("e80300aa09084092e90000b4e80300aa090140390902003408050091"), [addr]),
		[str.length, 0]);

	return true;
});

new Test("sc.call (non-turbo) translates ArrayBuffers to pointers to their data", () => {
	sc.disableTurbo();
	var ab = new ArrayBuffer(30);
	var u8 = new Uint8Array(ab);
	var str = "test string";
	for(var i = 0; i < str.length; i++) {
		u8[i] = str.charCodeAt(i);
	}
	u8[str.length] = 0;
	assertPairEq(
		// strlen
		sc.call(sc.gadget("e80300aa09084092e90000b4e80300aa090140390902003408050091"), [ab]),
		[str.length, 0]);

	return true;
});

new Test("sc.call (non-turbo) translates TypedArrays to pointers to their data", () => {
	sc.disableTurbo();
	var u8 = new Uint8Array(30);
	var str = "test string";
	for(var i = 0; i < str.length; i++) {
		u8[i] = str.charCodeAt(i);
	}
	u8[str.length] = 0;
	assertPairEq(
		// strlen
		sc.call(sc.gadget("e80300aa09084092e90000b4e80300aa090140390902003408050091"), [u8]),
		[str.length, 0]);

	return true;
});

new Test("sc.call (turbo) works", () => {
	sc.enableTurbo();
	var str = "test string";
	assertPairEq(
		// strlen
		sc.call(sc.gadget("e80300aa09084092e90000b4e80300aa090140390902003408050091"), [sc.str2buf(str)]),
		[str.length, 0]);

	return true;
});

new Test("sc.call (turbo) translates ArrayBuffers to pointers to their data", () => {
	sc.enableTurbo();
	var ab = new ArrayBuffer(30);
	var u8 = new Uint8Array(ab);
	var str = "test string";
	for(var i = 0; i < str.length; i++) {
		u8[i] = str.charCodeAt(i);
	}
	u8[str.length] = 0;
	assertPairEq(
		// strlen
		sc.call(sc.gadget("e80300aa09084092e90000b4e80300aa090140390902003408050091"), [ab]),
		[str.length, 0]);

	return true;
});

new Test("sc.call (turbo) translates TypedArrays to pointers to their data", () => {
	sc.enableTurbo();
	var u8 = new Uint8Array(30);
	var str = "test string";
	for(var i = 0; i < str.length; i++) {
		u8[i] = str.charCodeAt(i);
	}
	u8[str.length] = 0;
	assertPairEq(
		// strlen
		sc.call(sc.gadget("e80300aa09084092e90000b4e80300aa090140390902003408050091"), [u8]),
		[str.length, 0]);

	return true;
});

new Test("sc.svc[0xC GetThreadPriority] works", () => {
	var buf = new Uint32Array(2);
	buf[0] = 0;
	assertPairEq(sc.svc(0xC, [sc.getArrayBufferAddr(buf.buffer), 0xFFFF8000]), [0,0]);
	assertEq(buf[0], 58);
	return true;
});

new Test("sc.svc[0xC GetThreadPriority] translates TypedArrays", () => {
	var buf = new Uint32Array(2);
	buf[0] = 0;
	assertPairEq(sc.svc(0xC, [buf, 0xFFFF8000]), [0,0]);
	assertEq(buf[0], 58);
	return true;
});

new Test("sc.svc won't try to call bad SVCs", () => {
	try {
		sc.svc(0x888, []);
	} catch(e) {
		if(!e.message.startsWith("Failed to call svc")) {
			throw "exception message doesn't start with 'Failed to call svc': " + e.message;
		}
		return true;
	}
	throw "no exception raised";
});

new Test("sc.readString works", () => {
	var str = "test string two";
	var ab = utils.str2ab(str);
	assertEq(sc.readString(sc.getArrayBufferAddr(ab)), str);
	return true;
});

new Test("sc.memcpy works", () => {
	var src = new Uint32Array(4);
	var dst = new Uint32Array(4);
	src[0] = 0xAAAA;
	src[1] = 0xBBBB;
	src[2] = 0xCCCC;
	src[3] = 0xDDDD;
	assertNotEq(src[0], dst[0]);
	assertNotEq(src[1], dst[1]);
	assertNotEq(src[2], dst[2]);
	assertNotEq(src[3], dst[3]);
	sc.memcpy(dst, src, 16);
	assertEq(dst[0], 0xAAAA);
	assertEq(dst[1], 0xBBBB);
	assertEq(dst[2], 0xCCCC);
	assertEq(dst[3], 0xDDDD);
	assertEq(src[0], dst[0]);
	assertEq(src[1], dst[1]);
	assertEq(src[2], dst[2]);
	assertEq(src[3], dst[3]);
	return true;
});

new Test("sc.asyncCaller works", () => {
	var str = "test string";
	var ab = utils.str2ab(str);
	return sc.asyncCaller.call(sc.gadget("e80300aa09084092e90000b4e80300aa090140390902003408050091"), [sc.getArrayBufferAddr(ab)]).then((result) => {
		assertPairEq(result, [str.length, 0]);
		return true;
	});
});

new Test("sc.asyncCaller translates ArrayBuffers", () => {
	var ab = new ArrayBuffer(30);
	var u8 = new Uint8Array(ab);
	var str = "test string";
	for(var i = 0; i < str.length; i++) {
		u8[i] = str.charCodeAt(i);
	}
	u8[str.length] = 0;
	return sc.asyncCaller.call(sc.gadget("e80300aa09084092e90000b4e80300aa090140390902003408050091"), [ab]).then((result) => {
		assertPairEq(result, [str.length, 0]);
		return true;
	});
});

new Test("sc.asyncCaller translates TypedArrays", () => {
	var u8 = new Uint8Array(30);
	var str = "test string";
	for(var i = 0; i < str.length; i++) {
		u8[i] = str.charCodeAt(i);
	}
	u8[str.length] = 0;
	return sc.asyncCaller.call(sc.gadget("e80300aa09084092e90000b4e80300aa090140390902003408050091"), [u8]).then((result) => {
		assertPairEq(result, [str.length, 0]);
		return true;
	});
});

function assertIpcPacking(msg, hexblob) {
	hexblob = hexblob.replace(/ /g, "");
	var packed = msg.pack();
	var buf = new ArrayBuffer(hexblob.length/2);
	var u8 = new Uint8Array(buf);

	for(var i = 0; i < hexblob.length; i+= 2) {
		u8[i/2] = parseInt(hexblob.substring(i, i+2), 16);
	}
	var u32 = new Uint32Array(buf);

	for(var i = 0; i < Math.max(packed.length, u32.length); i++) {
		if(i >= u32.length && packed[i] === 0) {
			continue; // forgive short templates
		}
		if(packed[i] != u32[i]) {
			utils.hexdump("packed", packed);
			utils.hexdump("template", buf);
			throw "IPC packing doesn't match";
		}
	}
  
	return true;
}

new Test("basic IPC messages pack correctly", () => {
	assertIpcPacking(sc.ipcMsg(5), "04 00 00 00 08 00 00 00  00 00 00 00 00 00 00 0053 46 43 49 00 00 00 00  05 00 00 00 00 00 00 00");
	assertIpcPacking(sc.ipcMsg(9), "04 00 00 00 08 00 00 00  00 00 00 00 00 00 00 0053 46 43 49 00 00 00 00  09 00 00 00 00 00 00 00");
	return true;
});

new Test("IPC messages with datau32 pack correctly", () => {
	assertIpcPacking(sc.ipcMsg(2).datau32(0xAAAA, 0xBBBB, 0xCCCC), "0400 0000 0b00 0000 0000 0000 0000 00005346 4349 0000 0000 0200 0000 0000 0000aaaa 0000 bbbb 0000 cccc 0000");
	return true;
});

new Test("A descriptors, X descriptors, and object domain information pack properly", () => {
	assertIpcPacking(sc.ipcMsg(11).data([0xAAAA, 0xDDDD]).aDescriptor(0xBBBB, 0xCCCC, 0x33).aDescriptor(0xEEEE, 0xFFFF, 0x34).xDescriptor(0, 0, 0).xDescriptor(0, 0, 1).toObject(1),
		"04 00 22 00 0e 00 00 00 00 00 00 00 00 00 00 00" +
                   "01 00 00 00 00 00 00 00 cc cc 00 00 bb bb 00 00" +
                   "33 00 00 00 ff ff 00 00 ee ee 00 00 34 00 00 00" +
                   "01 00 18 00 01 00 00 00 00 00 00 00 00 00 00 00" +
                   "53 46 43 49 00 00 00 00 0b 00 00 00 00 00 00 00" +
                   "aa aa 00 00 dd dd 00 00 00 00 00 00 00 00 00 00");

	return true;
});

/* insert more IPC packing tests here */
/* TO TEST STILL:
 * setType
 * sendPid
 * setCmd
 * data
 * a descriptors
 * b descriptors
 * c descriptors
 * x descriptors
 * copying handles
 * moving handles
 * toObjectDomain
 * response unpacking
 */

new Test("buffer type 6 ipc example passes", () => {
	assertIpcPacking(sc.ipcMsg(1).aDescriptor(0x7000000, 0xa20, 0x0),
		"04 00 10 00 08 00 00 00  20 0a 00 00 00 00 00 07" +
                   "00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00" +
                   "53 46 43 49 00 00 00 00  01 00 00 00 00 00 00 00");
	return true;
});

new Test("buffer type 5 ipc example passes", () => {
	assertIpcPacking(sc.ipcMsg(2).bDescriptor(0x7000000, 0xa20, 0x0),
		"04 00 00 01 08 00 00 00  20 0a 00 00 00 00 00 07" +
                   "00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00" +
                   "53 46 43 49 00 00 00 00  02 00 00 00 00 00 00 00");
	return true;
});

new Test("buffer type 0x1A (c descriptor) ipc example passes", () => {
	assertIpcPacking(sc.ipcMsg(3).cDescriptor(0x7000000, 0x100, false),
		"04 00 00 00 08 0c 00 00  00 00 00 00 00 00 00 00" +
                   "53 46 43 49 00 00 00 00  03 00 00 00 00 00 00 00" +
                   "00 00 00 00 00 00 00 00  00 00 00 07 00 00 00 01");
	return true;
});

new Test("buffer type 0x19 ipc example passes", () => {
	assertIpcPacking(sc.ipcMsg(37).xDescriptor(0x6ffff70, 0x48, 0x0).xDescriptor(0x6ffff28, 0x48, 0x1),
		"04 00 02 00 08 00 00 00  00 00 48 00 70 ff ff 06" +
                   "01 00 48 00 28 ff ff 06  00 00 00 00 00 00 00 00" +
                   "53 46 43 49 00 00 00 00  25 00 00 00 00 00 00 00");
	return true;
});

new Test("buffer type 0x9 ipc example passes", () => {
	assertIpcPacking(sc.ipcMsg(1002).toObject(0xf001).data(0, utils.parseAddr("0x01007ef00011e000")).xDescriptor(0x7003040, 0x20, 0x0),
		"04 00 01 00 10 00 00 00  00 00 20 00 40 30 00 07" +
                   "01 00 20 00 01 f0 00 00  00 00 00 00 00 00 00 00" +
                   "53 46 43 49 00 00 00 00  ea 03 00 00 00 00 00 00" +
                   "00 00 00 00 00 00 00 00  00 e0 11 00 f0 7e 00 01" +
                   "00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00");
	return true;
});

new Test("buffer type 0xA (c descriptor) ipc example passes", () => {
	assertIpcPacking(sc.ipcMsg(8).cDescriptor(0x3000010, 0x30, true),
		"04 00 00 00 09 0c 00 00  00 00 00 00 00 00 00 00" +
                   "53 46 43 49 00 00 00 00  08 00 00 00 00 00 00 00" +
                   "00 00 00 00 00 00 00 00  30 00 00 00 10 00 00 03" +
                   "00 00 30 00");
	return true;
});

new Test("buffer type 0x16 ipc example passes", () => {
	assertIpcPacking(sc.ipcMsg(14).bDescriptor(0x7000000, 0x180, 0x0),
		"04 00 00 01 08 00 00 00  80 01 00 00 00 00 00 07" +
                   "00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00" +
                   "53 46 43 49 00 00 00 00  0e 00 00 00 00 00 00 00");
	return true;
});

function expectError(cb) {
	try {
		cb();
		throw new Error("no error was raised");
	} catch(e) {
		return e;
	}
}

function assertErrorCode(cb, c) {
	var e = expectError(cb);
	if(e.code !== c) {
		throw e;
	}
	return true;
}

function assertErrorMessage(cb, m) {
	var e = expectError(cb);
	if(e.message !== m) {
		throw e;
	}
	return true;
}

new Test("sc.svcWithResult returns an Err on a non-0 result code by closing 0", () => {
	return sc.svcWithResult(0x16, [0]).assertErrorCode(0xe401);
});

new Test("sc.getService fails with non-string arguments", () => {
	assertErrorMessage(() => sc.getService(null).assertOk(), "cannot get service with non-string name");
	assertErrorMessage(() => sc.getService({}).assertOk(), "cannot get service with non-string name");
	return true;
});

new Test("sc.getService returns closeable handles for valid services", () => {
	sc.svcWithResult(0x16, [sc.getService("lbl").assertOk()]).assertOk();
	return true;
});

new Test("when svcSendSyncRequest returns != 0, we get an IPCFailure", () => {
	var r = sc.ipcMsg(0).sendTo(0);
	if(!r.isFailure) { throw r + " is not an ipc failure"; }
	assertEq(r.resultCode.code, 0xe401);
	return true;
});

new Test("IPCFailure.asResult() returns an Err(IPCFailure)", () => {
	var r = sc.ipcMsg(0).sendTo(0);
	if(!r.isFailure) { throw r + " is not an ipc failure"; }
	assertEq(r.resultCode.code, 0xe401);
	var resu = r.asResult();
	if(resu.isOk) { throw "result was not Err"; }
	if(resu.getError() !== r) { throw "result error is not IPCFailure"; }
	return true;  
});

new Test("IPCFailure.assertOk() throws error code", () => {
	assertEq(expectError(() => sc.ipcMsg(0).sendTo(0).assertOk()).code, 0xe401);
	return true;
});

new Test("the language can be retrieved from sc.getService(\"set\")", () => {
	assertPairEq(
		sc.ipcMsg(0).sendTo(sc.getService("set").assertOk()).assertOk().dataBuffer[0],
		utils.str2u64(navigator.language)[0]);
	return true;
});

new Test("sc.hasService returns true for existing services (such as lbl)", () => {
	assertEq(sc.hasService("lbl"), true);
	return true;
});

new Test("sc.hasService returns false for not-existing services", () => {
	assertEq(sc.hasService("foobar"), false);
	return true;
});

new Test("sc.getService throws for services that don't exit", () => {
	assertErrorMessage(() => sc.getService("foobar"), "no such service");
	return true;
});

new Test("sc.getService(name, callback) works", () => {
	var handle;
	assertEq(sc.getService("set", (h) => {
		handle = h;
		sc.ipcMsg(0).sendTo(h).assertOk();
		return "test return value";
	}), "test return value");
	sc.svcCloseHandle(handle).assertErrorCode(0xe401);
	return true;
});

/* TODO:
   Test sc.registerService
   Test sc.unregisterService
 */

new Test("sc.getAutoHandle returns the same handle if it isn't killed", () => {
	var handle1 = sc.getAutoHandle("lbl");
	var handle2 = sc.getAutoHandle("lbl");
	assertPairEq(handle1, handle2);
	return true;
});

new Test("sc.getAutoHandle returns a new handle if the old one is killed", () => {
	var handle1 = sc.getAutoHandle("lbl");
	sc.killAutoHandle("lbl");
	var handle2 = sc.getAutoHandle("lbl");
	assertNotEq(handle1, handle2);
	return true;
});

new Test("ipcMsg.sendTo only kills auto handles when it gets back a bad result code", () => {
	var handle1 = sc.getAutoHandle("fsp-srv");
	sc.ipcMsg(1).datau64(0).sendPid().sendTo("fsp-srv").assertOk();
	var handle2 = sc.getAutoHandle("fsp-srv");
	assertEq(handle1, handle2);
	assertEq(sc.ipcMsg(999999).data(14).sendTo("fsp-srv").asResult().assertError().resultCode.code, 0xf601);
	var handle3 = sc.getAutoHandle("fsp-srv");
	assertNotEq(handle2, handle3);
	return true;
});

new Test("b descriptors work by asking csrng for random data", () => {
	var buf = new Uint8Array(512);
	sc.ipcMsg(0).bDescriptor(sc.getArrayBufferAddr(buf.buffer), buf.byteLength, 0).sendTo("csrng").assertOk();
	var zeroCount = 0;
	for(var i = 0; i < buf.length; i++) {
		if(buf[i] == 0) {
			zeroCount++;
		}
	}
	if(zeroCount == buf.length) {
		// I hope this never *actually* happens without shenanigans
		throw "got back all zeroes from csrng";
	}
	sc.killAutoHandle("csrng");
	return true;
});

new Test("b descriptors can be specified with a TypedArray (crng test)", () => {
	var buf = new Uint8Array(512);
	sc.ipcMsg(0).bDescriptor(buf, 512, 0).sendTo("csrng").assertOk();
	var zeroCount = 0;
	for(var i = 0; i < buf.length; i++) {
		if(buf[i] == 0) {
			zeroCount++;
		}
	}
	if(zeroCount == buf.length) {
		throw "got back all zeroes from csrng";
	}
	sc.killAutoHandle("csrng");
	return true;  
});

new Test("b descriptors can be specified with an ArrayBuffer (crng test)", () => {
	var buf = new Uint8Array(512);
	sc.ipcMsg(0).bDescriptor(buf.buffer, 512, 0).sendTo("csrng").assertOk();
	var zeroCount = 0;
	for(var i = 0; i < buf.length; i++) {
		if(buf[i] == 0) {
			zeroCount++;
		}
	}
	if(zeroCount == buf.length) {
		throw "got back all zeroes from csrng";
	}
	sc.killAutoHandle("csrng");
	return true;  
});

new Test("b descriptors will infer size from an ArrayBuffer (crng test)", () => {
	var buf = new Uint8Array(512);
	sc.ipcMsg(0).bDescriptor(buf.buffer).sendTo("csrng").assertOk();
	var zeroCount = 0;
	for(var i = 0; i < buf.length; i++) {
		if(buf[i] == 0) {
			zeroCount++;
		}
	}
	if(zeroCount == buf.length) {
		throw "got back all zeroes from csrng";
	}
	sc.killAutoHandle("csrng");
	return true;  
});

new Test("IPCMessage.withHandles will close handles", () => {
	var handles = sc.ipcMsg(0).datau64(0).sendPid().sendTo("pctl:a").assertOk().withHandles((msg, m, c) => {
		sc.ipcMsg(1032).sendTo(m[0]).assertOk();
		return m;
	});
	sc.ipcMsg(1032).sendTo(handles[0]).asResult().assertError();
	return true;
});

new Test("svcGetSystemTick wrapper works", () => {
	assertPairNotEq(sc.svcGetSystemTick(), [0,0]);
	return true;
});

new Test("svcQueryMemory wrapper returns okay-looking values for heap", () => {
	var buf = new Uint32Array(4);
	var addr = sc.getArrayBufferAddr(buf.buffer);
	var [base, size, state, perm, pageinfo] = sc.svcQueryMem(buf, true).assertOk();
	if(base[1] > addr[1] || (base[1] == addr[1] && base[0] > addr[0])) {
		throw "address base is higher than queried address";
	}
	var end = utils.add2(base, size);
	if(end[1] < addr[1] || (end[1] == addr[1] && end[0] < addr[0])) {
		throw "region end is lower than queried address";
	}
	if(perm != 3) {
		throw "heap is not RW";
	}
	if(state != 5) {
		throw "heap is not PRIVATE";
	}
	return true;
});

new Test("findUnmappedRegion returns a region with perm,state == 0 and size >= targetSize", () => {
	var targetSize = 0x100000;
	var region = sc.findUnmappedRegion(targetSize);
	var [base, size, state, perm, pageinfo] = sc.svcQueryMem(region, true).assertOk();
	if(size[1] == 0 && size[0] < targetSize) {
		throw "findUnmappedRegion returned too small region";
	}
	if(state != 0 || perm != 0) {
		throw "findUnmappedRegion returned mapped region";
	}
	return true;
});

fails = 0;
var promise = Promise.resolve(true);
tests.forEach((test) => {
	promise = promise.then(() => test.run());
});
promise.then((result) => {
	if(fails != 0) {
		utils.log(fails + " FAILED TEST" + (fails == 1 ? "" : "s"));
	} else {
		utils.log("ALL TESTS PASSED!");
	}
}).catch((e) => {
	utils.log("error: " + e.message);
	throw e;
});
