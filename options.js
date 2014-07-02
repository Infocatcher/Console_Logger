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
		return cli;
	},

	_savedOptions: null,
	get optionsHash() {
		var options = this.options;
		if("JSON" in window)
			return JSON.stringify(options);
		return uneval(options);
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

	disableControls: function() {
		var noSelected = this.selectedItems.length == 0;
		document.getElementById("cl-btn-remove").disabled = noSelected;
		document.getElementById("cl-mi-remove").disabled = noSelected;
	},

	load: function() {
		this.options = consoleLogger.options;
		this.markAsSaved();
		this.disableControls();
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
		this.appendItem({ name: name }).focus();
	},
	remove: function() {
		this.selectedItems.forEach(function(elt) {
			elt.parentNode.removeChild(elt);
		});
		this.disableControls();
	}
};