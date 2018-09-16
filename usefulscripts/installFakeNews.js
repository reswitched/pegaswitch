//
// Script originally by kgsws, modified by SciresM.
// BEWARE! By modifying system save data you risk a brick.
//

sc.killAutoHandle();

var save_struct = new Uint8Array([
	0, 0, 0, 0, 0, 0, 0, 0,
	0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
	0, 0, 0, 0, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0, 0, 0,
]);

var perm_a = new Uint8Array([
	0x01, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x1c, 0x00, 0x00, 0x00, 0x00,
	0x00, 0x00, 0x00, 0x1c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

var perm_b = new Uint8Array([
	0x01, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00,
	0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
	0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff
]);

var save_data;
var save_file = "/data/D00000000000000000000_LS00000000000000010000.msgpack";

// you have to make pegaswitch serve static HTTP files, like ace_loader or kgDoom used
var xhr = new XMLHttpRequest();
xhr.open("GET", "/fake_news.mp", false);
xhr.send(null);
if(xhr.status !== 200) {
	throw new Error("xhr failure " + xhr.status);
}
var save_data = new Uint8Array(JSON.parse(xhr.responseText));

utils.log('fake_news_len: '+save_data.length);
utils.log('AAA: '+save_data[0xCCC].toString(16));

if (sc.elev_privs === undefined || !sc.elev_privs) {
	sc.elev_privs = false;
	// kill bcat
	var tid = utils.parseAddr('010000000000000C'); // bcat
	sc.ipcMsg(2).data(tid).sendTo('pm:shell');
	sc.getService("pm:dmnt", (hndle) => {
		utils.log("got handle 0x" + hndle.toString(16));

		// crash PM
		for(var i = 0; i < 64; i++)
		{
			var res = sc.ipcMsg(2).setType(5).sendTo(hndle);//.assertOk();
			if(res.movedHandles != undefined)
				utils.log("duplicate 0x" + res.movedHandles[0].toString(16));
		}

	});
	var pid = sc.getService('fsp-srv', (tmp_hnd) => {
		utils.log("got fspsrv");
		sc.ipcMsg(1).sendPid().data(0).sendTo(tmp_hnd).assertOk();
		return sc.read4(sc.ipcBufAddr, 0xC >> 2);
	});
	sc.getService("fsp-pr", (hndle) => {
		// ClearFsPermissions
		sc.ipcMsg(1).data(pid).sendTo(hndle).assertOk();
		// SetFsPermissions
		sc.ipcMsg(0).data(3, pid, tid, 0x1c, 0x2c).aDescriptor(perm_a.buffer, 0x1c, 0).aDescriptor(perm_b.buffer, 0x2c, 0).sendTo(hndle).assertOk();
	});
	sc.elev_privs = true;
}



sc.getService("fsp-srv", (hndle) => {
	utils.log("got handle 0x" + hndle.toString(16));
	sc.ipcMsg(1).datau64(0).sendPid().sendTo(hndle).assertOk(); // initialize
	var res = sc.ipcMsg(52).dataArrayBuffer(save_struct.buffer).sendTo(hndle).assertOk(); // MountSystemSaveData
	sc.withHandle(res.movedHandles[0], (bish) => {
		utils.log("got handle 0x" + hndle.toString(16));
		var fs = new sc.IFileSystem(sc, bish);
		utils.log("delete file");
		fs.DeleteFile(save_file).assertOk();
		utils.log("create file");
		fs.CreateFile(save_file, save_data.byteLength).assertOk();
		utils.log("open file");
		var f = fs.OpenFile(save_file).assertOk();
		utils.log("write file");
		f.Write(0, save_data.buffer, save_data.byteLength).assertOk();
		utils.log("close file");
		f.Close();
		utils.log("commit");
		sc.ipcMsg(10).sendTo(bish).assertOk(); // commit
		utils.log("finished");
		if (sc.version === '1.0.0') {    
			sc.ipcMsg(1).sendTo("bpc:c").assertOk();
		} else {
			sc.ipcMsg(1).sendTo("bpc").assertOk();
		}
	});
});