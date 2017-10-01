var utils = require('../utils');

function IFile (sc, handle) {
	this.sc = sc;
	this.handle = handle;
}

IFile.prototype.Write = function (offset, buf, size) {
	return this.sc.ipcMsg(1).aDescriptor(buf, size, 1).datau64(0, offset, size).sendTo(this.handle).asResult();
};

IFile.prototype.GetSize = function () {
	return this.sc.ipcMsg(4).sendTo(this.handle).asResult()
		.map((r) => [r.data[0], r.data[1]]);
};

IFile.prototype.Read = function (size) {
	if(size instanceof ArrayBuffer || ArrayBuffer.isView(size)) {
		var m = size;
		size = m.byteLength;
	} else {
		var m = new ArrayBuffer(utils.trunc32(size));
	}
	return this.sc.ipcMsg(0).datau64(0, 0, size).bDescriptor(m, size, 1).sendTo(this.handle).asResult().replaceValue(m);
};

IFile.prototype.ReadAll = function () {
	var self = this;
	return this.GetSize().andThen((size) => {
		var fSize = utils.trunc32(size);
		var m = new ArrayBuffer(fSize);
		return self.sc.ipcMsg(0).datau64(0, 0, fSize).bDescriptor(m, fSize, 1).sendTo(self.handle).asResult().replaceValue(m);
	});
};

IFile.prototype.Close = function () {
	return this.sc.svcCloseHandle(this.handle);
};

module.exports = IFile;
