var consoleLoggerGlobal;
this.__defineGetter__("OS", function() {
	delete this.OS;
	return this.OS = consoleLoggerGlobal.OS;
});
var consoleLoggerOptions = {
	exports: ["consoleLogger", "Services", "prefs", "delay", "platformVersion"],
	init: function() {
		//Services.obs
		Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService)
			.notifyObservers(window, "consoleLogger-exportScope", "consoleLoggerGlobal");
		this.exports.forEach(function(prop) {
			window[prop] = consoleLoggerGlobal[prop];
		}, this);
		if(!("JSON" in window)) {
			var scope = {}; // Note: we can't load directly into content window
			Services.scriptloader.loadSubScript("chrome://consolelogger/content/json.js", scope);
			window.JSON = scope.JSON;
		}
		this.setupUI();
		this.load();
		Services.obs.addObserver(this, "consoleLogger-logUpdated", false);
		if(this.isWindow)
			consoleLogger.setSessionState("optionsOpened", true);
	},
	destroy: function() {
		Services.obs.removeObserver(this, "consoleLogger-logUpdated");
		if(!consoleLogger.isShutdown)
			consoleLogger.setSessionState("optionsOpened", false);
		consoleLoggerGlobal = null;
		this.exports.forEach(function(prop) {
			window[prop] = null;
		}, this);
		delete window.OS;
	},
	setupUI: function() {
		var root = document.documentElement;
		var applyBtn = this.applyBtn = root.getButton("extra1");
		applyBtn.setAttribute("icon", "apply");
		applyBtn.setAttribute("cl_key", "cl-key-save");
		applyBtn.disabled = true;
		this.placeButtonsBar();
		// Insert Apply button between OK and Cancel
		var okBtn = root.getButton("accept");
		var cancelBtn = root.getButton("cancel");
		var btnBox = okBtn.parentNode;
		for(var node = btnBox.firstChild; node; node = node.nextSibling) {
			if(node == okBtn || node == cancelBtn) {
				node = node.nextSibling;
				if(node != applyBtn)
					btnBox.insertBefore(applyBtn, node);
				break;
			}
		}

		if(!("selectAll" in this.list)) { // Only single selection in Firefox 2.0 and older
			// Note: works, if installed Console2 extension
			this.$("cl-sep-beforeSelectAll").setAttribute("hidden", "true");
			this.$("cl-mi-selectAll").setAttribute("hidden", "true");
		}
		if(!("timeout" in this.filter)) { // Firefox 3.0 and older
			this.filter.setAttribute("type", "timed");
			this.filter.onkeypress = function(e) {
				if(
					e.keyCode == e.DOM_VK_ESCAPE
					&& !this.disabled && !this.readOnly && this.value
				) {
					e.preventDefault();
					this.value = "";
					this._fireCommand(this);
				}
			};
		}

		// Align: show global "enabled" checkbox right above other ones
		var cs = window.getComputedStyle(this.list, null);
		var right = cs.direction == "rtl" ? "Left" : "Right";
		var cb = this.$("cl-enabled");
		cb.style["margin" + right] = parseFloat(window.getComputedStyle(cb, null)["margin" + right])
			+ parseFloat(cs["margin" + right])
			+ parseFloat(cs["border" + right + "Width"])
			+ parseFloat(cs["padding" + right])
			+ "px";

		this.setCompactMode();

		setTimeout(function(_this) {
			_this.setKeysDesc();
		}, 0, this);

		this.timer(function() {
			var browserWindow = Services.wm.getMostRecentWindow("navigator:browser");
			if(!browserWindow)
				this.$("cl-mi-opts-openInTab").setAttribute("hidden", "true");
		}, this);
	},
	singleButtonsBar: false,
	placeButtonsBar: function(singleBar) {
		var isStartup = singleBar === undefined;
		if(isStartup)
			singleBar = prefs.get("options.singleButtonsBar");
		else
			prefs.set("options.singleButtonsBar", singleBar);
		if(singleBar == this.singleButtonsBar)
			return;
		this.singleButtonsBar = singleBar;

		var btnsPanel = this.$("cl-buttonsPanel");
		Array.forEach(
			btnsPanel.getElementsByTagName("button"),
			function(btn) {
				btn.className = singleBar ? "dialog-button" : "";
			}
		);
		if(singleBar) {
			var btnBox = this.applyBtn.parentNode;
			var w = btnBox.boxObject.width;
			btnBox.insertBefore(btnsPanel, btnBox.firstChild);
			for(var spacer = btnsPanel.nextSibling; spacer; spacer = spacer.nextSibling) {
				if(spacer.localName == "spacer") {
					spacer.setAttribute("flex", "1");
					break;
				}
			}
			var ovr = btnBox.boxObject.width - w;
			if(ovr > 0 && !isStartup)
				window.resizeBy(ovr, 0);
		}
		else {
			var list = this.list;
			list.parentNode.insertBefore(btnsPanel, list.nextSibling);
		}
	},
	setKeysDesc: function() {
		var nodes = Array.concat(
			Array.slice(document.getElementsByAttribute("cl_key", "*")),
			Array.slice(this.applyBtn.parentNode.getElementsByAttribute("cl_key", "*"))
		);
		//~ hack: show fake hidden popup with <menuitem key="keyId" /> to get descriptions
		var mp = document.documentElement.appendChild(document.createElement("menupopup"));
		mp.style.visibility = "collapse";
		nodes.forEach(function(node) {
			var keyId = node.getAttribute("cl_key");
			if(!keyId)
				return;
			var mi = document.createElement("menuitem");
			mi.__node = node;
			mi.setAttribute("key", keyId);
			mp.appendChild(mi);
		});
		mp._onpopupshown = function() {
			Array.forEach(
				this.childNodes,
				function(mi) {
					var keyDesk = mi.getAttribute("acceltext");
					if(!keyDesk)
						return;
					var node = mi.__node;
					node.tooltipText = node.tooltipText
						? node.tooltipText + " (" + keyDesk + ")"
						: keyDesk;
				}
			);
			this.parentNode.removeChild(this);
		};
		mp.setAttribute("onpopupshown", "this._onpopupshown();");
		mp["openPopup" in mp ? "openPopup" : "showPopup"]();
	},

	observe: function(subject, topic, data) {
		if(topic == "consoleLogger-logUpdated") {
			this.timer(function() {
				this.getItemsByName(data).forEach(function(cli) {
					cli.markAsUpdated();
				});
			}, this);
		}
	},

	$: function(id) {
		return document.getElementById(id);
	},
	timer: function(fn, context, delay) {
		return setTimeout(function() {
			fn.call(context);
		}, delay || 0);
	},
	get options() {
		var options = { __proto__: null };
		this.items.forEach(function(cli) {
			var item = cli.state;
			var name = item.name;
			if(name)
				options[name] = item;
		});
		return options;
	},
	set options(options) {
		var optionsArr = [];
		for(var name in options)
			optionsArr.push(options[name]);
		optionsArr.sort(function(a, b) {
			return a.name > b.name ? 1 : -1; // Note: always not equal!
		});
		this.list.textContent = "";
		optionsArr.forEach(this.appendItem, this);
	},
	get list() {
		delete this.list;
		return this.list = this.$("cl-list");
	},
	get items() {
		return this.list.children;
	},
	get selectedItems() {
		var rlb = this.list;
		var selectedItems = rlb.selectedItems || rlb.selectedItem && [rlb.selectedItem] || [];
		return selectedItems.filter(function(cli) {
			return cli.parentNode && !cli.collapsed;
		});
	},
	get visibleItems() {
		return this.items.filter(function(cli) {
			return !cli.collapsed;
		});
	},
	get enabledInSelection() {
		var selectedItems = this.selectedItems;
		if(!selectedItems.length)
			return undefined;
		var hasEnabled = false;
		var allEnabled = true;
		selectedItems.some(function(cli) {
			if(cli.enabled)
				hasEnabled = true;
			else
				allEnabled = false;
			return hasEnabled && !allEnabled;
		});
		return allEnabled ? 1 : hasEnabled ? -1 : 0;
	},
	focusItem: function(cli) {
		cli.focusItem();
		this.list.selectedItem = cli;
		this.list.ensureElementIsVisible(cli);
	},
	get filter() {
		delete this.filter;
		return this.filter = this.$("cl-filter");
	},
	getItemsByName: function(name) {
		return this.items.filter(function(cli) {
			return cli.name == name;
		});
	},
	appendItem: function(state) {
		var cli = document.createElement("richlistitem");
		cli.className = "cl-list-item";
		this.list.appendChild(cli);
		if(state) {
			cli.state = state;
			this.timer(function() { // Pseudo async
				var name = state.name;
				this.logFileExists(name, function(exists) {
					cli.canOpen = exists;
					cli.isOldChanges = !(name in consoleLogger._changedInSession);
				});
			}, this);
		}
		return cli;
	},
	getUniqueName: function(baseName) {
		var options = this.options;
		for(var n = 1; ; ++n) {
			var name = baseName
				? n == 1 ? baseName : baseName + "#" + n
				: "Extension" + n;
			if(!(name in options))
				break;
		}
		return name;
	},
	validateFields: function() {
		var hasInvalid = false;
		var names = ["name", "source", "message", "exclude"];
		function validateName(name) {
			return name ? "" : strings.emptyName;
		}
		function validatePattern(pattern) {
			try {
				new RegExp(pattern);
				return "";
			}
			catch(e) {
				return "" + e;
			}
		}
		this.items.forEach(function(cli) {
			names.forEach(function(name) {
				var validator = name == "name" ? validateName : validatePattern;
				if(cli.validateItem(name, validator))
					return;
				if(!hasInvalid) {
					this.list.ensureElementIsVisible(cli);
					cli.focusItem(name);
				}
				hasInvalid = true;
			}, this);
		}, this);
		return !hasInvalid;
	},
	validateFieldsAsync: function() {
		this.timer(this.validateFields, this);
	},

	exportHeader: "// Console Logger options\n",
	exportedFields: ["enabled", "source", "message", "exclude"],
	requiredFields: ["source", "message"],
	get clipboard() {
		return this.parseOptions(this.readFromClipboard());
	},
	set clipboard(options) {
		this.copyString(this.stringifyOptions(options));
	},
	parseOptions: function(data) {
		data = data.replace(/^\s*\/\/[^\n\r]+[\n\r]+/, "");
		if(data && data.charAt(0) == "{") try {
			var options = JSON.parse(data);
			return this.validateOptions(options);
		}
		catch(e) {
		}
		return null;
	},
	stringifyOptions: function(options) {
		this.cleanupOptions(options);
		var data = JSON.stringify(options, null, "\t");
		return consoleLogger.fixBr(this.exportHeader + data);
	},
	validateOptions: function(options) {
		if(!options || typeof options != "object")
			return null;
		for(var name in options) {
			var item = options[name];
			if(!item || typeof item != "object")
				return null;
			// Forward compatibility: check only for required fields and ignore not yet known properties
			// (will be ignored in consoleLoggerItem.state setter)
			if(
				!this.requiredFields.every(function(p) {
					return p in item;
				})
			)
				return null;
		}
		return options;
	},
	cleanupOptions: function(options) {
		for(var name in options) {
			var item = options[name];
			for(var p in item)
				if(this.exportedFields.indexOf(p) == -1)
					delete item[p];
		}
		return options;
	},
	exportOptions: function(all) {
		var options = { __proto__: null };
		var items = all
			? this.items
			: this.selectedItems;
		items.forEach(function(cli) {
			var item = cli.state;
			options[item.name] = item; // Note: exported all items, even without name
		});
		return options;
	},
	importOptions: function(options, override) {
		if(!options)
			return;
		var cliFirst;
		var overrided = false;
		for(var name in options) {
			if(override && !overrided) {
				overrided = true;
				// Remove all
				this.list.textContent = "";
				// And restore not imported items from default branch
				var defaultOptions = consoleLogger.defaultOptions;
				for(var name2 in defaultOptions)
					if(!(name2 in options))
						this.appendItem(defaultOptions[name2]);
			}
			var item = options[name];
			item.name = this.getUniqueName(name);
			var cli = this.appendItem(item);
			if(!cliFirst)
				cliFirst = cli;
		}
		if(!override && cliFirst) {
			this.list.ensureElementIsVisible(cli);
			this.focusItem(cliFirst);
			if("selectItemRange" in this.list)
				this.list.selectItemRange(cliFirst, cli);
		}
		this.checkUnsaved();
		this.updateFilter();
	},
	readFromClipboard: function() {
		// Based on readFromClipboard() function from
		// chrome://browser/content/browser.js in Firefox 30
		var str = "";
		try {
			var cb = Services.clipboard;
			var trans = Components.classes["@mozilla.org/widget/transferable;1"]
				.createInstance(Components.interfaces.nsITransferable);
			if("init" in trans) try {
				trans.init(
					window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
						.getInterface(Components.interfaces.nsIWebNavigation)
						.QueryInterface(Components.interfaces.nsILoadContext)
				);
			}
			catch(e2) {
				Components.utils.reportError(e2);
			}
			trans.addDataFlavor("text/unicode");
			cb.getData(trans, cb.kGlobalClipboard);
			var data = {};
			var dataLen = {};
			trans.getTransferData("text/unicode", data, dataLen);
			if(data) {
				data = data.value.QueryInterface(Components.interfaces.nsISupportsString);
				str = data.data.substring(0, dataLen.value/2);
			}
		}
		catch(e) {
		}
		return str;
	},
	copyString: function(str) {
		Components.classes["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Components.interfaces.nsIClipboardHelper)
			.copyString(str, document);
	},
	fp: Components.interfaces.nsIFilePicker,
	pickOptionsFile: function(mode, callback, context, name) {
		var fp = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(Components.interfaces.nsIFilePicker);
		var modeSave = mode == fp.modeSave;
		var fileName = "consoleLogger";
		if(modeSave) {
			fileName += name
				? "_" + consoleLogger.safeFileName(name)
					.replace(/\s/g, "_")
				: "_options";
			fileName += new Date().toLocaleFormat("_%Y-%m-%d_%H-%M");
		}
		fp.defaultString = fileName + ".json";
		fp.defaultExtension = "json";
		fp.appendFilter(strings.optionsFiles, "consoleLogger*.json");
		fp.appendFilter(strings.jsonFiles, "*.json");
		fp.appendFilters(fp.filterAll);
		var exportDir = this.exportDir;
		if(exportDir)
			fp.displayDirectory = exportDir;
		var title = modeSave ? strings.exportTitle : strings.importTitle;
		fp.init(window, title, mode);
		var _this = this;
		function done(result) {
			if(result != fp.returnCancel) {
				_this.exportDir = fp.file.parent;
				callback.call(context, fp.file);
			}
		}
		if("open" in fp)
			fp.open({ done: done });
		else
			done(fp.show());
	},
	readFromFile: function(file, callback, context) {
		if(platformVersion < 20) {
			try {
				var data = "";
				var fiStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
					.createInstance(Components.interfaces.nsIFileInputStream);
				var ciStream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
					.createInstance(Components.interfaces.nsIConverterInputStream);
				fiStream.init(file, -1, 0, 0);
				ciStream.init(fiStream, "UTF-8", 0, 0);
				for(var read, str = {}; read = ciStream.readString(0xffffffff, str); )
					data += str.value;
				ciStream.close(); // this closes fiStream
				callback.call(context, data);
			}
			catch(e) {
				this.onError(e);
			}
			return;
		}
		OS.File.read(file.path).then(
			function onSuccess(arr) {
				var decoder = new TextDecoder();
				var data = decoder.decode(arr);
				callback.call(context, data);
			},
			this.onError
		).then(null, this.onError);
	},
	get exportDir() {
		var path = prefs.get("options.exportDirectory");
		var file = path && this.getRelativeFile(path);
		return file && file.isDirectory() && file;
	},
	set exportDir(dir) {
		var savedDir = this.exportDir;
		if(savedDir && dir.equals(savedDir))
			return; // May be manually changed to use some custom alias, don't override!
		var path = dir.path;
		var curDrv = this.getRelativeFile("%cl_ProfDrv%").path;
		if(path.substr(0, curDrv.length) == curDrv)
			path = "%cl_ProfDrv%" + path.substr(curDrv.length);
		prefs.set("options.exportDirectory", path);
	},
	writeToFile: function(file, data) {
		if(platformVersion < 20) {
			try {
				var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
					.createInstance(Components.interfaces.nsIFileOutputStream);
				foStream.init(
					file,
					0x02 | 0x08 | 0x20,
					0x02 /*PR_WRONLY*/ | 0x08 /*PR_CREATE_FILE*/ | 0x20 /*PR_TRUNCATE*/,
					parseInt("0644", 8),
					0
				);
				var coStream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
					.createInstance(Components.interfaces.nsIConverterOutputStream);
				coStream.init(foStream, "UTF-8", 0, 0);
				coStream.writeString(data);
				coStream.close(); // this closes foStream
			}
			catch(e) {
				this.onError(e);
			}
			return;
		}
		var encoder = new TextEncoder();
		var arr = encoder.encode(data);
		var options = { tmpPath: file.path + ".tmp" };
		OS.File.writeAtomic(file.path, arr, options)
			.then(null, this.onError)
			.then(null, this.onError);
	},
	onError: function(error) {
		Components.utils.reportError(error);
		if(error && !error.fileName && !error.filename && !error.lineNumber) {
			// Looks like useless error-like object, will try to report something more useful
			var caller = Components.stack.caller;
			var scriptErr = Components.classes["@mozilla.org/scripterror;1"]
				.createInstance(Components.interfaces.nsIScriptError);
			scriptErr.init(
				consoleLoggerGlobal.LOG_PREFIX + (error.message || error),
				error.fileName || error.filename || caller.filename,
				null,
				error.lineNumber || error.lineno || caller.lineNumber,
				error.columnNumber || 0,
				scriptErr.errorFlag,
				null
			);
			Services.console.logMessage(scriptErr);
		}
		Services.prompt.alert(window, strings.errorTitle, error);
	},

	getLogFile: function(name) {
		if(!name)
			return null;
		var file = consoleLogger.getFile(name);
		if(!file.exists())
			return null;
		return file;
	},
	openLogFile: function(name) {
		var file = this.getLogFile(name);
		if(!file)
			return;
		var viewerFile = this.getRelativeFile(prefs.get("options.logViewer"));
		if(viewerFile) try {
			var args = prefs.get("options.logViewerArgs", "")
				.replace(/%F/g, file.path)
				.split(/[\r\n]+/);
			var process = Components.classes["@mozilla.org/process/util;1"]
				.createInstance(Components.interfaces.nsIProcess);
			process.init(viewerFile);
			var run  = process.runw || process.run;
			run.call(process, false, args, args.length);
			return;
		}
		catch(e) {
			Components.utils.reportError(e);
		}
		if("nsILocalFile" in Components.interfaces)
			file instanceof Components.interfaces.nsILocalFile;
		file.launch();
	},
	logFileExists: function(name, callback, context) {
		var file = consoleLogger.getFile(name);
		if(platformVersion < 19) {
			callback.call(context, file.exists());
			return;
		}
		OS.File.exists(file.path).then(
			function onSuccess(exists) {
				callback.call(context, exists);
			},
			this.onError
		);
	},
	get env() {
		delete this.env;
		return this.env = Components.classes["@mozilla.org/process/environment;1"]
			.getService(Components.interfaces.nsIEnvironment);
	},
	getRelativeFile: function(path) {
		if(!path)
			return null;
		var _this = this;
		var absPath = path.replace(/%([^%]+)%/g, function(s, alias) {
			if(alias == "cl_ProfDrv")
				return _this.getFileRoot(Services.dirsvc.get("ProfD", Components.interfaces.nsIFile)).path;
			try {
				return Services.dirsvc.get(alias, Components.interfaces.nsIFile).path;
			}
			catch(e) {
			}
			if(_this.env.exists(alias))
				return _this.env.get(alias);
			return s;
		});
		var file = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile || Components.interfaces.nsIFile);
		try {
			file.initWithPath(absPath);
			if(file.exists())
				return file;
			throw new Error("Log viewer not found:\n" + path + "\n=> " + absPath);
		}
		catch(e) {
			Components.utils.reportError(e);
		}
		return null;
	},
	getFileRoot: function(file) {
		var root;
		try {
			for(var tmp = file; tmp = tmp.parent; )
				root = tmp;
		}
		catch(e) {
			// Firefox 1.5 and 2.0 says:
			// Component returned failure code: 0x80520001 (NS_ERROR_FILE_UNRECOGNIZED_PATH) [nsIFile.parent]
			// for root directories
		}
		return root;
	},

	_savedOptions: null,
	get optionsHash() {
		return JSON.stringify(this.options);
	},
	get baseTitle() {
		delete this.baseTitle;
		return this.baseTitle = document.title;
	},
	_modified: false,
	get modified() {
		return this._modified;
	},
	set modified(modified) {
		if(modified == this._modified)
			return;
		this._modified = modified;
		this.applyBtn.disabled = !modified;
		document.title = (modified ? "* " : "") + this.baseTitle;
	},
	markAsSaved: function() {
		this._savedOptions = this.optionsHash;
		this.modified = false;
	},
	_checkUnsavedTimer: 0,
	checkUnsaved: function() {
		clearTimeout(this._checkUnsavedTimer);
		this._checkUnsavedTimer = this.timer(this._checkUnsaved, this, 15);
	},
	_checkUnsaved: function() {
		this.modified = this.optionsHash != this._savedOptions
			|| consoleLogger.enabled != this.enabled;
	},

	updateControls: function() {
		var selectedItems = this.selectedItems;
		var hasLocked = selectedItems.some(function(cli) {
			return cli.locked
				&& !this.getItemsByName(cli.name).some(function(cli) {
					return selectedItems.indexOf(cli) == -1;
				});
		}, this);
		var cantReset = selectedItems.length == 0;
		var cantRemove = cantReset || hasLocked;
		var isEmpty = !this.list.hasChildNodes();
		this.$("cl-deck-reset").selectedIndex = hasLocked ? 1 : 0;
		this.$("cl-btn-remove").disabled = cantRemove;
		this.$("cl-btn-reset").disabled = cantReset;
		this.filter.disabled = isEmpty;
		this.$("cl-filterLabel").disabled = isEmpty;
		this.timer(function() {
			var miRemove = this.$("cl-mi-remove");
			var miReset = this.$("cl-mi-reset");
			miRemove.setAttribute("disabled", cantRemove);
			miReset.setAttribute("disabled", cantReset);
			miRemove.setAttribute("hidden", hasLocked);
			miReset.setAttribute("hidden", !hasLocked);
			this.$("cl-mi-copy").setAttribute("disabled", cantReset);
			this.$("cl-mi-opts-copy").setAttribute("disabled", cantReset);
			this.$("cl-mi-opts-copyAll").setAttribute("disabled", isEmpty);
			this.$("cl-mi-opts-export").setAttribute("disabled", cantReset);
			this.$("cl-mi-opts-exportAll").setAttribute("disabled", isEmpty);
		}, this);
	},
	updateContextMenu: function() {
		var cantPaste = !this.clipboard;
		this.$("cl-mi-paste").setAttribute("disabled", cantPaste);
		this.$("cl-mi-opts-paste").setAttribute("disabled", cantPaste);
		this.$("cl-mi-opts-pasteOvr").setAttribute("disabled", cantPaste);
		this.$("cl-mi-opts-compact").setAttribute("checked", this.list.hasAttribute("cl_compact"));
		this.$("cl-mi-opts-singleButtonsBar").setAttribute("checked", prefs.get("options.singleButtonsBar"));
		this.$("cl-mi-opts-openInTab").setAttribute("checked", prefs.get("options.openInTab"));
		var cantSelectAll = !this.visibleItems.some(function(cli) {
			return !cli.hasAttribute("selected");
		});
		this.$("cl-mi-selectAll").setAttribute("disabled", cantSelectAll);
		var toggler = this.$("cl-mi-toggle");
		var hasEnabled = this.enabledInSelection;
		if(hasEnabled)
			toggler.setAttribute("checked", "true");
		else
			toggler.removeAttribute("checked");
		if(hasEnabled == -1)
			toggler.setAttribute("cl_intermediate", "true");
		else
			toggler.removeAttribute("cl_intermediate");
		toggler.setAttribute("disabled", hasEnabled === undefined);
		var logFileExists = this.selectedItems.some(function(cli) {
			var hasLogFile = !!this.getLogFile(cli.name);
			setTimeout(function() { // User may remove *.log file manually...
				if(cli.canOpen != hasLogFile)
					cli.canOpen = hasLogFile;
			}, 0);
			return hasLogFile;
		}, this);
		this.$("cl-mi-open").setAttribute("disabled", !logFileExists);
		this.$("cl-mi-clear").setAttribute("disabled", !logFileExists);
	},
	get enabled() {
		return this.$("cl-enabled").checked;
	},
	set enabled(enabled) {
		this.$("cl-enabled").checked = enabled;
		if(enabled)
			document.documentElement.removeAttribute("cl_disabled");
		else
			document.documentElement.setAttribute("cl_disabled", "true");
	},
	setCompactMode: function(compact) {
		if(compact === undefined)
			compact = prefs.get("options.compact");
		else
			prefs.set("options.compact", compact);
		if(compact)
			this.list.setAttribute("cl_compact", "true");
		else
			this.list.removeAttribute("cl_compact");
	},
	toggleCompactMode: function() {
		this.setCompactMode(!prefs.get("options.compact"));
	},
	get isWindow() {
		delete this.isWindow;
		return this.isWindow = window instanceof Components.interfaces.nsIDOMChromeWindow;
	},
	setOpenInTab: function(inTab) {
		var alreadyHere = inTab != this.isWindow;
		if(!alreadyHere && this.modified) {
			var ps = Services.prompt;
			var btn = ps.confirmEx(
				window,
				this.baseTitle,
				strings.saveChanges,
				ps.BUTTON_POS_0 * ps.BUTTON_TITLE_SAVE
					+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
					+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_DONT_SAVE,
				"", "", "", null, {}
			);
			if(btn == 1)
				return;
			if(btn == 0)
				this.save();
		}
		prefs.set("options.openInTab", inTab);
		if(alreadyHere)
			return;
		consoleLogger.openOptions();
		window.close();
	},

	load: function() {
		this.options = consoleLogger.options;
		this.enabled = consoleLogger.enabled;
		this.markAsSaved();
		this.updateControls();
		this.updateFilter();
		this.validateFieldsAsync();
	},
	save: function(sync) {
		if(!this.validateFields())
			return false;
		consoleLogger.options = this.options;
		consoleLogger.enabled = this.enabled;
		this.markAsSaved();
		var prefs = Services.prefs; // Will be removed from window!
		delay(function() {
			prefs.savePrefFile(null);
		});
		return true;
	},
	add: function() {
		var cli = this.appendItem({
			name: this.getUniqueName(),
			enabled: true
		});
		this.focusItem(cli);
		this.checkUnsaved();
		this.updateFilter();
	},
	reset: function() {
		var defaultOptions = consoleLogger.defaultOptions;
		var moveSelection = true;
		var origItems = Array.slice(this.items);
		this.selectedItems.forEach(function(cli) {
			var name = cli.name;
			if(
				name in defaultOptions
				&& this.getItemsByName(name).length <= 1
			)
				cli.state = defaultOptions[name], moveSelection = false;
			else
				cli.parentNode.removeChild(cli);
		}, this);
		if(moveSelection) {
			// Select nearest not removed item
			var newSelectedItem, nearestItem, foundRemoved;
			for(var i = origItems.length - 1; i >= 0; --i) {
				var cli = origItems[i];
				if(!cli.parentNode) {
					foundRemoved = true;
					if(nearestItem) {
						newSelectedItem = nearestItem;
						break;
					}
				}
				else if(!foundRemoved || !nearestItem) {
					nearestItem = cli;
				}
			}
			this.list.selectedItem = newSelectedItem || this.list.lastChild;
		}
		this.checkUnsaved();
		this.updateControls();
		this.updateFilter();
	},
	toggle: function() {
		var enable = this.enabledInSelection < 1;
		this.selectedItems.forEach(function(cli) {
			cli.enabled = enable;
		});
	},
	open: function(cli) {
		var items = cli ? [cli] : this.selectedItems;
		items.forEach(function(cli) {
			this.openLogFile(cli.name);
			cli.markAsRead();
		}, this);
	},
	clear: function() {
		var confirmed = false;
		this.selectedItems.every(function(cli) {
			var file = this.getLogFile(cli.name);
			if(!file)
				return true;
			if(!confirmed) {
				confirmed = Services.prompt.confirm(window, strings.selfName, strings.removeLogs);
				if(!confirmed)
					return false;
			}
			try {
				file.remove(false);
				cli.canOpen = false;
			}
			catch(e) {
				this.onError(e);
			}
			return true;
		}, this);
	},
	copy: function(all) {
		this.clipboard = this.exportOptions(all);
	},
	paste: function(override) {
		this.importOptions(this.clipboard, override);
	},
	exportToFile: function(all) {
		var options = this.exportOptions(all);
		var count = 0;
		for(var singleName in options) {
			if(++count > 1) {
				singleName = "";
				break;
			}
		}
		this.pickOptionsFile(this.fp.modeSave, function(file) {
			var data = this.stringifyOptions(options);
			this.writeToFile(file, data);
		}, this, singleName || all && "all_options");
	},
	importFromFile: function(override) {
		this.pickOptionsFile(this.fp.modeOpen, function(file) {
			this.readFromFile(file, function(data) {
				var options = this.parseOptions(data);
				this.importOptions(options, override);
			}, this);
		}, this);
	},
	setFilter: function(filter) {
		filter = filter
			.replace(/^\s+|\s+$/g, "")
			.toLowerCase();
		var tokens = filter.split(/\s+/);
		var matcher = filter && tokens.length && function(s) {
			s = s.toLowerCase();
			return !tokens.some(function(token) {
				return s.indexOf(token) == -1;
			});
		};
		var found = false;
		this.items.forEach(function(cli) {
			var matched = cli.setFilter(matcher);
			cli.collapsed = !matched && matcher;
			if(matched)
				found = true;
		});
		if(!found && matcher)
			this.filter.setAttribute("cl-notFound", "true");
		else
			this.filter.removeAttribute("cl-notFound");
	},
	_notifyFilterTimer: 0,
	updateFilter: function(notifyTimes) {
		var filterBox = this.filter;
		var filter = filterBox.value;
		if(!filter)
			return;
		this.setFilter(filter);
		if(notifyTimes === undefined)
			notifyTimes = 3;
		var _this = this;
		if(notifyTimes) (function blink() {
			clearTimeout(_this._notifyFilterTimer);
			filterBox.setAttribute("cl_highlight", "true");
			_this._notifyFilterTimer = setTimeout(function() {
				filterBox.removeAttribute("cl_highlight");
				if(--notifyTimes)
					_this._notifyFilterTimer = setTimeout(blink, 100);
			}, 150);
		})();
	}
};