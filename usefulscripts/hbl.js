sc.getServices(["lr"], function (lr) {
    var path = utils.str2ab("@Sdcard:/ncm.nsp");
    //var path = utils.str2ab("@User:/.nsp"); /* path used by switchbrew's hbl installer */
    /* OR put your own hbl nsp on your SD card, for example:
        var path = utils.str2ab("@Sdcard:/ncm.nsp");
    */
    var tid  = [0x100D, 0x01000000];        /* TID of the Album applet */
    var storageId = 3;                      /* NAND (location of the Album applet) */

    var msg = sc.ipcMsg(0).data(storageId).sendTo(lr).assertOk(); /* nn::lr::ILocationResolverManager(StorageId storageId) => nn::lr::ILocationResolver */
    sc.withHandle(msg.movedHandles[0], (h) => {                   /* nn::lr::ILocationResolver::SetProgramNcaPath(u64 TID, const char *path) */
        msg = sc.ipcMsg(1).data(tid).xDescriptor(path, path.byteLength, 0).sendTo(h).assertOk();
    });
});