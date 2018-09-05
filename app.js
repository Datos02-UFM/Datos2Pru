var rp = require('request-promise')
var request = require('request')
const express = require('express')
const app = express()
const morgan = require('morgan')
const mysql = require('mysql')
var uuid = require('node-uuid');
var httpContext = require('express-http-context');
var log4js = require('log4js');
log4js.configure({
  appenders: { cheese: { type: 'file', filename: 'cheese.log' } },
  categories: { default: { appenders: ['cheese'], level: 'error' } }
});



//Define conexion a db
const connection = mysql.createConnection({
    host: 'mysql-datos-2.cyufope5fgiy.us-east-1.rds.amazonaws.com',
    port: 3306,
    user: 'root',
    password: 'root1234',
    database: 'MySQL_Datos_2'
  })
//timing 
app.use(morgan('short'));

//sessionId
app.use(httpContext.middleware);

// Asigna unique identifier a cada request
app.use(function(req, res, next) {
  httpContext.set('reqId', uuid.v1());
  next();
});

//search con userid
app.get('/search/:topic/:userId', (req, res) => {
    console.log("Fetching articles of topic: " + req.params.topic)
    const myTopic = req.params.topic
    //revisa en redis 
    var redis = require('redis');
    var client = redis.createClient();
    client.on('connect', function() {
        console.log('Redis client connected');
    });
    client.on('error', function (err) {
        console.log('Something went wrong ' + err);
    });
    client.get(myTopic, function (error, result) {
        if (error) {
            console.log(error);
            throw error; }

        //estructura json del resultado
        console.log(result);

        //si no esta la info en redis va a wikipedia
        if (result==null){
            console.log('Toca ir a wikipedia');
            var options={
                methode: 'GET',
                uri:'https://en.wikipedia.org/w/api.php?action=opensearch&search=' + myTopic + '&limit=25&namespace=0&format=json',
                json:true
              };
            rp(options)
            .then(function(parseBody){topArticles = parseBody[1];
                res.json("[{\"Topic\" : " + myTopic + ", \"Top articles\": " + topArticles + ", \"UserId\" : " + req.params.userId + "}]");
            })
            .catch(function (err){
            }).finally(function(){
                var cleanArticles = topArticles.toString().replace(/\'/,"-");
                var cleanArticles2 = cleanArticles.toString().replace(/\'[a-zA-Z]/,"-");

                //guarda la info en redis
                client.set(myTopic, cleanArticles2, redis.print);
                console.log('Se guardo en Redis')
              });
        }else{
            console.log('Se encontro en Redis');
            res.json("[{\"Topic\" : " + myTopic + ", \"Top articles\": " + result + ", \"UserId\" : " + req.params.userId + "}]");
        }
    });

    //Guarda un log en mysql para el historial
    var sql = "INSERT INTO user_logs (topic, usuario) VALUES ('" + myTopic + "', '" + req.params.userId + "')";
    connection.query(sql, function (err, result) {
    if (err) throw err;
    console.log("1 log inserted");
    });
    
    
})

//search sin userid
app.get('/search/:topic', (req, res) => {
    console.log("Fetching articles of topic: " + req.params.topic)
    //genera un user id
    var reqId = httpContext.get('reqId');
    const myTopic = req.params.topic

    //Trae el topic de redis
    var redis = require('redis');
    var client = redis.createClient();
    client.on('connect', function() {
        console.log('Redis client connected');
    });
    client.on('error', function (err) {
        console.log('Something went wrong ' + err);
    });
    client.get(myTopic, function (error, result) {
        if (error) {
            console.log(error);
            throw error; }

        //estructura json del resultado
        console.log(result);

        //si no esta la info en redis va a wikipedia
        if (result==null){
            console.log('Toca ir a wikipedia');
            var options={
                methode: 'GET',
                uri:'https://en.wikipedia.org/w/api.php?action=opensearch&search=' + myTopic + '&limit=25&namespace=0&format=json',
                json:true
              };
            rp(options)
            .then(function(parseBody){topArticles = parseBody[1];
                res.json("[{\"Topic\" : " + myTopic + ", \"Top articles\": " + topArticles + ", \"UserId\" : " +  reqId + "}]");
            })
            .catch(function (err){
            }).finally(function(){
                var cleanArticles = topArticles.toString().replace(/\'/,"-");
                var cleanArticles2 = cleanArticles.toString().replace(/\'[a-zA-Z]/,"-");

                //guarda la info en redis
                client.set(myTopic, cleanArticles2, redis.print);
                console.log('Se guardo en Redis')
              });
        }else{
            console.log('Se encontro en Redis');
            res.json("[{\"Topic\" : " + myTopic + ", \"Top articles\": " + result + ", \"UserId\" : " +  reqId + "}]");
        }
    });
    
    //Guarda un log en mysql para el historial
    var sql = "INSERT INTO user_logs (topic, usuario) VALUES ('" + myTopic + "', '" +  reqId + "')";
    connection.query(sql, function (err, result) {
    if (err) throw err;
    console.log("1 log inserted");
    });
    
    //logea
    var logger = log4js.getLogger('cheese'); 
    logger.info('Cheese is Gouda.');
})

//obtener historial por usuario
app.get('/history/:userId', (req, res) => {
  console.log("Fetching history by userId")

  const queryString = "SELECT fecha, topic FROM user_logs where usuario = ? "
  connection.query(queryString, [req.params.userId], (err, rows, fields) => {
    if (err) {
      console.log("Failed to query for users: " + err)
      res.sendStatus(500)
      return
      // throw err
    }
    var historyUser = rows.map((row) => {
      return {"Date": row.fecha, "url": "http://localhost:3003/search/" + row.topic + "/" + req.params.userId};
    })
    res.json(historyUser)
  })
})
  

app.listen(3003, () => {
    console.log("Server is up and listening on 3003...")
  })
