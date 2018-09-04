//Dependencias
const rp = require('request-promise')
var request = require('request')
const express = require('express')
const app = express()
const morgan = require('morgan')
const mysql = require('mysql')
var uuid = require('node-uuid');
var httpContext = require('express-http-context');
var redis = require('redis');
//Define conexion a db
const connection = mysql.createConnection({
  host: 'mysql-datos-2.cyufope5fgiy.us-east-1.rds.amazonaws.com',
  port: 3306,
  user: 'root',
  password: 'root1234',
  database: 'MySQL_Datos_2'
})

//logs con timings de requests 
app.use(morgan('short'));
//sessionId
app.use(httpContext.middleware);
// Asigna unique identifier a cada request
app.use(function(req, res, next) {
  httpContext.set('reqId', uuid.v1());
  next();
});

//consulta sin userid
app.get("/search/:topic", (req, res) => {
  console.log("Fetching articles of topic: " + req.params.topic)
  var reqId = httpContext.get('reqId');
  const myTopic = req.params.topic
  const queryString = "SELECT topic, info_array FROM articulos WHERE topic = ?"
  connection.query(queryString, [myTopic], (err, rows, fields) => {
    if (err) {
      //go fetch from wikipedia
      console.log("Unable to retrieve from database: " + err)
      res.sendStatus(500)
      
    }

    //return info from db
    var topArticles = rows.map((row) => {
      return {"Topic": row.topic, "Top articles": row.info_array, "UserId": reqId};
    })

    if (rows == 0) {
      console.log("Not found locally; fetching from wikipedia");
      var options={
        methode: 'GET',
        uri:'https://en.wikipedia.org/w/api.php?action=opensearch&search=' + myTopic + '&limit=25&namespace=0&format=json',
        json:true
      };
    
      rp(options)
        .then(function(parseBody){
          topArticles = parseBody[1];
          res.json("[{Topic : " + myTopic + ", Top articles : " + topArticles + ", UserId : " + reqId + "}]");
        })
        .catch(function (err){
        }).finally(function(){
          var cleanArticles = topArticles.toString().replace(/\'/,"-");
          var cleanArticles2 = cleanArticles.toString().replace(/\'[a-zA-Z]/,"-");
          var sql = "INSERT INTO articulos (topic, info_array) VALUES ('" + myTopic + "', '" + cleanArticles2 + "')";
          connection.query(sql, function (err, result) {
          if (err) throw err;
            console.log("1 record inserted");

            //Uso de redis para guardar 
          
         var redis = require('redis');
         var client = redis.createClient();
         
         client.on('connect', function() {
             console.log('Redis client connected');
         });
         
         client.on('error', function (err) {
             console.log('Something went wrong ' + err);
         });
         
         client.set(myTopic, cleanArticles2, redis.print);
         client.get(myTopic, function (error, result) {
             if (error) {
                 console.log(error);
                 throw error;
             }
             console.log('GET result ->' + result);
         });
          });

          

	console.log('El resultado '+result);
	});
    }
else{
    res.json(topArticles);
    }
  })
  //Inserta log del request
  var sql = "INSERT INTO user_logs (topic, usuario) VALUES ('" + myTopic + "', '" + reqId + "')";
  connection.query(sql, function (err, result) {
  if (err) throw err;
  console.log("1 log inserted");
  });

})

//consulta con userid
app.get('/search/:topic/:userId', (req, res) => {
  //jala los parametros
console.log("Fetching articles of topic: " + req.params.topic)
const myTopic = req.params.topic
var cleanArticles = topArticles.toString().replace(/\'/,"-");
var cleanArticles2 = cleanArticles.toString().replace(/\'[a-zA-Z]/,"-");
var redis = require('redis');
var client = redis.createClient();
//revisa en redis
client.on('connect', function() {
    console.log('Redis client connected');
});
client.on('error', function (err) {
    console.log('Something went wrong ' + err);
});
client.get(myTopic, function (error, result) {
    if (error) {
        console.log(error);
        throw error;
    }
    console.log('GET result ->' + result);

    //si el result esta vacio va a wikipedia y lo guarda

    if (result=null){
        console.log("Not found locally; fetching from wikipedia");
    var options={
      methode: 'GET',
      uri:'https://en.wikipedia.org/w/api.php?action=opensearch&search=' + myTopic + '&limit=25&namespace=0&format=json',
      json:true
    };
        rp(options)
      .then(function(parseBody){
        topArticles = parseBody[1];
        res.json("[{\"Topic\" : " + myTopic + ", \"Top articles\": " + topArticles + ", \"UserId\" : " + req.params.userId + "}]");
      })
      .catch(function (err){
      }).finally(function(){
        var cleanArticles = topArticles.toString().replace(/\'/,"-");
        var cleanArticles2 = cleanArticles.toString().replace(/\'[a-zA-Z]/,"-");
      //Uso de redis para guardar   
       var redis = require('redis');
       var client = redis.createClient();
       client.on('connect', function() {
           console.log('Redis client connected');
       });
       client.on('error', function (err) {
           console.log('Something went wrong ' + err);
       });
       client.set(myTopic, cleanArticles2, redis.print);

      });

    }else{
  res.json(topArticles);
  }
  //Inserta log del request
var sql = "INSERT INTO user_logs (topic, usuario) VALUES ('" + myTopic + "', '" + req.params.userId + "')";
connection.query(sql, function (err, result) {
if (err) throw err;
console.log("1 log inserted");
});
});
}

//elimina
app.get("/", (req, res) => {
  console.log("Responding to root route")
  //res.send("Root")

  const queryString = "delete from articuloss where topic = 'beatles'; "
  connection.query(queryString, (err, rows, fields) => {
    if (err) {
      console.log("Failed to query for users: " + err)
      res.sendStatus(500)
      return
      // throw err
    }
    res.json(rows)
  })

  // res.end()
})

app.get('/topTrends', (req, res) => {
  console.log("Fetching top trends")

  const queryString = "SELECT topic FROM user_logs GROUP BY topic ORDER BY count(*) DESC LIMIT 10; "
  connection.query(queryString, (err, rows, fields) => {
    if (err) {
      console.log("Failed to query for users: " + err)
      res.sendStatus(500)
      return
      // throw err
    }
    res.json(rows)
  })

  // res.end()
})

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

    const users = rows.map((row) => {
      return {"Trending topics": row.topic}
    })
    
    res.json(rows)
  })

  // res.end()
})

// localhost:3003
app.listen(3003, () => {
  console.log("Server is up and listening on 3003...")
})
