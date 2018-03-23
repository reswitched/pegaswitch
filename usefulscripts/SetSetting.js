sc.killAutoHandle();

// change these
var cls = '';
var nam = '';
var setValue = 0;

function getSetting(session, cls, nam) { // session is set:sys
	var out = new Uint32Array(1);
	var x1 = utils.str2ab(cls);
	var x2 = utils.str2ab(nam);
	return sc.ipcMsg(38).bDescriptor(out, 4, 0).xDescriptor(x1, 48, 0).xDescriptor(x2, 48, 1).sendTo(session).asResult().map((r) => out[0]);
}

function setSetting(session, cls, nam, value) { // session is set:fd
	var a = new Uint32Array(1);
	a[0] = value;
	var x1 = utils.str2ab(cls);
	var x2 = utils.str2ab(nam);
	return sc.ipcMsg(2).xDescriptor(x1, 48, 0).xDescriptor(x2, 48, 1).aDescriptor(a, 4, 0).sendTo(session).asResult();
}

sc.getServices(["set:sys", "set:fd"], function (setsys, setfd) {
	var val = getSetting(setsys, cls, nam).assertOk();
	utils.log(cls + '!' + nam + ': 0x' + val.toString(16));
	setSetting(setfd, cls, nam, setValue).assertOk();
	var val2 = getSetting(setsys, cls, nam).assertOk();
	utils.log(cls + '!' + nam + ': 0x' + val2.toString(16));
	if(val != val2) {
		utils.log('SUCCESS');
	}
});
