"use strict";

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var QC;
(function (QC) {

    var setup = false;

    QC.LOCATIONS = {
        LEFT: "left",
        RIGHT: "right",
        TOP: "top",
        BOTTOM: "bottom",
        FULL: "full"
    };

    QC.config = {
        overrideNativeCalls: true,
        location: QC.LOCATIONS.LEFT,
        maxMessageCount: 50,
        maxConsoleHistory: 40
    };

    QC.init = function (options, keyhandler) {
        //TODO: something here with registering the keyhandler.
        QC.config.location = options.location || QC.config.location;
        QC.overrideNativeCalls = options.overrideNativeCalls || QC.config.overrideNativeCalls;
        if (!setup) {
            var st = QC.DI.load("setup");
            st.registerKeyHandler(keyhandler);
            setup = true;
        }
    };
})(QC || (QC = {}));
var quickConsole = QC;

var QC;
(function (QC) {
    "use strict";

    function DI() {
        this.statics = [];
        this.buildable = [];
        this.registered = [];
    }

    DI.prototype.register = function (name, func, dependencies) {
        this.buildable[name] = {
            name: name,
            func: func,
            dependencies: dependencies || []
        };
        this.registered.push(this.buildable[name]);
    };

    DI.prototype.registerStatic = function (name, staticVar) {
        this.statics[name] = staticVar;
    };

    DI.prototype.load = function (name) {
        var loaded = this.statics[name];
        if (!loaded) {
            loaded = this.build(name);
            this.statics[name] = loaded;
        }
        return loaded;
    };

    DI.prototype.build = function (name) {
        var _this = this;

        var obj = this.buildable[name];
        if (!obj) {
            throw new Error("'" + name + "'  has not been registered!");
        }
        var dependencies = [];
        if (obj.dependencies && obj.dependencies.length) {
            obj.dependencies.forEach(function (depName) {
                var dep = _this.load(depName);
                dependencies.push(dep);
            });
        }
        //  FROM: http://stackoverflow.com/a/28244500  cr
        return new (obj.func.bind.apply(obj.func, [null].concat(dependencies)))();
    };

    DI.prototype.getDependencyMap = function () {
        var _this2 = this;

        return this.registered.map(function (build) {
            var deps = _this2.getDependencies(build.dependencies, [build.name], 2);
            return build.name + ":" + "\n" + deps;
        }).join("\n");
    };

    DI.prototype.getDependencies = function (deps, referencers, insetDepth) {
        var _this3 = this;

        if ((!deps || !deps.length) && insetDepth === 2) {
            return Array(insetDepth).join("--") + "No Dependencies \n";
        }
        return deps.map(function (dep) {
            if (referencers.indexOf(dep) > -1) {
                return Array(insetDepth).join("--") + "Recursive depency on: " + dep + "\n";
            }
            var ancestors = referencers.slice(0);
            ancestors.push(dep);
            return Array(insetDepth).join("--") + dep + "\n" + _this3.getDependencies(_this3.buildable[dep].dependencies, ancestors, insetDepth + 1);
        }).join("");
    };

    // instantiating directly since it is needed to build everything else.
    QC.DI = new DI();
})(QC || (QC = {}));

