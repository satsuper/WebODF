/*jslint bitwise: true*/
/*global Components: true, dump: true, Uint8Array: true, Services: true,
   XPCOMUtils: true*/
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var Cu = Components.utils;

var ODF_CONTENT_TYPE_PREFIX = 'application/vnd.oasis.opendocument.';

Cu["import"]('resource://gre/modules/XPCOMUtils.jsm');
Cu["import"]('resource://gre/modules/Services.jsm');

function log(aMsg) {
    "use strict";
    var msg = 'odfContentHandler.js: ' + (aMsg.join ? aMsg.join('') : aMsg);
    Cc['@mozilla.org/consoleservice;1'].getService(Ci.nsIConsoleService)
                                       .logStringMessage(msg);
    dump(msg + '\n');
}

function fireEventTo(aName, aData, aWindow) {
    "use strict";
    var window = aWindow.wrappedJSObject,
        evt = window.document.createEvent('CustomEvent');
    evt.initCustomEvent('odf' + aName, false, false, aData);
    window.document.dispatchEvent(evt);
}

function loadDocument(aWindow, aDocumentUrl) {
    "use strict";
    var xhr = Cc['@mozilla.org/xmlextras/xmlhttprequest;1']
              .createInstance(Ci.nsIXMLHttpRequest);
    xhr.onprogress = function updateProgress(evt) {
        if (evt.lengthComputable) {
            fireEventTo(evt.type, evt.loaded / evt.total, aWindow);
        }
    };

    xhr.onerror = function error(evt) {
        fireEventTo(evt.type, false, aWindow);
    };

    xhr.onload = function load(evt) {
        var data = (xhr.mozResponseArrayBuffer || xhr.mozResponse ||
                xhr.responseArrayBuffer || xhr.response),
            view,
            window,
            arrayBuffer,
            view2,
            array,
            i;
        try {
            view = new Uint8Array(data);
            window = aWindow.wrappedJSObject;
            arrayBuffer = new window.ArrayBuffer(data.byteLength);
            view2 = new window.Uint8Array(arrayBuffer);
            view2.set(view);
            array = [];
            array.length = view2.byteLength;
            for (i = 0; i < view2.byteLength; i += 1) {
                array[i] = view2[i];
            }
            fireEventTo(evt.type, array, aWindow);
        } catch (e) {
            log('Error - ' + e);
        }
    };

    xhr.open('GET', aDocumentUrl);
    xhr.responseType = 'arraybuffer';
    xhr.send(null);
}

var WebProgressListener = {
    init: function WebProgressListenerInit(aWindow, aUrl) {
        "use strict";
        this.locationHasChanged = false;
        this.documentUrl = aUrl;

        var flags = Ci.nsIWebProgress.NOTIFY_LOCATION |
                Ci.nsIWebProgress.NOTIFY_STATE_NETWORK |
                Ci.nsIWebProgress.NOTIFY_STATE_DOCUMENT,
            docShell = aWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                          .getInterface(Ci.nsIWebNavigation)
                          .QueryInterface(Ci.nsIDocShell),
            webProgress = docShell.QueryInterface(Ci.nsIInterfaceRequestor)
                              .getInterface(Ci.nsIWebProgress);
        try {
            webProgress.removeProgressListener(this);
        } catch (e) {
        }
        webProgress.addProgressListener(this, flags);
    },

    onStateChange: function onStateChange(aWebProgress, aRequest, aStateFlags,
                                        aStatus) {
        "use strict";
        var complete = Ci.nsIWebProgressListener.STATE_IS_WINDOW +
                     Ci.nsIWebProgressListener.STATE_STOP;
        if ((aStateFlags & complete) === complete && this.locationHasChanged) {
            aWebProgress.removeProgressListener(this);
            loadDocument(aWebProgress.DOMWindow, this.documentUrl);
        }
    },

    onProgressChange: function onProgressChange(aWebProgress, aRequest,
                                                aCurSelf, aMaxSelf, aCurTotal,
                                                aMaxTotal) {
        "use strict";
    },

    onLocationChange: function onLocationChange(aWebProgress, aRequest,
                                              aLocationURI) {
        "use strict";
        this.locationHasChanged = true;
    },

    onStatusChange: function onStatusChange(aWebProgress, aRequest, aStatus,
                                          aMessage) {
        "use strict";
    },

    onSecurityChange: function onSecurityChange(aWebProgress, aRequest, aState) {
        "use strict";
    },

    QueryInterface: function QueryInterface(aIID) {
        "use strict";
        if (aIID.equals(Ci.nsIWebProgressListener) ||
                aIID.equals(Ci.nsISupportsWeakReference) ||
                aIID.equals(Ci.nsISupports)) {
            return this;
        }
        throw Components.results.NS_ERROR_NO_INTERFACE;
    }
};

function odfContentHandler() {
    "use strict";
}

odfContentHandler.prototype = {
    handleContent: function handleContent(aMimetype, aContext, aRequest) {
        "use strict";
        if (!(aMimetype.indexOf(ODF_CONTENT_TYPE_PREFIX) === 0 ||
                aMimetype === "application/octet-stream")) {
            throw Cr.NS_ERROR_WONT_HANDLE_CONTENT;
        }

        if (!(aRequest instanceof Ci.nsIChannel)) {
            throw Cr.NS_ERROR_WONT_HANDLE_CONTENT;
        }

        var window = null,
            callbacks = aRequest.notificationCallbacks ||
                    aRequest.loadGroup.notificationCallbacks,
            uri = aRequest.URI,
            url;
        if (!callbacks) {
            return;
        }

        aRequest.cancel(Cr.NS_BINDING_ABORTED);

        window = callbacks.getInterface(Ci.nsIDOMWindow);
        WebProgressListener.init(window, uri.spec);

        try {
            url = Services.prefs.getCharPref('extensions.webodf.js.url');
            url = url.replace('%s', uri.spec);
            window.location = url;
        } catch (e) {
            log('Error retrieving the webodf base url - ' + e);
        }
    },

    classID: Components.ID('{afe5fa21-709d-4916-b51c-56f60d574a0a}'),
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIContentHandler])
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([odfContentHandler]);
