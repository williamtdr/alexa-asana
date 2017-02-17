/*
 * Abstraction layer for .json configuration files.
 */

"use strict";

const fs = require("fs"),
	  log = require("./log"),
	  get = require("lodash.get"),
	  set = require("lodash.set");

module.exports = class Config {
	// Create a new config object, and start loading/parsing it. Checks for
	// sample & creates if necessary, then calls callback.
	constructor(path) {
		this.data = false;
		this.sample = false;
		this.path = path;

		try {
			this.data = JSON.parse(fs.readFileSync(path, "utf8"));
		} catch(e) {}

		try {
			this.sample = JSON.parse(fs.readFileSync(path.replace(new RegExp(".json$"), ".sample.json"), "utf8"));
		} catch(e) {}

		if(this.sample && !this.data) {
			log.info("Config", "Creating default configuration from sample...");
			this.data = this.sample;
			this.save();
		}
	}

	// Get a config file, or the sample value if it is not set.
	get(key) {
		var exists = get(this.data, key);

		return exists !== undefined ? exists : get(this.sample, key);
	}

	// Sets a config value. Synchronous to prevent collision.
	set(key, value) {
		set(this.data, key, value);

		return this.save();
	}

	// Write current configuration to disk.
	save() {
		try {
			fs.writeFileSync(this.path, JSON.stringify(this.data, null, "\t"));

			return true;
		} catch(e) {
			console.log(e);

			return false;
		}
	}
};