This is extension for Gecko-based applications (Firefox, Thunderbird, SeaMonkey), for developers and testers.
<br>Adds ability to write certain console messages to log files, see <a href="defaults/preferences/prefs.js#files">defaults/preferences/prefs.js</a> for details.
<hr>
Also you can use <a href="https://addons.mozilla.org/addon/custom-buttons/">Custom Buttons</a> or something similar to open options from toolbar button.
<br>Code:
```js
var obs = "Services" in window && Services.obs
	|| Components.classes["@mozilla.org/observer-service;1"]
		.getService(Components.interfaces.nsIObserverService);
var scope = {};
scope.wrappedJSObject = scope;
obs.notifyObservers(scope, "consoleLogger-exportScope", null);
scope.consoleLogger.openOptions();
```
Also available `consoleLogger.openOptionsInWindow()` and `consoleLogger.openOptionsInTab()` API to force open options in window or tab.
<br>Icon: `chrome://consolelogger/content/icon16.png`