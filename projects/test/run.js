const express = require('express');
const app = express();
const Mocha = require('mocha');
const path = require('path');
const openurl = require('openurl');

const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
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
    res.sendFile(path.join(__dirname, 'public', 'report.html'));
  });
});

app.listen(port, () => {
  console.log('Server running on port', port);
});