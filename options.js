var consoleLoggerGlobal;
var consoleLoggerOptions = {
	exports: ["consoleLogger", "Services", "prefs"],
	init: function() {
		//Services.obs
		Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService)
			.notifyObservers(window, "consoleLogger-exportScope", "consoleLoggerGlobal");
		this.exports.forEach(function(prop) {
			window[prop] = consoleLoggerGlobal[prop];
		}, this);
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

		this.canExport = "JSON" in window; // Firefox 3.5+
		if(!this.canExport) {
			document.getElementById("cl-bms-beforeCopy").setAttribute("hidden", "true");
			document.getElementById("cl-bmi-copy").setAttribute("hidden", "true");
			document.getElementById("cl-bmi-paste").setAttribute("hidden", "true");
			document.getElementById("cl-ms-beforeCopy").setAttribute("hidden", "true");
			document.getElementById("cl-mi-copy").setAttribute("hidden", "true");
			document.getElementById("cl-mi-paste").setAttribute("hidden", "true");
		}
		if(!("selectAll" in this.box)) { // Only single selection in Firefox 1.5 and 2.0
			document.getElementById("cl-ms-beforeSelectAll").setAttribute("hidden", "true");
			document.getElementById("cl-mi-selectAll").setAttribute("hidden", "true");
		}

		this.setCompactMode();
	},

	get options() {
		var options = { __proto__: null };
		Array.forEach(
			this.box.getElementsByTagName("consoleloggeritem"),
			function(cli) {
				var item = cli.state;
				var name = item.name;
				if(!name)
					return;
				options[name] = item;
			}
		);
		return options;
	},
	set options(options) {
		this.box.textContent = "";
		for(var name in options)
			this.appendItem(options[name]);
	},
	get box() {
		delete this.box;
		return this.box = document.getElementById("cl-richlistbox");
	},
	get selectedItems() {
		var rlb = this.box;
		var selectedItems = rlb.selectedItems || rlb.selectedItem && [rlb.selectedItem];
		return selectedItems.filter(function(elt) {
			return elt.parentNode;
		});
	},
	getItemsByName: function(name) {
		return Array.filter(
			this.box.getElementsByTagName("consoleloggeritem"),
			function(cli) {
				return cli.getItem("name").value == name;
			}
		);
	},
	appendItem: function(state) {
		var rli = document.createElement("richlistitem");
		var cli = document.createElement("consoleloggeritem");
		cli.setAttribute("flex", "1");
		rli.appendChild(cli);
		this.box.appendChild(rli);
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

	exportHeader: "// Console Logger options\n",
	exportedFields: ["enabled", "source", "message", "exclude"],
	get clipboard() {
		var data = this.readFromClipboard()
			.replace(/^\s*\/\/[^\n\r]+[\n\r]+/, "");
		if(data && data.charAt(0) == "{") try {
			var options = JSON.parse(data);
		}
		catch(e) {
		}
		return this.validateOptions(options);
	},
	set clipboard(options) {
		this.cleanupOptions(options);
		var data = JSON.stringify(options, null, "\t");
		this.copyString(this.exportHeader + data);
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
		str = str.replace(/\r\n?|\n/g, Services.appinfo.OS == "WINNT" ? "\r\n" : "\n");
		Components.classes["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Components.interfaces.nsIClipboardHelper)
			.copyString(str, document);
	},

	_savedOptions: null,
	get optionsHash() {
		var options = this.options;
		if(!("JSON" in window)) {
			var data = [];
			for(var name in options) {
				var item = options[name];
				for(var p in item)
					data.push(p + ":" + item[p]);
			}
			return data.join("\n");
		}
		return JSON.stringify(options);
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
		this.applyBtn.disabled = this.optionsHash == this._savedOptions;
	},

	updateControls: function() {
		var selectedItems = this.selectedItems;
		var hasLocked = selectedItems.some(function(rli) {
			var cli = rli.firstChild;
			var nameField = cli.getItem("name");
			return nameField.disabled
				&& !this.getItemsByName(nameField.value).some(function(cli) {
					return selectedItems.indexOf(cli.parentNode) == -1;
				});
		}, this);
		var cantReset = selectedItems.length == 0;
		var cantRemove = cantReset || hasLocked;
		document.getElementById("cl-deck-reset").selectedIndex = hasLocked ? 1 : 0;
		document.getElementById("cl-btn-remove").disabled = cantRemove;
		document.getElementById("cl-btn-reset").disabled = cantReset;
		var miRemove = document.getElementById("cl-mi-remove");
		var miReset = document.getElementById("cl-mi-reset");
		miRemove.setAttribute("disabled", cantRemove);
		miReset.setAttribute("disabled", cantReset);
		miRemove.setAttribute("hidden", hasLocked);
		miReset.setAttribute("hidden", !hasLocked);
		if(this.canExport) {
			document.getElementById("cl-mi-copy").setAttribute("disabled", cantReset);
			document.getElementById("cl-bmi-copy").setAttribute("disabled", cantReset);
		}
	},
	updateContextMenu: function() {
		if(this.canExport) {
			var cantPaste = !this.clipboard;
			document.getElementById("cl-mi-paste").setAttribute("disabled", cantPaste);
			document.getElementById("cl-bmi-paste").setAttribute("disabled", cantPaste);
		}
		document.getElementById("cl-bmi-compact").setAttribute("checked", this.box.hasAttribute("cl_compact"));
		document.getElementById("cl-mi-selectAll").setAttribute("disabled", !this.box.hasChildNodes());
	},
	setCompactMode: function(compact) {
		if(compact === undefined)
			compact = prefs.get("options.compact");
		else
			prefs.set("options.compact", compact);
		if(compact)
			this.box.setAttribute("cl_compact", "true");
		else
			this.box.removeAttribute("cl_compact");
	},

	load: function() {
		this.options = consoleLogger.options;
		this.markAsSaved();
		this.updateControls();
	},
	save: function() {
		consoleLogger.options = this.options;
		this.markAsSaved();
	},
	add: function() {
		var rli = this.appendItem({
			name: this.getUniqueName(),
			enabled: true
		});
		rli.firstChild.focus();
		this.box.selectedItem = rli;
		this.box.ensureElementIsVisible(rli);
		this.checkUnsaved();
	},
	reset: function() {
		var defaultOptions = consoleLogger.defaultOptions;
		var moveSelection = true;
		var origItems = Array.slice(this.box.children);
		this.selectedItems.forEach(function(rli) {
			var cli = rli.firstChild;
			var name = cli.state.name;
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
			this.box.selectedItem = newSelectedItem || this.box.lastChild;
		}
		this.checkUnsaved();
		this.updateControls();
	},
	copy: function() {
		var options = { __proto__: null };
		this.selectedItems.forEach(function(rli) {
			var cli = rli.firstChild;
			var item = cli.state;
			var name = item.name;
			//if(!name)
			//	return;
			options[name] = item;
		});
		this.clipboard = options;
	},
	paste: function() {
		var options = this.clipboard;
		for(var name in options) {
			var item = options[name];
			item.name = this.getUniqueName(name);
			this.appendItem(item);
		}
	}
};