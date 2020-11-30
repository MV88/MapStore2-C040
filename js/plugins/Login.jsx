/*
 * Copyright 2017, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React  from 'react';
import {Glyphicon}  from 'react-bootstrap';
import {UserDetails, PasswordReset }  from '@mapstore/framework/plugins/login/index';
import Login  from './LoginModal';
import PropTypes  from 'prop-types';


import {connect, createPlugin}  from '@mapstore/framework/utils/PluginsUtils';
import {setControlProperty}  from '@mapstore/framework/actions/controls';
import {logoutWithReload}  from '@mapstore/framework/actions/security';
import security from '@mapstore/framework/reducers/security';
import epics from '@mapstore/framework/epics/login';
import UserMenuComponent from '../components/UserMenu';
import '@mapstore/framework/plugins/login/login.css';
/**
  * Login Plugin. Allow to login/logout or show user info and reset password tools
  * @class Login
  * @memberof plugins
  * @static
  *
  * @prop {string} cfg.id identifier of the Plugin, by default `"mapstore-login-menu"`
  * @prop {object} cfg.menuStyle inline style for the menu, by defualt:
  * ```
  * menuStyle: {
  *      zIndex: 30
  * }
  *```
  */

const UserMenu = connect((state) => ({
    user: state.security && state.security.user
}), {
    onShowLogin: setControlProperty.bind(null, "LoginForm", "enabled", true, true),
    onShowAccountInfo: setControlProperty.bind(null, "AccountInfo", "enabled", true, true),
    onShowChangePassword: setControlProperty.bind(null, "ResetPassword", "enabled", true, true),
    onLogout: logoutWithReload
})(UserMenuComponent);

const LoginNav = connect((state) => ({
    user: state.security && state.security.user,
    nav: false,
    renderButtonText: false,
    renderButtonContent: () => {return <Glyphicon glyph="user" />; },
    bsStyle: "primary",
    className: "square-button"
}), {
    onShowLogin: setControlProperty.bind(null, "LoginForm", "enabled", true, true),
    onShowAccountInfo: setControlProperty.bind(null, "AccountInfo", "enabled", true, true),
    onShowChangePassword: setControlProperty.bind(null, "ResetPassword", "enabled", true, true),
    onLogout: logoutWithReload
})(UserMenuComponent);

class LoginTool extends React.Component {
    static propTypes = {
        id: PropTypes.string,
        menuStyle: PropTypes.object
    }
    static defaultProps = {
        id: "mapstore-login-menu",
        menuStyle: {
            zIndex: 30
        }
    }
    render() {
        return (<div id={this.props.id}>
            <div style={this.props.menuStyle}>
                <UserMenu />
            </div>
            <UserDetails />
            <PasswordReset />
            <Login />
        </div>);
    }
}

export default createPlugin('Login', {
    component: LoginTool,
    containers: {
        OmniBar: {
            name: "login",
            position: 3,
            tool: LoginNav,
            tools: [UserDetails, PasswordReset, Login],
            priority: 1
        }
    },
    reducers: {
        security
    },
    epics
});
