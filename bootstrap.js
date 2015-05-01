const LOG_PREFIX = "[Console Logger] ";
const FILE_NAME_PREFIX = "consoleLogger_";
const FILE_NAME_DEBUG = "consoleLogger-debug.log";
var global = this;
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
	if(platformVersion < 10 && "addBootstrappedManifestLocation" in Components.manager)
		Components.manager.addBootstrappedManifestLocation(params.installPath);
	if(platformVersion >= 2 && platformVersion < 8) {
		rootURI = params && params.resourceURI
			? params.resourceURI.spec
			: new Error().fileName
				.replace(/^.* -> /, "")
				.replace(/[^\/]+$/, "");
		delay(function() {
			var sss = Components.classes["@mozilla.org/content/style-sheet-service;1"]
				.getService(Components.interfaces.nsIStyleSheetService);
			var cssStr = '\
				/* Console Logger: hide options button (chrome://... link doesn\'t work) */\n\
				@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");\n\
				@-moz-document url("about:addons"),\n\
					url("chrome://mozapps/content/extensions/extensions.xul") {\n\
					.addon-control.preferences {\n\
						display: none !important;\n\
					}\n\
				}';
			var cssURI = Services.io.newURI("data:text/css," + encodeURIComponent(cssStr), null, null);
			if(!sss.sheetRegistered(cssURI, sss.USER_SHEET))
				sss.loadAndRegisterSheet(cssURI, sss.USER_SHEET);
			global.unloadAddonManagerFix = function() {
				if(sss.sheetRegistered(cssURI, sss.USER_SHEET))
					sss.unregisterSheet(cssURI, sss.USER_SHEET);
			};
		});
	}
	consoleLogger.init(reason);
}
function shutdown(params, reason) {
	if(platformVersion < 10 && "addBootstrappedManifestLocation" in Components.manager)
		Components.manager.removeBootstrappedManifestLocation(params.installPath);
	if("unloadAddonManagerFix" in global)
		global.unloadAddonManagerFix();
	consoleLogger.destroy(reason);
}

