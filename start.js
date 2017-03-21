const fs = require('fs')
const path = require('path')
const os = require('os')

const browserify = require('browserify')
const dnsd = require('dnsd')
const ip = require('ip')
const express = require('express')
const bodyParser = require('body-parser')
const mkdirp = require('mkdirp')
const blessed = require('blessed')
const contrib = require('blessed-contrib')
const yargs = require('yargs')

if (os.platform() !== 'win32' && process.getuid() !== 0) {
  console.error('Please run as root so we can bind to port 53 & 80')
  process.exit()
}

let argv = yargs
  .usage('Usage $0')
  .describe('disable-curses', 'Disabled curses interface. Requires --logfile')
  .describe('disable-dns', 'Disables builtin DNS server.')
  .describe('ip', 'Override IP address DNS server responds with')
  .describe('logfile', 'Writes debug log to file')
  .example('$0 --ip 1.2.4.8 --disable-curses --logfile debug.txt')
  .help('h')
  .nargs('ip', 1)
  .nargs('logfile', 1)
  .alias('h', 'help')
  .argv

if (argv['disable-curses'] && !argv.logfile) {
  console.error('--disable-curses requires --logfile')
  process.exit(1)
}

let logger = {
  log: function (data) {
    fs.writeFileSync(path.resolve(__dirname, argv.logfile), `${data}\n`, {
      flag: 'a'
    })
  }
}

if (argv['disable-dns'] !== true) {
  // Spin up our DNS server
  let dns = dnsd.createServer(function(req, res) {
    res.end(argv.ip || ip.address())
  })

  dns.on('error', function (err) {
    console.log(`There was an issue setting up DNS: ${err.message}`)
    process.exit()
  })

  dns.listen(53, '0.0.0.0')
}

// Web server
const app = express()
app.use(bodyParser.json())

app.get('/', function (req, res) {
  res.end(fs.readFileSync(path.resolve(__dirname, 'exploit/index.html')))
})

app.get('/minmain.js', function (req, res) {
  res.end(fs.readFileSync(path.resolve(__dirname, 'exploit/minmain.js')))
})

app.get('/bundle.js', function (req, res) {
  let b = browserify({
    entries: [ 'exploit/main.js'],
    cache: {},
    packageCache: {}
  }).bundle().pipe(res)
})

let failures = 0
let successes = 0

app.post('/log', function (req, res) {
  let message = req.body.msg

  if (message === 'Loaded') {
    logger.log(`Success percentage: ${(successes / failures * 100).toFixed(2)} (${successes + failures} samples)`)
  } else if (message === '~~failed') {
    failures++
  } else if (message === '~~success') {
    successes++
  } else {
    logger.log(message)
  }

  return res.sendStatus(200)
})

app.post('/error', function (req, res) {
  logger.log(`ERR [${req.body.msg[0]}]: ${req.body.msg[1]}`)
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

if (argv['disable-curses']) {
  return require('./repl')
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

logger = log

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

// Render everything
screen.render()
