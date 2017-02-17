"use strict";

/*
 * Alexa skill to create, complete, and manage tasks on an Asana account.
 * License: MIT
 */

// Dependencies
const alexa = require("alexa-app");

// Allow this module to be reloaded automatically when code is changed
module.change_code = 1;

// Define an alexa-app
const app = new alexa.app("asana");

// Called when user says "open asana"
app.launch((req, res) => {
	res.say("Hello! I should say something about the state of your account.");
	res.shouldEndSession(false, "Anything else?");
});

// Last-resort error method (unknown intent, etc)
app.post = (request, response, type, exception) => {
	if(exception)
		response.say("Sorry, an error occurred.").send();
};

module.exports = app;