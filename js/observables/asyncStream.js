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
const {getParsedUrl} = require('../../MapStore2/web/client/utils/ConfigUtils');
const {generateTemplateString} = require('../../MapStore2/web/client/utils/TemplateUtils');

/**
 * creates a stream for fetching data via WPS with a customized CQL filter
 * @param  {external:Observable} props
 * @return {external:Observable} the stream used for fetching data for the Indirizzi editor
*/

const textIntoFilter = ({searchText, staticFilter, blacklist, item, queriableAttributes, predicate} ) => {
    // split into words and remove blacklisted words
    const staticFilterParsed = generateTemplateString(staticFilter || "")(item);
    let searchWords = searchText.split(" ").filter(w => w).filter( w => blacklist.indexOf(w.toLowerCase()) < 0 );

    // if the array searchWords is empty, then use the full searchText
    if (searchWords.length === 0 ) {
        searchWords = !!searchText ? [searchText] : [];
    }
    let filter;
    if (searchWords.length > 0 ) {
        /*    filter = "(".concat( `${queriableAttributes[0]} ${predicate} '%${searchWords[0].replace("'", "''")}%'`).concat(`${searchWords[1]} ${predicate} '%${searchWords[1].replace("'", "''")}%'`)
        .join(" OR ")).join(') AND (')).concat(")");*/

        filter = "(".concat( searchWords.map( (w) => queriableAttributes.map( attr => `${attr} ${predicate} '%${w.replace("'", "''")}%'`).join(" OR ")).join(') AND (')).concat(")");
    }

    filter = filter ? filter.concat(staticFilterParsed) : staticFilterParsed || null;
    return filter;
};

const createIndirizziStream = (props$) => props$
    .switchMap((p) => {
        if (p.performFetch) {

            let serviceOptions = assign({},
                {url: getParsedUrl(p.url, {service: "WFS"}, "wfs"),
                typeName: "SITGEO:CIVICI_COD_TOPON",
                queriableAttributes: ["DESVIA", "TESTO"],
                outputFormat: "application/json",
                predicate: "ILIKE",
                staticFilter: "",
                blacklist: ["via", "viale", "piazza"],
                textIntoFilter,
                item: {},
                params: {
                    timeout: 60000,
                    headers: {'Accept': 'application/json', 'Content-Type': 'application/xml'}
                }
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
