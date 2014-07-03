var consoleLoggerGlobal;
var consoleLoggerOptions = {
	exports: ["consoleLogger"],
	init: function() {
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

		//Services.obs
		Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService)
			.notifyObservers(window, "consoleLogger-exportScope", "consoleLoggerGlobal");
		this.exports.forEach(function(prop) {
			window[prop] = consoleLoggerGlobal[prop];
		}, this);
		this.load();
	},
	destroy: function() {
		consoleLoggerGlobal = null;
		this.exports.forEach(function(prop) {
			window[prop] = null;
		}, this);
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

	_savedOptions: null,
	get optionsHash() {
		return this.getOptionsHash(this.options);
	},
	getOptionsHash: function(options) {
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
			return rli.firstChild.getItem("name").disabled;
		});
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
		var options = this.options;
		var n = 0;
		for(;;) {
			var name = "Extension" + ++n;
			if(!(name in options))
				break;
		}
		var rli = this.appendItem({ name: name });
		rli.firstChild.focus();
		this.box.selectedItem = rli;
		this.checkUnsaved();
	},
	reset: function() {
		var selectedItems = this.selectedItems;
		selectedItems.forEach(function(rli) {
			var cli = rli.firstChild;
			consoleLogger.resetOptions(cli.state.name);
		});
		var savedOptions = consoleLogger.options;
		selectedItems.forEach(function(rli) {
			var cli = rli.firstChild;
			var name = cli.state.name;
			if(name in savedOptions)
				cli.state = savedOptions[name];
			else
				rli.parentNode.removeChild(rli);
		});
		this._savedOptions = this.getOptionsHash(savedOptions);
		this.checkUnsaved();
		this.updateControls();
	}
};