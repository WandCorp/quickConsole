var QC;
(function(QC) {

    View.STYLE_PREFIX = "qc-";
    function View(styleUtil) {
        QC.setLocation = (location) => this.setLocation(location);
        this.styleUtil = styleUtil;
        this.addCssLink(this.styleUtil.getCssString());
    }

    View.prototype.addCssLink = function(cssAsString) {
        let blob = new Blob([cssAsString], {type: 'text/css'});
        let linkTag = this.getLinkTag();
        linkTag.href = window.URL.createObjectURL(blob);
    };

    View.prototype.getLinkTag = function() {
        var link = document.getElementById("qc-styles");
        if (link) {
            return link;
        }
        return this.createElement({tag: "link", parent: document.head, 
                                    attrs: [{"id": "qc-styles"}, {"rel": "stylesheet"}]})
    };

    View.prototype.addToScreen = function() {
        this.consoleContainer = this.createElement({tag: "div", parent: document.body, 
                classes: ["container", QC.config.location]});

        this.consoleDiv = this.createElement({tag: "textarea", parent: this.consoleContainer, 
                    attrs: [{"readonly": ""}], classes: ["text-area"]});

        this.addInput();
    };
    
    View.prototype.addInput= function() {
        this.addCompletionHint();

        this.input = this.createElement({tag: "input", 
            attrs: [{"id": "consoleInput"}, {"type": "text"}], 
            classes: ["input"], parent: this.consoleContainer});
        this.addInputHandler(this.handler);
    };

    View.prototype.addInputHandler = function(handler) {
        if (this.addedHandler) {
            return;
        }
        if (!this.input) {
            this.handler = handler || this.handler;
            return;
        }
        this.addedHandler = true;
         this.input.onkeydown = (e) =>  {
            handler(e, this.input, this.completionHint);
        };
    }
    
    View.prototype.addCompletionHint = function() {
        this.completionHint = this.createElement({tag:"div", classes: ["completion-hint"], parent: this.consoleContainer});
    };
    
    View.prototype.setLocation = function(location) {
        QC.config.location = location;
        if (this.consoleContainer) {
            this.consoleContainer.className = ["qc-container", location].join(" " + View.STYLE_PREFIX);
        }
    };

    View.prototype.logToScreen = function(logList) {
        if (this.consoleDiv) {
            this.consoleDiv.innerText = logList.join(this.getSeperator());
        }
    };
    
    View.prototype.getSeperator = function() {
        if (!this.logSeperator) {
            this.logSeperator = String.fromCharCode(13) +
                Array(50).join("=") +
                String.fromCharCode(13);
        }
        return this.logSeperator;
    };
    
    View.prototype.toggleConsole = function() {
        console.log("should toggle console");
        if (this.consoleContainer) {
            this.consoleContainer.remove();
            this.consoleContainer = undefined;
        } else {
            this.addToScreen();
            this.input.focus();
        }
    };
    
    View.prototype.getViewAsString = function() {
        if (!this.consoleContainer) {
            return "";
        }
        return this.consoleContainer.outerHTML;  
    };

    View.prototype.createElement = function(elementConfig) {
        var elem = document.createElement(elementConfig.tag);
        if (elementConfig.parent) {
            elementConfig.parent.appendChild(elem);
        }
        if (elementConfig.classes) {
            elem.className = View.STYLE_PREFIX + elementConfig.classes.join(" " + View.STYLE_PREFIX);
        }
        if (elementConfig.attrs) {
            elementConfig.attrs.forEach((attr) => {
                let key = Object.keys(attr)[0];
                elem.setAttribute(key, attr[key]);
            });
        }
        return elem;
    };
    
    QC.DI.register("view", View, ["styleUtil"]);

})(QC || (QC = {}));
