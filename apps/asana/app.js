"use strict";

/*
 * Alexa skill to create, complete, and manage tasks on an Asana account.
 * License: MIT
 */

// Dependencies
const alexa = require('alexa-app'),
	  Asana = require('asana'),
	  log = require('../../src/log');

// Allow this module to be reloaded automatically when code is changed
module.change_code = 1;

// Define an alexa-app
const app = new alexa.app("asana");

const asanaClients = {},
	  state = {}; // TODO: Save state information to database

const STATE_READY = 0,
	  STATE_SELECTING_WORKSPACE = 1;

app.pre = (req, res) => {
	let accessToken = req.sessionDetails.accessToken;

	if(accessToken && accessToken.indexOf("___") === -1)
		accessToken = false;
	
	if(!accessToken) {
		res.linkAccount().shouldEndSession(true).say("Hello! Please link your Asana account in the Alexa app.").send();

		return false;
	}

	const tmp = accessToken.split("___"),
		  asanaAccessToken = tmp[0],
		  refreshToken = tmp[1];

	const client = Asana.Client.create();

	client.useOauth({
		credentials: {
			token_type: "bearer",
			access_token: asanaAccessToken,
			refresh_token: refreshToken,
			expires_in: 3600,
			data: {}
		},
	});

	if(!asanaClients[req.sessionId]) {
		asanaClients[req.sessionId] = client;
		state[req.sessionId] = {
			workspaceId: -1
		};
	}

	return true;
};

// Called when user says "open asana"
app.launch((req, res, send) => {
	asanaClients[req.sessionId].users.me()
		.then((user) => {
			const userFirstName = user.name.split(" ")[0] || false;

			let response = "Hello" + (", " + userFirstName || "") + "! ";

			if(user.workspaces.length > 1) {
				response += "I'm going to list off the workspaces on your Asana account. When I'm done, say the number of the workspace you want to use.";
				state[req.sessionId] = STATE_SELECTING_WORKSPACE;

				let workspaceCounter = 0;
				for(let workspace of user.workspaces) {
					workspaceCounter++;

					response += " Say \"" + workspaceCounter + "\" to work in " + workspace.name + ".";
				}

				response += " Okay, which numbered workspace should I use?";
			} else {
				state[req.sessionId] = STATE_READY;
				state[req.sessionId].workspaceId = user.workspaces[0];

				response += "You can ask me about upcoming tasks, to mark tasks as complete, or to create a new task.";
			}

			res.say(response).shouldEndSession(false);
			send();
		});

	return false;
});

app.intent("GetUpcomingTasks", {
		"slots": {
			"Timeframe": "AMAZON.DATE"
		},
		"utterances": [
			"what is on my schedule {-|Timeframe}",
			"what's on my schedule {-|Timeframe}",
			"what is due {-|Timeframe}",
			"what's due {-|Timeframe}",
			"what do I {have|need} to do {-|Timeframe}",
			"what are my upcoming tasks"
		]
	}, (req, res) => {

	}
);

// Last-resort error method (unknown intent, etc)
app.post = (request, response, type, exception) => {
	if(exception) {
		response.say("Sorry, an error occurred!").send();
		console.log(exception);
		console.log(exception.stack);
	}
};

log.info("System", "Alexa app successfully initialized.");
log.info("System", "Intent Schema:");
console.log(app.schema());
log.info("System", "Utterances:");
console.log(app.utterances());

module.exports = app;