// Usage:
// %someName% - "Name" field in GUI.
// extensions.consoleLogger.patterns.%someName%
//   "Source pattern"
//   (string) pattern for source URI (nsIScriptError.sourceName)
// extensions.consoleLogger.patterns.%someName%.enabled
//   "Enabled"
//   (boolean, optional) to disable
// extensions.consoleLogger.patterns.%someName%.message
//   "Message pattern"
//   (string, optional) pattern for simple messages without source URI (nsIConsoleMessage.message)
// extensions.consoleLogger.patterns.%someName%.exclude
//   "Exclude pattern"
//   (string, optional) exclusions, checks for message text (nsIScriptError.errorMessage or nsIConsoleMessage.message)
// Note: used case insensitive regular expressions for all patterns, internally this is new RegExp(..., "i")
// Output: %browser_profile%/consoleLogger_%someName%.log

// Handling of various message types:
// 1) errors and warnings (nsIScriptError)
//    => check source URI for "source" patterns
// 2) simple messages (nsIConsoleMessage), doesn't have source URI
//    => check message text for "message" patterns
// 3) anything from resource://gre/modules/devtools/Console.jsm
//    => check source URI for "source" patterns
// And then check message text for "exclude" patterns

pref("extensions.consoleLogger.enabled", true);
pref("extensions.consoleLogger.options.openInTab", false);
pref("extensions.consoleLogger.options.compact", false);
pref("extensions.consoleLogger.options.compact.clickToSelect", true);
pref("extensions.consoleLogger.options.singleButtonsBar", false);
pref("extensions.consoleLogger.options.restoreWindow", true);
pref("extensions.consoleLogger.options.logViewer", ""); // Path to external viewer
// Supported browser (%ProfD%) and environment variables (%ProgramFiles%, %PROFD%)
// See http://mxr.mozilla.org/mozilla-central/source/xpcom/io/nsDirectoryServiceDefs.h
// and http://mxr.mozilla.org/mozilla-central/source/xpcom/io/nsAppDirectoryServiceDefs.h
// Also supported special %cl_ProfDrv% for profile drive (root directory for browser profile)
pref("extensions.consoleLogger.options.logViewerArgs", "%F"); // Command line arguments for external viewer
// %F - path to *.log file
pref("extensions.consoleLogger.options.exportDirectory", "");

pref("extensions.consoleLogger.debug", false);