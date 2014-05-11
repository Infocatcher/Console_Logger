#### Console Logger: Changelog

`+` – added<br>
`-` – deleted<br>
`x` – fixed<br>
`*` – improved<br>

##### master/HEAD
`*` Now used <a href="https://developer.mozilla.org/en-US/docs/JavaScript_OS.File">OS.File</a> API to write logs with better performance (Gecko 27+) (<a href="https://github.com/Infocatcher/Console_Logger/issues/1">#1</a>).<br>

##### 0.1.0pre2 (2014-01-29)
`x` Correctly handle <em>.enabled</em> = <em>false</em> preference.<br>
`+` Write error category and additional flags.<br>
`+` Write column number (if available).<br>
`+` Added ability to write also simple messages.<br>
`*` Don't destroy on application shutdown to capture almost all possible messages.<br>

##### 0.1.0pre (2013-10-15)
`*` First public release.<br>