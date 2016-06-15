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
							this.cl.io.writeMessage(msg, key);
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
							this.cl.io.writeStringMessage(msg, key);
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
						this.cl.io.writeObjectMessage(msg, msgText, key);
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
		delete this.messages;
		delete this.sources;
		delete this.excludes;
		var messages = this.messages = { __proto__: null };
		var sources  = this.sources  = { __proto__: null };
		var excludes = this.excludes = { __proto__: null };
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
		return this;
	},
	exclude: function(msgText, key) {
		var patterns = this.excludes;
		if(key in patterns && patterns[key].test(msgText))
			return true;
		return false;
	},

	optionsURL: "chrome://consolelogger/content/options.xul",
	openOptions: function() {
		return prefs.get("options.openInTab") && this.openOptionsInTab()
			|| this.openOptionsInWindow();
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
					var content = browser.contentWindow; // e10s note: our tab shouldn't be remote
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
		var content = browserWindow.content || gBrowser.contentWindow;
		content.focus();
		return content;
	}
};