const fs = require('fs')
const path = require('path')
const os = require('os')

const browserify = require('browserify')
const watchify = require('watchify')
const dnsd = require('dnsd')
const ip = require('ip')
const express = require('express')
const bodyParser = require('body-parser')
const mkdirp = require('mkdirp')
const blessed = require('blessed')
const contrib = require('blessed-contrib')

if (os.platform() !== 'win32' && process.getuid() !== 0) {
  console.error('Please run as root so we can bind to port 53 & 80')
  process.exit()
}

// Setup our terminal
let screen = blessed.screen({
  smartCSR: true
})

let log = contrib.log({
  parent: screen,
  fg: 'green',
  selectedFg: 'green',
  label: 'Debug Log',
  border: 'line',
  width: '30%',
  height: '100%',
  left: '70%',
  style: {
    fg: 'default',
    bg: 'default',
    focus: {
      border: {
        fg: 'green'
      }
    }
  }
})

let repl = blessed.terminal({
  parent: screen,
  cursor: 'line',
  cursorBlink: true,
  screenKeys: false,
  label: 'REPL',
  left: 0,
  top: 0,
  width: '70%',
  height: '100%',
  border: 'line',
  style: {
    fg: 'default',
    bg: 'default',
    focus: {
      border: {
        fg: 'green'
      }
    }
  },
  shell: path.resolve(__dirname, 'repl.js')
});

repl.on('exit', function () {
  process.exit()
})

screen.append(log)
screen.append(repl)

repl.focus()

// Build our exploit bundle
let b = browserify({
  entries: [ 'exploit/main.js'],
  cache: {},
  packageCache: {},
  plugin: [ watchify ]
})

b.on('update', bundle)
bundle()

function bundle() {
  b.bundle().pipe(fs.createWriteStream('exploit/bundle.js'))
}

// Spin up our DNS server
let dns = dnsd.createServer(function(req, res) {
  res.end(ip.address())
})

dns.on('error', function (err) {
  console.log('There was an issue setting up DNS:', err.message)
  process.exit()
})

dns.listen(53, '0.0.0.0')

// Web server
const app = express()
app.use(bodyParser.json())

app.get('/', function (req, res) {
  res.end(fs.readFileSync(path.resolve(__dirname, 'exploit/index.html')))
})

app.get('/bundle.js', function (req, res) {
  res.end(fs.readFileSync(path.resolve(__dirname, 'exploit/bundle.js')))
})

let failures = 0
let successes = 0

app.post('/log', function (req, res) {
  let message = req.body.msg

  if (message === 'Loaded') {
    log.log(`Success percentage: ${(successes / failures * 100).toFixed(2)} (${successes + failures} samples)`)
  } else if (message === '~~failed') {
    failures++
  } else if (message === '~~success') {
    successes++
  } else {
    log.log(message)
  }

  return res.sendStatus(200)
})

app.post('/error', function (req, res) {
  log.log(`ERR [${req.body.line}]: ${req.body.message}`)
  return res.sendStatus(200)
})

app.post('/filedump', function (req, res) {
  let name = req.get('Content-Disposition').replace(':', '')
  let dir = path.dirname(name)

  try {
    fs.statSync(dir)
  } catch (e) {
    mkdirp.sync(dir)
  }
  req.pipe(fs.createWriteStream(name, {
    defaultEncoding: 'binary',
    flags: 'a'
  }))

  return res.sendStatus(200)
})

app.listen(80, '0.0.0.0', function (err) {
  if (err) {
    console.error('Could not bind to port 80')
    process.exit(1)
  }
})

// Render everything
// screen.render()
