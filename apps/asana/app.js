"use strict";

/*
 * Alexa skill to create, complete, and manage tasks on an Asana account.
 * License: MIT
 */

// Dependencies
const alexa = require("alexa-app"),
	  asana = require("asana"),
	  log = require("../../src/log");

const client = asana.Client.create().useAccessToken('my_access_token');

// Allow this module to be reloaded automatically when code is changed
module.change_code = 1;

// Define an alexa-app
const app = new alexa.app("asana");

// Called when user says "open asana"
app.launch((req, res) => {
	res.say("Hello! I should say something about the state of your account.");
	res.shouldEndSession(false, "Anything else?");
});

app.intent("GetUpcomingTasks", {
		"slots": {
			"name": "Timeframe",
			"type": "AMAZON.DATE"
		},
		"utterances": [
			"what is on my schedule {Timeframe}",
			"what is due {Timeframe}",
			"what do I have to do {Timeframe}",
			"what are my upcoming tasks"
		]
	}, (req, res) => {
		res.linkAccount();
		res.say("Check the Alexa app to log into Asana.");
	}
);

app.pre = (request, response, type) => {
	if(request.sessionDetails.application.applicationId !== global.config.get("")) {
		// Fail ungracefully
		throw 'Invalid applicationId: ' + request.sessionDetails.application.applicationId;
	}
};

// Last-resort error method (unknown intent, etc)
app.post = (request, response, type, exception) => {
	if(exception)
		response.say("Sorry, an error occurred.").send();
};

log.info("System", "Alexa app successfully initialized.");
log.info("System", "Intent Schema:");
console.log(app.schema());
log.info("System", "Utterances:");
console.log(app.utterances());

module.exports = app;