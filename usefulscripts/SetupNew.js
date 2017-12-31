/*
	Both of these settings are automatically set by PegaSwitch. You shouldn't need to run this script.
 */

sc.killAutoHandle();

var settings = {
	'eupld!upload_enabled' : 0, 
	'ro!ease_nro_restriction' : 1, 
};

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

var keys = Object.keys(settings);
sc.getServices(["set:sys", "set:fd"], function (setsys, setfd) {
  for(var elem of keys) {
    var velem = elem.split('!');
    var cls = velem[0], name = velem[1];
    var orig = getSetting(setsys, cls, name).assertOk();
    utils.log(elem + ' original: 0x' + orig.toString(16));
    var set = settings[elem];
    utils.log(elem + ' assigning to: 0x' + set.toString(16));
    setSetting(setfd, cls, name, set).assertOk();
    if(getSetting(setsys, cls, name).assertOk() != set) {
      utils.log('... FAILED');
    }
  }
});

utils.log("done");

