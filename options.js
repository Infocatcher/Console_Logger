var consoleLoggerGlobal;
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
		if(!("JSON" in window))
			Services.scriptloader.loadSubScript("chrome://consolelogger/content/json.js", window);
		this.setupUI();
		this.load();
	},
	destroy: function() {
		consoleLoggerGlobal = null;
		this.exports.forEach(function(prop) {
			window[prop] = null;
		}, this);
	},
	setupUI: function() {
		var root = document.documentElement;
		var applyBtn = this.applyBtn = root.getButton("extra1");
		applyBtn.setAttribute("icon", "apply");
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

		delay(function() {
			var browserWindow = Services.wm.getMostRecentWindow("navigator:browser");
			if(!browserWindow)
				this.$("cl-mi-opts-openInTab").setAttribute("hidden", "true");
		}, this);
	},

	$: function(id) {
		return document.getElementById(id);
	},
	get options() {
		var options = { __proto__: null };
		Array.forEach(
			this.list.getElementsByTagName("consoleloggeritem"),
			function(cli) {
				var item = cli.state;
				var name = item.name;
				if(name)
					options[name] = item;
			}
		);
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
	get selectedItems() {
		var rlb = this.list;
		var selectedItems = rlb.selectedItems || rlb.selectedItem && [rlb.selectedItem] || [];
		return selectedItems.filter(function(elt) {
			return elt.parentNode;
		});
	},
	get enabledInSelection() {
		var selectedItems = this.selectedItems;
		if(!selectedItems.length)
			return undefined;
		var hasEnabled = false;
		var allEnabled = true;
		selectedItems.some(function(rli) {
			var cli = rli.firstChild;
			if(cli.enabled)
				hasEnabled = true;
			else
				allEnabled = false;
			return hasEnabled && !allEnabled;
		});
		return allEnabled ? 1 : hasEnabled ? -1 : 0;
	},
	get filter() {
		delete this.filter;
		return this.filter = this.$("cl-filter");
	},
	getItemsByName: function(name) {
		return Array.filter(
			this.list.getElementsByTagName("consoleloggeritem"),
			function(cli) {
				return cli.name == name;
			}
		);
	},
	appendItem: function(state) {
		var rli = document.createElement("richlistitem");
		var cli = document.createElement("consoleloggeritem");
		cli.setAttribute("flex", "1");
		rli.appendChild(cli);
		this.list.appendChild(rli);
		if(state)
			cli.state = state;
		return rli;
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
		Array.forEach(
			this.list.getElementsByTagName("consoleloggeritem"),
			function(cli) {
				names.forEach(function(name) {
					var validator = name == "name" ? validateName : validatePattern;
					if(cli.validateItem(name, validator))
						return;
					if(!hasInvalid) {
						this.list.ensureElementIsVisible(cli.parentNode);
						cli.focus(name);
					}
					hasInvalid = true;
				}, this);
			},
			this
		);
		return !hasInvalid;
	},
	validateFieldsAsync: function() {
		setTimeout(function(_this) {
			_this.validateFields();
		}, 0, this);
	},

	exportHeader: "// Console Logger options\n",
	exportedFields: ["enabled", "source", "message", "exclude"],
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
		}
		catch(e) {
		}
		return this.validateOptions(options);
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
			for(var p in item)
				if(this.exportedFields.indexOf(p) == -1)
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
			? this.list.children
			: this.selectedItems;
		items.forEach(function(rli) {
			var cli = rli.firstChild;
			var item = cli.state;
			options[item.name] = item; // Note: exported all items, even without name
		});
		return options;
	},
	importOptions: function(options, override) {
		if(!options)
			return;
		for(var name in options) {
			if(override) {
				override = false;
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
			this.appendItem(item);
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
	pickOptionsFile: function(mode, callback, context) {
		var fp = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(Components.interfaces.nsIFilePicker);
		var modeSave = mode == fp.modeSave;
		var ts = modeSave ? new Date().toLocaleFormat("_%Y-%m-%d_%H-%M") : "";
		fp.defaultString = "console_logger_options" + ts + ".json";
		fp.defaultExtension = "json";
		fp.appendFilter(strings.optionsFiles, "console_logger_options*.json");
		fp.appendFilter(strings.jsonFiles, "*.json");
		fp.appendFilters(fp.filterAll);
		//fp.displayDirectory = this.backupsDir;
		var title = modeSave ? strings.exportTitle : strings.importTitle;
		fp.init(window, title, mode);
		function done(result) {
			if(result != fp.returnCancel)
				callback.call(context, fp.file);
		}
		if("open" in fp)
			fp.open({ done: done });
		else
			done(fp.show());
	},
	readFromFile: function(file, callback, context) {
		if(platformVersion < 20) {
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
			return;
		}
		var OS = Components.utils["import"]("resource://gre/modules/osfile.jsm", {}).OS;
		OS.File.read(file.path).then(
			function onSuccess(arr) {
				var decoder = new TextDecoder();
				var data = decoder.decode(arr);
				callback.call(context, data);
			},
			Components.utils.reportError
		).then(null, Components.utils.reportError);
	},
	writeToFile: function(file, data) {
		if(platformVersion < 20) {
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
			return;
		}
		var OS = Components.utils["import"]("resource://gre/modules/osfile.jsm", {}).OS;
		var encoder = new TextEncoder();
		var arr = encoder.encode(data);
		var options = { tmpPath: file.path + ".tmp" };
		OS.File.writeAtomic(file.path, arr, options)
			.then(null, Components.utils.reportError)
			.then(null, Components.utils.reportError);
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
			.createInstance(Components.interfaces.nsIFile);
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

	_savedOptions: null,
	get optionsHash() {
		return JSON.stringify(this.options);
	},
	markAsSaved: function() {
		this._savedOptions = this.optionsHash;
		this.applyBtn.disabled = true;
	},
	_checkUnsavedTimer: 0,
	checkUnsaved: function() {
		clearTimeout(this._checkUnsavedTimer);
		this._checkUnsavedTimer = setTimeout(function(_this) {
			_this._checkUnsaved();
		}, 15, this);
	},
	_checkUnsaved: function() {
		this.applyBtn.disabled = this.optionsHash == this._savedOptions
			&& consoleLogger.enabled == this.enabled;
	},

	updateControls: function() {
		var selectedItems = this.selectedItems;
		var hasLocked = selectedItems.some(function(rli) {
			var cli = rli.firstChild;
			return cli.locked
				&& !this.getItemsByName(cli.name).some(function(cli) {
					return selectedItems.indexOf(cli.parentNode) == -1;
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
		delay(function() {
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
		this.$("cl-mi-opts-openInTab").setAttribute("checked", prefs.get("options.openInTab"));
		this.$("cl-mi-selectAll").setAttribute("disabled", !this.list.hasChildNodes());
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
		var logFileExists = this.selectedItems.some(function(rli) {
			var cli = rli.firstChild;
			return this.getLogFile(cli.name);
		}, this);
		this.$("cl-mi-open").setAttribute("disabled", !logFileExists);
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
	setOpenInTab: function(inTab) {
		prefs.set("options.openInTab", inTab);
		top.openDialog("chrome://consolelogger/content/optionsOpener.xul", "", "chrome,all,modal");
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
		var rli = this.appendItem({
			name: this.getUniqueName(),
			enabled: true
		});
		rli.firstChild.focus();
		this.list.selectedItem = rli;
		this.list.ensureElementIsVisible(rli);
		this.checkUnsaved();
		this.updateFilter();
	},
	reset: function() {
		var defaultOptions = consoleLogger.defaultOptions;
		var moveSelection = true;
		var origItems = Array.slice(this.list.children);
		this.selectedItems.forEach(function(rli) {
			var cli = rli.firstChild;
			var name = cli.name;
			if(
				name in defaultOptions
				&& this.getItemsByName(name).length <= 1
			)
				cli.state = defaultOptions[name], moveSelection = false;
			else
				rli.parentNode.removeChild(rli);
		}, this);
		if(moveSelection) {
			// Select nearest not removed item
			var newSelectedItem, nearestItem, foundRemoved;
			for(var i = origItems.length - 1; i >= 0; --i) {
				var rli = origItems[i];
				if(!rli.parentNode) {
					foundRemoved = true;
					if(nearestItem) {
						newSelectedItem = nearestItem;
						break;
					}
				}
				else if(!foundRemoved || !nearestItem) {
					nearestItem = rli;
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
		this.selectedItems.forEach(function(rli) {
			var cli = rli.firstChild;
			cli.enabled = enable;
		});
	},
	open: function() {
		this.selectedItems.forEach(function(rli) {
			var cli = rli.firstChild;
			this.openLogFile(cli.name);
		}, this);
	},
	copy: function(all) {
		this.clipboard = this.exportOptions(all);
	},
	paste: function(override) {
		this.importOptions(this.clipboard, override);
	},
	exportToFile: function(all) {
		this.pickOptionsFile(this.fp.modeSave, function(file) {
			var options = this.exportOptions(all);
			var data = this.stringifyOptions(options);
			this.writeToFile(file, data);
		}, this);
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
		Array.forEach(
			this.list.getElementsByTagName("consoleloggeritem"),
			function(cli) {
				if(!cli.setFilter(matcher) && matcher)
					cli.parentNode.setAttribute("collapsed", "true");
				else
					cli.parentNode.removeAttribute("collapsed"), found = true;
			}
		);
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