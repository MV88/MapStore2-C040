/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/
const React = require('react');
const PropTypes = require('prop-types');
const AttributeEditor = require('../../MapStore2/web/client/components/data/featuregrid/editors/AttributeEditor');
// const AsyncCombobox = require('../../MapStore2/web/client/components/misc/combobox/AsyncCombobox');
const {AutocompleteCombobox} = require('../../MapStore2/web/client/components/misc/AutocompleteCombobox');
const {createIndirizziStream} = require('../observables/asyncStream');


class IndirizziEditor extends AttributeEditor {
    static propTypes = {
        column: PropTypes.object,
        dataType: PropTypes.string,
        defaultOption: PropTypes.string,
        forceSelection: PropTypes.bool,
        allowEmpty: PropTypes.bool,
        inputProps: PropTypes.object,
        isValid: PropTypes.func,
        onBlur: PropTypes.func,
        typeName: PropTypes.string,
        url: PropTypes.string,
        value: PropTypes.string,
        values: PropTypes.array
    };
    static defaultProps = {
        isValid: () => true,
        dataType: "string",
        values: [],
        forceSelection: true,
        allowEmpty: true
    };
    constructor(props) {
        super(props);
        this.validate = (value) => {
            try {
                return this.props.isValid(value[this.props.column && this.props.column.key]);
            } catch (e) {
                return false;
            }
        };
        this.getValue = () => {
            const updated = super.getValue();
            return updated;
        };
    }
    render() {
        /*const data = this.props.values.map(v => {return {label: v, value: v}; });

        const props = assign({}, {...this.props}, {
            data,
            defaultOption: this.props.defaultOption || head(this.props.values),
            autocompleteStreamFactory: createIndirizziStream
        });*/
        return <AutocompleteCombobox {...this.props} filter="contains" autocompleteStreamFactory={createIndirizziStream} valueField="CODICE_CONTROLLO"/>;
        // return <AsyncCombobox {...this.props} filter="contains" autocompleteStreamFactory={createIndirizziStream}/>;
    }
}

module.exports = IndirizziEditor;