var QC;
(function (QC) {
    "use strict";

    function Execute(log) {
        this.clearFunctionsOptions = ["clear();", "clear()", "Clear();", "Clear()"];
        this.log = log;
        this.executor = this.executeEval;
    }

    Execute.prototype.eval = function (evalString) {
        if (this.requestingClear(evalString)) {
            this.log.clear();
            return;
        }
        this.executor(evalString);
    };

    Execute.prototype.requestingClear = function (evalString) {
        return this.clearFunctionsOptions.indexOf(evalString) > -1;
    };

    Execute.prototype.executeEval = function (evalString) {
        var response;
        try {
            response = eval(evalString);
        } catch (error) {
            if (error.message && error.message.indexOf("Refused to evaluate a string as JavaScript because 'unsafe-eval'") > -1) {
                this.log.write("log", "Eval is not allowed on this platform, defaulting to simple execution which only allow direct function calls with primitives as params");
                this.executor = this.executeSafe;
                this.executeSafe(evalString);
            }
            this.log.write("error", error.message);
        }
        this.handleExecuteResponse(response);
    };

    Execute.prototype.executeSafe = function (inputValue) {
        var _this4 = this;

        if (inputValue.indexOf("(") > -1) {
            var parts = inputValue.split("(");
            var funcName = parts[0];
            var params = parts && parts.length ? parts[1].split(")")[0].split(",") : [];
            params = params.map(function (val) {
                return _this4.parseParam(val);
            }).filter(function (val) {
                return !!val;
            });
            this.executeFunction(funcName, params);
        } else {
            this.logObject(inputValue);
        }
    };

    Execute.prototype.parseParam = function (val) {
        if (!val || !val.length) {
            return null;
        }
        if (this.isNumber(val)) {

            return val.indexOf(".") > -1 ? parseFloat(val) : parseInt(val);
        } else {
            return this.sanitizeString(val);
        }
    };

    Execute.prototype.isNumber = function (str) {
        return !isNaN(parseFloat(str)) && isFinite(str);
    };

    Execute.prototype.sanitizeString = function (str) {
        if (!str.length) {
            return str;
        }
        str = str.trim();
        if (str[0] === "\"" || str[0] === "'") {
            return this.sanitizeString(str.substr(1));
        }
        if (str[str.length - 1] === "\"" || str[str.length - 1] === "'") {
            return this.sanitizeString(str.slice(0, -1));
        }
        return str;
    };

    Execute.prototype.executeFunction = function (funcName, params) {
        var func = window;
        var context = window;
        var functionName = "window";
        funcName.split(".").forEach(function (name) {
            if (!func[name]) {
                console.error(name + " does not exist on object: " + functionName);
                return;
            }
            context = func;
            functionName += "." + name;
            func = func[name];
        });
        var response = func.apply(context, params);
        this.handleExecuteResponse(response);
    };

    Execute.prototype.logObject = function (objName) {
        var context = window;
        var tmpName = "window";
        objName.split(".").forEach(function (name) {
            if (!context[name]) {
                console.error(name + " does not exist on object: " + tmpName);
                return;
            }
            tmpName += "." + name;
            context = context[name];
        });
        this.handleExecuteResponse(context);
    };

    Execute.prototype.handleExecuteResponse = function (response) {
        var _this5 = this;

        if (!response) {
            return;
        }
        // check to see if it is a promise
        if (response.then) {
            response.then(function (returnVal) {
                _this5.log.write("log", returnVal);
            });
            return;
        }
        this.log.write("log", response);
    };

    QC.DI.register("execute", Execute, ["log"]);
})(QC || (QC = {}));

