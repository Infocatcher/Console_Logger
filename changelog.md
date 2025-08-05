#### Console Logger: Changelog

`+` – added<br>
`-` – deleted<br>
`x` – fixed<br>
`*` – improved<br>

##### master/HEAD
`*` Improved performance: now used separate files with lazy loading (<a href="https://github.com/Infocatcher/Console_Logger/issues/23">#23</a>).<br>
`+` Options window: show last modified date in tooltip for “Log” button.<br>
`*` Options window: improved performance, now used asynchronous functions to update UI.<br>
`x` Fixed compatibility with future Firefox versions: don't use Array generics like `Array.forEach()` (<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1222547">bug 1222547</a>).<br>
`x` Fixed compatibility with future Firefox versions: don't use deprecated `Date.prototype.toLocaleFormat()` (<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=818634">bug 818634</a>).<br>
`+` Options window: added ability to use built-in view source window to open logs (<em>extensions.consoleLogger.options.logViewer</em> = "viewSource" preference).<br>
`+` Options window: rename log file from UI.<br>
`x` Correctly handle Pale Moon version to not hide accidentally options in Add-ons Manager.<br>
`+` Added application version to timestamp string in log file.<br>
`x` Fixed string prefs in Firefox 58+ (<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1414096">bug 1414096</a>).<br>
`x` Added trick to install in Firefox 58+ (don't use <a href="https://forum.mozilla-russia.org/viewtopic.php?pid=748266#p748266">blocklisted em:optionsType</a>; rename options.xul -> optionsWindow.xul, “magic” name causes tracking missed optionsType as <a href="https://developer.mozilla.org/en-US/docs/Archive/Add-ons/Install_Manifests#optionsType">AddonManager.OPTIONS_TYPE_INLINE</a>; use chrome.manifest override to use options.xul).<br>
`x` Fixed TextEncoder() usage in Firefox 57+.<br>
`x` Use SessionStore.jsm instead of nsISessionStore in Firefox 61+ (<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1450559">bug 1450559</a>, <a href="https://forum.mozilla-russia.org/viewtopic.php?pid=756422#p756422">thanks to Dumby</a>).<br>
`x` Added basic replacement for viewSource.xul window in Firefox 60+ (<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1418403">bug 1418403</a>).<br>
`+` Added confirmation to reset/remove action (+ ask to also remove log files, <em>extensions.consoleLogger.options.confirmRemoval</em> preference).<br>
`x` Fixed constants usage across files in Firefox 44+ (<a href="https://blog.mozilla.org/addons/2015/10/14/breaking-changes-let-const-firefox-nightly-44/">Breaking changes in let and const in Firefox Nightly 44</a>, <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1202902">bug 1202902</a>).<br>
`+` Added “Add for not listed log files” menu item.<br>
`x` Correctly detect saved state and also always export sorted options.<br>
`x` Compatibility fixes for Pale Moon 28.1+ and Basilisk (correctly detect relevant platform version).<br>
`x` Fixed single buttons toolbar mode in Firefox 65+: now nodes beside anonymous content becomes anonymous too (not accessible through `document.getElementById()`).<br>
`x` Fixed richlistbox.children usage in Firefox 65+: this is HTMLCollection now, force convert to array.<br>
`+` Options window: added filter restoring.<br>
`*` Options window: improved options reloading, now will be preserved selected items.<br>
`+` Options window: added ability to hide disabled items (to focus view on currently active logs, <em>extensions.consoleLogger.options.showDisabled</em> preference).<br>

##### 0.2.0pre2 (2015-12-14)
`x` Fixed hiding of special window that open options in non-modal window.<br>
`+` Options window: added F11 hotkey to toggle full screen mode.<br>
`x` Fixed options in tab in Firefox 3.0 and older.<br>
`+` Options window: added ability to use single toolbar for all buttons (<a href="https://github.com/Infocatcher/Console_Logger/issues/18">#18</a>).<br>
`+` Options window: save and restore opened state between browser restarts (<a href="https://github.com/Infocatcher/Console_Logger/issues/19">#19</a>).<br>
`+` Options window: show hotkeys in button's tooltips (<a href="https://github.com/Infocatcher/Console_Logger/issues/20">#20</a>).<br>
`+` Options window: added ability to cut selected items (<a href="https://github.com/Infocatcher/Console_Logger/issues/21">#21</a>).<br>
`*` Improved compatibility with multi-process mode (Electrolysis aka e10s) (<a href="https://github.com/Infocatcher/Console_Logger/issues/22">#22</a>).<br>
`+` Options window: added F10 hotkey to maximize/restore window.<br>
`x` Options window: fixed handling of selected items in Firefox 45+.<br>
`*` Options window: improved compact mode: select items only after releasing of left mouse button (<em>extensions.consoleLogger.options.compact.clickToSelect</em> preference).<br>
`x` Options window: prevent saving of two items with the same name.<br>
`*` Options window: “Export All” will export only visible items, if used filter.<br>
`+` Options window: added menu item (and Ctrl+* hotkey) to invert selection.<br>
`*` Options window: small UI enhancements.<br>

##### 0.2.0pre (2014-08-06)
`*` Now used <a href="https://developer.mozilla.org/en-US/docs/JavaScript_OS.File">OS.File</a> API to write logs with better performance (Gecko 27+) (<a href="https://github.com/Infocatcher/Console_Logger/issues/1">#1</a>).<br>
`*` Slightly improved performance: now console notifications are handled after small delay to not hang browser (<a href="https://github.com/Infocatcher/Console_Logger/issues/2">#2</a>).<br>
`*` Now works correctly, if \*.log file was removed.<br>
`x` Correctly disable \*.message patterns.<br>
`+` Added support for Firefox 1.5+, Thunderbird 1.5+ and SeaMonkey 2.0+.<br>
`+` Added GUI for options (<a href="https://github.com/Infocatcher/Console_Logger/issues/3">#3</a>).<br>
`+` Added icon for Add-ons Manager (from <a href="http://www.fatcow.com/free-icons">Farm-fresh</a> icon set).<br>
`+` Added support for <a href="https://developer.mozilla.org/en-US/docs/Tools/Browser_Console#Messages_from_add-ons">Console.jsm</a> messages (<a href="https://github.com/Infocatcher/Console_Logger/issues/17">#17</a>).<br>

##### 0.1.0pre2 (2014-01-29)
`x` Correctly handle <em>.enabled</em> = <em>false</em> preference.<br>
`+` Write error category and additional flags.<br>
`+` Write column number (if available).<br>
`+` Added ability to write also simple messages.<br>
`*` Don't destroy on application shutdown to capture almost all possible messages.<br>

##### 0.1.0pre (2013-10-15)
`*` First public release.<br>