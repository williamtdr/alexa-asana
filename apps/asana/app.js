"use strict";

/*
 * Alexa skill to create, complete, and manage tasks on an Asana account.
 * License: MIT
 */

// Dependencies
const alexa = require("alexa-app"),
	  asana = require("asana");

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

app.intent("GetLastTweet", {
		"slots": {"AccountName": "LITERAL"},
		"utterances": [
			"for the last tweet from {account name|AccountName}",
			"what is the last tweet from {account name|AccountName}",
			"read me the last tweet from {account name|AccountName}",
			"tell me the last tweet from {account name|AccountName}"
		]
	}, (req, res) => {
		return false;
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

module.exports = app;