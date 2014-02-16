// Worker code to call Parse Cloud code
var https = require('https');
var net = require('net');

var headers = {
	'Content-Type': 'application/json',
	'X-Parse-Application-Id': '97s1dXeGVg72YmhWjZVFXQvWFILwyyV78pftvQBe',
	'X-Parse-REST-API-Key': 'B4E2AAy0sf4CckbatLWWNy6DqWdL03ZH4ieGOUUy'
};

var post_options = {
	host: 'api.parse.com',
	port: '443',
	path: '/1/functions/check_games',
	method: 'POST',
	headers: headers
};

var post_req = https.request(post_options, function(res) {
	console.log("Parse post statusCode: ", res.statusCode);

	res.on('data', function(d) {
		process.stdout.write(d);
	});

});

post_req.write("{}");
post_req.end();
post_req.on('error', function(e) {
	console.error(e);
});