import json

with file('memdump.json', 'r') as fp:
	data = json.loads(fp.read())
	
	first = min(map(int, data.keys()))
	last = max(map(int, data.keys()))

	all = []
	for i in xrange(0, (last - first) + 4096, 4096):
		sub = data[str(i + first)]
		for elem in sub:
			all.append(elem & 0xFF)
			all.append((elem >> 8) & 0xFF)
			all.append((elem >> 16) & 0xFF)
			all.append((elem >> 24) & 0xFF)

	with file('memdump.bin', 'wb') as wfp:
		wfp.write(''.join(map(chr, all)))