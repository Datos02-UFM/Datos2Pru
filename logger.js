var request = require('request')
const express = require('express')
const app = express()
var fs = require('fs');
app.get('/log/:topic/:userId', (req, res) => {
    const topic = req.params.topic
    const userId = req.params.userId
    fs.appendFile('D:\\Sexto Semestre\\Datos 2\\node logger\\log.txt', userId+", "+topic+"\r\n", function(err){
        if(err){console.log(err);}
    });
});

app.listen(3003, () => {
    console.log("Server is up and listening on 3003...")
  })