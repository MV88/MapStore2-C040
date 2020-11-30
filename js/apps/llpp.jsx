/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import { startLoading, updateFeatureLoader } from '@js/epics/featureloader';
import { ensureIntl } from '@mapstore/framework/utils/LocaleUtils';
import StandardApp from '@mapstore/framework/components/app/StandardApp';
import appConfigllpp from '@js/appConfigllpp';
import StandardRouter from '@mapstore/framework/components/app/StandardRouter';
import StandardStore from '@mapstore/framework/stores/StandardStore';
import {
    standardReducers,
    standardEpics,
    standardRootReducerFunc
} from '@mapstore/framework/stores/defaultOptions';
import maps from '@mapstore/framework/reducers/maps';
import security from '@mapstore/framework/reducers/security';

const startApp = () => {
    const { pages, pluginsDef, initialState, storeOpts, printingEnabled } = appConfigllpp;
    const routerSelector = createSelector(state => state.locale, (locale) => ({
        locale: locale || {},
        version: "no-version",
        themeCfg: {
            theme: "comge",
            path: __MAPSTORE_PROJECT_CONFIG__.themePath
        },
        pages
    }));
    const ConnectedStandardRouter = connect(routerSelector)(StandardRouter);
    const appStore = StandardStore.bind(null, {
        initialState,
        appReducers: {
            ...standardReducers,
            mode: (state = 'embedded') => state,
            maps,
            security
        },
        appEpics: {
            ...standardEpics,
            "FEATUREVIEWER:startLoading": startLoading,
            "FEATUREVIEWER:updateFeatureLoader": updateFeatureLoader
        },
        rootReducerFunc: standardRootReducerFunc
    });
    const appConfig = {
        appStore,
        storeOpts,
        pluginsDef,
        initialActions: [],
        appComponent: ConnectedStandardRouter,
        printingEnabled
    };
    ReactDOM.render(
        <StandardApp {...appConfig} mode="desktop"/>,
        document.getElementById('container')
    );
};
if (!global.Intl ) {
    // Ensure Intl is loaded, then call the given callback
    ensureIntl(startApp);
} else {
    startApp();
}
