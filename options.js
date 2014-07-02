var consoleLoggerGlobal;
var consoleLoggerOptions = {
	exports: ["consoleLogger"],
	init: function() {
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

	get box() {
		delete this.box;
		return this.box = document.getElementById("cl-richlistbox");
	},
	get selectedItems() {
		var rlb = this.box;
		return rlb.selectedItems || rlb.selectedItem && [rlb.selectedItem];
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

	load: function() {
		this.box.textContent = "";
		var options = consoleLogger.options;
		for(var name in options)
			this.appendItem(options[name]);
	},
	save: function() {
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
		consoleLogger.options = options;
	},
	add: function() {
		this.appendItem();
	},
	remove: function() {
		this.selectedItems.forEach(function(elt) {
			elt.parentNode.removeChild(elt);
		});
	}
};