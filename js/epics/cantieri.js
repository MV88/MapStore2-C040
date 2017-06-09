/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const Rx = require('rxjs');
const area = require('@turf/area');
const {CLICK_ON_MAP} = require('../../MapStore2/web/client/actions/map');
const requestBuilder = require('../../MapStore2/web/client/utils/ogc/WFS/RequestBuilder');
const {filter, and, property} = requestBuilder({wfsVersion: "1.1.0"});
const {error, info, success} = require('../../MapStore2/web/client/actions/notifications');
const {featureToRow, isSameFeature, checkFeature, uncheckFeature, getAreaFilter, isActiveTool,
    removeFeature, clearAllFeatures, getAreasLayer, getElementsLayer, getAreasGeometry,
    addFeaturesToElementLayer, showQueryElementsError, getElementsFilter, addFeatureToAreaLayer,
    replaceFeatures, getCheckedElementsFromLayer
} = require('../utils/CantieriUtils');
const axios = require('../../MapStore2/web/client/libs/ajax');
const {addLayer, changeLayerProperties} = require('../../MapStore2/web/client/actions/layers');
const {changeDrawingStatus, END_DRAWING} = require('../../MapStore2/web/client/actions/draw');

const {reprojectGeoJson} = require('../../MapStore2/web/client/utils/CoordinatesUtils');
const {
    ERROR_LOAD_CANTIERI_AREAS, ERROR_RESET_CANTIERI_FEATURES, ERROR_REMOVE_CANTIERI_AREA, FETCH_CANTIERI_FEATURES,
    REMOVE_CANTIERI_AREA, RESET_CANTIERI_FEATURES, QUERY_ELEMENTS_FEATURES, ELEMENTS_LAYER, AREAS_LAYER, ROWS_SELECTED, ROWS_DESELECTED, SAVE_CANTIERI_DATA, dataSaved, queryElements, ERROR_DRAWING_AREAS, SUCCESS_SAVING, savingData, loadingData
} = require('../actions/cantieri');

const {getWFSFilterData} = require('../../MapStore2/web/client/epics/wfsquery');
const {transaction, describeFeatureType} = require('../api/WFST');
const {getTypeName} = require('../../MapStore2/web/client/utils/ogc/WFS/base');
const {insert, deleteFeaturesByFilter} = require('../../MapStore2/web/client/utils/ogc/WFST');

const getWFSFeature = (searchUrl, filterObj) => {
    const data = getWFSFilterData(filterObj);
    return Rx.Observable.defer( () =>
        axios.post(searchUrl + '?service=WFS&outputFormat=json&request=getFeature', data, {
          timeout: 10000,
          headers: {'Accept': 'application/json', 'Content-Type': 'application/xml'}
     }));
};

const getLayer = (props) => {
    return {
        "group": props.group,
        "name": props.name,
        "id": props.id,
        "title": props.title,
        "type": "vector",
        "features": props.features,
        "visibility": true,
        "crs": props.projection,
        "featuresCrs": props.projection,
        "style": props.style
    };
};

var areaCount = 0;
const getSpatialFilter = (geometry, options, operation = "INTERSECTS") => {
    return {
        spatialField: {
            operation: operation,
            attribute: "GEOMETRY",
            geometry
        },
        "filterType": "OGC",
        "ogcVersion": "1.1.0",
        ...options
    };
};

const createAndAddLayers = (areasFeatures, store, checkedElementsFeatures) => {
    let actions = [];
    let areaOptions = {
        features: areasFeatures,
        group: "Cantiere",
        title: "Aree",
        id: AREAS_LAYER,
        name: "CORSO_1:AREE_CANTIERE",
        style: {
            type: "MultiPolygon",
            stroke: {
                color: 'blue',
                width: 3
            },
            fill: {
                color: [0, 0, 0, 0]
            }
        },
        projection: store.getState().map.present.projection
    };
    let elementiOptions = {
        features: checkedElementsFeatures,
        group: "Cantiere",
        title: "Elementi Selezionati",
        id: ELEMENTS_LAYER,
        name: "cantiere_elements",
        style: {
            "type": "MultiPolygon",
            "stroke": {
                color: 'red',
                width: 1
            },
            "fill": {
                color: [100, 100, 100, 0.1]
            }
        },
        projection: store.getState().map.present.projection
    };
    actions.push(addLayer(getLayer(areaOptions)));
    actions.push(addLayer(getLayer(elementiOptions)));

    // load elements inside areas
    /*const options = {
        "featureTypeName": store.getState().cantieri.elementsLayerName
    };*/
    // let areasGeometry = reprojectGeoJson(getAreasGeometry(areasFeatures), store.getState().map.present.projection);
    /*if (areasGeometry.coordinates.length > 0 ) {
        actions.push(queryElements(getSpatialFilter(areasGeometry, {"featureTypeName": store.getState().cantieri.elementsLayerName}, "WITHIN"), false));
    }*/
    // updates draw support interaction
    actions.push(changeDrawingStatus("cleanAndContinueDrawing", "", "LavoriPubblici", [], {}));
    return Rx.Observable.from(actions);
};


