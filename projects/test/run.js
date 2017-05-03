const express = require('express');
const morgan = require('morgan');
const path = require('path');
const ngrok = require('ngrok');
const openurl = require('openurl');
const Mocha = require('mocha');

const app = express();
const port = process.env.PORT || 3000;
var publicUrl = '';

app.use(morgan('dev')); 

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'report.html'));
});

app.post('/', (req, res) => {
  console.log('Running tests');

  Object.keys(require.cache).forEach(file => {
    delete require.cache[file];
  });

  new Mocha({
    reporter: 'mochawesome',
    reporterOptions: {
      reportDir: path.join(__dirname, 'public'),
      reportFilename: 'report',
      reportTitle: 'Report',
      reportPageTitle: 'Report',
      inlineAssets: true
    }
  }).addFile(path.join(__dirname, 'lib', 'test.js')).run((failures) => {
    openurl.open(publicUrl); // this opens a new tab, i want it to refresh
  });
});

app.listen(port, () => {
  console.log('Server running on port', port);

  ngrok.connect(port, (err, url) => {
    publicUrl = url;

    console.log('Public URL is', publicUrl);

    openurl.open(publicUrl);
  });
});