var QC;
(function (QC) {
    "use strict";

    function Format() {
        this.spacer = String.fromCharCode(32);
    }

    Format.prototype.message = function (msg, viewHtml) {
        if (typeof msg === "string") {
            return msg;
        } else if (this.isElement(msg)) {
            return this.formatElement(msg, viewHtml);
        } else {
            return this.formatJSON(msg);
        }
    };

    Format.prototype.formatElement = function (msg, removeChars) {
        var _this6 = this;

        var prefix = "Element: Html" + String.fromCharCode(13) + Array(25).join("-");
        var offset = 0;
        var html = msg.outerHTML;
        if (removeChars) {
            html = html.replace(removeChars, "<quick-console>[...]</quick-console>");
        }
        return prefix + html.replace(/(?:\r\n|\r|\n)/g, "#").replace(/>/g, ">#").replace(/</g, "#<").replace(/##/g, "#").split("#").map(function (val) {
            val = val.trim();
            if (val[1] && val[1] === "/" && offset > 2) {
                offset = offset - 2;
                return _this6.getSpacer(offset) + val;
            } else if (val[0] && val[0] === "<" && val[1] !== "i") {
                var tempOffset = offset;
                offset = offset + 2;
                return _this6.getSpacer(tempOffset) + val;
            } else {
                return _this6.getSpacer(offset) + val;
            }
        }).join(String.fromCharCode(13));
    };

    Format.prototype.getSpacer = function (num) {
        return Array(num * 2).join(this.spacer);
    };

    Format.prototype.isElement = function (obj) {
        return typeof obj.outerHTML !== "undefined";
    };

    Format.prototype.formatJSON = function (msg) {
        try {
            return JSON.stringify(msg, null, 4);
        } catch (error) {
            return "Failed to serialize object";
        }
    };

    QC.DI.register("format", Format);
})(QC || (QC = {}));
var QC;
(function (QC) {
    "use strict";

    function History(storage) {
        this.storage = storage;
        this.consoleList = [];
        this.consoleIndex = 0;
        this.maxConsoleHistory = 40;
        this.loadSavedConsoleHistory();
    }

    History.prototype.loadSavedConsoleHistory = function () {
        var found = this.storage.retrieve("consoleHistory");
        if (found) {
            this.consoleList = JSON.parse(found);
            this.consoleIndex = this.consoleList.length - 1;
        }
    };

    History.prototype.saveLast = function (value) {
        // don't save empty values.
        if (!value || value === "") {
            return;
        }

        //  Was last command, no need to save again.
        if (this.consoleList[this.consoleList.length - 1] === value) {
            return;
        }

        if (this.consoleList.length >= QC.config.maxConsoleHistory) {
            this.consoleList.shift();
        }
        this.consoleList.push(value);
        this.consoleIndex = this.consoleList.length - 1;
        this.storage.store("consoleHistory", JSON.stringify(this.consoleList));
    };

    History.prototype.loadLast = function () {
        if (!this.consoleList.length) {
            // no history, just return.
            return "";
        }
        var returnObj = this.consoleList[this.consoleIndex];
        if (this.consoleList.length > this.consoleIndex) {
            this.consoleIndex += 1;
        }
        return returnObj || "";
    };

    History.prototype.loadNext = function () {
        if (!this.consoleList.length) {
            // no history, just return.
            return "";
        }
        var returnObj = this.consoleList[this.consoleIndex];
        this.consoleIndex = this.consoleIndex > 0 ? this.consoleIndex - 1 : 0;
        return returnObj || "";
    };

    QC.DI.register("history", History, ["storage"]);
})(QC || (QC = {}));

