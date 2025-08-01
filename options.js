var consoleLoggerGlobal;
this.__defineGetter__("OS", function() {
	delete this.OS;
	return this.OS = consoleLoggerGlobal.OS;
});
var consoleLoggerOptions = {
	cl: null,
	exports: ["consoleLogger", "Services", "prefs", "delay", "platformVersion"],
	init: function() {
		//Services.obs
		Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService)
			.notifyObservers(window, "consoleLogger-exportScope", "consoleLoggerGlobal");
		this.exports.forEach(function(prop) {
			window[prop] = consoleLoggerGlobal[prop];
		}, this);
		this.cl = consoleLogger;
		if(!("JSON" in window)) {
			var scope = {}; // Note: we can't load directly into content window
			Services.scriptloader.loadSubScript("chrome://consolelogger/content/json.js", scope);
			window.JSON = scope.JSON;
		}
		this.setupUI();
		this.load();
		this.loadFilter();
		Services.obs.addObserver(this, "consoleLogger-logUpdated", false);
		Services.prefs.addObserver(prefs.ns + "options.", this, false);
		if(this.isWindow && prefs.get("options.restoreWindow"))
			this.cl.setSessionState("optionsOpened", true);
	},
	destroy: function() {
		this.saveFilter();
		Services.obs.removeObserver(this, "consoleLogger-logUpdated");
		Services.prefs.removeObserver(prefs.ns + "options.", this);
		if(!this.cl.isShutdown)
			this.cl.setSessionState("optionsOpened", false);
		this.exports.forEach(function(prop) {
			window[prop] = null;
		}, this);
		consoleLoggerGlobal = this.cl = null;
		delete window.OS;
	},
	setupUI: function() {
		this.baseTitle = document.title;

		var root = document.documentElement;
		var applyBtn = this.applyBtn = root.getButton("extra1");
		applyBtn.setAttribute("icon", "apply");
		applyBtn.setAttribute("cl_key", "cl-key-save");
		applyBtn.disabled = true;
		this.updateUIFromPrefs();
		var okBtn = this.okBtn = root.getButton("accept");
		okBtn.setAttribute("cl_key", "cl-key-accept");
		// Insert Apply button between OK and Cancel
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
			this.$("cl-mi-invertSelection").setAttribute("hidden", "true");
			this.list.setAttribute("seltype", "single");
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

		delay(this.setKeysDesc, this);
	},
	updateUIFromPrefs: function() {
		if(!this.cl) // Nothing to update, window was closed
			return;
		this.placeButtonsBar();
		this.setCompactMode();
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
		Array.prototype.forEach.call(
			btnsPanel.getElementsByTagName("button"),
			function(btn) {
				btn.className = singleBar ? "dialog-button" : "";
			}
		);
		if(singleBar) {
			var btnBox = this.applyBtn.parentNode;
			var w = !isStartup && btnBox.boxObject.width;
			btnBox.insertBefore(btnsPanel, btnBox.firstChild);
			for(var spacer = btnsPanel.nextSibling; spacer; spacer = spacer.nextSibling) {
				if(spacer.localName == "spacer") {
					spacer.setAttribute("flex", "1");
					break;
				}
			}
			if(!isStartup) {
				var ovr = btnBox.boxObject.width - w;
				if(ovr > 0)
					window.resizeBy(ovr, 0);
			}
		}
		else {
			var list = this.list;
			list.parentNode.insertBefore(btnsPanel, list.nextSibling);
		}
	},
	loadFilter: function() {
		var fb = this.filter;
		if(fb.value && fb._searchIcons)
			fb._searchIcons.selectedIndex = 1;
	},
	saveFilter: function() {
		var fb = this.filter;
		fb.setAttribute("value", fb.value);
		document.persist(fb.id, "value");
	},
	setKeysDesc: function() {
		var nodes = Array.prototype.concat.call(
			Array.prototype.slice.call(document.getElementsByAttribute("cl_key", "*")),
			Array.prototype.slice.call(this.applyBtn.parentNode.getElementsByAttribute("cl_key", "*"))
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
			Array.prototype.forEach.call(
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
			delay(function() {
				this.getItemsByName(data).forEach(function(cli) {
					cli.markAsUpdated();
				});
			}, this);
		}
		else if(topic == "nsPref:changed") {
			delay(this.updateUIFromPrefs, this); // Wait for observer from bootstrap.js
		}
	},

	$: function(id) {
		return document.getElementById(id)
			|| document.getAnonymousElementByAttribute(document.documentElement, "id", id); // Firefox 65+
	},
	get options() {
		var optionsArr = [];
		this.items.forEach(function(cli) {
			var item = cli.state;
			item.name && optionsArr.push(item);
		});
		var options = { __proto__: null };
		optionsArr.sort(this.sortOptions).forEach(function(item) {
			options[item.name] = item;
		});
		return options;
	},
	set options(options) {
		var optionsArr = [];
		for(var name in options)
			optionsArr.push(options[name]);
		optionsArr.sort(this.sortOptions);
		var list = this.list;
		var reload = list.hasChildNodes();
		var current;
		var selected = reload && this.selectedItems.map(function(cli) {
			if(cli.getAttribute("current") == "true")
				current = cli.name;
			return cli.name;
		});
		this.clearList();
		optionsArr.forEach(function(state) {
			var cli = this.appendItem(state);
			if(!reload || selected.indexOf(state.name) == -1)
				return;
			if("addItemToSelection" in list)
				list.addItemToSelection(cli);
			else
				list.selectedItem = cli;
			if("currentItem" in list && state.name == current)
				list.currentItem = cli;
		}, this);
	},
	sortOptions: function(a, b) {
		return a.name > b.name ? 1 : -1; // Note: always not equal!
	},
	get list() {
		delete this.list;
		return this.list = this.$("cl-list");
	},
	clearList: function() {
		this.list.textContent = "";
	},
	get items() {
		var items = this.list.children;
		if("forEach" in items)
			return items;
		return Array.prototype.slice.call(items); // Firefox 65+
	},
	get selectedItems() {
		var rlb = this.list;
		var selectedItems = rlb.selectedItems || rlb.selectedItem && [rlb.selectedItem] || [];
		var items = this.items;
		// Note: we have NodeList in Firefox 45+
		return Array.prototype.filter.call(selectedItems, function(cli) {
			return cli.parentNode && !cli.collapsed;
		}).sort(function(cli1, cli2) { // Force convert to visible order
			return items.indexOf(cli1) - items.indexOf(cli2);
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
			var name = state.name;
			this.logFileExists(name, function(exists) {
				cli.canOpen = exists;
				cli.isOldChanges = !(name in this.cl._changedInSession);
			}, this);
		}
		return cli;
	},
	getUniqueName: function(baseName) {
		if(!baseName)
			baseName = "Extension";
		var options = this.options;
		for(var n = 1; ; ++n) {
			var name = n == 1 ? baseName : baseName + "#" + n;
			if(!(name in options))
				break;
		}
		return name;
	},
	validateFields: function() {
		var hasInvalid = false;
		var names = ["name", "source", "message", "exclude"];
		var items = this.items;
		function validateName(name) {
			if(!name)
				return strings.emptyName;
			var cnt = 0;
			for(var i = 0, l = items.length; i < l; ++i)
				if(items[i].name == name && ++cnt > 1)
					return strings.nameUsed;
			return "";
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
		items.forEach(function(cli) {
			names.forEach(function(name) {
				var validator = name == "name" ? validateName : validatePattern;
				if(cli.validateItem(name, validator))
					return;
				if(!hasInvalid) {
					hasInvalid = true;
					cli.focusItem(name);
					this.list.ensureElementIsVisible(cli);
				}
			}, this);
		}, this);
		if(hasInvalid) {
			this.applyBtn.setAttribute("cl_error", "true");
			this.okBtn.setAttribute("cl_error", "true");
		}
		else {
			this.applyBtn.removeAttribute("cl_error");
			this.okBtn.removeAttribute("cl_error");
		}
		return !hasInvalid;
	},
	validateFieldsAsync: function() {
		delay(this.validateFields, this);
	},

	exportHeader: "// Console Logger options\n",
	fields: {
		enabled: "boolean",
		source:  "string",
		message: "string",
		exclude: "string",
		__proto__: null
	},
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
		return this.cl.io.fixBr(this.exportHeader + data);
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
			// Check type of each known field
			for(var p in this.fields)
				if(p in item && typeof item[p] != this.fields[p])
					return null;
		}
		return options;
	},
	cleanupOptions: function(options) {
		for(var name in options) {
			var item = options[name];
			for(var p in item)
				if(!(p in this.fields))
					delete item[p];
		}
		return options;
	},
	exportOptions: function(all) {
		var options = { __proto__: null };
		var items = all
			? this.visibleItems
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
				this.clearList();
				// And restore not imported items from default branch
				var defaultOptions = this.cl.defaultOptions;
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
			this.focusItem(cliFirst);
			if("selectItemRange" in this.list)
				this.list.selectItemRange(cliFirst, cli);
		}
		this.checkUnsaved();
		this.updateControls();
		this.updateFilter();
	},
	addForLogFiles: function() {
		var prefix = consoleLoggerGlobal.FILE_NAME_PREFIX;
		var entries = this.cl.io.profileDir.directoryEntries;
		var cliFirst;
		while(entries.hasMoreElements()) {
			var entry = entries.getNext().QueryInterface(Components.interfaces.nsIFile);
			var fName = entry.leafName;
			if(fName.substr(0, prefix.length) != prefix || fName.substr(-4) != ".log")
				continue;
			var name = fName.slice(prefix.length, -4);
			if(this.getItemsByName(name).length)
				continue;
			var cli = this.appendItem({
				name: this.getUniqueName(name)
			});
			if(!cliFirst)
				cliFirst = cli;
		}
		if(!cliFirst)
			return;
		this.focusItem(cliFirst);
		if("selectItemRange" in this.list)
			this.list.selectItemRange(cliFirst, cli);
		this.checkUnsaved();
		this.updateFilter();
	},
	readFromClipboard: function() {
		// Based on readFromClipboard() function from
		// chrome://browser/content/browser.js in Firefox 30
		var str = "";
		try {
			var cb = Services.clipboard
				|| Components.classes["@mozilla.org/widget/clipboard;1"]
					.getService(Components.interfaces.nsIClipboard);
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
			if(("" + e).indexOf("NS_ERROR_FAILURE") == -1)
				Components.utils.reportError(e);
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
			.createInstance(this.fp);
		var modeSave = mode == fp.modeSave;
		var baseName = "consoleLogger";
		var fileName = baseName;
		if(modeSave) {
			fileName += name
				? "_" + this.cl.io.safeFileName(name)
					.replace(/\s/g, "_")
				: "_options";
			var d = new Date();
			if("toISOString" in d) { // Firefox 3.5+
				// toISOString() uses zero UTC offset, trick to use locale offset
				d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
				fileName += "_" + d.toISOString() // Example: 2017-01-02T03:04:05.006Z
					.replace(/:\d+\.\d+Z$/, "")
					.replace("T", "_")
					.replace(":", "-"); // 2017-01-02_03-04
			}
			else {
				fileName += d.toLocaleFormat("_%Y-%m-%d_%H-%M");
			}
		}
		fp.defaultString = fileName + ".json";
		fp.defaultExtension = "json";
		fp.appendFilter(strings.optionsFiles, baseName + "*.json");
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
		prefs.set("options.exportDirectory", this.tryMakeRelativePath(dir.path));
	},
	tryMakeRelativePath: function(path) {
		var curDrv = this.expandAlias("cl_ProfDrv");
		if(path.substr(0, curDrv.length) == curDrv)
			path = "%cl_ProfDrv%" + path.substr(curDrv.length);
		return path;
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
		var file = name && this.cl.io.getFile(name);
		return file && file.exists() ? file : null;
	},
	openLogFile: function(cli) {
		var name = cli.name;
		var file = this.getLogFile(name);
		if(!file) {
			cli.canOpen = false;
			return;
		}
		if(!cli.canOpen)
			cli.canOpen = true;
		var viewer = prefs.get("options.logViewer");
		if(viewer == "viewSource") {
			this.openInViewSource(file);
			return;
		}
		var viewerFile = this.getRelativeFile(viewer);
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
	openInViewSource: function(file) {
		var fileURL = Services.io.newFileURI(file).spec;
		if(platformVersion >= 60 && Services.appinfo.name == "Firefox") {
			// https://bugzilla.mozilla.org/show_bug.cgi?id=1418403
			var brWin = openDialog(
				"chrome://browser/content/browser.xul", "_blank",
				"chrome,menubar=0,toolbar=0,location=1,personalbar=0,status=0,dialog=0,resizable",
				"view-source:" + fileURL
			);
			brWin.addEventListener("load", function onLoad() {
				brWin.removeEventListener("load", onLoad, false);
				var stopTime = Date.now() + 3500;
				brWin.setTimeout(function wait() {
					var sb = brWin.gBrowser.selectedBrowser;
					var isLoading = sb && (
						sb.webProgress && sb.webProgress.isLoadingDocument
						|| sb.currentURI && sb.currentURI.spec == "about:blank"
					);
					if(isLoading && Date.now() < stopTime)
						brWin.setTimeout(wait, 15);
					else
						brWin.goDoCommand("cmd_scrollBottom");
				}, 30);
			}, false);
			return;
		}
		var vsWin = platformVersion >= 42 // Note: ability to specify charset was removed
			? openDialog("chrome://global/content/viewSource.xul", "_blank", "all,dialog=no", {
				URL: fileURL
			})
			: openDialog(
				"chrome://global/content/viewSource.xul", "_blank", "all,dialog=no",
				fileURL, "charset=UTF-8", null, null, true
			);
		vsWin.addEventListener("load", function onLoad() {
			vsWin.removeEventListener("load", onLoad, false);
			if("viewSourceChrome" in vsWin) try {
				var fake = document.createElement("menuitem");
				fake.setAttribute("charset", "UTF-8");
				vsWin.viewSourceChrome.onSetCharacterSet({
					target: fake
				});
			}
			catch(e) {
				Components.utils.reportError(e);
			}
			var stopTime = Date.now() + 1000;
			vsWin.setTimeout(function wait() {
				var cw = vsWin.gBrowser.contentWindow;
				var y = cw.scrollMaxY;
				if(!y && Date.now() < stopTime)
					vsWin.setTimeout(wait, 15);
				else
					cw.scrollTo(0, y);
			}, 15);
		}, false);
	},
	logFileExists: function() {
		delay(this._logFileExists, this, arguments);
	},
	_logFileExists: function(name, callback, context) {
		var file = this.cl.io.getFile(name);
		if(platformVersion < 19) {
			callback.call(context, file.exists());
			return;
		}
		OS.File.exists(file.path).then(
			function onSuccess(exists) {
				callback.call(context, exists);
			},
			this.onError
		).then(null, this.onError);
	},
	getLogFileDate: function() {
		delay(this._getLogFileDate, this, arguments);
	},
	_getLogFileDate: function(name, callback, context) {
		var file = this.cl.io.getFile(name);
		if(platformVersion < 24) {
			callback.call(context, file.exists() && file.lastModifiedTime);
			return;
		}
		OS.File.stat(file.path).then(
			function onSuccess(info) {
				callback.call(context, info.lastModificationDate);
			},
			function onFailure(reason) {
				if(!(reason instanceof OS.File.Error && reason.becauseNoSuchFile))
					this.onError(reason);
			}.bind(this)
		).then(null, this.onError);
	},
	formatDate: function(date) {
		if(!date)
			return "";
		date = new Date(date);
		var dt = Math.round(Math.max(0, Date.now() - date)/1000);
		var days = Math.floor(dt/24/3600);
		dt -= days*24*3600;
		var d = new Date((dt + new Date(dt).getTimezoneOffset()*60)*1000);
		var m = d.getMinutes();
		var ts = d.getHours() + ":" + (m > 9 ? m : "0" + m);
		if(days)
			ts = days + strings.day + " " + ts;
		return strings.dateTipTmpl
			.replace("$ago", ts)
			.replace("$date", date.toLocaleString());
	},
	getRelativeFile: function(path) {
		if(!path)
			return null;
		var absPath = this.expandVariables(path);
		var file = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile || Components.interfaces.nsIFile);
		try {
			file.initWithPath(absPath);
			if(!file.exists())
				throw 0;
			return file;
		}
		catch(e) {
			Components.utils.reportError("Console Logger: log viewer not found:\n" + path + "\n=> " + absPath);
			e && Components.utils.reportError(e);
		}
		return null;
	},
	expandVariables: function(s) {
		var _this = this;
		return s.replace(/%([^%]+)%/g, function(s, alias) {
			return _this.expandAlias(alias) || s;
		});
	},
	get env() {
		delete this.env;
		return this.env = Components.classes["@mozilla.org/process/environment;1"]
			.getService(Components.interfaces.nsIEnvironment);
	},
	expandAlias: function(alias) {
		if(alias == "cl_ProfDrv")
			return this.getFileRoot(this.cl.io.profileDir).path;
		if(Services.dirsvc.has(alias))
			return Services.dirsvc.get(alias, Components.interfaces.nsIFile).path;
		if(this.env.exists(alias))
			return this.env.get(alias);
		return "";
	},
	getFileRoot: function(file) {
		try {
			for(var tmp = file; tmp = tmp.parent; )
				file = tmp;
		}
		catch(e) { // Firefox 1.5 and 2.0 throws for root directories
		}
		return file;
	},

	_savedOptions: null,
	get optionsHash() {
		var options = this.options;
		for(var p in options)
			delete options[p].originalName;
		return JSON.stringify(options);
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
		// Looks like we reverted to (correct) saved state, will re-validate to remove warnings
		if(!modified && this.applyBtn.hasAttribute("cl_error"))
			this.validateFieldsAsync();
	},
	markAsSaved: function() {
		this._savedOptions = this.optionsHash;
		this.modified = false;
	},
	_checkUnsavedTimer: 0,
	checkUnsaved: function() {
		clearTimeout(this._checkUnsavedTimer);
		this._checkUnsavedTimer = setTimeout(function(_this) {
			_this._checkUnsaved();
		}, 15, this);
	},
	_checkUnsaved: function() {
		this.modified = this.optionsHash != this._savedOptions
			|| this.cl.enabled != this.enabled;
	},

	updateControls: function() {
		var selectedItems = this.selectedItems;
		var hasLocked = selectedItems.some(function(cli) {
			return cli.locked
				&& !this.getItemsByName(cli.name).some(function(cli) {
					return selectedItems.indexOf(cli) == -1;
				});
		}, this);
		var cantReset = !selectedItems.length;
		var cantRemove = cantReset || hasLocked;
		var isEmpty = !this.list.hasChildNodes();
		this.$("cl-deck-reset").selectedIndex = hasLocked ? 1 : 0;
		this.$("cl-btn-remove").disabled = cantRemove;
		this.$("cl-btn-reset").disabled = cantReset;
		this.filter.disabled = isEmpty;
		this.$("cl-filterLabel").disabled = isEmpty;
		delay(function() {
			var noVisible = isEmpty || !this.visibleItems.length;
			var miRemove = this.$("cl-mi-remove");
			var miReset = this.$("cl-mi-reset");
			miRemove.setAttribute("disabled", cantRemove);
			miReset.setAttribute("disabled", cantReset);
			miRemove.setAttribute("hidden", hasLocked);
			miReset.setAttribute("hidden", !hasLocked);
			this.$("cl-mi-cut").setAttribute("disabled", cantReset);
			this.$("cl-mi-opts-cut").setAttribute("disabled", cantReset);
			this.$("cl-mi-copy").setAttribute("disabled", cantReset);
			this.$("cl-mi-opts-copy").setAttribute("disabled", cantReset);
			this.$("cl-mi-opts-copyAll").setAttribute("disabled", noVisible);
			this.$("cl-mi-opts-export").setAttribute("disabled", cantReset);
			this.$("cl-mi-opts-exportAll").setAttribute("disabled", noVisible);
			this.$("cl-mi-opts-importOvr").setAttribute("disabled", isEmpty);
		}, this);
	},
	updateContextMenu: function() {
		var cantPaste = !this.clipboard;
		this.$("cl-mi-paste").setAttribute("disabled", cantPaste);
		this.$("cl-mi-opts-paste").setAttribute("disabled", cantPaste);
		this.$("cl-mi-opts-pasteOvr").setAttribute("disabled", cantPaste);
		this.$("cl-mi-opts-compact").setAttribute("checked", this.list.hasAttribute("cl_compact"));
		this.$("cl-mi-opts-singleButtonsBar").setAttribute("checked", prefs.get("options.singleButtonsBar"));
		var openInTab = this.$("cl-mi-opts-openInTab");
		openInTab.setAttribute("checked", prefs.get("options.openInTab"));
		setTimeout(function() {
			openInTab.setAttribute("disabled", !Services.wm.getMostRecentWindow("navigator:browser"));
		}, 0);
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
			var hasLogFile = cli.canOpen; // Take fast check
			this.logFileExists(cli.name, function(exists) { // And take async check for real state
				if(exists == hasLogFile)
					return;
				cli.canOpen = exists;
				this.updateContextMenu(); // Just re-update
			}, this);
			return hasLogFile;
		}, this);
		this.$("cl-mi-open").setAttribute("disabled", !logFileExists);
		this.$("cl-mi-clear").setAttribute("disabled", !logFileExists);
	},
	updateLogViewerMenu: function() {
		var viewer = prefs.get("options.logViewer");
		this.$("cl-mi-opts-logViewer-default").setAttribute("checked", viewer == "");
		this.$("cl-mi-opts-logViewer-viewSource").setAttribute("checked", viewer == "viewSource");
		var useExtApp = viewer && viewer != "viewSource";
		var miExtApp = this.$("cl-mi-opts-logViewer-extApp");
		miExtApp.setAttribute("checked", useExtApp);
		miExtApp.tooltipText = useExtApp ? viewer : "";
	},
	setLogViewer: function(e) {
		var mi = e.target;
		var id = mi.id.replace("cl-mi-opts-logViewer-", "");
		function setViewer(viewer) {
			prefs.set("options.logViewer", viewer);
		}
		if(id == "default")
			setViewer("");
		else if(id == "viewSource")
			setViewer("viewSource");
		else if(id == "extApp") {
			var fp = Components.classes["@mozilla.org/filepicker;1"]
				.createInstance(this.fp);
			fp.appendFilters(fp.filterApps);
			fp.appendFilters(fp.filterAll);
			fp.init(window, strings.viewerChoose, fp.modeOpen);
			var _this = this;
			var done = function(result) {
				if(result != fp.returnCancel)
					setViewer(_this.tryMakeRelativePath(fp.file.path));
			};
			if("open" in fp)
				fp.open({ done: done });
			else
				done(fp.show());
		}
	},
	onListDblClick: function(e) {
		if(e.button != 0)
			return;
		if(e.target == this.list)
			this.add();
		else if(e.target.localName == "richlistitem") {
			var ln = e.originalTarget.localName;
			if(
				ln != "div" && ln != "button" && ln != "checkbox"
				&& prefs.get("options.doubleClickToOpen")
			)
				this.open(e.target);
		}
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
		if(compact && prefs.get("options.compact.clickToSelect"))
			this.list.setAttribute("cl_clickToSelect", "true");
		else
			this.list.removeAttribute("cl_clickToSelect");
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
		this.cl.openOptions();
		window.close();
	},

	load: function() {
		this.options = this.cl.options;
		this.enabled = this.cl.enabled;
		this.markAsSaved();
		this.updateControls();
		this.updateFilter();
		this.validateFieldsAsync();
	},
	save: function(sync) {
		if(!this.validateFields())
			return false;
		this.cl.options = this.options;
		this.cl.enabled = this.enabled;
		this.items.forEach(function(cli) {
			cli.originalName = cli.name;
		});
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
	reset: function(confirmOnlyLogFiles) {
		var selectedItems = this.selectedItems;

		var logFiles = 0;
		var logMark = "*";
		var names = this.cropNames(selectedItems.map(function(cli, i) {
			var name = cli.name;
			var n = (i + 1) + ") ";
			if(!this.getLogFile(name))
				return n + name;
			++logFiles;
			return n + name + " " + logMark;
		}, this));
		var removeLogs = { value: false };
		var hasLocked = this.$("cl-deck-reset").selectedIndex == 1;
		var ask = (hasLocked ? strings.resetConfirm : strings.removeConfirm)
			+ "\n" + names.join("\n")
			+ (logFiles ? "\n" + strings.hasLog.replace("$S", logMark) : "");
		if(
			(logFiles || !confirmOnlyLogFiles)
			&& prefs.get("options.confirmRemoval")
			&& !Services.prompt[logFiles ? "confirmCheck" : "confirm"](
				window, strings.selfName, ask, strings.removeLogsAlso.replace("$S", logFiles), removeLogs
			)
		)
			return;
		if(removeLogs.value)
			this.clear(true);

		var defaultOptions = this.cl.defaultOptions;
		var moveSelection = true;
		var origItems = this.visibleItems;
		selectedItems.forEach(function(cli) {
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
			this.list.selectedItem = newSelectedItem || nearestItem;
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
			this.openLogFile(cli);
			cli.markAsRead();
		}, this);
	},
	clear: function(confirmed) {
		var items = [];
		this.selectedItems.forEach(function(cli) {
			var file = this.getLogFile(cli.name);
			if(file)
				items.push({ cli: cli, file: file });
			else
				cli.canOpen = false;
		}, this);

		if(!items.length)
			return;
		var names = this.cropNames(items.map(function(item, i) {
			return (i + 1) + ") " + item.cli.name;
		}));
		if(!confirmed && !Services.prompt.confirm(window, strings.selfName, strings.removeLogs + "\n" + names.join("\n")))
			return;

		items.forEach(function(item) {
			try {
				item.file.remove(false);
				item.cli.canOpen = false;
			}
			catch(e) {
				this.onError(e);
			}
		}, this);
	},
	cropNames: function(names) {
		var maxNames = 10;
		var count = names.length;
		if(count > maxNames)
			names.splice(maxNames - 2, count - maxNames + 1, "\u2026" /* "..." */);
		return names;
	},
	copy: function(all) {
		this.clipboard = this.exportOptions(all);
	},
	paste: function(override) {
		this.importOptions(this.clipboard, override);
	},
	cut: function() {
		this.copy();
		this.reset(true);
	},
	exportToFile: function(all) {
		var options = this.exportOptions(all);
		var singleName = (function() {
			var count = 0;
			for(var name in options)
				if(++count > 1)
					return "";
			return name.replace(/\s+/g, "_");
		})();
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
		delay(this.updateControls, this);
	},
	_notifyFilterTimer: 0,
	updateFilter: function(notifyTimes) {
		var filterBox = this.filter;
		var filter = filterBox.value;
		if(/^\s*$/.test(filter))
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