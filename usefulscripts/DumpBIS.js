sc.enableTurbo();
sc.escalateFilesystemAccess();

sc.getService("fsp-srv", (fspsrv) => {
	sc.ipcMsg(1).sendPid().datau64(0).sendTo(fspsrv).assertOk();
	sc.ipcMsg(18).sendTo(fspsrv).asResult().mapErr((e) => "Failed to open SD card. Is it inserted?: " + e.toString()).assertOk().withHandles((r, m, c) => {
		var sd = new sc.IFileSystem(sc, m[0]);
		
		var partition_names = {
			0 : 'Boot0',
			10 : 'Boot1',
			20 : 'RawNand',
			21 : 'BCPKG2-1-Normal-Main',
			22 : 'BCPKG2-2-Normal-Sub',
			23 : 'BCPKG2-3-SafeMode-Main',
			24 : 'BCPKG2-4-SafeMode-Sub',
			25 : 'BCPKG2-5-Repair-Main',
			26 : 'BCPKG2-6-Repair-Sub',
			27 : 'PRODINFO-CAL0',
			28 : 'PRODINFOF',
			29 : 'SAFE',
			30 : 'USER',
			31 : 'SYSTEM1',
			32 : 'SYSTEM2',
		};
		
		var partitions = [0];
		
		partitions.forEach((id) => {
			sc.ipcMsg(12).datau32(id).sendTo(fspsrv).withHandles((r, m, c) => {
				var bis = new sc.IStorage(sc, m[0]);
				sc.dumpToFile(sd, "/BIS-PARTITION-" + partition_names[id] + ".bin", false, bis.GetSize().assertOk(), bis.makeReader())
			}, (e, m, c) => {
				utils.log("Failed to open BIS partition " + id + ": " + e.toString());
			});
		});
	});
});
