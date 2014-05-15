// Usage:
// extensions.consoleLogger.patterns.%someName%         - pattern for new RegExp(..., "i"), checks for nsIScriptError.sourceName
// extensions.consoleLogger.patterns.%someName%.enabled - (optional) to disable
// extensions.consoleLogger.patterns.%someName%.message - (optional) pattern for new RegExp(..., ""), checks for nsIConsoleMessage.message
// extensions.consoleLogger.patterns.%someName%.exclude - (optional) exclusions, checks for nsIScriptError.errorMessage
// Output: %browser_profile%/consoleLogger_%someName%.log
pref("extensions.consoleLogger.patterns.Private_Tab", "/privateTab@infocatcher|://privatetab/");
pref("extensions.consoleLogger.patterns.Private_Tab.enabled", true);
pref("extensions.consoleLogger.patterns.Private_Tab.message", /*"^\\[Private Tab\\]"*/ "");
pref("extensions.consoleLogger.patterns.Private_Tab.exclude", "^Only internal code is allowed to set the usePrivateBrowsing attribute");

pref("extensions.consoleLogger.debug", false);