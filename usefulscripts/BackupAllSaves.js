function GetUsers() {
	return sc.getService("acc:u0", (acc) => {
		var numAccounts = sc.ipcMsg(0).sendTo(acc).assertOk().dataBuffer[0];
		var obuf = new Uint32Array(4*8);
		sc.ipcMsg(2).datau32().cDescriptor(obuf, obuf.length * 4, true).sendTo(acc).assertOk();
		var ids = [];
		for(var i = 0; i < numAccounts; i++) {
			ids[i] = [obuf[i*4+0], obuf[i*4+1], obuf[i*4+2], obuf[i*4+3]];
		}
		return ids;
	});
}

function GetProfile(id) {
	return sc.getService("acc:u0", (acc) => {
		return sc.withHandle(sc.ipcMsg(5).datau32(id[0], id[1], id[2], id[3]).sendTo(acc).assertOk().movedHandles[0], (iProfile) => {
			var userData = new Uint8Array(0x80);
			var profileBase = new Uint32Array(
				sc.ipcMsg(0).cDescriptor(userData).sendTo(iProfile).assertOk().data);
			var imageSize = sc.ipcMsg(10).sendTo(iProfile).assertOk().data[0];
			var image = new Uint8Array(imageSize);
			sc.ipcMsg(11).bDescriptor(image, image.byteLength, 0).sendTo(iProfile).assertOk();
			return {
				name: utils.u8a2nullstr(new Uint8Array(profileBase.buffer, 0x18, 10)),
				imageData: image
			};
		});
	});
}

function GetIApplicationManager(cb) {
	if(sc.hasService("ns:am")) {
		return sc.getService("ns:am", cb);
	} else {
		return sc.getService("ns:am2", (ns) => {
			return sc.ipcMsg(7996).sendTo(ns).assertOk().withHandles((r, m, c) => { // GetIApplicationManager
				return cb(m[0]);
			});
		});
	}
}

function GetTitleIds() {
	return GetIApplicationManager((iam) => {
		var buf = new Uint32Array(0x18*32); // 32 games max
		var count = sc.ipcMsg(0).datau32(0).bDescriptor(buf).sendTo(iam).assertOk().data[0];
		var tids = [];
		for(var i = 0; i < count; i++) {
			tids[i] = [buf[6*i+0], buf[6*i+1]];
		}
		return tids;
	});
}

sc.enableTurbo();
sc.escalateFilesystemAccess();
var date = new Date();
var prefix = "saves-" + date.getFullYear() + "-" + (date.getMonth()+1) + "-" + date.getDate() + "-" + date.getHours() + "-" + date.getMinutes();
var tids = GetTitleIds();

sc.getService("fsp-srv", (serv) => {
	GetUsers().forEach((userId) => {
		var profile = GetProfile(userId);
		utils.log("dump saves for " + profile.name);
		sc.ipcMsg(1).sendPid().data(0).sendTo(serv);
		
		tids.forEach((tid) => {
			utils.log("dump saves for " + profile.name + " game " + utils.paddr(tid));
			var msg = sc.ipcMsg(51).datau64(0x1, utils.pad64(tid), [userId[0], userId[1]], [userId[2], userId[3]], [0x0, 0x0], 0x1, 0x0, 0x0, 0x0).sendTo(serv);
			if(!msg.success) {
				utils.log("failed to mount save data for " + profile.name + " game " + utils.paddr(tid) + ": 0x" + msg.resultCode.toString(16));
				return;
			}
			sc.withHandle(msg.movedHandles[0], (h) => {
				var fs = new sc.IFileSystem(sc, h);
				try {
					var curDir = fs.OpenDir("/").assertOk();
					try {
						curDir.DirDump(prefix + "/" + profile.name + "/" + utils.paddr(tid) + "/");
					} finally {
						curDir.Close();
					}
				} finally {
					fs.Close();
				}
				utils.log("finished dumping saves for " + profile.name + " game " + utils.paddr(tid));
			});
		});
		
		utils.log("finished dumping saves for " + profile.name);
	});
});
