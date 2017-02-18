"use strict";

/*
 * Alexa skill to create, complete, and manage tasks on an Asana account.
 * License: MIT
 */

// Dependencies
const alexa = require('alexa-app'),
	  Asana = require('asana'),
	  log = require('../../src/log'),
	  moment = require('moment'),
	  natural = require('natural'),
	  momentRange = require('moment-range');

// Allow this module to be reloaded automatically when code is changed
module.change_code = 1;

// Setup
const app = new alexa.app("asana"),
	  asanaClients = {},
	  state = {}; // TODO: Save state information to database

// Constants
const STATE_READY = 0,
	  STATE_SELECTING_WORKSPACE = 1;

// Get rid of the deprecation spam, we'll use promises later.
console.trace = function() {

};

momentRange.extendMoment(moment);

function removeLastInstance(badtext, str) {
	let charpos = str.lastIndexOf(badtext);

	if(charpos < 0)
		return str.trim();

	let ptone = str.substring(0, charpos),
		pttwo = str.substring(charpos + (badtext.length));

	return (ptone + pttwo).trim();
}

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

	const client = Asana.Client.create({
		clientId: global.config.get("asana.client_id"),
		clientSecret: global.config.get("asana.client_secret"),
		redirectUri: global.config.get("asana.redirect_uri")
	});

	client.useOauth({
		credentials: {
			token_type: "bearer",
			access_token: asanaAccessToken,
			refresh_token: refreshToken,
			expires_in: 3600,
			data: {}
		},
	});

	if(!asanaClients[req.sessionDetails.accessToken]) {
		asanaClients[req.sessionDetails.accessToken] = client;
		state[req.sessionDetails.accessToken] = {};
	}

	return true;
};