var QC;
(function (QC) {

    function InputHandler(execute, history, suggest) {
        this.execute = execute;
        this.history = history;
        this.suggest = suggest;
    }

    InputHandler.prototype.updateInputText = function (keyEvent, input, completionHint) {
        // loading when needed to make sure we don't have recursive dependencies.
        if (QC.DI.load("setup").checkForConsoleToggle(keyEvent)) {
            return;
        }
        switch (keyEvent.key) {
            case "Enter":
                this.handleReturnKey(input);
                break;
            case "ArrowDown":
                input.value = this.history.loadLast();
                break;
            case "ArrowUp":
                input.value = this.history.loadNext();
                break;
            case "Tab":
                this.handleTabCompletion(keyEvent, input);
                break;
            case "z":
                if (!keyEvent.ctrlKey) {
                    return;
                }
                input.value = this.lastValue;
                break;
            default:
                this.updateSuggestionsAfterTimeout(input, completionHint);
                return;
        }
        this.moveCursorToEnd(input, completionHint);
    };

    InputHandler.prototype.handleReturnKey = function (input) {
        this.history.saveLast(input.value);
        try {
            this.execute.eval(input.value);
        } catch (error) {
            // error already logged elsewhere just catching it here so we can continue execution.
        }
        input.value = "";
    };

    InputHandler.prototype.handleTabCompletion = function (keyEvent, input) {
        this.lastValue = input.value;
        var suggestion = this.suggest.getSuggestion(input.value);
        input.value = suggestion.getAutoCompetion();
        keyEvent.preventDefault();
        input.focus();
    };

    InputHandler.prototype.moveCursorToEnd = function (input, hint) {
        input.focus();
        hint.innerText = "";
        setTimeout(function () {
            input.value = input.value;
        }, 20);
    };

    InputHandler.prototype.updateSuggestionsAfterTimeout = function (input, hint) {
        var _this7 = this;

        clearTimeout(this.suggestionTimeoutId);

        this.suggestionTimeoutId = setTimeout(function () {
            _this7.populateHint(hint, _this7.suggest.getSuggestion(input.value));
        }, 50);
    };

    InputHandler.prototype.populateHint = function (hint, suggestion) {
        if (!suggestion.suggestions) {
            return;
        }
        hint.innerText = suggestion.getAutoCompetion();
    };

    QC.DI.register("inputHandler", InputHandler, ["execute", "history", "suggest"]);
})(QC || (QC = {}));
var QC;
(function (QC) {

    function Log(format, storage) {
        this.format = format;
        this.storage = storage;
        this.logList = [];
    }

    Log.prototype.write = function (logName, msg) {
        var message = logName.toUpperCase() + ": " + this.format.message(msg, this.getView().getViewAsString());
        this.addToLogList(message);
        // loading view when needed so we don't have a recursive dependency
        this.getView().logToScreen(this.logList);
        if (!QC.innerConsole[logName] || QC.config.overrideNativeCalls) {
            return;
        }
        QC.innerConsole[logName](msg);
    };

    Log.prototype.getView = function () {
        if (!this.view) {
            this.view = QC.DI.load("view");
        }
        return this.view;
    };

    Log.prototype.error = function (errorMsg, url, lineNumber, column) {
        this.write("error", ["errorMsg: ", errorMsg, "url: ", url, "lineNumber: ", lineNumber, "column: ", column].join("\n"));
        if (QC.innerConsole.onError) {
            QC.innerConsole.onError(errorMsg, url, lineNumber, column);
        }
    };

    Log.prototype.clear = function () {
        this.storage.store("consoleMsg", JSON.stringify(this.logList));
        if (QC.innerConsole.clear) {
            QC.innerConsole.clear();
        }
        this.logList = [];
        var view = QC.DI.load("view");
        view.logToScreen(this.logList);
    };

    Log.prototype.addToLogList = function (value) {
        if (this.logList.length >= QC.config.maxMessageCount) {
            this.logList.pop();
        }
        this.logList.unshift(value);
    };

    QC.DI.register("log", Log, ["format", "storage"]);
})(QC || (QC = {}));
var QC;
(function (QC) {
    "use strict";

    // view is recursive, we need to solve this

    function Setup(log, view) {
        this.log = log;
        this.view = view;
        QC.init = this.init;
        this.captureNativeConsole();
        this.registered = false;
        this.overrideNativeConsole();
        this.toggleConsoleTimeout;
    }

    Setup.prototype.overrideNativeConsole = function () {
        var _this8 = this;

        console.log = function (msg) {
            return _this8.log.write("log", msg);
        };
        console.error = function (msg) {
            return _this8.log.write("error", msg);
        };
        console.warn = function (msg) {
            return _this8.log.write("warn", msg);
        };
        console.info = function (msg) {
            return _this8.log.write("info", msg);
        };
        console.clear = this.log.clear;
        window.onerror = function (errorMsg, url, lineNumber, column) {
            return _this8.log.error(errorMsg, url, lineNumber, column);
        };
    };

    Setup.prototype.captureNativeConsole = function () {
        QC.innerConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info,
            clear: console.clear,
            onError: window.onerror
        };
    };

    Setup.prototype.registerToggleHandler = function (obj) {
        if (!this.registered) {
            this.registerKeyHandler(window);
            this.registered = true;
        }
        if (!obj) {
            return;
        }
        this.registerKeyHandler(obj);
    };

    Setup.prototype.registerKeyHandler = function (obj) {
        var _this9 = this;

        var elem = obj || window;
        var currentHandler = elem.onkeydown;
        elem.onkeyup = function (e) {
            _this9.checkForConsoleToggle(e);
            if (currentHandler) {
                currentHandler(e);
            }
        };
    };

    Setup.prototype.checkForConsoleToggle = function (e) {
        var _this10 = this;

        // ctrl + alt + shift + d to open console
        if (e.shiftKey && e.altKey && e.ctrlKey && e.keyCode === 68) {
            clearTimeout(this.toggleConsoleTimeout);
            this.toggleConsoleTimeout = setTimeout(function () {
                _this10.view.toggleConsole();
            }, 200);
            return true;
        }
        return false;
    };

    QC.DI.register("setup", Setup, ["log", "view"]);
})(QC || (QC = {}));
var QC;
(function (QC) {
    "use strict";

    function Storage() {}

    Storage.prototype.store = function (key, value) {
        if (!this.useLocalStorage()) {
            return false;
        }
        localStorage.setItem(key, value);
        return true;
    };

    Storage.prototype.retrieve = function (key, defaultValue) {
        if (!this.useLocalStorage()) {
            return defaultValue;
        }
        var foundValue = localStorage.getItem(key);
        if (typeof foundValue === "undefined" && typeof foundValue !== "undefined") {
            return defaultValue;
        }
        return foundValue;
    };

    Storage.prototype.useLocalStorage = function () {
        //TODO: cache value.
        var hasLocalStorage = false;
        try {
            hasLocalStorage = typeof localStorage !== "undefined";
        } catch (error) {
            // no need to catch anything, just use local storage if available.
        }
        return hasLocalStorage;
    };

    QC.DI.register("storage", Storage, []);
})(QC || (QC = {}));
var QC;
(function (QC) {
    "use strict";

    var styles = {
        container: {
            position: "absolute",
            background: "rgba(250, 250, 250, .87)",
            "z-index": 2000,
            overflow: "auto",
            color: "#404040"
        },
        textArea: {
            position: "absolute",
            background: "rgba(250, 250, 250, 0.87)",
            rect: "5px 50px calc(100% - 20px) calc(100% - 60px)"
        },
        input: {
            position: "relative",
            rect: "0 0 calc(100% - 35px) 20px",
            border: "1px solid rgba(90, 90, 90, 0.7);",
            padding: "5px",
            margin: "1%",
            "z-index": 2,
            font: "1em arial",
            outline: "none",
            "background-color": "transparent"
        },
        completionHint: {
            position: "absolute",
            rect: "0 0 80% 20px",
            "z-index": 2,
            color: "rgba(40, 40, 40, 0.7)",
            font: "1em arial",
            "line-height": "20px",
            margin: "1%",
            padding: "6px"
        },
        left: {
            rect: "0 0 50% 100%"
        },
        right: {
            rect: "50% 0 50% 100%"
        },
        top: {
            rect: "0 0 100% 50%"
        },
        bottom: {
            rect: "0 50% 100% 50%"
        },
        full: {
            rect: "0 0 100% 100%"
        }
    };

    QC.DI.registerStatic("style", styles);
})(QC || (QC = {}));

