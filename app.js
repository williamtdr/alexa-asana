"use strict";

const Asana = require('asana'),
	  cookieParser = require('cookie-parser'),
	  session = require('express-session'),
	  Config = require('./src/config');

global.config = new Config("config/config.json");

const alexaServerConfiguration = {
	server_root: __dirname,
	app_dir: "apps",
	port: global.config.get("web_server.port")
};

if(global.config.get("app.production")) {
	alexaServerConfiguration.debug = false;
	alexaServerConfiguration.verify = true;
	alexaServerConfiguration.httpsEnabled = true;
	alexaServerConfiguration.privateKey = global.config.get("web_server.https.private_key");
	alexaServerConfiguration.certificate = global.config.get("web_server.https.certificate");
	alexaServerConfiguration.httpsPort = global.config.get("web_server.https.port");
}

const server = require('alexa-app-server').start(alexaServerConfiguration),
	  app = server.express;

const clientId = global.config.get("asana.client_id"),
	  clientSecret = global.config.get("asana.client_secret");

// Create an Asana client. Do this per request since it keeps state that
// shouldn't be shared across requests.
function createClient() {
	return Asana.Client.create({
		clientId: clientId,
		clientSecret: clientSecret,
		redirectUri: global.config.get("asana.redirect_uri")
	});
}

// Causes request cookies to be parsed, populating `req.cookies`.
app.use(cookieParser());
app.use(session({
	secret: global.config.get("app.session_secret"), resave: false, saveUninitialized: true, cookie: { maxAge: 60000 }
}));

// Home page - shows user name if authenticated, otherwise seeks authorization.
app.get("/", (req, res) => {
	if(req.query.redirect_uri)
		req.session.alexa = req.query;

	const client = createClient(),
		  token = req.cookies.token;

	req.session.token = token;

	if(token) {
		if(token.indexOf("___") === -1)
			return false;

		client.useOauth({
			credentials: token.split("___")[0]
		});

		client.users.me().then(() => {
			res.redirect(req.session.alexa.redirect_uri + "#access_token=" + token + "&state=" + req.session.alexa.state + "&token_type=bearer&code=");
		}).catch((err) => {
			res.end("Error fetching user: " + err);
		});
	} else
		res.redirect(client.app.asanaAuthorizeUrl());
});

app.post("/authorize_alexa", (req, res) => {
	const alexa = req.session.alexa;

	res.redirect(alexa.redirect_uri + "#access_token=" + req.session.token + "state=" + alexa.state + "&token_type=bearer");
});

// Authorization callback - redirected to from Asana.
app.get("/oauth_callback", (req, res) => {
	const code = req.query.code;

	if(code) {
		const client = createClient();
		client.app.accessTokenFromCode(code).then((credentials) => {
			console.log(credentials);

			res.cookie("token", credentials.access_token + "___" + credentials.refresh_token, { maxAge: 60 * 60 * 1000 });

			res.redirect("/");
		});
	} else
		res.end("Error getting authorization: " + req.query.error);
});