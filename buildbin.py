import json

with file('memdump.json', 'r') as fp:
	data = json.loads(fp.read())

	keys = sorted(map(int, data.keys()))
	
	print '%016x' % keys[0]

	all = []
	for key in keys:
		print '%016x' % key
		sub = data[str(key)]
		for elem in sub:
			elem = int(elem)
			all.append(elem & 0xFF)
			all.append((elem >> 8) & 0xFF)
			all.append((elem >> 16) & 0xFF)
			all.append((elem >> 24) & 0xFF)

	with file('memdump.bin', 'wb') as wfp:
		wfp.write(''.join(map(chr, all)))