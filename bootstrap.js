const LOG_PREFIX = "[Console Logger] ";
const FILE_NAME_PREFIX = "consoleLogger_";
var rootURI;

Components.utils.import("resource://gre/modules/Services.jsm");
this.__defineGetter__("NetUtil", function() {
	delete this.NetUtil;
	return Components.utils.import("resource://gre/modules/NetUtil.jsm").NetUtil;
});
this.__defineGetter__("FileUtils", function() {
	delete this.FileUtils;
	return Components.utils.import("resource://gre/modules/FileUtils.jsm").FileUtils;
});

function install(params, reason) {
}
function uninstall(params, reason) {
}
function startup(params, reason) {
	rootURI = params && params.resourceURI
		? params.resourceURI.spec
		: new Error().fileName
			.replace(/^.* -> /, "")
			.replace(/[^\/]+$/, "");

	consoleLogger.init(reason);
}
function shutdown(params, reason) {
	consoleLogger.destroy(reason);
}

var consoleLogger = {
	initialized: false,
	init: function(reason) {
		if(this.initialized)
			return;
		this.initialized = true;

		prefs.init();
		Services.console.registerListener(this);
	},
	destroy: function(reason) {
		if(!this.initialized)
			return;
		this.initialized = false;

		prefs.destroy();
		Services.console.unregisterListener(this);
	},

	observe: function(msg) {
		if(!(msg instanceof Components.interfaces.nsIScriptError)) {
			if(msg instanceof Components.interfaces.nsIConsoleMessage) {
				var msgText = msg.message;
				var messages = this.messages;
				for(var key in messages) {
					if(messages[key].test(msgText)) {
						var excludes = this.excludes;
						if(key in excludes && excludes[key].test(msgText))
							break;
						this.writeStringMessage(msg, key);
						break;
					}
				}
			}
			return;
		}
		var msgSource = msg.sourceName;
		var patterns = this.patterns;
		for(var key in patterns) {
			var pattern = patterns[key];
			if(pattern.test(msgSource)) {
				var msgText = msg.errorMessage;
				var excludes = this.excludes;
				if(key in excludes && excludes[key].test(msgText))
					break;
				this.writeMessage(msg, key);
				break;
			}
		}
	},

	writeStringMessage: function(msg, key) {
		var timestamp = this.getTimestamp(msg);
		this.writeToFile(
			this.getFile(key),
			timestamp + " [message]" + ":\n"
			+ msg.message
			+ "\n\n"
		);
	},
	writeMessage: function(msg, key) {
		if("nsIScriptError2" in Components.interfaces)
			msg instanceof (Components.interfaces.nsIScriptError2);
		var timestamp = this.getTimestamp(msg);
		var details = [msg.category || "unknown"];
		var flags = msg.flags;
		var flagConsts = ["warning", "exception", "strict"];
		flagConsts.forEach(function(flag) {
			if(flags & msg[flag + "Flag"])
				details.push(flag);
		});
		var line = ":" + msg.lineNumber + (msg.columnNumber ? ":" + msg.columnNumber : "");
		this.writeToFile(
			this.getFile(key),
			timestamp + " [" + details.join(", ") + "]" + ":\n"
			+ msg.sourceName + line + "\n"
			+ msg.errorMessage
			+ (msg.sourceLine ? "\n" + msg.sourceLine : "")
			+ "\n\n"
		);
	},
	getTimestamp: function(msg) {
		var d = msg.timeStamp
			? new Date(msg.timeStamp)
			: new Date();
		var ms = d.getMilliseconds();
		return d.toLocaleFormat("%Y-%m-%d %H:%M:%S:") + "000".substr(String(ms).length) + ms;
	},

	get patterns() {
		return this.loadPatterns().patterns;
	},
	get messages() {
		return this.loadPatterns().messages;
	},
	get excludes() {
		return this.loadPatterns().excludes;
	},
	loadPatterns: function() {
		var ns = "patterns.";
		var patterns = { __proto__: null };
		var messages = { __proto__: null };
		var excludes = { __proto__: null };

		var _patterns = { __proto__: null };
		var _disabled = { __proto__: null };
		var _excludes = { __proto__: null };
		Services.prefs.getBranch(prefs.ns + ns)
			.getChildList("", {})
			.forEach(function(pName) {
				var val = prefs.get(ns + pName);
				var pShort, type;
				if(/\.[^.]+$/.test(pName)) {
					pShort = RegExp.leftContext;
					type = RegExp.lastMatch;
				}
				if(type == ".enabled") {
					if(!val)
						_disabled[pShort] = true;
				}
				else if(type == ".exclude") {
					_excludes[pShort] = val;
				}
				else if(type == ".message") {
					try {
						messages[pShort] = new RegExp(val);
					}
					catch(e) {
						Components.utils.reportError(LOG_PREFIX + 'Invalid message pattern for "' + pShort + '":\n' + val);
						Components.utils.reportError(e);
					}
				}
				else {
					_patterns[pName] = val;
				}
			});

		for(var key in _patterns) {
			if(key in _disabled)
				continue;
			try {
				patterns[key] = new RegExp(_patterns[key], "i");
				if(key in _excludes) try {
					excludes[key] = new RegExp(_excludes[key], "i");
				}
				catch(e2) {
					Components.utils.reportError(LOG_PREFIX + 'Invalid exclusion for "' + key + '":\n' + _excludes[key]);
					Components.utils.reportError(e);
				}
			}
			catch(e) {
				Components.utils.reportError(LOG_PREFIX + 'Invalid pattern for "' + key + '":\n' + _patterns[key]);
				Components.utils.reportError(e);
			}
		}
		delete this.patterns;
		delete this.excludes;
		return {
			patterns: (this.patterns = patterns),
			messages: (this.messages = messages),
			excludes: (this.excludes = excludes)
		}
	},

	_files: { __proto__: null },
	getFile: function(key) {
		var files = this._files;
		if(key in files)
			return files[key];
		var file = FileUtils.getFile("ProfD", [FILE_NAME_PREFIX + key + ".log"]);
		if(!file.exists())
			file.create(file.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
		return files[key] = file;
	},
	_writeInProgress: false,
	_writeQueue: [],
	writeToFile: function(file, data) {
		if(this._writeInProgress) {
			this._writeQueue.push(arguments);
			return;
		}
		this._writeInProgress = true;

		var ostream = FileUtils.openFileOutputStream(file, FileUtils.MODE_WRONLY | FileUtils.MODE_APPEND);
		var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
			.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
		converter.charset = "UTF-8";
		var istream = converter.convertToInputStream(data);
		NetUtil.asyncCopy(istream, ostream, function(status) {
			if(!Components.isSuccessCode(status))
				Components.utils.reportError(LOG_PREFIX + "Can't write to " + file.path + ", status: " + status);

			this._writeInProgress = false;
			var next = this._writeQueue.shift();
			if(next)
				this.writeToFile.apply(this, next);
		}.bind(this));
	},

	prefChanged: function(pName, val) {
		this.loadPatterns();
	}
};

var prefs = {
	ns: "extensions.consoleLogger.",
	initialized: false,
	init: function() {
		if(this.initialized)
			return;
		this.initialized = true;

		//~ todo: add condition when https://bugzilla.mozilla.org/show_bug.cgi?id=564675 will be fixed
		this.loadDefaultPrefs();
		Services.prefs.addObserver(this.ns, this, false);
	},
	destroy: function() {
		if(!this.initialized)
			return;
		this.initialized = false;

		Services.prefs.removeObserver(this.ns, this);
	},
	observe: function(subject, topic, pName) {
		if(topic != "nsPref:changed")
			return;
		var shortName = pName.substr(this.ns.length);
		var val = this.getPref(pName);
		this._cache[shortName] = val;
		consoleLogger.prefChanged(shortName, val);
	},

	loadDefaultPrefs: function() {
		var defaultBranch = Services.prefs.getDefaultBranch("");
		var prefsFile = rootURI + "defaults/preferences/prefs.js";
		var prefs = this;
		Services.scriptloader.loadSubScript(prefsFile, {
			pref: function(pName, val) {
				var pType = defaultBranch.getPrefType(pName);
				if(pType != defaultBranch.PREF_INVALID && pType != prefs.getValueType(val)) {
					Components.utils.reportError(
						LOG_PREFIX + 'Changed preference type for "' + pName
						+ '", old value will be lost!'
					);
					defaultBranch.deleteBranch(pName);
				}
				prefs.setPref(pName, val, defaultBranch);
			}
		});
	},

	_cache: { __proto__: null },
	get: function(pName, defaultVal) {
		var cache = this._cache;
		return pName in cache
			? cache[pName]
			: (cache[pName] = this.getPref(this.ns + pName, defaultVal));
	},
	set: function(pName, val) {
		return this.setPref(this.ns + pName, val);
	},
	getPref: function(pName, defaultVal, prefBranch) {
		var ps = prefBranch || Services.prefs;
		switch(ps.getPrefType(pName)) {
			case ps.PREF_BOOL:   return ps.getBoolPref(pName);
			case ps.PREF_INT:    return ps.getIntPref(pName);
			case ps.PREF_STRING: return ps.getComplexValue(pName, Components.interfaces.nsISupportsString).data;
		}
		return defaultVal;
	},
	setPref: function(pName, val, prefBranch) {
		var ps = prefBranch || Services.prefs;
		var pType = ps.getPrefType(pName);
		if(pType == ps.PREF_INVALID)
			pType = this.getValueType(val);
		switch(pType) {
			case ps.PREF_BOOL:   ps.setBoolPref(pName, val); break;
			case ps.PREF_INT:    ps.setIntPref(pName, val);  break;
			case ps.PREF_STRING:
				var ss = Components.interfaces.nsISupportsString;
				var str = Components.classes["@mozilla.org/supports-string;1"]
					.createInstance(ss);
				str.data = val;
				ps.setComplexValue(pName, ss, str);
		}
		return this;
	},
	getValueType: function(val) {
		switch(typeof val) {
			case "boolean": return Services.prefs.PREF_BOOL;
			case "number":  return Services.prefs.PREF_INT;
		}
		return Services.prefs.PREF_STRING;
	}
};