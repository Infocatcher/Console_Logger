var consoleLoggerCore = {
	cl: consoleLogger,

	handleConsoleMessage: function(msg) {
		if(msg instanceof Components.interfaces.nsIConsoleMessage) {
			if(msg instanceof Components.interfaces.nsIScriptError) {
				var msgSource = msg.sourceName;
				var patterns = this.sources;
				for(var key in patterns) {
					if(patterns[key].test(msgSource)) {
						if(!this.exclude(msg.errorMessage, key))
							this.cl.writeMessage(msg, key);
						break;
					}
				}
			}
			else {
				var msgText = msg.message;
				var patterns = this.messages;
				for(var key in patterns) {
					if(patterns[key].test(msgText)) {
						if(!this.exclude(msgText, key))
							this.cl.writeStringMessage(msg, key);
						break;
					}
				}
			}
		}
		else {
			// See sendConsoleAPIMessage() in resource://gre/modules/devtools/Console.jsm
			msg = msg.wrappedJSObject || msg;
			var msgSource = msg.filename;
			var patterns = this.sources;
			for(var key in patterns) {
				if(patterns[key].test(msgSource)) {
					var msgText = Array.map(msg.arguments || [], String).join("\n");
					if(!this.exclude(msgText, key))
						this.cl.writeObjectMessage(msg, msgText, key);
					break;
				}
			}
		}
	},

	get sources() {
		return this.loadPatterns().sources;
	},
	get messages() {
		return this.loadPatterns().messages;
	},
	get excludes() {
		return this.loadPatterns().excludes;
	},
	get options() {
		return this.getOptions(false);
	},
	set options(options) {
		prefs.lockObserver = true;
		var ns = prefs.ns + "patterns.";
		prefs.resetBranch(ns);
		for(var name in options) {
			var item = options[name];
			prefs.setPref(ns + name, item.source);
			prefs.setPref(ns + name + ".message", item.message);
			prefs.setPref(ns + name + ".exclude", item.exclude);
			prefs.setPref(ns + name + ".enabled", item.enabled);
		}
		prefs.lockObserver = false;
		this.loadPatterns();
	},
	get defaultOptions() {
		return this.getOptions(true);
	},
	getOptions: function(defaults) {
		var ns = prefs.ns + "patterns.";
		var items = { __proto__: null };
		var defaultBranch = Services.prefs.getDefaultBranch("");
		var branch = defaults && defaultBranch;
		Services.prefs.getBranch(ns)
			.getChildList("", {})
			.forEach(function(pName) {
				var val = prefs.getPref(ns + pName, null, branch);
				if(val === null)
					return;
				var name = pName;
				var type = "source";
				if(/\.(enabled|exclude|message)$/.test(pName)) {
					name = RegExp.leftContext;
					type = RegExp.$1;
				}
				var item = items[name] || (
					items[name] = {
						name: name,
						enabled: true,
						source: "",
						message: "",
						exclude: "",
						locked: defaults || prefs.getPref(ns + pName, null, defaultBranch) !== null,
						__proto__: null
					}
				);
				item[type] = val;
			});
		return items;
	},
	resetOptions: function(name) {
		prefs.resetBranch(prefs.ns + "patterns." + name);
	},
	loadPatterns: function() {
		var messages = { __proto__: null };
		var sources  = { __proto__: null };
		var excludes = { __proto__: null };
		function makePattern(out, name, item, type, flags) {
			if(item[type]) try {
				out[name] = new RegExp(item[type], flags);
			}
			catch(e) {
				Components.utils.reportError(LOG_PREFIX + "Invalid " + type + " pattern for \"" + name + "\":\n" + item[type]);
				Components.utils.reportError(e);
			}
		}
		var options = this.options;
		for(var name in options) {
			var item = options[name];
			if(!item.enabled)
				continue;
			makePattern(messages, name, item, "message", "i");
			makePattern(sources,  name, item, "source",  "i");
			makePattern(excludes, name, item, "exclude", "i");
		}
		delete this.messages;
		delete this.sources;
		delete this.excludes;
		return {
			messages: (this.messages = messages),
			sources:  (this.sources  = sources),
			excludes: (this.excludes = excludes)
		};
	},
	exclude: function(msgText, key) {
		var patterns = this.excludes;
		if(key in patterns && patterns[key].test(msgText))
			return true;
		return false;
	}
};