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


app.set('view engine','ejs');

app.use(session({
    name: 'session',
    keys: [SECRETKEY1,SECRETKEY2]}));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/',function(req,res) {
    if(req.session.authenticated==true){
    MongoClient.connect(mongourl, function(err, db) {
        assert.equal(err,null);
        search(db,{},20,function(result) {
            db.close();
            res.status(200);
            res.render('index',{restaurants:result});

            });
        });
    } else res.render('login',{})});

app.get('/login',function(req,res){
    res.render('login',{});
});

app.post('/login',function(req,res){
    MongoClient.connect(mongourl,function (err,db) {
        db.collection('user').findOne({userid:req.body.usrid},function (err,user) {
            db.close();
            if(err){
                res.redirect('/');
            }
            else if(user==null){
                res.redirect('/');
            }
            else if(user.password!=req.body.usrpw){
                res.redirect('/');
            }
            else{
                req.session.authenticated = true;
                console.log("Login sucessful");
                req.session.usrid = req.body.usrid;
                res.redirect('/');
            }
        })

    })
});

app.get('/registration',function(req,res){
    res.render('registration',{});
});

app.post('/registration',function(req,res){
    MongoClient.connect(mongourl,function (err,db) {
        assert.equal(err,null);
        register(db,req.body.usrid,req.body.usrpw,function(result){
            db.close();
            console.log('Disconnected MongoDB\n');
            res.redirect('/');
        });
    });
});

app.get('/create',function(req,res){
    var creator = req.session.usrid;
    checkSession(req,res);
    res.render('create',{})
});

app.post('/create',function(req,res) {
    var dataArray = {};
    var address = {};
    var nrestaurant = {};
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
        console.log(JSON.stringify(files));
        dataArray['creator'] = fields.creator;
        dataArray['rname'] = fields.rname;
        dataArray['borough'] = fields.borough;
        dataArray['cuisine'] = fields.cuisine;
        dataArray['street'] = fields.street;
        dataArray['building'] = fields.building;
        dataArray['zip'] = fields.zip;
        dataArray['locat'] = [parseFloat(fields.latitude),parseFloat(fields.longitude)];
        var filename = files.uploadpic.path;
        var mimetype = files.uploadpic.type;
        if(files.uploadpic!==undefined){
            console.log("ReadFile");
            fs.readFile(filename, function(err,data) {
                dataArray['mimetype'] = mimetype;
                dataArray['image'] = new Buffer(data).toString('base64');
                for(key in dataArray){
                    if(dataArray[key]!==''){
                        switch(key){
                            case "street": case "building": case "zip": case "locat":
                            address[key] = dataArray[key];
                            break;
                            default:
                                nrestaurant[key] = dataArray[key];
                        }
                    }
                }
                if (address!==null&&address!=={}) {
                    nrestaurant['address'] = address;
                }
                console.log('About to insert: ' + JSON.stringify(nrestaurant));

                MongoClient.connect(mongourl,function(err,db) {
                    assert.equal(err,null);
                    console.log('Connected to MongoDB\n');
                    create(db,nrestaurant,function(id) {
                        db.close();
                        res.redirect('/display?_id='+id+'&backToIndex=true');
                    });
                });
            })
        }else{
            for(key in dataArray){
                if(dataArray[key]!==''){
                    switch(key){
                        case "street": case "building": case "zip": case "locat":
                        address[key] = dataArray[key];
                        break;
                        default:
                            nrestaurant[key] = dataArray[key];
                    }
                }
            }
            if (address!==null&&address!=={}) {
                nrestaurant['address'] = address;
            }
            console.log('About to insert: ' + JSON.stringify(nrestaurant));

            MongoClient.connect(mongourl,function(err,db) {
                assert.equal(err,null);
                console.log('Connected to MongoDB\n');
                create(db,nrestaurant,function(id) {
                    db.close();
                    res.redirect('/display?_id='+id);
                });
            });
        }


    });
});

app.get('/display',function(req,res) {
    checkSession(req,res);
    var parsedURL = url.parse(req.url,true); //true to get query as object
    var queryAsObject = parsedURL.query;
    var backToIndex = (!(queryAsObject.backToIndex === null || queryAsObject.backToIndex === undefined));
    MongoClient.connect(mongourl, function(err, db) {
        assert.equal(err,null);
        db.collection('restaurant').findOne({_id: ObjectId(queryAsObject._id)},function(err,doc) {
            assert.equal(err,null);
            console.log(req.session.usrid);
            Rated(db,queryAsObject._id,req.session.usrid,function(callback){
                db.close();
                if (callback) {
                    if(callback.grades.length==1){
                    var ratedScore = callback.grades[0].score;}
                    else{
                        for(var i=0;i<callback.grades.length;i++){
                            if(callback.grades[i].userid == req.session.usrid){
                                ratedScore = callback.grades[i].score;}
                        }}

                    console.log("Score: " + ratedScore);

                    res.render('display', {
                        restaurant: doc,
                        rated: true,
                        user: req.session.usrid,
                        score: ratedScore,
                        backToIndex: backToIndex
                    });

                }else {
                    res.render('display', {
                        restaurant: doc,
                        user: req.session.usrid,
                        rated: false,
                        score: false,
                        backToIndex: backToIndex
                    });
                }
            });
        });
    });
});

