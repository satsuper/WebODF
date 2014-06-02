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
 * @param {!string} inputMemberId
 * @constructor
 */
gui.ListController = function ListController(session, inputMemberId) {
    "use strict";
    var odtDocument = session.getOdtDocument(),
        odfUtils = odf.OdfUtils,
        eventNotifier = new core.EventNotifier([
            gui.ListController.listStylingChanged
        ]),
        /**@type{!gui.ListStyleSummary}*/
        lastSignalledSelectionInfo,
        /**@type{!core.LazyProperty.<!gui.ListStyleSummary>}*/
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
     * @return {!gui.ListStyleSummary}
     */
    function getSelectionInfo() {
        var cursor = odtDocument.getCursor(inputMemberId),
            cursorNode = cursor && cursor.getNode();

        return new gui.ListStyleSummary(cursorNode, odtDocument.getRootNode(), odtDocument.getFormatting());
    }

    /**
     * @return {undefined}
     */
    function emitSelectionChanges() {
        var hasChanged = true,
            newStyleSummary = cachedSelectionInfo.value();

        if (lastSignalledSelectionInfo) {
            hasChanged = lastSignalledSelectionInfo.isNumberedList !== newStyleSummary.isNumberedList ||
                lastSignalledSelectionInfo.isBulletedList !== newStyleSummary.isBulletedList;
        }

        if (hasChanged) {
            lastSignalledSelectionInfo = newStyleSummary;
            eventNotifier.emit(gui.ListController.listStylingChanged, lastSignalledSelectionInfo);
        }
    }

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

        cachedSelectionInfo = new core.LazyProperty(getSelectionInfo);
    }

    init();
};

/**@const*/
gui.ListController.listStylingChanged = "listStyling/changed";
