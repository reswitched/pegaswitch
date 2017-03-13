import json, logging, random, os, errno
from flask import Flask, request, make_response
from functools import wraps, update_wrapper
from datetime import datetime

def nocache(view):
	@wraps(view)
	def no_cache(*args, **kwargs):
		response = make_response(view(*args, **kwargs))
		response.headers['Last-Modified'] = datetime.now()
		response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
		response.headers['Pragma'] = 'no-cache'
		response.headers['Expires'] = '-1'
		return response
	return update_wrapper(no_cache, view)

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__, static_url_path='')
app.debug = True

@app.route('/')
@nocache
def root():
	return file('exploit/index.html').read()

@app.route('/bundle.js')
@nocache
def bundle():
	return file('exploit/bundle.js').read()

failures = successes = 0

@app.route('/log', methods=['POST'])
@nocache
def log():
	global failures, successes
	if request.form['data'] == 'undefined':
		message = '??undefined??'
	else:
		message = json.loads(request.form['data'])
	if message == 'Loaded':
		print
		print
		if failures != 0 or successes != 0:
			print 'Success percentage: %.2f (%i samples)' % (successes / float(failures + successes) * 100, failures + successes)
	elif isinstance(message, unicode) and message.startswith('~~'):
		if message == '~~failed':
			failures += 1
		elif message == '~~success':
			successes += 1
		return ''
	print 'Log: ', message
	return ''

@app.route('/error', methods=['POST'])
@nocache
def error():
	line, message = json.loads(request.form['data'])

	print 'ERR [%i]: ' % line, message
	return ''

memory = {}
@app.route('/memdump', methods=['POST'])
@nocache
def memdump():
	lo, hi, data = json.loads(request.form['data'])

	base = (int(hi, 16) << 32) | int(lo, 16)

	print 'Got memory at base 0x%016x' % base

	memory[base] = data
	with file('memdump.json', 'w') as fp:
		fp.write(json.dumps(memory))

	return ''

@app.route('/filedump', methods=['POST'])
@nocache
def filedump():
    fn = request.headers['Content-Disposition']
    #if '/' in fn:
    #    fn = fn[fn.rindex('/') + 1:]
    fn = fn.replace(":", "")
    if not os.path.exists(os.path.dirname(fn)):
        try:
            os.makedirs(os.path.dirname(fn))
        except OSError as exc: # Guard against race condition
            if exc.errno != errno.EEXIST:
                raise
    with open(fn, 'ab') as f:
        f.write(request.data)
    print 'wrote to %s!' % fn
    return ''

app.run(host='0.0.0.0', port=80, threaded=True)