var QC;
(function (QC) {
    "use strict";

    function StyleUtil(style) {
        console.log(style);
        this.style = style;
    }

    StyleUtil.prototype.get = function get(styleKey) {
        console.log(this.toStyle(this.style[styleKey]));
        return this.toStyle(this.style[styleKey]);
    };

    StyleUtil.prototype.set = function set(element, styleKey) {
        element.setAttribute("style", this.get(styleKey));
    };

    StyleUtil.prototype.toStyle = function toStyle(obj) {
        var _this11 = this;

        var keys = Object.keys(obj);
        return keys.map(function (key) {
            return _this11.toStyleRule(key, obj[key]);
        }).join(" ");
    };

    StyleUtil.prototype.toStyleRule = function (name, value) {
        if (name === "rect") {
            console.log(name + " " + value);

            var _getRectStylesAsArray = this.getRectStylesAsArray(value),
                _getRectStylesAsArray2 = _slicedToArray(_getRectStylesAsArray, 4),
                left = _getRectStylesAsArray2[0],
                top = _getRectStylesAsArray2[1],
                width = _getRectStylesAsArray2[2],
                height = _getRectStylesAsArray2[3];

            return this.getRect(left, top, width, height);
        }
        return name + ":" + value + ";";
    };

    StyleUtil.prototype.setContainerStyle = function getContainer(container) {
        this.style.container.rect = this.getConsolePosition();
        container.setAttribute("style", this.toStyle(this.style.container));
    };

    StyleUtil.prototype.getRect = function (left, top, width, height) {
        return [this.toStyleRule("left", left), this.toStyleRule("top", top), this.toStyleRule("width", width), this.toStyleRule("height", height)].join(' ');
    };

    StyleUtil.prototype.getRectStylesAsArray = function getRectStylesAsArray(stylesString) {
        console.log(stylesString);
        var styles = stylesString.split(" ");
        if (styles.length === 4) {
            return styles;
        }
        return styles.reduce(function (agg, next, index) {
            if (agg.last) {
                var last = [agg.last, next].join(" ");
                if (next.indexOf(")") > -1) {
                    agg.finalArray.push(last);
                    agg.last = null;
                } else {
                    agg.last = last;
                }
            } else if (next.indexOf("(") > -1) {
                agg.last = next;
            } else {
                agg.finalArray.push(next);
            }
            return agg;
        }, { finalArray: [] }).finalArray;
    };

    StyleUtil.prototype.getConsolePosition = function () {
        switch (QC.config.location) {
            case QC.LOCATIONS.LEFT:
                return this.style.left;
            case QC.LOCATIONS.RIGHT:
                return this.style.right;
            case QC.LOCATIONS.TOP:
                return this.style.top;
            case QC.LOCATIONS.BOTTOM:
                return this.style.bottom;
            default:
                return this.style.full;
        }
    };

    QC.DI.register("styleUtil", StyleUtil, ["style"]);
})(QC || (QC = {}));

