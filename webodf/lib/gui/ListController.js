/**
 * Copyright (C) 2010-2014 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * This file is part of WebODF.
 *
 * WebODF is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License (GNU AGPL)
 * as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.
 *
 * WebODF is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with WebODF.  If not, see <http://www.gnu.org/licenses/>.
 * @licend
 *
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

/*global core, ops, gui, odf, runtime*/

/**
 * @implements {core.Destroyable}
 * @param {!ops.Session} session
 * @param {!gui.SessionConstraints} sessionConstraints
 * @param {!gui.SessionContext} sessionContext
 * @param {!string} inputMemberId
 * @constructor
 */
gui.ListController = function ListController(session, sessionConstraints, sessionContext, inputMemberId) {
    "use strict";
    var odtDocument = session.getOdtDocument(),
        odfUtils = odf.OdfUtils,
        eventNotifier = new core.EventNotifier([
            gui.ListController.listStylingChanged,
            gui.ListController.enabledChanged
        ]),
        /**@type{!gui.ListController.SelectionInfo}*/
        lastSignalledSelectionInfo,
        /**@type{!core.LazyProperty.<!gui.ListController.SelectionInfo>}*/
        cachedSelectionInfo;

    /**
     * @param {!ops.OdtCursor|!string} cursorOrId
     * @return {undefined}
     */
    function onCursorEvent(cursorOrId) {
        var cursorMemberId = (typeof cursorOrId === "string")
            ? cursorOrId : cursorOrId.getMemberId();

        if (cursorMemberId === inputMemberId) {
            cachedSelectionInfo.reset();
        }
    }

    /**
     * @return {undefined}
     */
    function onParagraphStyleModified() {
        // this is reset on paragraph style change due to paragraph styles possibly linking to list styles
        // through the use of the style:list-style-name attribute
        // http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#attribute-style_list-style-name
        cachedSelectionInfo.reset();
    }

    /**
     * @param {!{paragraphElement:Element}} args
     * @return {undefined}
     */
    function onParagraphChanged(args) {
        var cursor = odtDocument.getCursor(inputMemberId),
            p = args.paragraphElement;

        if (cursor && odfUtils.getParagraphElement(cursor.getNode()) === p) {
            cachedSelectionInfo.reset();
        }
    }

    /**
     * @return {!gui.ListController.SelectionInfo}
     */
    function getSelectionInfo() {
        var cursor = odtDocument.getCursor(inputMemberId),
            cursorNode = cursor && cursor.getNode(),
            styleSummary = new gui.ListStyleSummary(cursorNode, odtDocument.getRootNode(), odtDocument.getFormatting()),
            isEnabled = true;

        if (sessionConstraints.getState(gui.CommonConstraints.EDIT.REVIEW_MODE) === true) {
            isEnabled = sessionContext.isLocalCursorWithinOwnAnnotation();
        }

        return new gui.ListController.SelectionInfo(isEnabled, styleSummary);
    }

    /**
     * @return {undefined}
     */
    function emitSelectionChanges() {
        var hasStyleChanged = true,
            hasEnabledChanged = true,
            newSelectionInfo = cachedSelectionInfo.value(),
            lastStyleSummary,
            newStyleSummary;

        if (lastSignalledSelectionInfo) {
            lastStyleSummary = lastSignalledSelectionInfo.styleSummary;
            newStyleSummary = newSelectionInfo.styleSummary;

            hasStyleChanged = lastStyleSummary.isNumberedList !== newStyleSummary.isNumberedList ||
                lastStyleSummary.isBulletedList !== newStyleSummary.isBulletedList;

            hasEnabledChanged = lastSignalledSelectionInfo.isEnabled !== newSelectionInfo.isEnabled;
        }

        lastSignalledSelectionInfo = newSelectionInfo;

        if (hasStyleChanged) {
            eventNotifier.emit(gui.ListController.listStylingChanged, lastSignalledSelectionInfo.styleSummary);
        }

        if (hasEnabledChanged) {
            eventNotifier.emit(gui.ListController.enabledChanged, lastSignalledSelectionInfo.isEnabled);
        }
    }

    /**
     * @return {undefined}
     */
    function forceSelectionInfoRefresh() {
        cachedSelectionInfo.reset();
        emitSelectionChanges();
    }

    /**
     * @return {!boolean}
     */
    this.isEnabled = function () {
        return cachedSelectionInfo.value().isEnabled;
    };

    /**
     * @param {!string} eventid
     * @param {!Function} cb
     * @return {undefined}
     */
    this.subscribe = function (eventid, cb) {
        eventNotifier.subscribe(eventid, cb);
    };

    /**
     * @param {!string} eventid
     * @param {!Function} cb
     * @return {undefined}
     */
    this.unsubscribe = function (eventid, cb) {
        eventNotifier.unsubscribe(eventid, cb);
    };

    /**
     * @param {!function(!Error=)} callback
     * @return {undefined}
     */
    this.destroy = function (callback) {
        odtDocument.unsubscribe(ops.Document.signalCursorAdded, onCursorEvent);
        odtDocument.unsubscribe(ops.Document.signalCursorRemoved, onCursorEvent);
        odtDocument.unsubscribe(ops.Document.signalCursorMoved, onCursorEvent);
        odtDocument.unsubscribe(ops.OdtDocument.signalParagraphChanged, onParagraphChanged);
        odtDocument.unsubscribe(ops.OdtDocument.signalParagraphStyleModified, onParagraphStyleModified);
        odtDocument.unsubscribe(ops.OdtDocument.signalProcessingBatchEnd, emitSelectionChanges);
        sessionConstraints.unsubscribe(gui.CommonConstraints.EDIT.REVIEW_MODE, forceSelectionInfoRefresh);
        callback();
    };

    /**
     * @return {undefined}
     */
    function init() {
        odtDocument.subscribe(ops.Document.signalCursorAdded, onCursorEvent);
        odtDocument.subscribe(ops.Document.signalCursorRemoved, onCursorEvent);
        odtDocument.subscribe(ops.Document.signalCursorMoved, onCursorEvent);
        odtDocument.subscribe(ops.OdtDocument.signalParagraphChanged, onParagraphChanged);
        odtDocument.subscribe(ops.OdtDocument.signalParagraphStyleModified, onParagraphStyleModified);
        odtDocument.subscribe(ops.OdtDocument.signalProcessingBatchEnd, emitSelectionChanges);
        sessionConstraints.subscribe(gui.CommonConstraints.EDIT.REVIEW_MODE, forceSelectionInfoRefresh);

        cachedSelectionInfo = new core.LazyProperty(getSelectionInfo);
    }

    init();
};

/**@const*/
gui.ListController.listStylingChanged = "listStyling/changed";

/**@const*/
gui.ListController.enabledChanged = "enabled/changed";

/**
 * @param {!boolean} isEnabled
 * @param {!gui.ListStyleSummary} styleSummary
 * @constructor
 * @struct
 */
gui.ListController.SelectionInfo = function (isEnabled, styleSummary) {
    "use strict";

    /**
     * Whether the controller is enabled based on the selection
     * @type {!boolean}
     */
    this.isEnabled = isEnabled;

    /**
     * Summary of list style information for the selection
     * @type {!gui.ListStyleSummary}
     */
    this.styleSummary = styleSummary;
};


