#### Console Logger: История изменений

`+` – добавлено<br>
`-` – удалено<br>
`x` – исправлено<br>
`*` – улучшено<br>

##### master/HEAD
##### 0.2.0pre (2014-08-06)
`*` Теперь используется <a href="https://developer.mozilla.org/en-US/docs/JavaScript_OS.File">OS.File</a> API для записи логов с лучшей производительностью (Gecko 27+) (<a href="https://github.com/Infocatcher/Console_Logger/issues/1">#1</a>).<br>
`*` Немного улучшена производительность: теперь уведомления о сообщениях в консоли обрабатываются после небольшой задержки, чтобы не блокировать браузер (<a href="https://github.com/Infocatcher/Console_Logger/issues/2">#2</a>).<br>
`*` Теперь корректно работает, если \*.log файл был удален.<br>
`x` Исправлено отключение \*.message шаблонов.<br>
`+` Добавлена поддержка Firefox 1.5+, Thunderbird 1.5+ и SeaMonkey 2.0+.<br>
`+` Добавлен интерфейс настроек (<a href="https://github.com/Infocatcher/Console_Logger/issues/3">#3</a>).<br>
`+` Добавлена иконка для страницы управления дополнениями (из набора <a href="http://www.fatcow.com/free-icons">Farm-fresh</a>).<br>
`+` Добавлена поддержка сообщений, отправленных через <a href="https://developer.mozilla.org/en-US/docs/Tools/Browser_Console#Messages_from_add-ons">Console.jsm</a> (<a href="https://github.com/Infocatcher/Console_Logger/issues/17">#17</a>).<br>

##### 0.1.0pre2 (2014-01-29)
`x` Исправлена обработка настроек <em>.enabled</em> = <em>false</em>.<br>
`+` Добавлена запись категории ошибки и дополнительных флагов.<br>
`+` Добавлена запись номера столбца (если доступно).<br>
`+` Добавлена возможность также записывать простые сообщения.<br>
`*` Расширение больше не прекращает запись при завершении работы приложения, чтобы обработать почти все возможные сообщения.<br>

##### 0.1.0pre (2013-10-15)
`*` Первая публичная версия.<br>