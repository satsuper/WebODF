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

/*global runtime, core, gui, odf, ops*/
(function () {
    "use strict";
    var inputMemberId = "Joe";

    /**
     * @param {!ops.OdtDocument} odtDocument
     * @extends {ops.Session} Don't mind me... I'm just lying to closure compiler again!
     * @constructor
     */
    gui.MockSession = function MockSession(odtDocument) {
        var self = this,
            /**@type{!ops.OperationFactory}*/
            operationFactory = new ops.OperationFactory();

        this.operations = [];

        this.getOdtDocument = function () {
            return odtDocument;
        };

        this.enqueue = function (newOps) {
            newOps.forEach(function (op) {
                var /**@type{?ops.Operation}*/
                    timedOp,
                    opspec = op.spec();

                // need to set the timestamp, otherwise things fail in odtDocument
                opspec.timestamp = Date.now();
                timedOp = operationFactory.create(opspec);
                self.operations.push(timedOp);

                if (timedOp.execute(odtDocument)) {
                    odtDocument.emit(ops.OdtDocument.signalOperationEnd, timedOp);
                }
            });
        };

        this.reset = function () {
            self.operations.length = 0;
        };

        function init() {
            var op = new ops.OpAddMember();
            op.init({
                memberid: inputMemberId,
                setProperties: /**@type {!ops.MemberProperties}*/({
                    fullName: "Metha",
                    color: "black",
                    imageUrl: "avatar-joe.png"
                })
            });
            self.enqueue([op]);
            self.reset();
        }

        init();
    };

    /**
     * @param {!HTMLElement} testAreaNode
     * @extends {odf.OdfCanvas} Well.... we don't really, but please shut your face closure compiler :)
     * @constructor
     */
    gui.MockOdfCanvas = function MockOdfCanvas(testAreaNode) {
        var odfContainer = new odf.OdfContainer(odf.OdfContainer.DocumentType.TEXT),
            newCanvas = new odf.OdfCanvas(testAreaNode);

        odfContainer.setRootElement(/**@type{!Element}*/(testAreaNode.firstElementChild));
        newCanvas.setOdfContainer(odfContainer);
        return newCanvas;
    };

}());


