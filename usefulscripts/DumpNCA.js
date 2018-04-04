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
var TITLE_ID = "0100000000001000";
var TITLE_TYPE = TYPE_PROGRAM;
var TITLE_STORAGE = STORAGE_NANDSYS;

sc.enableTurbo();
sc.escalateFilesystemAccess();

var dumpNCA = function(nca_id, ics_handle, sd, path, is_exfat) {
	var size = sc.ipcMsg(14).datau32(nca_id[0], nca_id[1], nca_id[2], nca_id[3]).sendTo(ics_handle).assertOk().data;
	sc.dumpToFile(sd, path, is_exfat, size, (ab, offset, size) => {
		offset = utils.pad64(offset);
		return sc.ipcMsg(18).datau32(nca_id[0], nca_id[1], nca_id[2], nca_id[3], offset[0], offset[1])
			.bDescriptor(ab, size).sendTo(ics_handle).asResult();
	});
};

var nca_id = new Uint32Array(4);
// find nca_id:
sc.getService("ncm", (ncm_handle) => {
	sc.ipcMsg(5).datau32(TITLE_STORAGE).sendTo("ncm").assertOk().withHandles((r, m, c) => { // GetIContentMetaDatabase
		var icmd = m[0]; // IContentMetaDatabase
		var res = sc.ipcMsg(6).datau64(utils.parseAddr(TITLE_ID)).sendTo(icmd).assertOk(); // GetMetaRecord
		res = sc.ipcMsg(3).datau32(TITLE_TYPE, 0, res.data[0], res.data[1], res.data[2], res.data[3]).sendTo(icmd).assertOk(); // GetEntryContentNcaId
		for(var i = 0; i < 4; i++) {
			nca_id[i] = res.data[i];
		}
	});
});

// Get NCA string for pretty printing.
var nca_id_str = "";
for (var i = 0; i < 4; i++) {
	var val = nca_id[i];
	for (var j = 0; j < 4; j++) {
		var b = (val >> (j*8)) & 0xFF;
		nca_id_str+= ("00" + b.toString(16)).slice(-2);
	}
}
if (TITLE_TYPE == TYPE_CNMT) {
	nca_id_str+= ".cnmt";
}
nca_id_str+= ".nca";

utils.log("Found NCA: " + nca_id_str);

var allow402 = function(result) {
	return result.mapErr((e) => { if(e.resultCode != 0x402) { throw new Error(e); } });
};

sc.getService("fsp-srv", (fspsrv) => {
	sc.ipcMsg(1).sendPid().datau64(0).sendTo(fspsrv).assertOk();
	sc.ipcMsg(18).sendTo(fspsrv).asResult().mapErr((e) => "Failed to open SD card. Is it inserted?: " + e.toString()).assertOk().withHandles((r, m, c) => {
		var sd = new sc.IFileSystem(sc, m[0]);
		var nca_id_path = "/ncas";
		allow402(sd.CreateDirectory(nca_id_path));
		nca_id_path+= "/" + ["None", "Host", "Gamecard", "System", "User", "Sdcard"][TITLE_STORAGE];
		allow402(sd.CreateDirectory(nca_id_path));
		nca_id_path+= "/" + TITLE_ID;
		allow402(sd.CreateDirectory(nca_id_path));
		nca_id_path+= "/" + nca_id_str;
		
		if(TITLE_STORAGE == STORAGE_GAMECARD) {
			utils.log("Getting gamecard handle...");
			var gc_hnd = sc.ipcMsg(400).sendTo(fspsrv).assertOk().withHandles((r, m, c) => { // OpenDeviceOperator
				var ido = m[0];
				return sc.ipcMsg(202).sendTo(ido).assertOk().data[0]; // GetCameCardHandle
			});
			utils.log("Got gamecard handle: 0x" + gc_hnd.toString(16));
			sc.ipcMsg(31).datau32(gc_hnd, 2).sendTo(fspsrv).asResult().map((r) => {
				r.withHandles((r, m, c) => {
					utils.log("mounted secure partition");
					var gc_fs = new sc.IFileSystem(sc, m[0]);
					var nca_file = gc_fs.OpenFile("/" + nca_id_str).assertOk();
					sc.withHandle(nca_file.handle, () => {
						sc.dumpToFile(sd, nca_id_path, false, nca_file.GetSize().assertOk(), nca_file.makeReader());
					});
				});
			}, (e) => {
				throw new Error("failed to mount gamecard secure partition: " + e.toString());
			});
		} else {
			sc.getService("ncm", (ncm) => {
				sc.ipcMsg(4).datau32(TITLE_STORAGE).sendTo(ncm).assertOk().withHandles((r, m, c) => { // GetIContentStorage
					var ics = m[0];
					dumpNCA(nca_id, ics, sd, nca_id_path, false);
				});
			});
		}
	});
});
