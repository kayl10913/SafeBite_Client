(function () {
	try {
		var host = (typeof location !== 'undefined' && location.hostname) ? location.hostname : '';
		var isLocalhost = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(host);
		var allowConsole = isLocalhost; // allow logs on localhost only

		if (!allowConsole) {
			var noop = function () {};
			var methods = [
				'log', 'info', 'warn', 'error', 'debug', 'trace',
				'group', 'groupCollapsed', 'groupEnd', 'table', 'time', 'timeEnd'
			];
			if (!window.console) window.console = {};
			for (var i = 0; i < methods.length; i++) {
				try { window.console[methods[i]] = noop; } catch (e) {}
			}
		}
	} catch (_) { /* ignore */ }
})();


