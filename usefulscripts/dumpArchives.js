function dumpArchive(hndle, archive) {
	utils.log("Dumping " + archive);
	sc.ipcMsg(1).datau64(0).sendPid().sendTo(hndle).assertOk();
	var res = sc.ipcMsg(202).datau64(3, utils.parseAddr(archive), 1).sendTo(hndle).assertOk();
	sc.withHandle(res.movedHandles[0], (storage) => {
		utils.log('Got IStorage handle: 0x'+ storage.toString(16));
		res = sc.ipcMsg(4).sendTo(storage).assertOk();
		var archive_len = [res.data[0], res.data[1]];
		utils.log(archive+' is size '+utils.paddr(archive_len));
		var buf = new ArrayBuffer(utils.trunc32(archive_len));
		res = sc.ipcMsg(0).datau64(0, archive_len).bDescriptor(buf, archive_len, 1).sendTo(storage);
		sc.memdump(buf, buf.byteLength, 'archives/'+archive+'.bin');
		utils.log('done');
	});
}
var archives =
				{
					//'800' : '0100000000000800',
					'801' : '0100000000000801',
					'802' : '0100000000000802',
					'803' : '0100000000000803',
					'804' : '0100000000000804',
					'805' : '0100000000000805',
					'806' : '0100000000000806',
					//'807' : '0100000000000807',
					'808' : '0100000000000808',
					'809' : '0100000000000809',
					'80A' : '010000000000080A',
					'80B' : '010000000000080B',
					'80C' : '010000000000080C',
					'80D' : '010000000000080D',
					'80E' : '010000000000080E',
					'810' : '0100000000000810',
					'811' : '0100000000000811',
					'812' : '0100000000000812',
					'813' : '0100000000000813',
					'814' : '0100000000000814',
					'818' : '0100000000000818',
					'819' : '0100000000000819',
					'81A' : '010000000000081A',
					'81D' : '010000000000081D',
					//'81E' : '010000000000081E',
					//'81F' : '010000000000081F',
					//'820' : '0100000000000820',
					//'821' : '0100000000000821',
				};
if (version != "1.0.0") {
	archives['800'] = '0100000000000800';
	archives['807'] = '0100000000000807';
	archives['81E'] = '010000000000081E';
	archives['81F'] = '010000000000081F';
	archives['820'] = '0100000000000820';
	archives['821'] = '0100000000000821';
}

sc.getService("fsp-srv", (hndle) => {
	utils.log("got handle 0x" + hndle.toString(16));
	for (var name in archives) {
		dumpArchive(hndle, archives[name]);
	}
});
