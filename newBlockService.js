process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
var autobahn = require('autobahn');
var http = require('http');
var wspassword = 'web';
var connection = new autobahn.Connection({
    url:'wss://live.prohashing.com:443/ws',realm:'mining',authid:'web',authmethods: ['wampcra'],onchallenge:onChallenge
});

var username = 'test';
var password = 'test';
var cryptk33pr = 'api.outlawdesigns.io';
var port = 9662;
var auth_token = 12345;
var coins = [];

httpRequest = function(host,method,endpoint,params){
    return new Promise(function(resolve, reject){
        var options = {
            hostname:host,
            port:port,
            path:'/' + endpoint,
            method:method,
            headers:{
                //'Content-Type':'application/json; charset=utf-8',
                'Content-Length': Buffer.byteLength(JSON.stringify(params)),
            }
        };
        if(endpoint === 'authenticate'){
            options.headers.request_token = username;
            options.headers.password = password;
        }else{
            options.headers.auth_token = auth_token;
        }
        var req = http.request(options,function(response){
            var data = '';
            response.on('data',function(chunk){
                data += chunk;
            });
            response.on('end',function(){
                resolve(JSON.parse(data));
            });
        }).on('error',function(err){
            reject(err.message);
        });
        req.write(JSON.stringify(params));
    });
};

function getToken(){
    return httpRequest(cryptk33pr,'GET','authenticate',null).then(function(response){
        auth_token = response.token;
    },function(err){
        console.log(err);
    });
}
function verifyToken(){
    return new Promise(function(resolve,reject){
        httpRequest(cryptk33pr,'GET','verify',null).then(function(response){
            if(response['error'] !== undefined){
                reject(response);
            }
            resolve(response);
        },function(err){
            reject(err);
        });
    });
}

function getCoins(){
    httpRequest(cryptk33pr,'GET','coin',null).then(function(response){
        for(var i = 0; i < response.length; i++){
            if(!includes(coins,response[i].coin_name)){
                coins.push(response[i].coin_name);
            }
        }
    },function(err){
        console.log(err);
    });
}

function updateChainData(block){
    var insert = {
        coin_name:block.coin_name,
        block_height:block.block_height,
        share_diff:block.share_diff,
        coinbase_value:block.coinbase_value,
        snapshot_value_usd:block.snapshot_value_usd,
        algorithm:block.algorithm,
        source:'prohashing'
    };
    httpRequest(cryptk33pr,'POST','chain',insert).then(function(response){
        console.log(response);
    },function(err){
        console.log(err);
    });
}

function includes(arr,obj) {
    return (arr.indexOf(obj) !== -1);
}

function onChallenge(session, method, extra) {
    if (method === 'wampcra') {
        return autobahn.auth_cra.sign(wspassword, extra.challenge);
    }
};

connection.onopen = function(session,details){
    console.log('Connection Established');
    var blockCount = 0;
    setInterval(function(){
        verifyToken().then(function(response){
            getCoins();
        },function(err){
            getToken().then(function(){
                getCoins();
            });
        });
    },5000);
    session.subscribe('found_block_updates',onBlockUpdate);
    function onBlockUpdate(block){
        if(includes(coins,block[0].coin_name)){
            console.log('Block Found: ' + block[0].coin_name);
            updateChainData(block[0]);
            blockCount++;
            console.log(blockCount);
        }
    }
};
connection.onclose = function(reason,details){
    console.log(reason);
    console.log(details);
};
connection.open();
