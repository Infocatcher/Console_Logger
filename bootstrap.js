const LOG_PREFIX = "[Console Logger] ";
const FILE_NAME_PREFIX = "consoleLogger_";
const FILE_NAME_DEBUG = "consoleLogger-debug.log";
var rootURI = "chrome://consolelogger/content/";
var platformVersion;

if(!("Services" in this))
	Components.utils["import"]("resource://gre/modules/Services.jsm");
this.__defineGetter__("OS", function() {
	delete this.OS;
	return Components.utils["import"]("resource://gre/modules/osfile.jsm").OS;
});

function install(params, reason) {
}
function uninstall(params, reason) {
}
function startup(params, reason) {
	platformVersion = parseFloat(Services.appinfo.platformVersion);
	if(platformVersion < 10) {
		rootURI = params && params.resourceURI
			? params.resourceURI.spec
			: new Error().fileName
				.replace(/^.* -> /, "")
				.replace(/[^\/]+$/, "");
	}
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
		if(reason == APP_SHUTDOWN)
			return;

		if(!this.initialized)
			return;
		this.initialized = false;

		prefs.destroy();
		Services.console.unregisterListener(this);
	},

	observe: function(msg) {
		delay(function() {
			this.observeDelayed(msg);
		}, this);
	},
	observeDelayed: function(msg) {
		if(!(msg instanceof Components.interfaces.nsIScriptError)) {
			if(msg instanceof Components.interfaces.nsIConsoleMessage) {
				var msgText = msg.message;
				var messages = this.messages;
				for(var key in messages) {
					if(messages[key].test(msgText)) {
						if(!this.exclude(msgText, key))
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
				if(!this.exclude(msg.errorMessage, key))
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
	writeDebugMessage: function(msg) {
		this.writeToFile(
			this.getFile(FILE_NAME_DEBUG, FILE_NAME_DEBUG),
			this.getTimestamp() + " " + msg + "\n"
		);
	},
	getTimestamp: function(msg) {
		var d = msg && msg.timeStamp
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
		var ns = prefs.ns + "patterns.";
		var patterns = { __proto__: null };
		var messages = { __proto__: null };
		var excludes = { __proto__: null };

		var _patterns = { __proto__: null };
		var _disabled = { __proto__: null };
		var _messages = { __proto__: null };
		var _excludes = { __proto__: null };
		Services.prefs.getBranch(ns)
			.getChildList("", {})
			.forEach(function(pName) {
				var val = prefs.getPref(ns + pName);
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
					_messages[pShort] = val;
				}
				else {
					_patterns[pName] = val;
				}
			});

		for(var key in _patterns) {
			if(key in _disabled)
				continue;
			if(key in _messages && _messages[key]) try {
				messages[key] = new RegExp(_messages[key]);
			}
			catch(e) {
				Components.utils.reportError(LOG_PREFIX + 'Invalid message pattern for "' + key + '":\n' + _messages[key]);
				Components.utils.reportError(e);
			}
			if(_patterns[key]) try {
				patterns[key] = new RegExp(_patterns[key], "i");
			}
			catch(e) {
				Components.utils.reportError(LOG_PREFIX + 'Invalid pattern for "' + key + '":\n' + _patterns[key]);
				Components.utils.reportError(e);
			}
			if(key in _excludes && _excludes[key]) try {
				excludes[key] = new RegExp(_excludes[key], "i");
			}
			catch(e) {
				Components.utils.reportError(LOG_PREFIX + 'Invalid exclusion for "' + key + '":\n' + _excludes[key]);
				Components.utils.reportError(e);
			}
		}
		delete this.patterns;
		delete this.messages;
		delete this.excludes;
		return {
			patterns: (this.patterns = patterns),
			messages: (this.messages = messages),
			excludes: (this.excludes = excludes)
		};
	},
	exclude: function(msgText, key) {
		var excludes = this.excludes;
		if(key in excludes && excludes[key].test(msgText))
			return true;
		return false;
	},

	_files: { __proto__: null },
	getFile: function(key, name) {
		var files = this._files;
		if(key in files)
			return files[key];
		var file = Services.dirsvc.get("ProfD", Components.interfaces.nsIFile);
		file.append(name || FILE_NAME_PREFIX + key + ".log");
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

		var done = function(err) {
			err && Components.utils.reportError(LOG_PREFIX + "Can't write to " + file.path + ", error:\n" + err);
			this._writeInProgress = false;
			var next = this._writeQueue.shift();
			if(next)
				this.writeToFile.apply(this, next);
		}.bind(this);

		var _this = this;
		if(platformVersion < 7) {
			try {
				var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
					.createInstance(Components.interfaces.nsIFileOutputStream);
				foStream.init(
					file,
					0x02 /*PR_WRONLY*/ | 0x08 /*PR_CREATE_FILE*/ | 0x10 /*PR_APPEND*/,
					parseInt("0644", 8),
					0
				);
				var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
					.createInstance(Components.interfaces.nsIConverterOutputStream);
				converter.init(foStream, "UTF-8", 0, 0);
				converter.writeString(data);
				converter.close(); // this closes foStream
				done();
			}
			catch(e) {
				Components.utils.reportError(e);
				done(e);
			}
			return;
		}
		if(platformVersion < 27) {
			var FileUtils = this.FileUtils || (
				this.FileUtils = Components.utils["import"]("resource://gre/modules/FileUtils.jsm").FileUtils
			);
			var NetUtil = this.NetUtil || (
				this.NetUtil = Components.utils["import"]("resource://gre/modules/NetUtil.jsm").NetUtil
			);
			//if(!file.exists())
			//	file.create(file.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
			var ostream = FileUtils.openFileOutputStream(
				file,
				FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE | FileUtils.MODE_APPEND
			);
			var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
				.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
			converter.charset = "UTF-8";
			var istream = converter.convertToInputStream(data);
			NetUtil.asyncCopy(istream, ostream, function(status) {
				done(!Components.isSuccessCode(status) && "Status: " + _this.getErrorName(status));
			});
			return;
		}

		var onFailure = done;
		OS.File.open(file.path, { write: true, append: true }).then(
			function onSuccess(osFile) {
				var ensureClosed = function(err) {
					osFile.close()
						.then(done, onFailure)
						.then(null, onFailure);
				};
				var encoder = _this.textEncoder || (
					_this.textEncoder = new (Components.utils.getGlobalForObject(OS)).TextEncoder()
				);
				var arr = encoder.encode(data);
				osFile.write(arr).then(
					function onSuccess(bytesCount) {
						ensureClosed();
					},
					ensureClosed
				).then(null, ensureClosed);
			},
			onFailure
		).then(null, onFailure);
	},
	getErrorName: function(code) {
		var Cr = Components.results;
		for(var errName in Cr)
			if(Cr[errName] == code)
				return errName;
		return "" + code;
	}
};

var prefs = {
	ns: "extensions.consoleLogger.",
	initialized: false,
	init: function() {
		if(this.initialized)
			return;
		this.initialized = true;

		//~ todo: add new condition when https://bugzilla.mozilla.org/show_bug.cgi?id=564675 will be fixed
		if(platformVersion >= 2)
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
		if(shortName.substr(0, 9) == "patterns.")
			consoleLogger.loadPatterns();
		else {
			var val = this.getPref(pName);
			this._cache[shortName] = val;
		}
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

function delay(callback, context) {
	if(platformVersion <= 1.8) { // Firefox 2 and older
		delay = function(callback, context) {
			var timer = Components.classes["@mozilla.org/timer;1"]
				.createInstance(Components.interfaces.nsITimer);
			timer.init({observe: function(subject, topic, data) {
				callback.call(context);
			}}, 0, timer.TYPE_ONE_SHOT);
		};
		delay.apply(this, arguments);
		return;
	}
	var tm = Services.tm;
	var DISPATCH_NORMAL = Components.interfaces.nsIThread.DISPATCH_NORMAL;
	delay = function(callback, context) {
		// Note: dispatch(function() { ... }) works only in Firefox 4+
		tm.mainThread.dispatch({run: function() {
			callback.call(context);
		}}, DISPATCH_NORMAL);
	}
	delay.apply(this, arguments);
}

function _log(s) {
	if(prefs.get("debug"))
		consoleLogger.writeDebugMessage(s);
}
function _dump(s) {
	if(prefs.get("debug"))
		dump(LOG_PREFIX + s + "\n");
}