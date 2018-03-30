sc.getFSPPR = function () {
	if (sc.closed_pr !== undefined) {
		return;
	}
	sc.enableTurbo();
	var i = 0;
	var srv = null;
	while (true) {
		sc.ipcMsg(2).setType(5).sendTo('pm:shell');
		var srvResult = sc.getService("fsp-pr");
		if(srvResult.isOk) {
			srv = srvResult.getValue();
			break;
		}
		i++;
	}
	utils.log('Got fsp-pr handle after ' + i + ' iterations: ');
	utils.log('fsp-pr handle: 0x' + srv.toString(16));
	sc.svcCloseHandle(srv).assertOk();
	sc.closed_pr = true;
};

sc.getFSPPR();
sc.enableTurbo();

if(sc.pr_handle) {
	sc.svcCloseHandle(sc.pr_handle);
	sc.pr_handle = undefined;
}

sc.getService("fsp-pr", (fsppr) => {
	var pid = sc.getService('fsp-srv', (tmp_hnd) => {
		utils.log("got fspsrv");
		sc.ipcMsg(1).sendPid().data(0).sendTo(tmp_hnd).assertOk();
		return sc.read4(sc.ipcBufAddr, 0xC >> 2);
	});
	utils.log('Got process PID: '+pid.toString(16));
	
	var buf1_sz = 0x1C;
	var buf2_sz = 0x2C;
	var buf = sc.malloc(buf1_sz + buf2_sz);
	var buf2 = utils.add2(buf, buf1_sz);
	
	// buffer init
	sc.write4(1, buf, 0x0>>2);
	sc.write8([0xFFFFFFFF, 0xFFFFFFFF], buf, 0x4 >> 2); // This is the permissions value.
	sc.write4(buf1_sz, buf, 0xC >> 2);
	sc.write4(buf1_sz, buf, 0x14 >> 2);
	
	sc.write4(1, buf2, 0x0 >> 2);
	sc.write8([0xFFFFFFFF, 0xFFFFFFFF], buf2, 0x4 >> 2); // This is the permissions value -- actual perms = buf2_val & buf1_val
	sc.write4(0xFFFFFFFF, buf2, 0x14 >> 2);
	sc.write4(0xFFFFFFFF, buf2, 0x18 >> 2);
	sc.write4(0xFFFFFFFF, buf2, 0x24 >> 2);
	sc.write4(0xFFFFFFFF, buf2, 0x28 >> 2);
	
    /* Change to mount a particular title's romfs */
	var tid = '0000000000000000';
	
	sc.ipcMsg(256).data(0).sendTo(fsppr).assertOk().show();
	sc.ipcMsg(1).data(pid).sendTo(fsppr).assertOk().show();
	sc.ipcMsg(0).data(2, [pid,0], utils.parseAddr(tid), buf1_sz, buf2_sz, pid, pid, 0, 0, 0, 0, 0).aDescriptor(buf, buf1_sz).aDescriptor(buf2, buf2_sz).sendTo(fsppr).assertOk().show();
	sc.free(buf);
	sc.free(buf2);
});

dumpIStorage = function(ist_hnd, sd_hnd, file_path, is_exfat) {
	if (is_exfat == undefined) {
		is_exfat = false;
	}
	sc.withHandle(ist_hnd, () => {
		var size = sc.ipcMsg(4).sendTo(ist_hnd).assertOk().data;
		utils.log('IStorage size: '+utils.paddr(size));
		var two_gigs = 0x80000000 >>> 0;

		var outbuf = new ArrayBuffer(0x1000000);
		var buf_sz = 0x1000000;

		var out_path = file_path;
		if ((size[1] > 0 || size[0] > two_gigs) && !is_exfat) {
			out_path = file_path + '.0';
			createFile(sd_hnd, out_path, two_gigs);
		} else {
			createFile(sd_hnd, out_path, size);
		}

		var f_hnd = openFile(sd_hnd, out_path);

		var offset = [0, 0];

		var ofs_in_file = 0;
		var file_num = 0;

		while (offset[0] < size[0] || offset[1] < size[1]) {
			if (offset[1] == size[1] && size[0] < offset[0] + buf_sz) {
				buf_sz = size[0] - offset[0];
				utils.log('Final block!');
			}

			sc.ipcMsg(0).datau64(offset, buf_sz).bDescriptor(outbuf, buf_sz, 1).sendTo(ist_hnd).assertOk();
			writeBufferToFile(f_hnd, ofs_in_file, outbuf, buf_sz);

			offset = utils.add2(offset, buf_sz);
			utils.log('Dumped: '+utils.paddr(offset)+'/'+utils.paddr(size));

			// Multi-part files.
			ofs_in_file += buf_sz;
			if (ofs_in_file >= two_gigs && !is_exfat) {
				sc.ipcMsg(2).sendTo(f_hnd).assertOk(); // flush
				sc.svcCloseHandle(f_hnd);
				file_num++;
				var new_path = file_path + '.' + file_num;
				if (size[1] > offset[1] || size[0] > two_gigs + offset[0]) {
					createFile(sd_hnd, new_path, two_gigs);
				} else {
					createFile(sd_hnd, new_path, size[0] - offset[0]);
				}
				f_hnd = openFile(sd_hnd, new_path);
				ofs_in_file = 0;
			}
		}
		sc.ipcMsg(2).sendTo(f_hnd).assertOk();
		sc.svcCloseHandle(f_hnd).assertOk();
	});
};

