var consoleLoggerIO = {
	cl: consoleLogger,

	writeStringMessage: function(msg, key) {
		var timestamp = this.getTimestamp(msg);
		this.writeToFile(
			this.getFile(key),
			timestamp + " [message]" + ":\n"
			+ msg.message
			+ "\n\n"
		);
		this.notifyUpdatedLog(key);
	},
	writeMessage: function(msg, key) {
		if("nsIScriptError2" in Components.interfaces)
			msg instanceof Components.interfaces.nsIScriptError2;
		var timestamp = this.getTimestamp(msg);
		var details = [msg.category || "unknown"];
		var flags = msg.flags;
		var flagConsts = ["warning", "exception", "strict"];
		flagConsts.forEach(function(flag) {
			if(flags & msg[flag + "Flag"])
				details.push(flag);
		});
		var line = ":" + msg.lineNumber + (msg.columnNumber ? ":" + msg.columnNumber : "");
		this.writeToFile(
			this.getFile(key),
			timestamp + " [" + details.join(", ") + "]" + ":\n"
			+ msg.sourceName + line + "\n"
			+ msg.errorMessage
			+ (msg.sourceLine ? "\n" + msg.sourceLine : "")
			+ "\n\n"
		);
		this.notifyUpdatedLog(key);
	},
	writeObjectMessage: function(msg, msgText, key) {
		var timestamp = this.getTimestamp(msg);
		var line = ":" + msg.lineNumber + (msg.columnNumber ? ":" + msg.columnNumber : "");
		this.writeToFile(
			this.getFile(key),
			timestamp + " [Console.jsm, " + (msg.level || "unknown") + "]" + ":\n"
			+ msg.filename + line + "\n"
			+ msgText
			+ "\n\n"
		);
		this.notifyUpdatedLog(key);
	},
	writeDebugMessage: function(msg) {
		this.writeToFile(
			this.getFile(FILE_NAME_DEBUG, FILE_NAME_DEBUG),
			this.getTimestamp() + " " + msg + "\n"
		);
	},
	notifyUpdatedLog: function(key) {
		this.cl._changedInSession[key] = true;
		delay(function() {
			Services.obs.notifyObservers(null, "consoleLogger-logUpdated", key);
		});
	},
	getTimestamp: function(msg) {
		var d = msg && msg.timeStamp
			? new Date(msg.timeStamp)
			: new Date();
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
	getFile: function(key, name) {
		var files = this._files;
		if(key in files)
			return files[key];
		var file = Services.dirsvc.get("ProfD", Components.interfaces.nsIFile);
		file.append(name || FILE_NAME_PREFIX + this.safeFileName(key) + ".log");
		return files[key] = file;
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
				var encoder = _this.textEncoder || (
					_this.textEncoder = new (Components.utils.getGlobalForObject(OS)).TextEncoder()
				);
				var arr = encoder.encode(_this.fixBr(data));
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

	getErrorName: function(code) {
		var Cr = Components.results;
		for(var errName in Cr)
			if(Cr[errName] == code)
				return errName;
		return "" + code;
	}
};