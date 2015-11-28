#### Console Logger: Changelog

`+` – added<br>
`-` – deleted<br>
`x` – fixed<br>
`*` – improved<br>

##### master/HEAD
`x` Fixed hiding of special window that open options in non-modal window.<br>
`+` Options window: added F11 hotkey to toggle full screen mode.<br>
`x` Fixed options in tab in Firefox 3.0 and older.<br>
`+` Options window: added ability to use single toolbar for all buttons (<a href="https://github.com/Infocatcher/Console_Logger/issues/18">#18</a>).<br>
`+` Options window: save and restore opened state between browser restarts (<a href="https://github.com/Infocatcher/Console_Logger/issues/19">#19</a>).<br>
`+` Options window: show hotkeys in button's tooltips (<a href="https://github.com/Infocatcher/Console_Logger/issues/20">#20</a>).<br>
`+` Options window: added ability to cut selected items (<a href="https://github.com/Infocatcher/Console_Logger/issues/21">#21</a>).<br>
`*` Improved compatibility with multi-process mode (Electrolysis aka e10s) (<a href="https://github.com/Infocatcher/Console_Logger/issues/22">#22</a>).<br>
`x` Options window: fixed handling of selected items in Firefox 45+.<br>
`*` Options window: improved compact mode: select items only after releasing of left mouse button (<em>extensions.consoleLogger.options.compact.clickToSelect</em> preference).<br>
`x` Options window: prevent saving of two items with the same name.<br>
`*` Options window: “Export All” will export only visible items, if used filter.<br>

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