openRootDirectory = function(ifs_hnd) {
	return openDirectory('/', ifs_hnd);
};

openDirectory = function(path, ifs_hnd) {
	var pbuf = utils.str2ab(path);
	var res = sc.ipcMsg(9).datau32(3).xDescriptor(pbuf, pbuf.byteLength, 0).sendTo(ifs_hnd).asResult().map((r) => r.movedHandles[0]).getValue();
};

createFile = function(ifs_hnd, path, size) {
	if (size == undefined) {
		size = 0x100;
	}
	var pbuf = utils.str2ab(path);
	var res = sc.ipcMsg(0).data([0, 0], utils.trunc32(size)).xDescriptor(pbuf, pbuf.byteLength, 0).sendTo(ifs_hnd);
	utils.log('Create '+path+' (size '+size.toString(16)+'): ');
	res.show();
	// ignore failure, it probably just means the file already existed
	//res.assertOk();
};

writeBufferToFile = function(f_hnd, offset, buf, sz) {
	sc.ipcMsg(1).aDescriptor(buf, sz, 1).data([0,0], utils.pad64(offset), utils.trunc32(sz)).sendTo(f_hnd).show().assertOk();
};

openFile = function(ifs_hnd, path) {
	var pbuf = utils.str2ab(path);
	utils.log('Open '+path+': ');
	return sc.ipcMsg(8).datau32(3).xDescriptor(pbuf, pbuf.byteLength, 0).sendTo(ifs_hnd).show().asResult().map((r) => r.movedHandles[0]).getValue();
};


sc.getService('fsp-srv', (hnd) => {
	utils.log('Using fsp-srv handle: 0x' + hnd.toString(16));
	sc.ipcMsg(1).sendPid().datau64(0).sendTo(hnd).assertOk();
	utils.log("initialized fsp-srv");

	try {
		var sd_mnt = sc.ipcMsg(18).sendTo(hnd).assertOk();
	} catch(e) {
		throw new Error("Failed to open SD card. Is it inserted?");
	}
 
	utils.log("opened sd card");
	
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
	}

	// var partitions = [0, 10]; // Package1 + Keyblobs
	// var partitions = [21, 22, 24, 25, 25, 26]; // Package2s
	// var partitions = [27, 28, 31]; // SYSTEM1 + Calibration
	 var partitions = [32]; // SYSTEM2
	// var partitions = [20]; // Raw NAND
    // var partitions = [0, 10, 21];
    // var partitions = [0, 10, 27]; // PK11, blobz, cal0

	sd_mnt.withHandles((r, m, c) => {
		var sd_hnd = m[0];
		for (var i = 0; i < partitions.length; i++) {
			var partition = partitions[i];
			var res = sc.ipcMsg(12).datau32(partition).sendTo(hnd).assertOk();
			res.withHandles((r, m, c) => {
				var bis_hnd = m[0];
				dumpIStorage(bis_hnd, sd_hnd, '/BIS-PARTITION-'+partition_names[partition]+'.bin', false);
			}, (e, m, c) => {
				utils.log('Failed to dump BIS partition '+partition+'!');
			});
			sc.gc();
		}
	});
});
