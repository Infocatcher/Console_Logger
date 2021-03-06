var consoleLoggerIO = {
	cl: consoleLogger,

	writeStringMessage: function(msg, key) {
		this.writeToLogFile(
			key,
			this.getDateInfo(msg) + " [message]" + ":\n"
			+ msg.message
			+ "\n\n"
		);
	},
	writeMessage: function(msg, key) {
		if("nsIScriptError2" in Components.interfaces)
			msg instanceof Components.interfaces.nsIScriptError2;
		var details = [msg.category || "unknown"];
		var flags = msg.flags;
		var flagConsts = ["warning", "exception", "strict"];
		flagConsts.forEach(function(flag) {
			if(flags & msg[flag + "Flag"])
				details.push(flag);
		});
		var line = ":" + msg.lineNumber + (msg.columnNumber ? ":" + msg.columnNumber : "");
		this.writeToLogFile(
			key,
			this.getDateInfo(msg) + " [" + details.join(", ") + "]" + ":\n"
			+ msg.sourceName + line + "\n"
			+ msg.errorMessage
			+ (msg.sourceLine ? "\n" + msg.sourceLine : "")
			+ "\n\n"
		);
	},
	writeObjectMessage: function(msg, msgText, key) {
		var line = ":" + msg.lineNumber + (msg.columnNumber ? ":" + msg.columnNumber : "");
		this.writeToLogFile(
			key,
			this.getDateInfo(msg) + " [Console.jsm, " + (msg.level || "unknown") + "]" + ":\n"
			+ msg.filename + line + "\n"
			+ msgText
			+ "\n\n"
		);
	},
	writeDebugMessage: function(msg) {
		this.writeToFile(this.debugFile, this.getDateInfo() + " " + msg + "\n");
	},
	writeToLogFile: function(key, data) {
		this.writeToFile(this.getFile(key), data);
		this.notifyUpdatedLog(key);
	},
	notifyUpdatedLog: function(key) {
		this.cl._changedInSession[key] = true;
		delay(function() {
			Services.obs.notifyObservers(null, "consoleLogger-logUpdated", key);
		});
	},
	get app() {
		delete this.app;
		return this.app = Services.appinfo.name + " " + Services.appinfo.version;
	},
	getDateInfo: function(msg) {
		return this.getTimestamp(msg) + " " + this.app;
	},
	getTimestamp: function(msg) {
		var d = msg && msg.timeStamp
			? new Date(msg.timeStamp)
			: new Date();
		if("toISOString" in d) { // Firefox 3.5+
			// toISOString() uses zero UTC offset, trick to use locale offset
			d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
			return d.toISOString() // Example: 2017-01-02T03:04:05.006Z
				.replace("T", " ")
				.replace(".", ":")
				.replace("Z", "");
		}
		var ms = d.getMilliseconds();
		return d.toLocaleFormat("%Y-%m-%d %H:%M:%S:") + "000".substr(String(ms).length) + ms;
	},
	get br() {
		delete this.br;
		return this.br = Services.appinfo.OS == "WINNT" ? "\r\n" : "\n";
	},
	fixBr: function(s) {
		return s.replace(/\r\n?|\n/g, this.br);
	},

	_files: { __proto__: null },
	get profileDir() {
		delete this.profileDir;
		return this.profileDir = Services.dirsvc.get("ProfD", Components.interfaces.nsIFile);
	},
	_getFile: function(name) {
		var file = this.profileDir.clone();
		file.append(name);
		return file;
	},
	get debugFile() {
		delete this.debugFile;
		return this.debugFile = this._getFile(FILE_NAME_DEBUG);
	},
	getFile: function(key) {
		var files = this._files;
		if(key in files)
			return files[key];
		return files[key] = this._getFile(FILE_NAME_PREFIX + this.safeFileName(key) + ".log");
	},
	safeFileName: function(s) {
		// From Session Manager extension,
		// https://addons.mozilla.org/files/browse/261680/file/chrome/content/modules/utils.jsm#L130
		return s.replace(/[<>:"\/\\|*?^\x00-\x1F]/g, "_");
	},
	_writeInProgress: false,
	_writeQueue: [],
	writeToFile: function(file, data) {
		if(this._writeInProgress) {
			this._writeQueue.push(arguments);
			return;
		}
		this._writeInProgress = true;

		var _this = this;
		function done(err) {
			err && Components.utils.reportError(LOG_PREFIX + "Can't write to " + file.path + ", error:\n" + err);
			_this._writeInProgress = false;
			var next = _this._writeQueue.shift();
			if(next) delay(function() {
				this.writeToFile.apply(this, next);
			}, _this);
		}

		if(platformVersion < 7) {
			try {
				var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
					.createInstance(Components.interfaces.nsIFileOutputStream);
				foStream.init(
					file,
					0x02 /*PR_WRONLY*/ | 0x08 /*PR_CREATE_FILE*/ | 0x10 /*PR_APPEND*/,
					parseInt("0644", 8),
					0
				);
				var coStream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
					.createInstance(Components.interfaces.nsIConverterOutputStream);
				coStream.init(foStream, "UTF-8", 0, 0);
				coStream.writeString(this.fixBr(data));
				coStream.close(); // this closes foStream
				done();
			}
			catch(e) {
				Components.utils.reportError(e);
				done(e);
			}
			return;
		}
		if(platformVersion < 27) {
			var FileUtils = this.FileUtils || (
				this.FileUtils = Components.utils["import"]("resource://gre/modules/FileUtils.jsm").FileUtils
			);
			var NetUtil = this.NetUtil || (
				this.NetUtil = Components.utils["import"]("resource://gre/modules/NetUtil.jsm").NetUtil
			);
			var ostream = FileUtils.openFileOutputStream(
				file,
				FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE | FileUtils.MODE_APPEND
			);
			var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
				.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
			converter.charset = "UTF-8";
			var istream = converter.convertToInputStream(this.fixBr(data));
			NetUtil.asyncCopy(istream, ostream, function(status) {
				done(!Components.isSuccessCode(status) && "Status: " + _this.getErrorName(status));
			});
			return;
		}

		var onFailure = done;
		OS.File.open(file.path, { write: true, append: true }).then(
			function onSuccess(osFile) {
				var ensureClosed = function(err) {
					osFile.close()
						.then(done, onFailure)
						.then(null, onFailure);
				};
				var arr = textEncoder.encode(_this.fixBr(data));
				osFile.write(arr).then(
					function onSuccess(bytesCount) {
						ensureClosed();
					},
					ensureClosed
				).then(null, ensureClosed);
			},
			onFailure
		).then(null, onFailure);
	},
	renameFileAsync: function(oldKey, newKey) {
		delay(function() {
			this.renameFile(oldKey, newKey);
		}, this);
	},
	renameFile: function(oldKey, newKey) {
		var oldFile = this.getFile(oldKey);
		var newFile = this.getFile(newKey);
		delete this._files[oldKey];
		if(platformVersion < 20) {
			if(oldFile.exists() && !newFile.exists())
				oldFile.renameTo(null, newFile.leafName);
			return;
		}
		OS.File.move(oldFile.path, newFile.path, { noOverwrite: true })
			.then(null, function onFailure(reason) {
				if(!(reason instanceof OS.File.Error && (reason.becauseNoSuchFile || reason.becauseExists)))
					Components.utils.reportError(reason);
			});
	},

	getErrorName: function(code) {
		var Cr = Components.results;
		for(var errName in Cr)
			if(Cr[errName] == code)
				return errName;
		return "" + code;
	}
};