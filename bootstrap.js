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
	return this.OS = Components.utils["import"]("resource://gre/modules/osfile.jsm", {}).OS;
});
this.__defineGetter__("textEncoder", function() {
	// Global object was changed in Firefox 57+ https://bugzilla.mozilla.org/show_bug.cgi?id=1186409
	delete this.textEncoder;
	return this.textEncoder = new (Components.utils.getGlobalForObject(OS)).TextEncoder();
});

function install(params, reason) {
}
function uninstall(params, reason) {
}
function startup(params, reason) {
	platformVersion = parseFloat(
		Services.appinfo.name == "Pale Moon"
			? Services.appinfo.version
			: Services.appinfo.platformVersion
	);
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
					.addon[value="consoleLogger@infocatcher"] .addon-control.preferences {\n\
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
	get core() {
		Services.scriptloader.loadSubScript("chrome://consolelogger/content/core.js");
		delete this.core;
		return this.core = consoleLoggerCore;
	},
	get io() {
		Services.scriptloader.loadSubScript("chrome://consolelogger/content/io.js");
		delete this.io;
		return this.io = consoleLoggerIO;
	},

	init: function(reason) {
		if(this.initialized)
			return;
		this.initialized = true;

		prefs.init();
		if(this.enabled)
			this.listen(true);
		Services.obs.addObserver(this, "consoleLogger-exportScope", false);
		if(this.canUseSessions) {
			Services.obs.addObserver(this, "sessionstore-windows-restored", false);
			Services.obs.addObserver(this, "sessionstore-browser-state-restored", false);
		}
		else if(reason == APP_STARTUP && prefs.get("options.restoreWindow")) {
			Services.obs.addObserver({ // Wait for first opened window
				cl: this,
				observe: function(subject, topic, data) {
					subject.addEventListener("load", this, false);
				},
				handleEvent: function(e) {
					e.currentTarget.removeEventListener("load", this, false);
					Services.obs.removeObserver(this, "domwindowopened");
					delay(this.cl.mayRestoreOptions, this.cl);
				}
			}, "domwindowopened", false);
		}
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
		if(this.canUseSessions) {
			Services.obs.removeObserver(this, "sessionstore-windows-restored");
			Services.obs.removeObserver(this, "sessionstore-browser-state-restored");
		}
		prefs.destroy();

		if("consoleLoggerCore" in global)
			this.core.cl = null;
		if("consoleLoggerIO" in global)
			this.io.cl = null;

		var isUpdate = reason == ADDON_UPGRADE || reason == ADDON_DOWNGRADE;
		function closeOptions(window) {
			var loc = window.location.href;
			if(loc.substr(0, 23) != "chrome://consolelogger/") {
				Array.prototype.slice.call(window.frames).forEach(closeOptions);
				return;
			}
			if(!isUpdate) {
				window.close();
				return;
			}
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
				this.core.handleConsoleMessage(subject);
			}, this);
		}
		else if(topic == "consoleLogger-exportScope") {
			var out = subject.wrappedJSObject || subject;
			if(data)
				out[data] = global;
			else
				out.consoleLogger = this;
		}
		else if(
			topic == "sessionstore-windows-restored"
			|| topic == "sessionstore-browser-state-restored"
		) {
			this.mayRestoreOptions();
		}
	},

	_changedInSession: { __proto__: null },

	get options()        { return this.core.options;        },
	set options(options) { this.core.options = options;     },
	get defaultOptions() { return this.core.defaultOptions; },

	openOptions:         function() { return this.core.openOptions();         },
	openOptionsInWindow: function() { return this.core.openOptionsInWindow(); },
	openOptionsInTab:    function() { return this.core.openOptionsInTab();    },

	ssPrefix: "consoleLogger:",
	ssPref: "session.",
	get ss() {
		delete this.ss;
		if(!("nsISessionStore" in Components.interfaces)) {
			try { // Firefox 61+, https://bugzilla.mozilla.org/show_bug.cgi?id=1450559
				return this.ss = Components.utils.import("resource:///modules/sessionstore/SessionStore.jsm", {})
					.SessionStore;
			}
			catch(e) {
			}
			return this.ss = null;
		}
		return this.ss = (
			Components.classes["@mozilla.org/browser/sessionstore;1"]
			|| Components.classes["@mozilla.org/suite/sessionstore;1"]
		).getService(Components.interfaces.nsISessionStore);
	},
	get canUseSessions() {
		delete this.canUseSessions;
		return this.canUseSessions = this.ss && "setGlobalValue" in this.ss; // Firefox 28+
	},
	setSessionState: function(key, val) {
		if(!this.canUseSessions) {
			var pn = this.ssPref + key;
			if(val)
				prefs.set(pn, val);
			else if(Services.prefs.prefHasUserValue(prefs.ns + pn))
				Services.prefs.clearUserPref(prefs.ns + pn);
			return;
		}
		if(val)
			this.ss.setGlobalValue(this.ssPrefix + key, "" + (val === true ? 1 : val));
		else
			this.ss.deleteGlobalValue(this.ssPrefix + key);
	},
	getSessionState: function(key) {
		if(!this.canUseSessions)
			return prefs.get(this.ssPref + key);
		return this.ss.getGlobalValue(this.ssPrefix + key);
	},
	mayRestoreOptions: function() {
		if(prefs.get("options.restoreWindow") && this.getSessionState("optionsOpened"))
			this.openOptions();
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
			consoleLogger.core.loadPatterns();
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
				case ps.PREF_STRING:
					if("getStringPref" in ps) // Firefox 58+
						return ps.getStringPref(pName);
					return ps.getComplexValue(pName, Components.interfaces.nsISupportsString).data;
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
				if("setStringPref" in ps) // Firefox 58+
					return ps.setStringPref(pName, val);
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

function delay(callback, context, args) {
	if(platformVersion <= 1.8) { // Firefox 2 and older
		delay = function(callback, context, args) {
			var timer = Components.classes["@mozilla.org/timer;1"]
				.createInstance(Components.interfaces.nsITimer);
			timer.init({observe: function(subject, topic, data) {
				callback.apply(context, args);
			}}, 0, timer.TYPE_ONE_SHOT);
		};
		delay.apply(this, arguments);
		return;
	}
	var tm = Services.tm;
	var DISPATCH_NORMAL = Components.interfaces.nsIThread.DISPATCH_NORMAL;
	delay = function(callback, context, args) {
		// Note: dispatch(function() { ... }) works only in Firefox 4+
		tm.mainThread.dispatch({run: function() {
			callback.apply(context, args);
		}}, DISPATCH_NORMAL);
	}
	delay.apply(this, arguments);
}

function _log(s) {
	if(prefs.get("debug"))
		consoleLogger.io.writeDebugMessage(s);
}
function _dump(s) {
	if(prefs.get("debug"))
		dump(LOG_PREFIX + s + "\n");
}