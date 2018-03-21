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

dumpNCA = function(nca_id, ncm_hnd, sd_hnd, file_path, is_exfat) {
	if (is_exfat == undefined) {
		is_exfat = false;
	}
	sc.withHandle(ncm_hnd, () => {
        // var size = GetRegisteredEntrySize();
        var size = sc.ipcMsg(14).datau32(nca_id[0], nca_id[1], nca_id[2], nca_id[3]).sendTo(ncm_hnd).assertOk();
        size = [size.data[0], size.data[1]];
        utils.log('NCA size: '+utils.paddr(size));
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

            // var data = ReadRegisteredEntry();
            sc.ipcMsg(18).datau32(nca_id[0], nca_id[1], nca_id[2], nca_id[3], offset[0], offset[1]).bDescriptor(outbuf, buf_sz).sendTo(ncm_hnd).assertOk().show();
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

dumpIFile = function(ifl_hnd, sd_hnd, file_path, is_exfat) {
	if (is_exfat == undefined) {
		is_exfat = false;
	}
	sc.withHandle(ifl_hnd, () => {
		var size = sc.ipcMsg(4).datau64(0).sendTo(ifl_hnd).assertOk().data;
		utils.log('Size: '+utils.paddr(size));
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

			sc.ipcMsg(0).datau64(0, offset, buf_sz).bDescriptor(outbuf, buf_sz, 1).sendTo(ifl_hnd).assertOk();
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
        sc.ipcMsg(2).sendTo(ifl_hnd).assertOk();
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

createDirectory = function(ifs_hnd, path) {
	var pbuf = utils.str2ab(path);
	var res = sc.ipcMsg(2).data([0, 0]).xDescriptor(pbuf, pbuf.byteLength, 0).sendTo(ifs_hnd);
	utils.log('Create '+path+': ');
	res.show();

}

writeBufferToFile = function(f_hnd, offset, buf, sz) {
	sc.ipcMsg(1).aDescriptor(buf, sz, 1).data([0,0], utils.pad64(offset), utils.trunc32(sz)).sendTo(f_hnd).show().assertOk();
};

openFile = function(ifs_hnd, path) {
	var pbuf = utils.str2ab(path);
	utils.log('Open '+path+': ');
	return sc.ipcMsg(8).datau32(3).xDescriptor(pbuf, pbuf.byteLength, 0).sendTo(ifs_hnd).show().asResult().map((r) => r.movedHandles[0]).getValue();
};
openReadFile = function(ifs_hnd, path) {
	var pbuf = utils.str2ab(path);
	utils.log('Open '+path+': ');
	return sc.ipcMsg(8).datau32(1).xDescriptor(pbuf, pbuf.byteLength, 0).sendTo(ifs_hnd).show().asResult().map((r) => r.movedHandles[0]).getValue();
};

/* define enums */
var TYPE_CNMT = 0;
var TYPE_PROGRAM = 1;
var TYPE_DATA = 2;
var TYPE_ICON = 3;
var TYPE_DOC = 4;
var TYPE_INFO = 5;

var STORAGE_NONE = 0;
var STORAGE_HOST = 1;
var STORAGE_GAMECARD = 2;
var STORAGE_NANDSYS = 3;
var STORAGE_NANDUSER = 4;
var STORAGE_SDCARD = 5;

/* Configure these as desired. */
var TITLE_ID = '0100000000001000';
var TITLE_TYPE = TYPE_PROGRAM;
var TITLE_STORAGE = STORAGE_NANDSYS;
        
/* Get the desired NCA ID */
var nca_id = new Uint32Array(4);
sc.ipcMsg(5).datau32(TITLE_STORAGE).sendTo('ncm').asResult().andThen(res => {
    sc.withHandle(res.movedHandles[0], function(hnd) {
        // var meta_record = GetMetaRecord(TITLE_ID);
        var res = sc.ipcMsg(6).datau64(utils.parseAddr(TITLE_ID)).sendTo(hnd).assertOk();
        // var nca_id = GetEntryContentNcaId(meta_record, TITLE_TYPE);
        res = sc.ipcMsg(3).datau32(TITLE_TYPE, 0, res.data[0], res.data[1], res.data[2], res.data[3]).sendTo(hnd).assertOk();
        for (var i = 0; i < 4; i++) {
            nca_id[i] = res.data[i];
        }
    });
});

// Get NCA string for pretty printing.
var nca_id_str = '';
for (var i = 0; i < 4; i++) {
    var val = nca_id[i];
    for (var j = 0; j < 4; j++) {
        var b = (val >> (j*8)) & 0xFF;
        nca_id_str += ('00' + b.toString(16)).slice(-2);
    }
}
if (TITLE_TYPE == TYPE_CNMT) {
    nca_id_str += '.cnmt';
}
nca_id_str += '.nca';

utils.log('Found NCA: '+nca_id_str);

sc.getService('fsp-srv', (hnd) => {
	utils.log('Using fsp-srv handle: 0x' + hnd.toString(16));
	sc.ipcMsg(1).sendPid().datau64(0).sendTo(hnd).assertOk();
	utils.log("initialized fsp-srv");


    try {
        var sd_mnt = sc.ipcMsg(18).sendTo(hnd).assertOk();
    } catch(e) {
        throw new Error("Failed to open SD card. Is it inserted?");
    }

	utils.log("Opened SD card.");
    
    if (TITLE_STORAGE == STORAGE_GAMECARD) {
        utils.log('Getting gamecard handle...');
        var ido_res = sc.ipcMsg(400).sendTo(hnd).assertOk();
        var gc_hnd = undefined;
        sc.withHandle(ido_res.movedHandles[0], (ido_hnd) => {
            gc_hnd = sc.ipcMsg(202).sendTo(ido_hnd).assertOk().data[0];
        });
        utils.log('Gamecard handle: '+gc_hnd);
        sd_mnt.withHandles((r, m, c) => {
            var sd_hnd = m[0];
            var nca_id_path = '/ncas';
            createDirectory(sd_hnd, nca_id_path);
            nca_id_path += '/'+['None', 'Host', 'Gamecard', 'System', 'User', 'Sdcard'][TITLE_STORAGE];
            createDirectory(sd_hnd, nca_id_path);
            nca_id_path += '/'+TITLE_ID;
            createDirectory(sd_hnd, nca_id_path);
            nca_id_path += '/'+nca_id_str;
            var res = sc.ipcMsg(31).datau32(gc_hnd, 2).sendTo(hnd).show().asResult();
            if (res.isOk) {  
                res = res.getValue();
                sc.withHandle(res.movedHandles[0], (gc_fs_hnd) => {
                    var nca_hnd = openReadFile(gc_fs_hnd, '/'+nca_id_str);
                    dumpIFile(nca_hnd, sd_hnd, nca_id_path, false);
                });
            } else {
                utils.log('Failed to mount gamecard secure partition!');
            }
        });
    } else {
        /* Dump the desired NCA */
        sc.ipcMsg(4).datau32(TITLE_STORAGE).sendTo('ncm').asResult().andThen(res => {
            sc.withHandle(res.movedHandles[0], function(ncm_hnd) {
                sd_mnt.withHandles((r, m, c) => {
                    var sd_hnd = m[0];
                    var nca_id_path = '/ncas';
                    createDirectory(sd_hnd, nca_id_path);
                    nca_id_path += '/'+['None', 'Host', 'Gamecard', 'System', 'User', 'Sdcard'][TITLE_STORAGE];
                    createDirectory(sd_hnd, nca_id_path);
                    nca_id_path += '/'+TITLE_ID;
                    createDirectory(sd_hnd, nca_id_path);
                    nca_id_path += '/'+nca_id_str;
                    dumpNCA(nca_id, ncm_hnd, sd_hnd, nca_id_path, false);
                });
            });
        }); 
    }
    


});