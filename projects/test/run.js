const express = require('express');
const morgan = require('morgan');
const instant = require('instant');
const path = require('path');
const ngrok = require('ngrok');
const openurl = require('openurl');
const Mocha = require('mocha');

const app = express();
const port = process.env.PORT || 3000;

var running = false;

app.use(morgan('dev'));
app.use(instant(path.join(__dirname, 'public')));

app.post('/', (req, res) => {
  res.sendStatus(200);

  run();
});

app.listen(port, () => {
  console.log('Server running on port', port);

  ngrok.connect({
    proto: 'http',
    addr: port,
  }, (err, url) => {
    console.log('Public URL is', url);

    openurl.open(path.join('http://localhost:' + port));

    run();
  });
});

function run() {
  if (running) {
    console.log('Already running');
  } else {
    console.log('Running tests');

    running = true;

    Object.keys(require.cache).forEach(file => {
      delete require.cache[file];
    });

    new Mocha({
      reporter: 'mochawesome',
      reporterOptions: {
        reportDir: path.join(__dirname, 'public'),
        reportFilename: 'index',
        inlineAssets: true
      }
    }).addFile(path.join(__dirname, 'lib', 'test.js')).run((failures) => {
      running = false;
    });
  }
}