var consoleLogger = {
	initialized: false,
	isShutdown: false,
	init: function(reason) {
		if(this.initialized)
			return;
		this.initialized = true;

		prefs.init();
		if(this.enabled)
			this.listen(true);
		Services.obs.addObserver(this, "consoleLogger-exportScope", false);
		Services.obs.addObserver(this, "sessionstore-windows-restored", false);
		Services.obs.addObserver(this, "sessionstore-browser-state-restored", false);
	},
	destroy: function(reason) {
		if(reason == APP_SHUTDOWN) {
			this.isShutdown = true;
			return;
		}

		if(!this.initialized)
			return;
		this.initialized = false;

		if(this.enabled)
			this.listen(false);
		Services.obs.removeObserver(this, "consoleLogger-exportScope");
		Services.obs.removeObserver(this, "sessionstore-windows-restored");
		Services.obs.removeObserver(this, "sessionstore-browser-state-restored");
		prefs.destroy();

		var isUpdate = reason == ADDON_UPGRADE || reason == ADDON_DOWNGRADE;
		function closeOptions(window) {
			var loc = window.location.href;
			if(loc.substr(0, 23) == "chrome://consolelogger/") {
				if(!isUpdate)
					window.close();
				else {
					window.location.replace("about:blank");
					window.stop();
					var stopWait = Date.now() + 3e3;
					window.setTimeout(function reload(w) {
						try { // Trick: wait for chrome package registration
							var locale = Components.classes["@mozilla.org/chrome/chrome-registry;1"]
								.getService(Components.interfaces.nsIXULChromeRegistry)
								.getSelectedLocale("consolelogger");
							if(/^\w/.test(locale)) {
								w.location.replace(loc);
								return;
							}
						}
						catch(e) {
						}
						if(Date.now() > stopWait)
							w.close();
						else
							w.setTimeout(reload, 10, w);
					}, 50, window);
				}
				return;
			}
			Array.slice(window.frames).forEach(closeOptions);
		};
		var windows = Services.wm.getEnumerator(null);
		while(windows.hasMoreElements())
			closeOptions(windows.getNext());
	},

	get enabled() {
		return prefs.get("enabled");
	},
	set enabled(enabled) {
		return prefs.set("enabled", enabled);
	},
	listen: function(on) {
		if(on) {
			Services.console.registerListener(this);
			Services.obs.addObserver(this, "console-api-log-event", false);
		}
		else {
			Services.console.unregisterListener(this);
			Services.obs.removeObserver(this, "console-api-log-event");
		}
	},

	observe: function(subject, topic, data) {
		if(!topic || topic == "console-api-log-event") {
			delay(function() {
				this.handleConsoleMessage(subject);
			}, this);
		}
		else if(topic == "consoleLogger-exportScope") {
			var out = subject.wrappedJSObject || subject;
			out[data] = global;
		}
		else if(
			topic == "sessionstore-windows-restored"
			|| topic == "sessionstore-browser-state-restored"
		) {
			if(this.getSessionState(this.optionsOpened))
				this.openOptions();
		}
	},
	handleConsoleMessage: function(msg) {
		if(msg instanceof Components.interfaces.nsIConsoleMessage) {
			if(msg instanceof Components.interfaces.nsIScriptError) {
				var msgSource = msg.sourceName;
				var patterns = this.sources;
				for(var key in patterns) {
					if(patterns[key].test(msgSource)) {
						if(!this.exclude(msg.errorMessage, key))
							this.writeMessage(msg, key);
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
							this.writeStringMessage(msg, key);
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
						this.writeObjectMessage(msg, msgText, key);
					break;
				}
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
		this.notifyUpdatedLog(key);
	},
	writeMessage: function(msg, key) {
		if("nsIScriptError2" in Components.interfaces)
			msg instanceof Components.interfaces.nsIScriptError2;
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
		this.notifyUpdatedLog(key);
	},
	writeObjectMessage: function(msg, msgText, key) {
		var timestamp = this.getTimestamp(msg);
		var line = ":" + msg.lineNumber + (msg.columnNumber ? ":" + msg.columnNumber : "");
		this.writeToFile(
			this.getFile(key),
			timestamp + " [Console.jsm, " + (msg.level || "unknown") + "]" + ":\n"
			+ msg.filename + line + "\n"
			+ msgText
			+ "\n\n"
		);
		this.notifyUpdatedLog(key);
	},
	writeDebugMessage: function(msg) {
		this.writeToFile(
			this.getFile(FILE_NAME_DEBUG, FILE_NAME_DEBUG),
			this.getTimestamp() + " " + msg + "\n"
		);
	},
	notifyUpdatedLog: function(key) {
		this._changedInSession[key] = true;
		delay(function() {
			Services.obs.notifyObservers(null, "consoleLogger-logUpdated", key);
		});
	},
	getTimestamp: function(msg) {
		var d = msg && msg.timeStamp
			? new Date(msg.timeStamp)
			: new Date();
		var ms = d.getMilliseconds();
		return d.toLocaleFormat("%Y-%m-%d %H:%M:%S:") + "000".substr(String(ms).length) + ms;
	},
	get br() {
		delete this.br;
		return this.br = Services.appinfo.OS == "WINNT" ? "\r\n" : "\n";
	},
	fixBr: function(s) {
		return s.replace(/\r\n?|\n/g, this.br);
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
	},

	_files: { __proto__: null },
	_changedInSession: { __proto__: null },
	getFile: function(key, name) {
		var files = this._files;
		if(key in files)
			return files[key];
		var file = Services.dirsvc.get("ProfD", Components.interfaces.nsIFile);
		file.append(name || FILE_NAME_PREFIX + this.safeFileName(key) + ".log");
		return files[key] = file;
	},
	safeFileName: function(s) {
		// From Session Manager extension,
		// https://addons.mozilla.org/files/browse/261680/file/chrome/content/modules/utils.jsm#L130
		return s.replace(/[<>:"\/\\|*?^\x00-\x1F]/g, "_");
	},
	_writeInProgress: false,
	_writeQueue: [],
	writeToFile: function(file, data) {
		if(this._writeInProgress) {
			this._writeQueue.push(arguments);
			return;
		}
		this._writeInProgress = true;

		var _this = this;
		function done(err) {
			err && Components.utils.reportError(LOG_PREFIX + "Can't write to " + file.path + ", error:\n" + err);
			_this._writeInProgress = false;
			var next = _this._writeQueue.shift();
			if(next) delay(function() {
				this.writeToFile.apply(this, next);
			}, _this);
		}

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
				var coStream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
					.createInstance(Components.interfaces.nsIConverterOutputStream);
				coStream.init(foStream, "UTF-8", 0, 0);
				coStream.writeString(this.fixBr(data));
				coStream.close(); // this closes foStream
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
			var ostream = FileUtils.openFileOutputStream(
				file,
				FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE | FileUtils.MODE_APPEND
			);
			var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
				.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
			converter.charset = "UTF-8";
			var istream = converter.convertToInputStream(this.fixBr(data));
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
				var arr = encoder.encode(_this.fixBr(data));
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
	},

	optionsURL: "chrome://consolelogger/content/options.xul",
	openOptions: function() {
		var w = prefs.get("options.openInTab") && this.openOptionsInTab();
		return w || this.openOptionsInWindow();
	},
	openOptionsInWindow: function() {
		var w = Services.wm.getMostRecentWindow("consoleLogger:options");
		if(w) {
			w.focus();
			return w;
		}
		var aw = Services.ww.activeWindow;
		if(aw && aw.location.href == "chrome://consolelogger/content/optionsOpener.xul")
			aw = aw.opener;
		return Services.ww.openWindow(
			aw,
			this.optionsURL,
			"_blank",
			"chrome,all,toolbar,centerscreen,resizable,dialog=0",
			null
		);
	},
	openOptionsInTab: function() {
		var optionsURL = this.optionsURL;
		function isBrowserWindow(win) {
			return "gBrowser" in win
				&& win.gBrowser
				&& win.gBrowser.browsers
				&& win.gBrowser.tabContainer;
		}
		function switchToTab(win, url) {
			if(!isBrowserWindow(win))
				return null;
			var browsers = win.gBrowser.browsers;
			for(var i = 0, l = browsers.length; i < l; ++i) {
				var browser = browsers[i];
				if(browser.currentURI.spec == url) {
					win.gBrowser.tabContainer.selectedIndex = i;
					var content = browser.contentWindow;
					content.focus();
					return content;
				}
			}
			return null;
		}
		// Note: in SeaMonkey private windows doesn't have windowtype
		var ws = Services.wm.getEnumerator(null);
		while(ws.hasMoreElements()) {
			var content = switchToTab(ws.getNext(), optionsURL);
			if(content)
				return content;
		}
		var browserWindow = Services.wm.getMostRecentWindow("navigator:browser");
		if(!browserWindow || !isBrowserWindow(browserWindow))
			return null;
		var gBrowser = browserWindow.gBrowser;
		if(
			!gBrowser.webProgress.isLoadingDocument && (
				"isBlankPageURL" in browserWindow
					? browserWindow.isBlankPageURL(gBrowser.currentURI.spec)
					: gBrowser.currentURI.spec == "about:blank"
			)
		)
			browserWindow.loadURI(optionsURL);
		else
			gBrowser.selectedTab = gBrowser.addTab(optionsURL);
		var content = browserWindow.content;
		content.focus();
		return content;
	},

	optionsOpened: "consoleLogger:optionsOpened",
	get ss() {
		delete this.ss;
		return this.ss = (
			Components.classes["@mozilla.org/browser/sessionstore;1"]
			|| Components.classes["@mozilla.org/suite/sessionstore;1"]
		).getService(Components.interfaces.nsISessionStore);
	},
	setSessionState: function(key, val) {
		var ss = this.ss;
		if(!("setGlobalValue" in ss))
			return;
		if(val) {
			if(val === true)
				val = 1;
			ss.setGlobalValue(key, "" + val);
		}
		else {
			ss.deleteGlobalValue(key);
		}
	},
	getSessionState: function(key, defaultVal) {
		var ss = this.ss;
		if("getGlobalValue" in ss)
			return ss.getGlobalValue(key);
		return defaultVal;
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
	lockObserver: false,
	observe: function(subject, topic, pName) {
		if(topic != "nsPref:changed" || this.lockObserver)
			return;
		var shortName = pName.substr(this.ns.length);
		if(shortName.substr(0, 9) == "patterns.")
			consoleLogger.loadPatterns();
		else {
			var val = this.getPref(pName);
			this._cache[shortName] = val;
			if(shortName == "enabled")
				consoleLogger.listen(val);
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
		try { // nsIPrefBranch.getPrefType() returns type of changed value for default branch
			switch(ps.getPrefType(pName)) {
				case ps.PREF_BOOL:   return ps.getBoolPref(pName);
				case ps.PREF_INT:    return ps.getIntPref(pName);
				case ps.PREF_STRING: return ps.getComplexValue(pName, Components.interfaces.nsISupportsString).data;
			}
		}
		catch(e) {
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
	},
	resetBranch: function(branchName) {
		// Note: nsIPrefBranch.resetBranch() isn't implemented
		var branch = Services.prefs.getBranch(branchName);
		branch.getChildList("", {}).forEach(function(pName) {
			if(branch.prefHasUserValue(pName))
				branch.clearUserPref(pName);
		});
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