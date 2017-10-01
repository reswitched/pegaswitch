sc.killAutoHandle();

var buf = sc.malloc(0x1000);
sc.write4(0x3052524E, buf);
sc.write8([0x00000350, 0x1], utils.add2(buf, 0x340));
sc.write4(0x1000, utils.add2(buf, 0x338));

var hash = '02bc556cdadb4be3be06b87e8ae7081688bdb57aeb1138d5182f5b2bfe6d48ec';
sc.memview(utils.add2(buf, 0x350), hash.length / 2, function(ab) {
	var u8 = new Uint8Array(ab);
	for(var i = 0; i < hash.length; i += 2)
		u8[i >> 1] = parseInt(hash[i] + hash[i+1], 16);
});

sc.ipcMsg(4).data(0, 0).sendPid().copyHandle(0xffff8001).sendTo('ldr:ro').show();
sc.ipcMsg(2).data(0, buf, 0x1000).sendPid().sendTo('ldr:ro').show();

var xhr = new XMLHttpRequest();
xhr.open('GET', '/nros/ace.nro', false);
xhr.send();

var res = JSON.parse(xhr.responseText);
while(res.length & 0xFFF)
	res.push(0);
var u8 = new Uint8Array(res);
var u32 = new Uint32Array(u8.buffer);

var nrobase = sc.malloc(u8.length + 0xfff);
if(nrobase[0] & 0xFFF)
	nrobase[0] = ((nrobase[0] & 0xFFFFF000) + 0x1000) >>> 0;
var bssbase = sc.malloc(0x9000);

var ab = new ArrayBuffer(u8.length);
var temp = new Uint32Array(ab);
var ta = sc.read8(sc.getAddr(temp), 4);
sc.write8(nrobase, sc.getAddr(temp), 4);
temp.set(u32);
sc.write8(ta, sc.getAddr(temp), 4);

sc.svcNroBase = sc.ipcMsg(0).data(0, nrobase, 0x3000, [0, 0], 0).sendPid().sendTo('ldr:ro').show().data[1];

utils.log('NRO loaded at ' + utils.paddr(sc.svcNroBase));
