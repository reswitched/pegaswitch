import json, logging
from flask import Flask, request

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__, static_url_path='')
app.debug = True

@app.route('/')
def root():
	return file('index.html').read()

@app.route('/main.js')
def main():
	return file('main.js').read()

@app.route('/log', methods=['POST'])
def log():
	if request.form['data'] == 'undefined':
		message = '??undefined??'
	else:
		message = json.loads(request.form['data'])
	if message == 'Loaded':
		print
		print
	print 'Log: ', message
	return ''

@app.route('/error', methods=['POST'])
def error():
	line, message = json.loads(request.form['data'])

	print 'ERR [%i]: ' % line, message
	return ''

app.run(host='0.0.0.0', port=80, threaded=True)
