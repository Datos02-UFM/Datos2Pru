var request = require('request')
const express = require('express')
const app = express()
var fs = require('fs');
app.get('/log/:topic/:userId/', (req, res) => {
    const topic = req.params.topic
    const userId = req.params.userId
    fs.appendFile('~/tmp/logstash.txt', userId+", "+topic +"\r\n", function(err){
        if(err){
            console.log(err);
        }
    });
});

app.listen(3000, () => {
    console.log("Server is up and listening on 3000...")
  })