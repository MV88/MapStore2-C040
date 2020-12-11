module.exports = ({proxy}) => ({
    proxy: {
        ...proxy,
        '/rest/geostore': {
            target: "http://vm-linuxgeofetest.comune.genova.it",
            pathRewrite: {'^/rest/geostore': '/MapStore2/rest/geostore'}
        },
        '/MapStore2/proxy': {
            target: "http://vm-linuxgeofetest.comune.genova.it"
        },
        '/pdf': {
            target: "http://vm-linuxgeofetest.comune.genova.it/MapStore2"
        },
        '/MapStore2/pdf': {
            target: "http://vm-linuxgeofetest.comune.genova.it"
        },
        '/geoserver/': {
            target: "https://mappe.comune.genova.it",
            secure: false,
            headers: {
                host: "mappe.comune.genova.it"
            }
        },
        '/geoserver-test/': {
            target: "http://vm-linuxgeofetest.comune.genova.it"
        },
        '/geonetwork': {
            target: "https://mappe.comune.genova.it",
            secure: false,
            headers: {
                host: "mappe.comune.genova.it"
            }
        },
        '/geofence': {
            target: "http://vm-linuxgeofetest.comune.genova.it"
        }
    }
});