module.exports = {
    updateCantieriByClick: ( action$, store ) =>
        action$.ofType(CLICK_ON_MAP)
            .filter(() => isActiveTool("pointSelection", store))
            .switchMap( (action) => {
                const geometry = {
                    type: "Point",
                    coordinates: [action.point.latlng.lng, action.point.latlng.lat]
                };
                return getWFSFeature(store.getState().cantieri.geoserverUrl, getSpatialFilter(geometry, {
                "featureTypeName": store.getState().cantieri.elementsLayerName}))
                    .switchMap((response) => {
                        if (response.data && response.data.features) {
                            const elementsLayer = getElementsLayer(store);
                            let featureByClick = response.data.features
                                .filter(f => elementsLayer.features.findIndex(f2 => isSameFeature(f, f2)) < 0);
                            if (elementsLayer !== undefined && featureByClick.length > 0) {
                                featureByClick = featureByClick.reduce((candidate, cur) => {
                                    // get the feature with the smaller area (it is usually the wanted one when you click)
                                    if (candidate) {
                                        if (cur.geometry.type === "Polygon" || cur.geometry.type === "MultiPolygon") {
                                            // turf miscalculate the area if the coords are not in 4326
                                            return area(candidate) > area(cur) ? cur : candidate;
                                        }
                                    }
                                    return cur;
                                });
                                featureByClick = reprojectGeoJson(featureByClick, "EPSG:4326", store.getState().map.present.projection);
                                let layerFeatures = elementsLayer.features.filter(f => f.id !== featureByClick.id);
                                return replaceFeatures(layerFeatures.concat(
                                    [featureByClick].map(checkFeature)
                                ), elementsLayer);
                            }
                            if (elementsLayer !== undefined && response.data.features.length === 0) {
                                return Rx.Observable.of(info({
                                    title: "warning",
                                    message: "cantieriGrid.notification.noFeaturesSelected",
                                    action: {
                                        label: "cantieriGrid.notification.confirm"
                                    },
                                    autoDismiss: 3,
                                    position: "tc"
                                }));
                            }
                        }
                        return Rx.Observable.of(info({
                            title: "warning",
                            message: "cantieriGrid.notification.elementAlreadyPresent",
                            action: {
                                label: "cantieriGrid.notification.confirm"
                            },
                            autoDismiss: 3,
                            position: "tc"
                        }));
                    });
            }),
    updateCantieriAreaLayer: ( action$, store ) =>
        action$.ofType(END_DRAWING)
        .filter((action) => action.owner === "LavoriPubblici")
        .switchMap( (action) => {
            let cantieriState = store.getState().cantieri;
            let areasLayer = getAreasLayer(store);
            let feature = {
                type: "Feature",
                geometry: {
                    coordinates: action.geometry.coordinates,
                    type: "Polygon"
                },
                id: "area_0",
                geometry_name: cantieriState.geometry_name,
                properties: {
                    "ID_ELEMENTO": areaCount++,
                    "ID_CANTIERE": cantieriState.id,
                    "TIPOLOGIA": cantieriState.typology
                },
                index: 0
            };
            const options = {
                pagination: {
                    maxFeatures: cantieriState.maxFeatures
                },
                "featureTypeName": cantieriState.elementsLayerName
            };
            const f4326 = reprojectGeoJson(feature, store.getState().map.present.projection, "EPSG:4326");
            const f = getSpatialFilter(f4326.geometry, options, "WITHIN");
            if (areasLayer !== undefined) {
                return addFeatureToAreaLayer(feature, areasLayer).concat(Rx.Observable.of(queryElements(f, true)));
            }

            return Rx.Observable.of(error({
                uid: ERROR_DRAWING_AREAS,
                title: "warning",
                message: "cantieriGrid.notification.errorDrawingAreas",
                action: {
                    label: "cantieriGrid.notification.confirm"
                },
                autoDismiss: 3,
                position: "tr"
            }));
        }),
    deleteCantieriAreaFeature: ( action$, store ) =>
        action$.ofType(REMOVE_CANTIERI_AREA)
        .switchMap( (action) => {
            let areasLayer = getAreasLayer(store);
            if (areasLayer !== undefined) {
                return removeFeature(action.area, areasLayer);
            }
            return Rx.Observable.of(error({
                uid: ERROR_REMOVE_CANTIERI_AREA,
                title: "warning",
                message: "cantieriGrid.notification.removeFeatureError",
                action: {
                    label: "cantieriGrid.notification.confirm"
                },
                autoDismiss: 3,
                position: "tr"
            }));
        }),
    resetCantieriFeatures: ( action$, store ) =>
        action$.ofType(RESET_CANTIERI_FEATURES)
        .switchMap( () => {
            let areasLayer = getAreasLayer(store);
            let elementsLayer = getAreasLayer(store);
            if (areasLayer !== undefined && elementsLayer !== undefined) {
                return clearAllFeatures();
            }
            return Rx.Observable.of(error({
                uid: ERROR_RESET_CANTIERI_FEATURES,
                title: "warning",
                message: "cantieriGrid.notification.resetCantieriFeaturesError",
                action: {
                    label: "cantieriGrid.notification.confirm"
                },
                autoDismiss: 3,
                position: "tr"
            }));
        }),
    updateCantieriElementsFeatures: ( action$, store ) =>
        action$.ofType(QUERY_ELEMENTS_FEATURES)
        .switchMap( (action) => {
            let elementsLayer = getElementsLayer(store);
            let areasLayer = getAreasLayer(store);
            if (elementsLayer !== undefined && areasLayer !== undefined) {
                return getWFSFeature(store.getState().cantieri.geoserverUrl, action.filter)
                    .switchMap((response) => {
                        if (response.data && response.data.features && response.data.features.length > 0) {
                            let newFeatures = response.data.features.map(f => {
                                return reprojectGeoJson(f, "EPSG:4326", store.getState().map.present.projection);
                            }).filter(f => elementsLayer.features.findIndex(f2 => isSameFeature(f, f2)) < 0);
                            return addFeaturesToElementLayer(
                                elementsLayer,
                                areasLayer,
                                newFeatures.map(checkFeature),
                                response.data.totalFeatures,
                                store.getState().cantieri.maxFeatures,
                                action.check);
                        }
                        return showQueryElementsError();
                    });
            }
            return showQueryElementsError();
        }),
    fetchCantieriAreaFeatures: ( action$, store ) =>
        action$.ofType(FETCH_CANTIERI_FEATURES)
            .switchMap( () => {
                const cantieriState = store.getState().cantieri;
                return Rx.Observable.forkJoin(
                    // fetch areas features
                    getWFSFeature(cantieriState.geoserverUrl, getAreaFilter(cantieriState.id, cantieriState.typology, cantieriState.areasLayerName))
                        .switchMap((response) => {
                            if (response.data && response.data.features && response.data.features.length > 0) {
                                let areasFeatures = response.data.features.map(f => {
                                    return reprojectGeoJson(f, "EPSG:4326", store.getState().map.present.projection);
                                });
                                return Rx.Observable.of(areasFeatures);

                            }
                            if (response.data.features.length === 0) {
                                return Rx.Observable.of([]);
                            }
                            return Rx.Observable.of(error({
                                uid: ERROR_LOAD_CANTIERI_AREAS,
                                title: "warning",
                                message: "cantieriGrid.notification.errorLoadCantieriAreas",
                                action: {
                                    label: "cantieriGrid.notification.confirm"
                                },
                                autoDismiss: 3,
                                position: "tr"
                            }));
                        }),
                    // fetch checked elements features
                    Rx.Observable.fromPromise(axios.post(store.getState().cantieri.geoserverUrl + '?service=WFS&outputFormat=json&request=getFeature', getElementsFilter(store.getState().cantieri.checkedElements, store.getState().cantieri.elementsLayerName), {
                                    timeout: 60000,
                                    headers: {'Accept': 'application/json', 'Content-Type': 'application/json'}
                                }).then(r => r.data.features))
                ).concatMap(([areas, elements]) => {
                    return getWFSFeature(store.getState().cantieri.geoserverUrl,
                    getSpatialFilter(reprojectGeoJson(getAreasGeometry(areas), store.getState().map.present.projection), {"featureTypeName": store.getState().cantieri.elementsLayerName}, "WITHIN"), false)
                    .map((response) => {
                        if (response.data && response.data.features && response.data.features.length > 0) {
                            let newFeatures = response.data.features.filter(f => elements.findIndex(f2 => isSameFeature(f, f2)) < 0 )
                            .map( f => uncheckFeature(f))
                            .concat(elements.map(checkFeature))
                            .map(f => {
                                return reprojectGeoJson(f, "EPSG:4326", store.getState().map.present.projection);
                            });
                            return [areas, newFeatures];
                        }
                    }).concatMap((res) => createAndAddLayers(res[0], store, res[1]));
                }).startWith(loadingData(true))
                .concat([loadingData(false)])
                .catch( () => {
                    return Rx.Observable.of(error({
                        uid: ERROR_LOAD_CANTIERI_AREAS,
                        title: "warning",
                        message: "cantieriGrid.notification.errorLoadCantieriAreas",
                        action: {
                            label: "cantieriGrid.notification.confirm"
                        },
                        autoDismiss: 3,
                        position: "tr"
                    }));
                });
            }),
    updateCantieriElementsStyle: ( action$, store ) =>
        action$.ofType(ROWS_SELECTED, ROWS_DESELECTED).switchMap( action => {
            {
                const modifyFeatures = (f) => {
                    const rowIndex = action.rows.findIndex(r => r.row.key === featureToRow(f).key);
                    if (rowIndex >= 0) {
                        if ( action.type === ROWS_SELECTED) {
                            return checkFeature(f);
                        }
                        return uncheckFeature(f);

                    }
                    return f;
                };
                const layer = getElementsLayer(store);
                let features = layer.features.map(modifyFeatures);

                return Rx.Observable.of(changeLayerProperties(layer.id, {features}));
            }
        }),
    saveCantieriAreas: (action$, store) =>
            action$.ofType(SAVE_CANTIERI_DATA)
                .throttleTime(2000)
                .switchMap( () => {
                    const cantierState = store.getState().cantieri;
                    return Rx.Observable.defer( () => describeFeatureType(cantierState.geoserverUrl, getAreasLayer(store).name ) )
                    .switchMap(describe => transaction(cantierState.geoserverUrl,
                            [
                                // SOME PROBLEM ON SERVER SIDE DO NOT ALLOW TO SAVE
                                deleteFeaturesByFilter(
                                        filter(and(property("ID_CANTIERE").equalTo(cantierState.id), property("TIPOLOGIA").equalTo(cantierState.typology))),
                                    getTypeName(describe)
                                ),
                                insert(reprojectGeoJson({type: "FeatureCollection", features: getAreasLayer(store).features}, store.getState().map.present.projection, "EPSG:4326"), describe)
                            ],
                            describe
                        ))
                    .map(() => success({
                            uid: SUCCESS_SAVING,
                            title: "warning",
                            message: "cantieriGrid.notification.successSaving",
                            action: {
                            label: "cantieriGrid.notification.confirm"
                        },
                        autoDismiss: 3,
                        position: "tc"
                    }))
                    .map(() => dataSaved(getCheckedElementsFromLayer(getElementsLayer(store)), cantierState.id, cantierState.typology ))
                    .startWith(savingData(true))
                    .concat([savingData(false)])
                    .catch( () => Rx.Observable.of(error({
                        title: "warning",
                        message: "cantieriGrid.notification.errorSavingData",
                        action: {
                            label: "cantieriGrid.notification.confirm"
                        },
                        autoDismiss: 3,
                        position: "tr"
                    })));
                }
            )
};
