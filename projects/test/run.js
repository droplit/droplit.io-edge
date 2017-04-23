const express = require('express');
const app = express();
const Mocha = require('mocha');
const path = require('path');
const openurl = require('openurl');

const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

var mocha = new Mocha({
  reporter: 'mochawesome',
  reporterOptions: {
    reportDir: path.join(__dirname, 'public'),
    reportFilename: 'report',
    reportTitle: 'Report',
    reportPageTitle: 'Report'
  },
  autoOpen: true
});

mocha.addFile(path.join(__dirname, 'lib/test.js'));

mocha.run((failures) => {
  app.listen(port, () => {
    openurl.open('http://localhost:3000/report.html');
  });
});