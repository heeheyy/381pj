var express = require('express');
var session = require('cookie-session');
var bodyParser = require('body-parser');
var app = express();
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var http = require('http');
var url  = require('url');
var fs = require('fs');
var formidable = require('formidable');
var mongourl='mongodb://heyy:123@ds125716.mlab.com:25716/381pj';

app.set('view engine','ejs');

var SECRETKEY1 = 'OUHK';
var SECRETKEY2 = 'passw0rd';

var users = [{userid: 'developer', password: 'developer'},
    {userid: 'guest', password: 'guest'}];

app.set('view engine','ejs');

app.use(session({
    name: 'session',
    keys: [SECRETKEY1,SECRETKEY2]}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));