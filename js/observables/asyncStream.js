/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/

const Rx = require('rxjs');
const {API} = require('../../MapStore2/web/client/api/searchText');
const assign = require('object-assign');
const {isNil} = require('lodash');
const {generateTemplateString} = require('../../MapStore2/web/client/utils/TemplateUtils');
var url = require('url');
const {endsWith} = require('lodash');

/**
 * creates a stream for fetching data via WPS with a customized CQL filter
 * @param  {external:Observable} props
 * @return {external:Observable} the stream used for fetching data for the Indirizzi editor
*/

const fromTextToFilter = ({searchText, staticFilter, blacklist, item} ) => {
    const staticFilterParsed = generateTemplateString(staticFilter || "")(item);
    const regAddress = /^([a-zA-Z\s'\\\é\è\ò\à\ù\ì]*)/g;
    const regCivic = /(\d{1,4}[a-zA-Z]{0,2})/g;
    const regCCode = /([a-zA-Z]?\d){0,10}/g;
    let searchWords = searchText.split(" ").filter(w => w).filter( w => blacklist.indexOf(w.toLowerCase()) < 0 );

    let matchedAddress = regAddress.exec(searchWords.join(""));
    let matchedCivic = regCivic.exec(searchText);
    let matchedCCode = regCCode.exec(searchText);
    let matches = [];
    let filter = "( ";
    if (!isNil(matchedAddress) && matchedAddress[0] !== "" ) {
        matches.push("DESVIA ILIKE " + `'%${matchedAddress[0]}%'`);
    }
    if (!isNil(matchedCivic) && matchedCivic[0] !== "" ) {
        matches.push("TESTO ILIKE " + `'%${matchedCivic[0]}%'`);
    }
    // no match case
    if (matches.length === 0 && !isNil(matchedCCode) && matchedCCode[0] === "") {
        return staticFilterParsed || null;
    }
    if (matches.length === 2) {
        filter += matches.join( " AND ");
    }
    if (matches.length === 1) {
        filter += matches[0];
    }
    if (!isNil(matchedCCode) && matchedCCode[0] !== "" ) {
        filter += " OR CODICE_CONTROLLO ILIKE " + `'%${matchedCCode[0]}%'`;
    }
    filter += ")";
    filter = filter ? filter.concat(staticFilterParsed) : staticFilterParsed || null;
    return filter;
};

const createIndirizziStream = (props$) => props$
    .throttle(props => Rx.Observable.timer(props.delayDebounce || 0))
    .merge(props$.debounce(props => Rx.Observable.timer(props.delayDebounce || 0)))
    .switchMap((p) => {
        if (p.performFetch) {

            let parsed = url.parse(p.url, true);
            let newPathname = "";
            if (endsWith(parsed.pathname, "wms") || endsWith(parsed.pathname, "ows") || endsWith(parsed.pathname, "wps")) {
                newPathname = parsed.pathname.replace(/(wms|ows|wps)$/, "wfs");
            }
            if ( !!parsed.query && !!parsed.query.service) {
                delete parsed.query.service;
            }
            const urlParsed = url.format(assign({}, parsed, {search: null, pathname: newPathname }));
            let serviceOptions = assign({},
                {url: urlParsed,
                typeName: "SITGEO:CIVICI_COD_TOPON",
                queriableAttributes: ["DESVIA", "TESTO"],
                outputFormat: "application/json",
                predicate: "ILIKE",
                staticFilter: "",
                blacklist: ["via", "viale", "piazza"],
                fromTextToFilter,
                item: {},
                timeout: 60000,
                headers: {'Accept': 'application/json', 'Content-Type': 'application/xml'},
                maxFeatures: 5,
                ...parsed.query
            });
            return Rx.Observable.fromPromise((API.Utils.getService("wfs")(p.value, serviceOptions)
                .then( features => {
                    return {fetchedData: { values: features.map(f => f.properties)}, busy: false};
                }))).catch(() => {
                    return Rx.Observable.of({fetchedData: {values: [], size: 0}, busy: false});
                }).startWith({busy: true});
        }
        return Rx.Observable.of({fetchedData: {values: [], size: 0}, busy: false});
    }).startWith({});


module.exports = {
    createIndirizziStream
};