var QC;
(function (QC) {
    "use strict";

    function Suggest() {}

    Suggest.prototype.getSuggestion = function (fullCommand) {
        var suggestion = new QC.Suggestion(fullCommand);
        suggestion.suggestions = this.getSuggestions(suggestion.getLastCommand(), true);
        return suggestion;
    };

    Suggest.prototype.getSuggestions = function (partialCommand, ignoreErrors) {
        var _this12 = this;

        var tmpName = "";
        return partialCommand.split(".").reduce(function (context, name, index, arr) {
            // get suggestions only for last object
            if (arr.length === index + 1) {
                return _this12.getSuggestionsForName(context, name);
            }

            if (!context[name]) {
                if (!ignoreErrors) {
                    console.error(name + " does not exist on object: " + tmpName);
                }
                return null;
            }
            tmpName += tmpName !== "" ? "." + name : name;
            // update context to be the built object.
            return context[name];
        }, window);
    };

    Suggest.prototype.getSuggestionsForName = function (context, name) {
        var options = this.getContextualSuggestions(context);
        var filtered = options.filter(function (option) {
            return option.toUpperCase().indexOf(name.toUpperCase()) === 0;
        });
        return filtered || [name];
    };

    Suggest.prototype.getContextualSuggestions = function (context) {
        var suggestions = [];
        for (var i in context) {
            suggestions.push(i);
        }
        //console.log(suggestions);
        return suggestions;
    };

    QC.DI.register("suggest", Suggest, []);
})(QC || (QC = {}));
var QC;
(function (QC) {
    "use strict";

    function Suggestion(fullCommand) {
        this.fullCommand = fullCommand;
        this.commandsToComplete = this.getLastCommand();
    }

    Suggestion.prototype.getLastCommand = function () {
        if (!this.fullCommand || this.fullCommand === "") {
            return "";
        }
        var commands = this.fullCommand.split(" ");
        return commands.pop();
    };

    Suggestion.prototype.getAutoCompetion = function () {
        var _this13 = this;

        if (!this.suggestions || !this.suggestions.length) {
            return this.fullCommand;
        }
        return this.fullCommand.split(".").map(function (text, index, arr) {
            if (arr.length === index + 1) {
                return _this13.getBestSuggestion() || text;
            }
            return text;
        }).join(".");
    };

    Suggestion.prototype.getBestSuggestion = function () {
        if (!this.suggestions || !this.suggestions.length) {
            return null;
        }
        return this.suggestions.sort(function (a, b) {
            return a.length - b.length;
        })[0];
    };

    QC.Suggestion = Suggestion;
})(QC || (QC = {}));
var QC;
(function (QC) {

    function View(execute, inputHandler, styleUtil) {
        QC.setLocation = this.setLocation;
        this.execute = execute;
        this.inputHandler = inputHandler;
        this.styleUtil = styleUtil;
    }

    View.prototype.addToScreen = function () {
        this.consoleContainer = document.createElement("div");
        this.styleUtil.setContainerStyle(this.consoleContainer);
        document.body.appendChild(this.consoleContainer);
        this.consoleDiv = document.createElement("textarea");
        this.consoleDiv.setAttribute("readonly", "");
        this.styleUtil.set(this.consoleDiv, "textArea");
        this.consoleContainer.appendChild(this.consoleDiv);
        this.addInput();
    };

    View.prototype.addInput = function () {
        var _this14 = this;

        this.addCompletionHint();
        this.input = document.createElement("input");
        this.input.setAttribute("id", "consoleInput");
        this.input.setAttribute("type", "text");
        this.styleUtil.set(this.input, "input");
        this.consoleContainer.appendChild(this.input);
        this.input.onkeydown = function (e) {
            _this14.inputHandler.updateInputText(e, _this14.input, _this14.completionHint);
        };
    };

    View.prototype.addCompletionHint = function () {
        this.completionHint = document.createElement("div");
        this.styleUtil.set(this.completionHint, "completionHint");
        this.consoleContainer.appendChild(this.completionHint);
    };

    View.prototype.setLocation = function (location) {
        QC.config.location = location;
        if (this.consoleContainer) {
            this.styleUtil.setContainerStyle(this.consoleContainer);
        }
    };

    View.prototype.logToScreen = function (logList) {
        if (this.consoleDiv) {
            this.consoleDiv.innerText = logList.join(this.getSeperator());
        }
    };

    View.prototype.getSeperator = function () {
        if (!this.logSeperator) {
            this.logSeperator = String.fromCharCode(13) + Array(50).join("=") + String.fromCharCode(13);
        }
        return this.logSeperator;
    };

    View.prototype.toggleConsole = function () {
        if (this.consoleContainer) {
            this.consoleContainer.remove();
            this.consoleContainer = undefined;
        } else {
            this.addToScreen();
            this.input.focus();
        }
    };

    View.prototype.getViewAsString = function () {
        if (!this.consoleContainer) {
            return "";
        }
        return this.consoleContainer.outerHTML;
    };

    QC.DI.register("view", View, ["execute", "inputHandler", "styleUtil"]);
})(QC || (QC = {}));
