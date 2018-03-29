function SetPerms() {
  sc.getFSPPR();
  utils.log("expldr triggered");
  sc.enableTurbo();
  utils.log("enabled turbo");
  sc.getService("fsp-pr", (fsppr) => {
    utils.log("got fsppr");
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
    var first_value = 1;

    sc.write4(first_value, buf, 0x0>>2); // Must be equal to second buf's first value + non-zero
    sc.write8([0xFFFFFFFF, 0xFFFFFFFF], buf, 0x4 >> 2); // This is the permissions value.
    sc.write4(buf1_sz, buf, 0xC >> 2); 
    sc.write4(buf1_sz, buf, 0x14 >> 2); 

    sc.write4(first_value, buf2, 0x0 >> 2); // Must be equal to second buf's first value + non-zero
    sc.write8([0xFFFFFFFF, 0xFFFFFFFF], buf2, 0x4 >> 2); // This is the permissions value -- actual perms = buf2_val & buf1_val
    sc.write4(0xFFFFFFFF, buf2, 0x14 >> 2);
    sc.write4(0xFFFFFFFF, buf2, 0x18 >> 2);
    sc.write4(0xFFFFFFFF, buf2, 0x24 >> 2);
    sc.write4(0xFFFFFFFF, buf2, 0x28 >> 2);


    sc.ipcMsg(256).data(0).sendTo(fsppr).assertOk();
    sc.ipcMsg(1).data(pid).sendTo(fsppr).assertOk();

    //TODO: Figure out what the non-pid arguments are lol
    sc.ipcMsg(0).data(2, pid, [0,0], buf1_sz, buf2_sz, pid, pid, 0, 0, 0, 0, 0).aDescriptor(buf, buf1_sz).aDescriptor(buf2, buf2_sz).sendTo(fsppr).assertOk();
    sc.free(buf);
    sc.free(buf2);
    utils.log("finish inner set perms");
  });
}

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

function GetTitleIds() {
  return sc.getService("ns:am", (nsam) => {
    var buf = new Uint32Array(0x18*32); // 32 games max
    var count = sc.ipcMsg(0).datau32(0).bDescriptor(buf).sendTo(nsam).assertOk().data[0];
    var tids = [];
    for(var i = 0; i < count; i++) {
      tids[i] = [buf[6*i+0], buf[6*i+1]];
    }
    return tids;
  });
}

function Main() {
  var date = new Date();
  var prefix = "saves-" + date.getFullYear() + "-" + (date.getMonth()+1) + "-" + date.getDate() + "-" + date.getHours() + "-" + date.getMinutes();
  var tids = GetTitleIds();
  
  sc.getService( 'fsp-srv', (serv) => {
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
            var curDir = fs.OpenDir('/').assertOk();
            try {
              curDir.DirDump(prefix + "/" + profile.name + "/" + utils.paddr(tid) + '/');
            } finally {
              curDir.Close();
            }
          } finally {
            fs.Close();
          }
          utils.log('finished dumping saves for ' + profile.name + " game " + utils.paddr(tid));
        });
      });

      utils.log("finished dumping saves for " + profile.name);
    });
  });
}

SetPerms();
utils.log("finished setting perms");
Main();
