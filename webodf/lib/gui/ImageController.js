/**
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * (GNU AGPL) as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this code.  If not, see <http://www.gnu.org/licenses/>.
 *
 * As additional permission under GNU AGPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * As a special exception to the AGPL, any HTML file which merely makes function
 * calls to this code, and for that purpose includes it by reference shall be
 * deemed a separate work for copyright law purposes. In addition, the copyright
 * holders of this code give you permission to combine this code with free
 * software libraries that are released under the GNU LGPL. You may copy and
 * distribute such a system following the terms of the GNU AGPL for this code
 * and the LGPL for the libraries. If you modify this code, you may extend this
 * exception to your version of the code, but you are not obligated to do so.
 * If you do not wish to do so, delete this exception statement from your
 * version.
 *
 * This license applies to this entire compilation.
 * @licend
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

/*global runtime, gui, odf, ops */

/**
 * @constructor
 * @param {!ops.Session} session
 * @param {!string} inputMemberId
 * @param {!odf.ObjectNameGenerator} objectNameGenerator
 */
gui.ImageController = function ImageController(session, inputMemberId, objectNameGenerator) {
    "use strict";

    var /**@const@type{!number}*/cmPerPixel = 0.0264583333333334, // since 1px always equals 0.75pt in css2.1
        /**@const
           @type{!Object.<!string, !string>}*/
        fileExtensionByMimetype = {
            "image/gif": ".gif",
            "image/jpeg": ".jpg",
            "image/png": ".png"
        },
        /**@const
           @type{!string}*/
        textns = odf.Namespaces.textns,
        odtDocument = session.getOdtDocument(),
        formatting = odtDocument.getFormatting(),
        /**@type{Object.<string,!{width: number, height: number}>}*/
        paragraphStyleToPageContentSizeMap = {};

    /**
     * @param {!string} name
     * @return {!ops.Operation}
     */
    function createAddGraphicsStyleOp(name) {
        var op = new ops.OpAddStyle();
        op.init({
            memberid: inputMemberId,
            styleName: name,
            styleFamily: 'graphic',
            isAutomaticStyle: false,
            setProperties: {
                "style:graphic-properties": {
                    "text:anchor-type": "paragraph",
                    "svg:x": "0cm",
                    "svg:y": "0cm",
                    "style:wrap": "dynamic",
                    "style:number-wrapped-paragraphs": "no-limit",
                    "style:wrap-contour": "false",
                    "style:vertical-pos": "top",
                    "style:vertical-rel": "paragraph",
                    "style:horizontal-pos": "center",
                    "style:horizontal-rel": "paragraph"
                }
            }
        });
        return op;
    }

    /**
     * @param {!string} styleName
     * @param {!string} parentStyleName
     * @return {!ops.Operation}
     */
    function createAddFrameStyleOp(styleName, parentStyleName) {
        var op = new ops.OpAddStyle();
        op.init({
            memberid: inputMemberId,
            styleName: styleName,
            styleFamily: 'graphic',
            isAutomaticStyle: true,
            setProperties: {
                "style:parent-style-name": parentStyleName,
                // a list of properties would be generated by default when inserting a image in LO.
                // They have no UI impacts in webodf, but copied here in case LO requires them to display image correctly.
                "style:graphic-properties": {
                    "style:vertical-pos": "top",
                    "style:vertical-rel": "baseline",
                    "style:horizontal-pos": "center",
                    "style:horizontal-rel": "paragraph",
                    "fo:background-color": "transparent",
                    "style:background-transparency": "100%",
                    "style:shadow": "none",
                    "style:mirror": "none",
                    "fo:clip": "rect(0cm, 0cm, 0cm, 0cm)",
                    "draw:luminance": "0%",
                    "draw:contrast": "0%",
                    "draw:red": "0%",
                    "draw:green": "0%",
                    "draw:blue": "0%",
                    "draw:gamma": "100%",
                    "draw:color-inversion": "false",
                    "draw:image-opacity": "100%",
                    "draw:color-mode": "standard"
                }
            }
        });
        return op;
    }

    /**
     * @param {!string} mimetype
     * @return {?string}
     */
    function getFileExtension(mimetype) {
        mimetype = mimetype.toLowerCase();
        return fileExtensionByMimetype.hasOwnProperty(mimetype) ? fileExtensionByMimetype[mimetype] : null;
    }

    /**
     * @param {!string} mimetype
     * @param {!string} content base64 encoded string
     * @param {!number} widthInCm
     * @param {!number} heightInCm
     * @return {undefined}
     */
    function insertImageInternal(mimetype, content, widthInCm, heightInCm) {
        var /**@const@type{!string}*/graphicsStyleName = "Graphics",
            stylesElement = odtDocument.getOdfCanvas().odfContainer().rootElement.styles,
            fileExtension = getFileExtension(mimetype),
            fileName,
            graphicsStyleElement,
            frameStyleName,
            op, operations = [];

        runtime.assert(fileExtension !== null, "Image type is not supported: " + mimetype);
        fileName = "Pictures/" + objectNameGenerator.generateImageName() + fileExtension;

        // TODO: eliminate duplicate image
        op = new ops.OpSetBlob();
        op.init({
            memberid: inputMemberId,
            filename: fileName,
            mimetype: mimetype,
            content: content
        });
        operations.push(op);

        // Add the 'Graphics' style if it does not exist in office:styles. It is required by LO to popup the
        // picture option dialog when double clicking the image
        // TODO: in collab mode this can result in unsolvable conflict if two add this style at the same time
        graphicsStyleElement = formatting.getStyleElement(graphicsStyleName, "graphic", [stylesElement]);
        if (!graphicsStyleElement) {
            op = createAddGraphicsStyleOp(graphicsStyleName);
            operations.push(op);
        }

        // TODO: reuse an existing graphic style (if there is one) that has same style as default;
        frameStyleName = objectNameGenerator.generateStyleName();
        op = createAddFrameStyleOp(frameStyleName, graphicsStyleName);
        operations.push(op);

        op = new ops.OpInsertImage();
        op.init({
            memberid: inputMemberId,
            position: odtDocument.getCursorPosition(inputMemberId),
            filename: fileName,
            frameWidth: widthInCm + "cm",
            frameHeight: heightInCm + "cm",
            frameStyleName: frameStyleName,
            frameName: objectNameGenerator.generateFrameName()
        });
        operations.push(op);

        session.enqueue(operations);
    }

    /**
     * @param {!{width: number, height: number}} originalSize
     * @param {!{width: number, height: number}} pageContentSize
     * @return {!{width: number, height: number}}
     */
    function trimmedSize(originalSize, pageContentSize) {
        var widthRatio = 1,
            heightRatio = 1,
            ratio;
        if (originalSize.width > pageContentSize.width) {
            widthRatio = pageContentSize.width / originalSize.width;
        }
        if (originalSize.height > pageContentSize.height) {
            heightRatio = pageContentSize.height / originalSize.height;
        }
        ratio = Math.min(widthRatio, heightRatio);
        return {
            width: originalSize.width * ratio,
            height: originalSize.height * ratio
        };
    }

    /**
     * @param {!string} mimetype
     * @param {!string} content base64 encoded string
     * @param {!number} widthInPx
     * @param {!number} heightInPx
     * @return {undefined}
     */
    this.insertImage = function (mimetype, content, widthInPx, heightInPx) {
        var paragraphElement,
            styleName,
            pageContentSize,
            originalSize,
            newSize;

        runtime.assert(widthInPx > 0 && heightInPx > 0, "Both width and height of the image should be greater than 0px.");

        // TODO: resize the image to fit in a cell if paragraphElement is in a table-cell
        paragraphElement = odtDocument.getParagraphElement(odtDocument.getCursor(inputMemberId).getNode());
        styleName = paragraphElement.getAttributeNS(textns, 'style-name');
        if (!paragraphStyleToPageContentSizeMap.hasOwnProperty(styleName)) {
            paragraphStyleToPageContentSizeMap[styleName] = formatting.getContentSize(styleName, 'paragraph');
        }

        pageContentSize = paragraphStyleToPageContentSizeMap[styleName];
        originalSize = {
            width: widthInPx * cmPerPixel,
            height: heightInPx * cmPerPixel
        };
        newSize = trimmedSize(originalSize, pageContentSize);
        insertImageInternal(mimetype, content, newSize.width, newSize.height);
    };
};