app.get('/filter',function(req,res) {
    checkSession(req,res);
    res.render('filter',{});
});

app.post('/filter',function(req,res) {
    var criteria={};
    for(key in req.body){
        if (req.body[key] != null) {
            switch (key) {
                case "street":
                case "building":
                    criteria['address.' + key] = new RegExp(req.body[key]);
                    break;
                default:
                    criteria[key] = new RegExp(req.body[key]);}}}
    MongoClient.connect(mongourl, function(err, db) {
        assert.equal(err,null);
        search(db,criteria,null,function(result) {
            db.close();
            res.status(200);
            res.render('index',{restaurants:result});
        });
    });
});

app.get('/edit',function(req,res) {
    checkSession(req,res);
    var parsedURL = url.parse(req.url,true);
    var queryAsObject = parsedURL.query;
    if(queryAsObject.creator !== req.session.usrid){
        window.alert("You are not allowed to edit this restaurant!");
        res.redirect("/");
    }
    var Obj = {
        _id: (queryAsObject._id===null?"":queryAsObject._id),
        building:(queryAsObject.building===null?"":queryAsObject.building),
        street:(queryAsObject.street===null?"":queryAsObject.street),
        zip:(queryAsObject.zip===null?"":queryAsObject.zip),
        rname: queryAsObject.rname,
        borough: queryAsObject.borough,
        cuisine: queryAsObject.cuisine,
        locat : [queryAsObject.latitude,queryAsObject.longtitdue]
    };
    res.render('edit',{restaurant:Obj});
});

app.post('/edit',function(req,res) {
    MongoClient.connect(mongourl,function(err,db) {
        assert.equal(err,null);
        console.log('Connected to MongoDB\n');
        var criteria = {};
        criteria['_id'] = ObjectId(req.body._id);
        var modrestaurant = {
            address: {
                building:(req.body.building===null?"":req.body.building),
                street:(req.body.street===null?"":req.body.street),
                zip:(req.body.zip===null?"":req.body.zip),
                locat:[req.body.latitude,req.body.longitude]
            },
            name: req.body.name,
            borough: req.body.borough,
            cuisine: req.body.cuisine
        };
        console.log('Preparing update: ' + JSON.stringify(modrestaurant));
        edit(db,criteria,modrestaurant,function(result) {
            db.close();
            res.redirect('/display?_id='+req.body._id+'&backToIndex=true');

        });
    });
});

app.post('/delete',function(req,res) {
    var criteria = {
        _id : ObjectId(req.body._id)
    };
    MongoClient.connect(mongourl,function(err,db) {
        assert.equal(err,null);
        remove(db,criteria,function(result) {
            db.close();
            res.redirect("/");
        });
    });
});

app.post('/rate',function(req,res) {
    var criteria = {
        _id : ObjectId(req.body._id)
    };

    MongoClient.connect(mongourl,function(err,db) {
        assert.equal(err,null);
        db.collection('restaurant').update(
            { _id: ObjectId(req.body._id) },
            { $push:
            { grades:
            {
                userid:req.session.usrid,

                score:req.body.score
            }
            }
            },function(err,result) {
                assert.equal(err, null);
                console.log("from "+req.session.usrid);
                console.log("Rated");
                res.redirect('/display?_id='+req.body._id+'&backToIndex=true');
            }

        )
    });
});

app.get('/logout',function(req,res) {
    req.session = null;
    res.redirect('/');
});


app.listen(process.env.PORT||8099);


function checkSession(req,res) {
    if(req.session.authenticated==false){
        res.redirect('/login');
    }

}

function register(db,userid,password,callback){
    db.collection('user').findOne({userid:userid},function(err,doc){
        if(doc == null){
            db.collection('user').insert(
                {
                    userid:userid,
                    password:password
                },function(err,result){
                    assert.equal(err,null);
                    console.log("Inserted sucessful.");
                    callback(true);
                }
            )
        } else{
            console.log("Insert Failed.");
            callback(false);
        }
        });
}

function create(db,r,callback) {
    db.collection('restaurant').insertOne(r,function(err,result) {
        assert.equal(err,null);
        callback(r._id);
    });
}

function search(db,criteria,limit,callback) {
    var result = [];
    if(limit!==null){
        cursor = db.collection('restaurant').find(criteria).limit(limit);
    }else{
        cursor = db.collection('restaurant').find(criteria);
        console.log(criteria);
    }
    cursor.each(function(err, doc) {
        assert.equal(err, null);
        if (doc != null) {
            result.push(doc);
        } else {
            callback(result);
        }
    });
}

function edit(db,criteria,newValues,callback) {
    db.collection('restaurants').updateOne(
        criteria,{$set: newValues},function(err,result) {
            assert.equal(err,null);
            callback(result);
        });
}

function remove(db,criteria,callback){
    db.collection('restaurants').remove(criteria,function(err,result) {
        assert.equal(err,null);
        callback(result);
    });
}

function Rated(db,obId,userId,callback) {
    db.collection('restaurant').findOne({
        "_id": ObjectId(obId),
        grades: {$elemMatch: {userid: userId}}
    },function(err, doc) {
        if (doc == null) {
            callback(false);
        } else {
            callback(doc);
        }
    });
}