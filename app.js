const Asana = require("asana"),
	  cookieParser = require('cookie-parser'),
	  Config = require("./src/config");

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

// Home page - shows user name if authenticated, otherwise seeks authorization.
app.get("/", (req, res) => {
	const client = createClient(),
		  token = req.cookies.token;

	if(token) {
		client.useOauth({
			credentials: token
		});

		client.users.me().then((me) => {
			res.end("Hello " + me.name);
		}).catch((err) => {
			res.end("Error fetching user: " + err);
		});
	} else
		res.redirect(client.app.asanaAuthorizeUrl());
});

// Authorization callback - redirected to from Asana.
app.get("/oauth_callback", (req, res) => {
	const code = req.params.code;

	if(code) {
		const client = createClient();
		client.app.accessTokenFromCode(code).then((credentials) => {
			res.cookie("token", credentials.access_token, { maxAge: 60 * 60 * 1000 });
			// Todo: Get refresh token, save both on server

			res.redirect('/');
		});
	} else
		res.end("Error getting authorization: " + req.params.error);
});