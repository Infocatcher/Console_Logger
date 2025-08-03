#### Console Logger: История изменений

`+` – добавлено<br>
`-` – удалено<br>
`x` – исправлено<br>
`*` – улучшено<br>

##### master/HEAD
`*` Улучшена производительность: теперь используются отдельные файлы с ленивой загрузкой (<a href="https://github.com/Infocatcher/Console_Logger/issues/23">#23</a>).<br>
`+` Окно настроек: добавлено отображение даты модификации во всплывающей подсказке кнопки «Лог».<br>
`*` Окно настроек: улучшена производительность, теперь используются асинхронные функции для обновления интерфейса.<br>
`x` Исправлена совместимость с будущими версиями Firefox: прекращено использование Array generics вида `Array.forEach()` (<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1222547">bug 1222547</a>).<br>
`x` Исправлена совместимость с будущими версиями Firefox: прекращено использование `Date.prototype.toLocaleFormat()` (<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=818634">bug 818634</a>).<br>
`+` Окно настроек: добавлена возможность использовать встроенное окно просмотра исходного кода для открытия логов (настройка <em>extensions.consoleLogger.options.logViewer</em> = "viewSource").<br>
`+` Окно настроек: реализовано переименование лог-файла из интерфейса.<br>
`x` Исправлена обработка версии Pale Moon и ошибочное скрытие настроек в управлении дополнениями.<br>
`+` Строка времени в лог-файле теперь дополняется версией приложения.<br>
`x` Исправлена работа со строковыми настройками в Firefox 58+ (<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1414096">bug 1414096</a>).<br>
`x` Добавлен хак для установки в Firefox 58+ (убрано использование <a href="https://forum.mozilla-russia.org/viewtopic.php?pid=748266#p748266">запрещенного em:optionsType</a>; переименовано options.xul -> optionsWindow.xul, чтобы специальное имя файла не приводило к трактовке optionsType как <a href="https://developer.mozilla.org/en-US/docs/Archive/Add-ons/Install_Manifests#optionsType">AddonManager.OPTIONS_TYPE_INLINE</a>; через chrome.manifest добавлено переопределение, чтобы работала ссылка на options.xul).<br>
`x` Исправлено использование TextEncoder() в Firefox 57+.<br>
`x` Теперь используется SessionStore.jsm вместо nsISessionStore в Firefox 61+ (<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1450559">bug 1450559</a>, <a href="https://forum.mozilla-russia.org/viewtopic.php?pid=756422#p756422">спасибо</a>).<br>
`x` Добавлена базовая замена для окна viewSource.xul в Firefox 60+ (<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1418403">bug 1418403</a>).<br>
`+` Добавлено подтверждение сброса/удаления настроек (+ предложение удалить лог-файлы, настройка <em>extensions.consoleLogger.options.confirmRemoval</em>).<br>
`x` Исправлено использование констант между файлами в Firefox 44+ (<a href="https://blog.mozilla.org/addons/2015/10/14/breaking-changes-let-const-firefox-nightly-44/">Breaking changes in let and const in Firefox Nightly 44</a>, <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1202902">bug 1202902</a>).<br>
`+` Добавлен пункт меню «Добавить для отсутствующих в списке лог-файлов».<br>
`x` Исправлено определение сохраненного состояния, также теперь всегда экспортируются отсортированные настройки.<br>
`x` Исправления для совместимости с Pale Moon 28.1+ и Basilisk (подкорректировано определение соответствующей версии платформы).<br>
`x` Исправлена единая панель кнопок в Firefox 65+: теперь узлы рядом с анонимными сами становятся анонимными (не могут быть получены через `document.getElementById()`).<br>
`x` Исправлено использование richlistbox.children в Firefox 65+: теперь это HTMLCollection, добавлено принудительное конвертирование в массив.<br>
`+` Окно настроек: добавлено восстановление фильтра.<br>
`*` Окно настроек: улучшена перезагрузка настроек, теперь будут сохраняться выделенные элементы.<br>

##### 0.2.0pre2 (2015-12-14)
`x` Исправлено скрытие специального окна, открывающего настройки в немодальном окне.<br>
`+` Окно настроек: добавлено переключение полноэкранного режима по нажатию F11.<br>
`x` Исправлены настройки во вкладке в Firefox 3.0 и более старых версиях.<br>
`+` Окно настроек: добавлена возможность использовать одну панель для всех кнопок (<a href="https://github.com/Infocatcher/Console_Logger/issues/18">#18</a>).<br>
`+` Окно настроек: добавлено сохранение и восстановление состояния между перезапусками браузера (<a href="https://github.com/Infocatcher/Console_Logger/issues/19">#19</a>).<br>
`+` Окно настроек: добавлено отображение сочетаний клавиш во всплывающих подсказках кнопок (<a href="https://github.com/Infocatcher/Console_Logger/issues/20">#20</a>).<br>
`+` Окно настроек: добавлена возможность вырезания выделенных элементов (<a href="https://github.com/Infocatcher/Console_Logger/issues/21">#21</a>).<br>
`*` Улучшена совместимость с мультипроцессным режимом (Electrolysis aka e10s) (<a href="https://github.com/Infocatcher/Console_Logger/issues/22">#22</a>).<br>
`+` Окно настроек: добавлено разворачивание/восстановление окна по нажатию F10.<br>
`x` Окно настроек: исправлена обработка выбранных элементов в Firefox 45+.<br>
`*` Окно настроек: улучшен компактный режим: элементы выделяются только после отпускания левой кнопки мыши (настройка <em>extensions.consoleLogger.options.compact.clickToSelect</em>).<br>
`x` Окно настроек: добавлено предотвращение сохранения двух элементов с одинаковым именем.<br>
`*` Окно настроек: «Экспортировать всё» экспортирует только выделенные элементы, если используется фильтр.<br>
`+` Окно настроек: добавлен пункт меню (и сочетание клавиш Ctrl+*) для инвертирования выделения.<br>
`*` Окно настроек: небольшие улучшения интерфейса.<br>

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