var versions = {
	0x000001c2: '1.0.0', // v450
	0x00010104: '2.0.0', // v65796
	0x0002005a: '2.1.0', // v131162
	0x00030014: '2.2.0', // v196628
	0x00040014: '2.3.0', // v262164
	0x0c00019a: '3.0.0', // v201327002
	0x0c010032: '3.0.1', // v201392178
	0x0c020014: '3.0.2', // v201457684
	0x100000c8: '4.0.0', // v268435656
	0x1001000a: '4.0.1', // v268501002
	0x10100032: '4.1.0'  // v269484082
};

sc.getService("fsp-srv", (hndle) => {
	sc.ipcMsg(1).datau64(0).sendPid().sendTo(hndle).assertOk(); // Initialise

	var res = sc.ipcMsg(400).sendTo(hndle).assertOk();
	sc.withHandle(res.movedHandles[0], (devop) => {
		utils.log('Got IDeviceOperator handle: 0x'+ devop.toString(16));
		res = sc.ipcMsg(202).sendTo(devop).assertOk(); // GetGameCardHandle
		var gc = res.data[0];

		res = sc.ipcMsg(203).datau32(gc).sendTo(devop).assertOk();

		var version = res.data[0];
		utils.log('Got version v' + version.toString() + ' (' + versions[version] + ')');
	});
});