// Called when user says "open asana"
app.launch((req, res, send) => {
	asanaClients[req.sessionDetails.accessToken].users.me()
		.then((user) => {
			const userFirstName = user.name.split(" ")[0] || false;
			let response = "Hello" + (" " + userFirstName || "") + "! ";

			if(user.workspaces.length > 1) {
				//response = "State engine is at stage one.";
				state[req.sessionDetails.accessToken].userState = STATE_SELECTING_WORKSPACE;
				state[req.sessionDetails.accessToken].workspaces = user.workspaces;
				state[req.sessionDetails.accessToken].asanaUser = user;

				response = "Welcome to Asana for Alexa. I'm going to list off and number the workspaces on your Asana account. Listen for the one you want to work in.";

				let workspaceCounter = 0;
				for(let workspace of user.workspaces) {
					workspaceCounter++;

					response += " \"" + workspaceCounter + "\" is " + workspace.name + ".";
				}

				response += " Okay, say \"use workspace\" followed by a number.";
			} else {
				state[req.sessionDetails.accessToken].userState = STATE_READY;
				state[req.sessionDetails.accessToken].workspace = user.workspaces[0];

				response += "You can ask me about upcoming tasks, to mark tasks as complete, or to create a new task. What do you want to do?";
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
	}, (req, res, send) => {
		const userState = state[req.sessionDetails.accessToken],
			  userDate = req.data.request.intent.slots.Timeframe.value;

		if(!userState.workspace) {
			res.say("Please select a workspace first.");

			return true;
		}

		const tasks = asanaClients[req.sessionDetails.accessToken].tasks.findAll({
			assignee: userState.asanaUser.id,
			workspace: userState.workspace.id,
			completed_since: "now",
			opt_fields: 'id,name,assignee_status,completed,due_on'
		}).then(asanaResponse => {
			return asanaResponse.data;
		});

		let weekNumber;
		if(userDate.indexOf("W") > -1)
			weekNumber = parseInt(userDate.split("W")[1]);

		tasks.filter(task => {
			if(userDate.indexOf("W") > -1) {
				const weekNumber = parseInt(userDate.split("W")[1]),
					  range = moment.range(moment().day("Sunday").week(weekNumber).format("YYYY-MM-DD"), moment().day("Saturday").week(weekNumber).format("YYYY-MM-DD"));

				return range.contains(new Date(task.due_on));
			} else {
				return task.due_on === userDate;
			}
		}).then(list => {
			if(list.length === 0) {
				res.say("You have no uncompleted tasks due in the specified time range.");
				send();

				return false;
			}

			let formattedTimeDelta;
			if(weekNumber) {
				formattedTimeDelta = "starting on " + moment().day("Sunday").week(weekNumber).format("YYYY-MM-DD");
			} else {
				formattedTimeDelta = moment(userDate).from(moment().format("YYYY-MM-DD"));
				if(formattedTimeDelta === "a few seconds ago")
					formattedTimeDelta = "today";

				if(formattedTimeDelta === "a day ago")
					formattedTimeDelta = "yesterday";

				if(formattedTimeDelta === "in a day")
					formattedTimeDelta = "tomorrow";

				if(formattedTimeDelta === "Invalid date")
					formattedTimeDelta = "on " + userDate;
			}

			let response = "You have " + list.length + " tasks due " + formattedTimeDelta + ": ",
				stringifiedList = "";

			for(let taskIndex in list) {
				let task = list[taskIndex];

				stringifiedList += ", " + (taskIndex != list.length - 1 ? task.name : "and " + task.name);
			}

			response += stringifiedList.substring(2, stringifiedList.length);
			res.say(response).shouldEndSession(true);

			send();
		});

		return false;
	}
);

app.intent("MarkTaskComplete", {
		"slots": {
			"Task": "AMAZON.LITERAL"
		},
		"utterances": [
			"mark {walking the dog|Task} as complete",
			"mark {walking the dog|Task} as done",
			"mark {walking the dog|Task} as finished",
			"mark {walking the dog|Task} complete",
			"mark {walking the dog|Task} done",
			"mark {walking the dog|Task} finished",
			"I've finished {walking the dog|Task}",
			"I'm done with {walking the dog|Task}"
		]
	}, (req, res, send) => {
		let userState = state[req.sessionDetails.accessToken],
			userTaskName = req.data.request.intent.slots.Task.value;

		for(let badInput of ["complete", "done", "finished", "is", "as", "of"])
			if(userTaskName.endsWith(badInput))
				userTaskName = removeLastInstance(badInput, userTaskName);

		if(!userState.workspace) {
			res.say("Please select a workspace first.");

			return true;
		}

		const tasks = asanaClients[req.sessionDetails.accessToken].tasks.findAll({
			assignee: userState.asanaUser.id,
			workspace: userState.workspace.id,
			completed_since: "now",
			opt_fields: 'id,name,assignee_status,completed,due_on'
		}).then(asanaResponse => {
			return asanaResponse.data;
		});

		tasks.then(list => {
			if(list.length === 0) {
				res.say("You don't have any unfinished tasks to mark as complete.");
				send();

				return false;
			}

			let minLevenshtienDistance = Number.MAX_SAFE_INTEGER,
				potentialTask;

			for(let task of list) {
				let ld = natural.LevenshteinDistance(userTaskName, task.name);

				if(ld < minLevenshtienDistance) {
					minLevenshtienDistance = ld;
					potentialTask = task;
				}
			}

			if(minLevenshtienDistance < 5) {
				console.log("Marking " + potentialTask.name + " as complete for " + userState.asanaUser.name);

				asanaClients[req.sessionDetails.accessToken].tasks.update(potentialTask.id, {completed: true}).then(status => {
					res.say("Okay, I've marked \"" + potentialTask.name + "\" as complete. Good job.").shouldEndSession(true);
					send();
				});
			} else {
				console.log(userTaskName);

				res.say("Sorry, I couldn't find any tasks by that name. Try again.").shouldEndSession(false);

				send();
			}
		});

		return false;
	}
);

app.intent("SelectWorkspace", {
		"slots": {
			"WorkspaceId": "AMAZON.NUMBER"
		},
		"utterances": [
			"Select workspace {-|WorkspaceId}",
			"Use workspace {-|WorkspaceId}"
		]
	}, (req, res) => {
		if(state[req.sessionDetails.accessToken].userState !== STATE_SELECTING_WORKSPACE)
			return true;

		try {
			const userWorkspaceNumber = parseInt(req.data.request.intent.slots.WorkspaceId.value) - 1,
				  workspace = state[req.sessionDetails.accessToken].workspaces[userWorkspaceNumber];

			if(workspace) {
				state[req.sessionDetails.accessToken].userState = STATE_READY;
				state[req.sessionDetails.accessToken].workspace = workspace;

				res.say("Great! You can ask me about upcoming tasks, to mark tasks as complete, or to create a new task. What do you want to do?").shouldEndSession(false);
				//res.say("State engine at stage two.").shouldEndSession(false);
				delete state[req.sessionDetails.accessToken].workspaces;
			} else
				res.say("Sorry, I don't see that workspace in your account. Try again.").shouldEndSession(false);
		} catch(e) {
			res.say("Sorry, I didn't get that. Try again.").shouldEndSession(false);
		}
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