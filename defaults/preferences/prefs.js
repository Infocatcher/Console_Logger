// Usage:
// extensions.consoleLogger.patterns.%someName%         - (string) pattern for nsIScriptError.sourceName
// extensions.consoleLogger.patterns.%someName%.enabled - (boolean, optional) to disable
// extensions.consoleLogger.patterns.%someName%.message - (string, optional) pattern for nsIConsoleMessage.message
// extensions.consoleLogger.patterns.%someName%.exclude - (string, optional) exclusions, checks for message text (nsIScriptError.errorMessage or nsIConsoleMessage.message)
// Note: we use new RegExp(..., "i") for all patterns
// Output: %browser_profile%/consoleLogger_%someName%.log
pref("extensions.consoleLogger.patterns.Private_Tab", "/privateTab@infocatcher|://privatetab/");
pref("extensions.consoleLogger.patterns.Private_Tab.enabled", true);
pref("extensions.consoleLogger.patterns.Private_Tab.message", /*"^\\[Private Tab\\]"*/ "");
pref("extensions.consoleLogger.patterns.Private_Tab.exclude", "^Only internal code is allowed to set the usePrivateBrowsing attribute");

pref("extensions.consoleLogger.enabled", true);
pref("extensions.consoleLogger.options.openInTab", false);
pref("extensions.consoleLogger.options.compact", false);
pref("extensions.consoleLogger.options.logViewer", ""); // Path to external viewer
// Supported browser (%ProfD%) and environment variables (%ProgramFiles%, %PROFD%)
// See http://mxr.mozilla.org/mozilla-central/source/xpcom/io/nsDirectoryServiceDefs.h
// and http://mxr.mozilla.org/mozilla-central/source/xpcom/io/nsAppDirectoryServiceDefs.h
// Also supported special %cl_ProfDrv% for profile drive (root directory for browser profile)
pref("extensions.consoleLogger.options.logViewerArgs", "%F"); // Command line arguments for external viewer
// %F - path to *.log file
pref("extensions.consoleLogger.options.exportDirectory", "");

pref("extensions.consoleLogger.debug", false);